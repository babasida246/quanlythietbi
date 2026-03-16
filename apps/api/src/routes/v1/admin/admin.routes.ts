import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError
} from '../../../shared/errors/http-errors.js'
import { createSuccessResponse, calculatePagination } from '../../../shared/utils/response.utils.js'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import { hashPassword, validatePasswordStrength } from '../../../shared/security/password.js'

interface AdminRoutesOptions {
    pgClient?: PgClient
}

type UserRow = {
    id: string
    email: string
    name: string
    role: string
    is_active: boolean
    status: string
    last_login_at: Date | null
    created_at: Date
}

type AuditLogRow = {
    id: string
    correlation_id: string | null
    user_id: string | null
    action: string
    resource: string | null
    details: unknown
    created_at: Date
}

const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    search: z.string().trim().optional()
})

const listAuditLogsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    search: z.string().trim().optional()
})

const userCreateSchema = z.object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(255),
    password: z.string().min(1),
    role: z.string().trim().min(1).max(50).optional()
})

const userUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    role: z.string().trim().min(1).max(50).optional(),
    isActive: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
})

const resetPasswordSchema = z.object({
    newPassword: z.string().min(1)
})

const userIdParamsSchema = z.object({
    id: z.string().uuid()
})

const tableExistsCache = new WeakMap<PgClient, Map<string, { value: boolean; expiresAt: number }>>()
const TABLE_EXISTS_TTL_MS = 60_000

function cacheTableExists(pgClient: PgClient, tableName: string, value: boolean): void {
    const existing = tableExistsCache.get(pgClient) ?? new Map<string, { value: boolean; expiresAt: number }>()
    existing.set(tableName, { value, expiresAt: Date.now() + TABLE_EXISTS_TTL_MS })
    tableExistsCache.set(pgClient, existing)
}

function readTableExistsCache(pgClient: PgClient, tableName: string): boolean | null {
    const cache = tableExistsCache.get(pgClient)
    if (!cache) return null
    const item = cache.get(tableName)
    if (!item) return null
    if (item.expiresAt <= Date.now()) {
        cache.delete(tableName)
        return null
    }
    return item.value
}

