import { randomUUID } from 'crypto'
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'

import { SetupService } from './setup.service.js'
import { validatePasswordStrength } from '../../shared/security/password.js'
import { createApiError, createErrorResponse, createSuccessResponse, ERROR_CODES } from '../../shared/utils/response.utils.js'

type SetupJobKind = 'migrate' | 'seed'
type SetupJobStatus = 'running' | 'success' | 'failed'

type SetupJob = {
    id: string
    kind: SetupJobKind
    status: SetupJobStatus
    logs: string[]
    createdAt: string
    updatedAt: string
    result?: unknown
    error?: string
}

type SetupRoutesService = Pick<
    SetupService,
    'getStatus' | 'isSetupLocked' | 'runMigrations' | 'runSeed' | 'createFirstAdmin' | 'finalizeSetup' | 'saveOrgInfo' | 'getOrgInfo'
>

export interface SetupRoutesOptions {
    pgClient: PgClient
    rootDir?: string
    appVersion?: string
    service?: SetupRoutesService
}

type RateWindow = {
    count: number
    resetAt: number
}

class InMemoryRateLimiter {
    private readonly windows = new Map<string, RateWindow>()

    consume(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSec: number } {
        const now = Date.now()
        const existing = this.windows.get(key)

        if (!existing || existing.resetAt <= now) {
            this.windows.set(key, {
                count: 1,
                resetAt: now + windowMs
            })
            return {
                allowed: true,
                remaining: Math.max(limit - 1, 0),
                retryAfterSec: Math.ceil(windowMs / 1000)
            }
        }

        if (existing.count >= limit) {
            return {
                allowed: false,
                remaining: 0,
                retryAfterSec: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
            }
        }

        existing.count += 1
        this.windows.set(key, existing)
        return {
            allowed: true,
            remaining: Math.max(limit - existing.count, 0),
            retryAfterSec: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
        }
    }
}

class SetupJobStore {
    private readonly jobs = new Map<string, SetupJob>()
    private readonly order: string[] = []

    constructor(
        private readonly maxJobs = 100,
        private readonly maxLogsPerJob = 2000
    ) { }

    create(kind: SetupJobKind): SetupJob {
        const now = new Date().toISOString()
        const job: SetupJob = {
            id: randomUUID(),
            kind,
            status: 'running',
            logs: [],
            createdAt: now,
            updatedAt: now
        }

        this.jobs.set(job.id, job)
        this.order.push(job.id)
        this.compact()
        return job
    }

    get(jobId: string): SetupJob | null {
        return this.jobs.get(jobId) ?? null
    }

    findRunning(kind: SetupJobKind): SetupJob | null {
        for (let index = this.order.length - 1; index >= 0; index -= 1) {
            const id = this.order[index]
            const job = this.jobs.get(id)
            if (job && job.kind === kind && job.status === 'running') {
                return job
            }
        }
        return null
    }

    appendLog(jobId: string, line: string): void {
        const job = this.jobs.get(jobId)
        if (!job) return

        const message = line.trim()
        if (!message) return

        job.logs.push(message)
        if (job.logs.length > this.maxLogsPerJob) {
            job.logs.splice(0, job.logs.length - this.maxLogsPerJob)
        }
        job.updatedAt = new Date().toISOString()
    }

    markSuccess(jobId: string, result: unknown): void {
        const job = this.jobs.get(jobId)
        if (!job) return
        job.status = 'success'
        job.result = result
        job.error = undefined
        job.updatedAt = new Date().toISOString()
    }

    markFailure(jobId: string, error: string): void {
        const job = this.jobs.get(jobId)
        if (!job) return
        job.status = 'failed'
        job.error = error
        job.updatedAt = new Date().toISOString()
    }

    private compact(): void {
        while (this.order.length > this.maxJobs) {
            const removed = this.order.shift()
            if (removed) {
                this.jobs.delete(removed)
            }
        }
    }
}

const adminBodySchema = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format').max(255),
    username: z
        .string()
        .trim()
        .min(3)
        .max(80)
        .regex(/^[A-Za-z0-9._@-]+$/)
        .optional(),
    password: z.string().min(1).max(128),
    locale: z.enum(['vi', 'en']).optional()
})

const finalizeBodySchema = z.object({
    allowSkipSeed: z.boolean().optional()
})

