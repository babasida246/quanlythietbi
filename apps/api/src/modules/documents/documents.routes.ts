/**
 * Documents Module - Routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Pool } from 'pg'

import type { AuthService } from '../auth/auth.service.js'
import { AdminRepository } from '../admin/admin.repository.js'
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/errors/http-errors.js'
import {
    approvalActionSchema,
    bulkDocumentsSchema,
    createDocumentSchema,
    documentListQuerySchema,
    downloadParamsSchema,
    idParamSchema,
    updateDocumentSchema
} from './documents.schemas.js'
import { DocumentsRepository } from './documents.repository.js'
import { DocumentsService } from './documents.service.js'

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? process.env.ASSET_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')

const DOC_FILE_EXT_ALLOWLIST = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg', '.vsdx', '.md', '.txt'])
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'upload-secret'

const deleteBodySchema = z.object({
    reason: z.string().trim().min(1).optional()
})

type UploadTokenPayload = {
    documentId: string
    userId: string
    storageKey: string
    filename: string
    mimeType: string | null
    exp: number
}

function signUploadToken(payload: UploadTokenPayload): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = crypto.createHmac('sha256', UPLOAD_TOKEN_SECRET).update(data).digest('hex')
    return `${data}.${sig}`
}

function verifyUploadToken(token: string): UploadTokenPayload {
    const [data, sig] = token.split('.', 2)
    if (!data || !sig) {
        throw new BadRequestError('Invalid upload token')
    }
    const expected = crypto.createHmac('sha256', UPLOAD_TOKEN_SECRET).update(data).digest('hex')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        throw new ForbiddenError('Invalid upload token signature')
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as UploadTokenPayload
    if (!payload?.exp || payload.exp <= Date.now()) {
        throw new ForbiddenError('Upload token expired')
    }
    return payload
}

function sanitizeFileName(name: string): string {
    const base = path.basename(name)
    return base.replace(/[^\w.-]/g, '_')
}

function buildStorageKey(documentId: string, fileName: string): { storageKey: string; filePath: string } {
    const safeName = sanitizeFileName(fileName)
    const storageKey = path.posix.join('docs', documentId, `${crypto.randomUUID()}-${safeName || 'attachment'}`)
    const filePath = path.resolve(UPLOAD_ROOT, storageKey)
    return { storageKey, filePath }
}

export async function documentsRoutes(
    fastify: FastifyInstance,
    deps: { db: Pool; authService: AuthService }
): Promise<void> {
    const repo = new DocumentsRepository(deps.db)
    const service = new DocumentsService(repo)
    const adminRepo = new AdminRepository(deps.db)

    const authenticate = async (request: any) => {
        const authHeader = request.headers.authorization
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('Missing or invalid authorization header')
        }
        const token = authHeader.substring(7)
        request.user = deps.authService.verifyAccessToken(token)
    }

    const isAdmin = (request: any) => {
        const role = request.user?.role
        return role === 'admin' || role === 'super_admin'
    }

    const requireAdmin = (request: any) => {
        if (!isAdmin(request)) {
            throw new ForbiddenError('Insufficient role for this action')
        }
    }

    const audit = async (request: any, action: string, resourceId: string | undefined, details: Record<string, any>) => {
        try {
            await adminRepo.createAuditLog({
                userId: request.user?.sub,
                action,
                resource: 'docs',
                resourceId,
                details,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent']
            })
        } catch (error) {
            request.log.error({ error }, 'Failed to write docs audit log')
        }
    }

    // ==================== Documents CRUD ====================

    fastify.get('/docs', {
        schema: {
            tags: ['Documents'],
            summary: 'List documents',
            security: [{ bearerAuth: [] }],
            querystring: zodToJsonSchema(documentListQuerySchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        const query = documentListQuerySchema.parse(request.query)
        // Non-admin users only see approved docs.
        const effectiveQuery = isAdmin(request) ? query : { ...query, status: 'approved' as const }
        const { data, total } = await service.list(effectiveQuery)
        return reply.send({
            data,
            meta: {
                page: effectiveQuery.page,
                pageSize: effectiveQuery.pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / effectiveQuery.pageSize))
            }
        })
    })

    fastify.post('/docs', {
        schema: {
            tags: ['Documents'],
            summary: 'Create document (draft)',
            security: [{ bearerAuth: [] }],
            body: zodToJsonSchema(createDocumentSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const body = createDocumentSchema.parse(request.body)
        const actor = request.user?.sub ?? 'system'
        const created = await service.create(body, actor)
        await audit(request, 'docs.create', created.id, { type: created.type, title: created.title, visibility: created.visibility })
        return reply.status(201).send({ data: created })
    })

    fastify.get('/docs/:id', {
        schema: {
            tags: ['Documents'],
            summary: 'Get document by ID',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        const { id } = idParamSchema.parse(request.params)
        const doc = await service.get(id)

        if (!isAdmin(request)) {
            if (doc.approval.status !== 'approved') throw new ForbiddenError('Document is not approved')
            if (doc.visibility === 'private') throw new ForbiddenError('Document is private')
        }

        return reply.send({ data: doc })
    })

    fastify.put('/docs/:id', {
        schema: {
            tags: ['Documents'],
            summary: 'Update document (draft/pending only)',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema),
            body: zodToJsonSchema(updateDocumentSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = updateDocumentSchema.parse(request.body)
        const actor = request.user?.sub ?? 'system'
        const updated = await service.update(id, body, actor)
        await audit(request, 'docs.update', id, { patch: body })
        return reply.send({ data: updated })
    })

    fastify.delete('/docs/:id', {
        schema: {
            tags: ['Documents'],
            summary: 'Delete document',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema),
            body: zodToJsonSchema(deleteBodySchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = deleteBodySchema.parse(request.body ?? {})
        const actor = request.user?.sub ?? 'system'
        await service.delete(id, body.reason, actor)
        await audit(request, 'docs.delete', id, { reason: body.reason ?? null })
        return reply.status(204).send()
    })

    // ==================== Files ====================

    // Upload a document file (direct multipart upload) OR request a presigned-like PUT URL.
    fastify.post('/docs/:id/upload', {
        schema: {
            tags: ['Documents'],
            summary: 'Upload a document file (multipart) OR request a presigned-like PUT URL',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const actor = request.user?.sub ?? 'system'
        // Ensure document exists
        await service.get(id)

        // If not multipart, return a signed upload URL for a subsequent PUT.
        if (!request.isMultipart?.()) {
            const bodySchema = z.object({
                filename: z.string().min(1),
                mimeType: z.string().optional()
            })
            const body = bodySchema.parse(request.body ?? {})
            const ext = path.extname(body.filename).toLowerCase()
            if (!DOC_FILE_EXT_ALLOWLIST.has(ext)) {
                throw new BadRequestError(`Unsupported file type: ${ext}`)
            }
            const { storageKey } = buildStorageKey(id, body.filename)
            const exp = Date.now() + 10 * 60 * 1000
            const token = signUploadToken({
                documentId: id,
                userId: actor,
                storageKey,
                filename: body.filename,
                mimeType: body.mimeType ?? null,
                exp
            })
            return reply.send({
                data: {
                    storageKey,
                    uploadUrl: `/api/v1/docs/${id}/upload?token=${encodeURIComponent(token)}`,
                    method: 'PUT',
                    expiresAt: new Date(exp).toISOString()
                }
            })
        }

        const file = await request.file()
        if (!file) throw new BadRequestError('File is required')

        const filename = file.filename ?? 'document'
        const ext = path.extname(filename).toLowerCase()
        if (!DOC_FILE_EXT_ALLOWLIST.has(ext)) {
            throw new BadRequestError(`Unsupported file type: ${ext}`)
        }

        const { storageKey, filePath } = buildStorageKey(id, filename)
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        const hash = crypto.createHash('sha256')
        let sizeBytes = 0

        file.file.on('data', (chunk: Buffer) => {
            sizeBytes += chunk.length
            hash.update(chunk)
        })

        await pipeline(file.file, fs.createWriteStream(filePath))
        const sha256 = hash.digest('hex')

        const updated = await repo.insertFileMeta(id, {
            storageKey,
            filename,
            sha256,
            sizeBytes,
            mimeType: file.mimetype ?? null
        })
        if (!updated) throw new NotFoundError('Document not found')

        await audit(request, 'docs.upload', id, { storageKey, filename, sizeBytes, sha256 })
        return reply.send({ data: updated })
    })

    // Upload a document file via a signed (presigned-like) PUT URL.
    fastify.put('/docs/:id/upload', {
        schema: {
            tags: ['Documents'],
            summary: 'Presigned-like PUT upload (tokenized).',
            params: zodToJsonSchema(idParamSchema),
            querystring: {
                type: 'object',
                properties: {
                    token: { type: 'string' }
                },
                required: ['token']
            }
        }
    }, async (request: any, reply) => {
        const { id } = idParamSchema.parse(request.params)
        const token = String((request.query as any)?.token ?? '')
        const payload = verifyUploadToken(token)

        if (payload.documentId !== id) {
            throw new ForbiddenError('Upload token does not match target document')
        }

        const filePath = path.resolve(UPLOAD_ROOT, payload.storageKey)
        if (!filePath.startsWith(UPLOAD_ROOT)) {
            throw new NotFoundError('Invalid storage path')
        }

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        const hash = crypto.createHash('sha256')
        let sizeBytes = 0

        request.raw.on('data', (chunk: Buffer) => {
            sizeBytes += chunk.length
            hash.update(chunk)
        })

        await pipeline(request.raw, fs.createWriteStream(filePath))
        const sha256 = hash.digest('hex')

        const updated = await repo.insertFileMeta(id, {
            storageKey: payload.storageKey,
            filename: payload.filename,
            sha256,
            sizeBytes,
            mimeType: payload.mimeType ?? (request.headers['content-type'] as string | undefined) ?? null
        })
        if (!updated) throw new NotFoundError('Document not found')

        // Audit as the actor who requested the signed URL.
        await adminRepo.createAuditLog({
            userId: payload.userId,
            action: 'docs.upload',
            resource: 'docs',
            resourceId: id,
            details: { storageKey: payload.storageKey, filename: payload.filename, sizeBytes, sha256, via: 'presigned' },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent']
        })

        return reply.send({ data: updated })
    })

    // Download a specific document file
    fastify.get('/docs/:id/download/:fileId', {
        schema: {
            tags: ['Documents'],
            summary: 'Download a document file',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(downloadParamsSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        const { id, fileId } = downloadParamsSchema.parse(request.params)
        const doc = await service.get(id)

        if (!isAdmin(request)) {
            if (doc.approval.status !== 'approved') throw new ForbiddenError('Document is not approved')
            if (doc.visibility === 'private') throw new ForbiddenError('Document is private')
        }

        const file = await repo.getFile(fileId)
        if (!file || file.document_id !== id) {
            throw new NotFoundError('File not found')
        }

        const filePath = path.resolve(UPLOAD_ROOT, file.storage_key)
        if (!filePath.startsWith(UPLOAD_ROOT)) {
            throw new NotFoundError('Invalid storage path')
        }
        await fs.promises.access(filePath).catch(() => {
            throw new NotFoundError('File missing')
        })

        await audit(request, 'docs.download', id, { fileId, storageKey: file.storage_key })

        reply.header('Content-Type', file.mime_type ?? 'application/octet-stream')
        reply.header('Content-Disposition', `attachment; filename="${sanitizeFileName(file.filename)}"`)
        return reply.send(fs.createReadStream(filePath))
    })

    // ==================== Approval Workflow ====================

    fastify.post('/docs/:id/submit-approval', {
        schema: {
            tags: ['Documents'],
            summary: 'Submit document for approval',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const actor = request.user?.sub ?? 'system'
        const updated = await service.submitApproval(id, actor)
        await audit(request, 'docs.submit_approval', id, {})
        return reply.send({ data: updated })
    })

    fastify.post('/docs/:id/approve', {
        schema: {
            tags: ['Documents'],
            summary: 'Approve document',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema),
            body: zodToJsonSchema(approvalActionSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = approvalActionSchema.parse(request.body)
        const actor = request.user?.sub ?? 'system'
        const updated = await service.approve(id, body, actor)
        await audit(request, 'docs.approve', id, { reason: body.reason ?? null, note: body.note ?? null })
        return reply.send({ data: updated })
    })

    fastify.post('/docs/:id/reject', {
        schema: {
            tags: ['Documents'],
            summary: 'Reject document',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema),
            body: zodToJsonSchema(approvalActionSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = approvalActionSchema.parse(request.body)
        const actor = request.user?.sub ?? 'system'
        const updated = await service.reject(id, body, actor)
        await audit(request, 'docs.reject', id, { reason: body.reason ?? null, note: body.note ?? null })
        return reply.send({ data: updated })
    })

    // ==================== Bulk ====================

    fastify.post('/docs/bulk', {
        schema: {
            tags: ['Documents'],
            summary: 'Bulk document actions',
            security: [{ bearerAuth: [] }],
            body: zodToJsonSchema(bulkDocumentsSchema)
        },
        preHandler: authenticate
    }, async (request: any, reply) => {
        requireAdmin(request)
        const body = bulkDocumentsSchema.parse(request.body)
        const actor = request.user?.sub ?? 'system'
        const result = await service.bulk(body, actor)
        await audit(request, 'docs.bulk', undefined, { action: body.action, ids: body.ids, tag: body.tag, visibility: body.visibility })
        return reply.send({ data: result })
    })
}