async function tableExists(pgClient: PgClient, tableName: string): Promise<boolean> {
    const cached = readTableExistsCache(pgClient, tableName)
    if (cached !== null) return cached

    const result = await pgClient.query<{ found: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
        ) AS found
        `,
        [tableName]
    )
    const found = result.rows[0]?.found === true
    cacheTableExists(pgClient, tableName, found)
    return found
}

async function ensureTable(pgClient: PgClient, tableName: 'users' | 'audit_logs'): Promise<void> {
    if (await tableExists(pgClient, tableName)) return
    throw new ServiceUnavailableError(`Table '${tableName}' is not available. Complete setup/migrations first.`)
}

function mapUserRow(row: UserRow) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isActive: row.is_active,
        lastLogin: row.last_login_at ? row.last_login_at.toISOString() : undefined,
        createdAt: row.created_at.toISOString()
    }
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

function toOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function mapAuditLogRow(row: AuditLogRow) {
    const details = asRecord(row.details)
    const resourceId = toOptionalString(details?.resourceId) ?? toOptionalString(details?.resource_id)
    const ipAddress = toOptionalString(details?.ipAddress) ?? toOptionalString(details?.ip_address)
    const userAgent = toOptionalString(details?.userAgent) ?? toOptionalString(details?.user_agent)

    return {
        id: row.id,
        userId: row.user_id,
        action: row.action,
        resource: row.resource ?? 'unknown',
        resourceId,
        details,
        ipAddress,
        userAgent,
        createdAt: row.created_at.toISOString()
    }
}

function isPgUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

function isPgUndefinedColumn(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42703'
}

function buildRequestAuditDetails(request: FastifyRequest, extra?: Record<string, unknown>): Record<string, unknown> {
    const userAgentHeader = request.headers['user-agent']
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
    return {
        ipAddress: request.ip ?? null,
        userAgent: userAgent ?? null,
        ...(extra ?? {})
    }
}

async function appendAuditLog(
    pgClient: PgClient,
    request: FastifyRequest,
    input: {
        actorUserId: string | null
        action: string
        resource: string
        details?: Record<string, unknown>
    }
): Promise<void> {
    try {
        if (!(await tableExists(pgClient, 'audit_logs'))) return
        const correlationId = getUserContext(request).correlationId
        await pgClient.query(
            `
            INSERT INTO audit_logs (correlation_id, user_id, action, resource, details)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            `,
            [
                correlationId,
                input.actorUserId,
                input.action,
                input.resource,
                JSON.stringify(buildRequestAuditDetails(request, input.details))
            ]
        )
    } catch (error) {
        request.log.warn({ err: error }, 'Failed to append admin audit log')
    }
}

function assertNotSelfAction(currentUserId: string, targetUserId: string, action: string): void {
    if (currentUserId === targetUserId) {
        throw new ForbiddenError(`Cannot ${action} your own account`)
    }
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (
    fastify: FastifyInstance,
    opts
) => {
    const pgClient = opts.pgClient ?? fastify.pgClient
    if (!pgClient) {
        throw new Error('pgClient is required for admin routes')
    }

    fastify.get('/users', async (request, reply) => {
        await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'users')

        const query = listUsersQuerySchema.parse(request.query)
        const page = query.page
        const limit = query.limit
        const offset = (page - 1) * limit
        const search = query.search?.trim()

        const whereParts: string[] = []
        const params: Array<string | number> = []
        if (search) {
            params.push(`%${search.toLowerCase()}%`)
            whereParts.push(`(LOWER(email) LIKE $${params.length} OR LOWER(name) LIKE $${params.length})`)
        }
        const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

        const countResult = await pgClient.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM users ${whereSql}`,
            params
        )
        const total = Number(countResult.rows[0]?.total ?? 0)

        const listParams = [...params, limit, offset]
        const rows = await pgClient.query<UserRow>(
            `
            SELECT id, email, name, role, COALESCE(is_active, true) AS is_active, status, last_login_at, created_at
            FROM users
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT $${listParams.length - 1}
            OFFSET $${listParams.length}
            `,
            listParams
        )

        return reply.send(
            createSuccessResponse(
                rows.rows.map(mapUserRow),
                String(request.id),
                calculatePagination(page, limit, total)
            )
        )
    })

    fastify.post('/users', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'users')

        const body = userCreateSchema.parse(request.body)
        const passwordCheck = validatePasswordStrength(body.password)
        if (!passwordCheck.valid) {
            throw new BadRequestError('Password does not meet strength requirements', { issues: passwordCheck.issues })
        }

        const passwordHash = await hashPassword(body.password)
        const email = body.email.trim().toLowerCase()
        const name = body.name.trim()
        const role = body.role?.trim() || 'user'

        try {
            const inserted = await pgClient.query<UserRow>(
                `
                INSERT INTO users (email, name, password_hash, role, status, is_active)
                VALUES ($1, $2, $3, $4, 'active', true)
                RETURNING id, email, name, role, COALESCE(is_active, true) AS is_active, status, last_login_at, created_at
                `,
                [email, name, passwordHash, role]
            )
            const user = inserted.rows[0]

            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId,
                action: 'admin.user.create',
                resource: 'users',
                details: { resourceId: user.id, email: user.email, role: user.role }
            })

            return reply.status(201).send(createSuccessResponse(mapUserRow(user), String(request.id)))
        } catch (error) {
            if (isPgUniqueViolation(error)) {
                throw new ConflictError('User with the same email or username already exists')
            }
            throw error
        }
    })

    fastify.patch('/users/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'users')

        const { id } = userIdParamsSchema.parse(request.params)
        const body = userUpdateSchema.parse(request.body)

        if (body.isActive === false) {
            assertNotSelfAction(ctx.userId, id, 'disable')
        }

        const fields: string[] = []
        const params: Array<string | boolean> = []

        if (body.email !== undefined) {
            params.push(body.email.trim().toLowerCase())
            fields.push(`email = $${params.length}`)
        }
        if (body.name !== undefined) {
            params.push(body.name.trim())
            fields.push(`name = $${params.length}`)
        }
        if (body.role !== undefined) {
            params.push(body.role.trim())
            fields.push(`role = $${params.length}`)
        }
        if (body.isActive !== undefined) {
            params.push(body.isActive)
            fields.push(`is_active = $${params.length}`)
            params.push(body.isActive ? 'active' : 'inactive')
            fields.push(`status = $${params.length}`)
        }

        if (fields.length === 0) {
            throw new BadRequestError('No valid fields to update')
        }

        try {
            params.push(id)
            const result = await pgClient.query<UserRow>(
                `
                UPDATE users
                SET ${fields.join(', ')}, updated_at = NOW()
                WHERE id = $${params.length}
                RETURNING id, email, name, role, COALESCE(is_active, true) AS is_active, status, last_login_at, created_at
                `,
                params
            )

            if (result.rowCount === 0) {
                throw new NotFoundError('User not found')
            }

            const updated = result.rows[0]
            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId,
                action: 'admin.user.update',
                resource: 'users',
                details: {
                    resourceId: updated.id,
                    changedFields: Object.keys(body),
                    role: updated.role,
                    isActive: updated.is_active
                }
            })

            return reply.send(createSuccessResponse(mapUserRow(updated), String(request.id)))
        } catch (error) {
            if (isPgUniqueViolation(error)) {
                throw new ConflictError('User with the same email or username already exists')
            }
            throw error
        }
    })

    fastify.delete('/users/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'users')

        const { id } = userIdParamsSchema.parse(request.params)
        assertNotSelfAction(ctx.userId, id, 'delete')

        const result = await pgClient.query<{ id: string }>(
            `
            UPDATE users
            SET is_active = false,
                status = 'inactive',
                updated_at = NOW()
            WHERE id = $1
            RETURNING id
            `,
            [id]
        )

        if (result.rowCount === 0) {
            throw new NotFoundError('User not found')
        }

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'admin.user.deactivate',
            resource: 'users',
            details: { resourceId: id }
        })

        return reply.send(
            createSuccessResponse(
                { success: true },
                String(request.id)
            )
        )
    })

    fastify.post('/users/:id/reset-password', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'users')

        const { id } = userIdParamsSchema.parse(request.params)
        const body = resetPasswordSchema.parse(request.body)
        const passwordCheck = validatePasswordStrength(body.newPassword)
        if (!passwordCheck.valid) {
            throw new BadRequestError('Password does not meet strength requirements', { issues: passwordCheck.issues })
        }

        const passwordHash = await hashPassword(body.newPassword)
        const result = await pgClient.query<{ id: string }>(
            `
            UPDATE users
            SET password_hash = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING id
            `,
            [passwordHash, id]
        )

        if (result.rowCount === 0) {
            throw new NotFoundError('User not found')
        }

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'admin.user.reset_password',
            resource: 'users',
            details: { resourceId: id }
        })

        return reply.send(
            createSuccessResponse(
                { success: true, message: 'Password reset successful' },
                String(request.id)
            )
        )
    })

    // ─── RBAC Management (moved to /api/v1/admin/permissions/*) ───────────────
    // Endpoints /rbac/* have been consolidated into permission-center.routes.ts
    // at prefix /api/v1/admin/permissions/classic/*.  Do not re-add here.

    // ─── Audit Logs ────────────────────────────────────────────────────────────

    fastify.get('/audit-logs', async (request, reply) => {
        await requirePermission(request, 'admin:settings')
        await ensureTable(pgClient, 'audit_logs')

        const query = listAuditLogsQuerySchema.parse(request.query)
        const page = query.page
        const limit = query.limit
        const offset = (page - 1) * limit
        const search = query.search?.trim()

        const whereParts: string[] = []
        const params: Array<string | number> = []
        if (search) {
            params.push(`%${search.toLowerCase()}%`)
            whereParts.push(
                `(LOWER(action) LIKE $${params.length}
                  OR LOWER(COALESCE(resource, '')) LIKE $${params.length}
                  OR LOWER(COALESCE(user_id, '')) LIKE $${params.length})`
            )
        }
        const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

        const countResult = await pgClient.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM audit_logs ${whereSql}`,
            params
        )
        const total = Number(countResult.rows[0]?.total ?? 0)

        try {
            const listParams = [...params, limit, offset]
            const rows = await pgClient.query<AuditLogRow>(
                `
                SELECT id, correlation_id, user_id, action, resource, details, created_at
                FROM audit_logs
                ${whereSql}
                ORDER BY created_at DESC
                LIMIT $${listParams.length - 1}
                OFFSET $${listParams.length}
                `,
                listParams
            )

            return reply.send(
                createSuccessResponse(
                    rows.rows.map(mapAuditLogRow),
                    String(request.id),
                    calculatePagination(page, limit, total)
                )
            )
        } catch (error) {
            // Older schemas may not have some columns selected above (defensive fallback).
            if (isPgUndefinedColumn(error)) {
                const listParams = [...params, limit, offset]
                const rows = await pgClient.query<AuditLogRow>(
                    `
                    SELECT id, NULL::text AS correlation_id, user_id, action, resource, details, created_at
                    FROM audit_logs
                    ${whereSql}
                    ORDER BY created_at DESC
                    LIMIT $${listParams.length - 1}
                    OFFSET $${listParams.length}
                    `,
                    listParams
                )

                return reply.send(
                    createSuccessResponse(
                        rows.rows.map(mapAuditLogRow),
                        String(request.id),
                        calculatePagination(page, limit, total)
                    )
                )
            }
            throw error
        }
    })
}