const jobParamsSchema = z.object({
    jobId: z.string().uuid()
})

function requestIdOf(request: FastifyRequest): string {
    return typeof request.id === 'string' ? request.id : String(request.id)
}

function validationDetails(error: z.ZodError): Record<string, string> {
    const details: Record<string, string> = {}
    for (const issue of error.issues) {
        const path = issue.path.join('.') || 'body'
        details[path] = issue.message
    }
    return details
}

async function sendIfSetupLocked(
    service: SetupRoutesService,
    request: FastifyRequest,
    reply: FastifyReply
): Promise<boolean> {
    const locked = await service.isSetupLocked()
    if (!locked) return false

    const requestId = requestIdOf(request)
    reply.status(403).send(
        createErrorResponse(createApiError.forbidden('Setup has already been finalized'), requestId)
    )
    return true
}

function enforceRateLimit(
    limiter: InMemoryRateLimiter,
    request: FastifyRequest,
    reply: FastifyReply,
    keyPrefix: string,
    limit: number,
    windowMs: number
): boolean {
    const key = `${keyPrefix}:${request.ip || 'unknown'}`
    const rate = limiter.consume(key, limit, windowMs)
    if (rate.allowed) {
        reply.header('x-ratelimit-remaining', String(rate.remaining))
        return true
    }

    const requestId = requestIdOf(request)
    reply
        .header('retry-after', String(rate.retryAfterSec))
        .status(429)
        .send(
            createErrorResponse(
                {
                    code: ERROR_CODES.RATE_LIMITED,
                    message: `Too many setup requests. Retry in ${rate.retryAfterSec}s`
                },
                requestId
            )
        )
    return false
}

function conflictFromErrorMessage(message: string): boolean {
    const normalized = message.toLowerCase()
    return normalized.includes('already exists') || normalized.includes('duplicate') || normalized.includes('unique')
}

export const setupRoutes: FastifyPluginAsync<SetupRoutesOptions> = async (
    fastify: FastifyInstance,
    opts
) => {
    const service =
        opts.service ??
        new SetupService(opts.pgClient, {
            rootDir: opts.rootDir,
            appVersion: opts.appVersion
        })

    const rateLimiter = new InMemoryRateLimiter()
    const jobs = new SetupJobStore()

    fastify.get('/status', async (request, reply) => {
        const status = await service.getStatus()
        reply.send(createSuccessResponse(status, requestIdOf(request)))
    })

    fastify.post('/migrate', async (request, reply) => {
        if (await sendIfSetupLocked(service, request, reply)) return
        if (!enforceRateLimit(rateLimiter, request, reply, 'setup:migrate', 10, 60_000)) return

        const running = jobs.findRunning('migrate')
        if (running) {
            reply.status(202).send(
                createSuccessResponse(
                    {
                        jobId: running.id,
                        status: running.status
                    },
                    requestIdOf(request)
                )
            )
            return
        }

        const job = jobs.create('migrate')
        jobs.appendLog(job.id, 'Starting migration run')

        void (async () => {
            try {
                const result = await service.runMigrations((line) => jobs.appendLog(job.id, line))
                jobs.appendLog(job.id, 'Migration run completed')
                jobs.markSuccess(job.id, result)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                jobs.appendLog(job.id, `Migration failed: ${message}`)
                jobs.markFailure(job.id, message)
            }
        })()

        reply.status(202).send(
            createSuccessResponse(
                {
                    jobId: job.id,
                    status: job.status
                },
                requestIdOf(request)
            )
        )
    })

    fastify.post('/seed', async (request, reply) => {
        if (await sendIfSetupLocked(service, request, reply)) return
        if (!enforceRateLimit(rateLimiter, request, reply, 'setup:seed', 6, 60_000)) return

        const running = jobs.findRunning('seed')
        if (running) {
            reply.status(202).send(
                createSuccessResponse(
                    {
                        jobId: running.id,
                        status: running.status
                    },
                    requestIdOf(request)
                )
            )
            return
        }

        const job = jobs.create('seed')
        jobs.appendLog(job.id, 'Starting deterministic seed run')

        void (async () => {
            try {
                const result = await service.runSeed((line) => jobs.appendLog(job.id, line))
                jobs.appendLog(job.id, 'Seed run completed')
                jobs.markSuccess(job.id, result)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                jobs.appendLog(job.id, `Seed failed: ${message}`)
                jobs.markFailure(job.id, message)
            }
        })()

        reply.status(202).send(
            createSuccessResponse(
                {
                    jobId: job.id,
                    status: job.status
                },
                requestIdOf(request)
            )
        )
    })

    fastify.get('/jobs/:jobId', async (request, reply) => {
        if (await sendIfSetupLocked(service, request, reply)) return

        const parsed = jobParamsSchema.safeParse(request.params)
        if (!parsed.success) {
            reply.status(400).send(
                createErrorResponse(
                    createApiError.validation('Invalid setup job id', validationDetails(parsed.error)),
                    requestIdOf(request)
                )
            )
            return
        }

        const job = jobs.get(parsed.data.jobId)
        if (!job) {
            reply.status(404).send(
                createErrorResponse(createApiError.notFound('Setup job', parsed.data.jobId), requestIdOf(request))
            )
            return
        }

        reply.send(createSuccessResponse(job, requestIdOf(request)))
    })

    fastify.post('/admin', async (request, reply) => {
        if (await sendIfSetupLocked(service, request, reply)) return
        if (!enforceRateLimit(rateLimiter, request, reply, 'setup:admin', 5, 10 * 60_000)) return

        const parsed = adminBodySchema.safeParse(request.body)
        if (!parsed.success) {
            reply.status(400).send(
                createErrorResponse(
                    createApiError.validation('Invalid admin payload', validationDetails(parsed.error)),
                    requestIdOf(request)
                )
            )
            return
        }

        const passwordValidation = validatePasswordStrength(parsed.data.password)
        if (!passwordValidation.valid) {
            reply.status(400).send(
                createErrorResponse(
                    createApiError.validation('Password does not meet complexity requirements', {
                        password: passwordValidation.issues.join('; ')
                    }),
                    requestIdOf(request)
                )
            )
            return
        }

        try {
            const result = await service.createFirstAdmin(parsed.data)
            reply.status(201).send(createSuccessResponse(result, requestIdOf(request)))
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const statusCode = conflictFromErrorMessage(message) ? 409 : 400
            const apiError =
                statusCode === 409 ? createApiError.conflict(message) : createApiError.badRequest(message)
            reply.status(statusCode).send(createErrorResponse(apiError, requestIdOf(request)))
        }
    })

    fastify.post('/finalize', async (request, reply) => {
        if (await sendIfSetupLocked(service, request, reply)) return
        if (!enforceRateLimit(rateLimiter, request, reply, 'setup:finalize', 6, 60_000)) return

        const parsed = finalizeBodySchema.safeParse(request.body ?? {})
        if (!parsed.success) {
            reply.status(400).send(
                createErrorResponse(
                    createApiError.validation('Invalid finalize payload', validationDetails(parsed.error)),
                    requestIdOf(request)
                )
            )
            return
        }

        try {
            const result = await service.finalizeSetup(parsed.data)
            reply.send(createSuccessResponse(result, requestIdOf(request)))
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            reply.status(400).send(createErrorResponse(createApiError.badRequest(message), requestIdOf(request)))
        }
    })

    const orgInfoBodySchema = z.object({
        name: z.string().trim().min(2).max(200),
        shortName: z.string().trim().min(1).max(20),
        address: z.string().trim().max(500).optional(),
        phone: z.string().trim().max(50).optional(),
        taxCode: z.string().trim().max(50).optional(),
        website: z.string().trim().max(200).optional(),
    })

    fastify.post('/org-info', async (request, reply) => {
        if (!enforceRateLimit(rateLimiter, request, reply, 'setup:org', 20, 60_000)) return

        const parsed = orgInfoBodySchema.safeParse(request.body)
        if (!parsed.success) {
            reply.status(400).send(
                createErrorResponse(
                    createApiError.validation('Invalid org info payload', validationDetails(parsed.error)),
                    requestIdOf(request)
                )
            )
            return
        }

        try {
            const result = await service.saveOrgInfo(parsed.data)
            reply.send(createSuccessResponse(result, requestIdOf(request)))
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            reply.status(400).send(createErrorResponse(createApiError.badRequest(message), requestIdOf(request)))
        }
    })

    fastify.get('/org', async (request, reply) => {
        const result = await service.getOrgInfo()
        reply.send(createSuccessResponse(result, requestIdOf(request)))
    })
}
