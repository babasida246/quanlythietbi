/**
 * Knowledge Base Documents — Routes
 * Migrated from apps/api/src/modules/documents/documents.routes.ts
 *
 * Auth: handled by global createApiV1AuthHook (all /api/v1/* routes).
 * The presigned PUT upload route is additionally secured by a signed token.
 */
import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import type { DocumentService } from '@qltb/application'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { AdminRepository } from '../../../modules/admin/admin.repository.js'
import {
    approvalActionSchema,
    bulkKbDocSchema,
    createKbDocSchema,
    deleteBodySchema,
    downloadParamsSchema,
    idParamSchema,
    kbDocListQuerySchema,
    updateKbDocSchema
} from './documents.schema.js'

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? process.env.ASSET_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')

const DOC_FILE_EXT_ALLOWLIST = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg', '.vsdx', '.md', '.txt'])
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'upload-secret'

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
    if (!data || !sig) throw new BadRequestError('Invalid upload token')
    const expected = crypto.createHmac('sha256', UPLOAD_TOKEN_SECRET).update(data).digest('hex')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        throw new ForbiddenError('Invalid upload token signature')
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as UploadTokenPayload
    if (!payload?.exp || payload.exp <= Date.now()) throw new ForbiddenError('Upload token expired')
    return payload
}

function sanitizeFileName(name: string): string {
    return path.basename(name).replace(/[^\w.-]/g, '_')
}

function buildStorageKey(documentId: string, fileName: string): { storageKey: string; filePath: string } {
    const safeName = sanitizeFileName(fileName)
    const storageKey = path.posix.join('docs', documentId, `${crypto.randomUUID()}-${safeName || 'attachment'}`)
    const filePath = path.resolve(UPLOAD_ROOT, storageKey)
    return { storageKey, filePath }
}

export async function documentsRoute(
    fastify: FastifyInstance,
    opts: { documentService: DocumentService; pgClient: PgClient }
): Promise<void> {
    const { documentService } = opts
    const pool = opts.pgClient.getPool()
    const adminRepo = new AdminRepository(pool)

    // ── Helpers ────────────────────────────────────────────────────────────────

    const isAdmin = (request: any) => {
        const role = request.user?.role
        return role === 'admin' || role === 'super_admin'
    }

    const requireAdmin = (request: any) => {
        if (!isAdmin(request)) throw new ForbiddenError('Insufficient role for this action')
    }

    const audit = async (request: any, action: string, resourceId: string | undefined, details: Record<string, any>) => {
        try {
            await adminRepo.createAuditLog({
                userId: request.user?.id,
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

    // ── CRUD ──────────────────────────────────────────────────────────────────

    fastify.get('/docs', {
        schema: {
            tags: ['Documents'],
            summary: 'List documents',
            security: [{ bearerAuth: [] }],
            querystring: zodToJsonSchema(kbDocListQuerySchema)
        }
    }, async (request: any, reply) => {
        const query = kbDocListQuerySchema.parse(request.query)
        const effectiveQuery = isAdmin(request) ? query : { ...query, status: 'approved' as const }
        const { data, total } = await documentService.list(effectiveQuery)
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
            body: zodToJsonSchema(createKbDocSchema)
        }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const body = createKbDocSchema.parse(request.body)
        const actor = request.user?.id ?? 'system'
        const created = await documentService.create(body, actor)
        await audit(request, 'docs.create', created.id, { type: created.type, title: created.title, visibility: created.visibility })
        return reply.status(201).send({ data: created })
    })

    fastify.get('/docs/:id', {
        schema: {
            tags: ['Documents'],
            summary: 'Get document by ID',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema)
        }
    }, async (request: any, reply) => {
        const { id } = idParamSchema.parse(request.params)
        const doc = await documentService.get(id)

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
            body: zodToJsonSchema(updateKbDocSchema)
        }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = updateKbDocSchema.parse(request.body)
        const actor = request.user?.id ?? 'system'
        const updated = await documentService.update(id, body, actor)
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
        }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = deleteBodySchema.parse(request.body ?? {})
        const actor = request.user?.id ?? 'system'
        await documentService.delete(id, body.reason, actor)
        await audit(request, 'docs.delete', id, { reason: body.reason ?? null })
        return reply.status(204).send()
    })

    // ── File Upload ───────────────────────────────────────────────────────────

    fastify.post('/docs/:id/upload', {
        schema: {
            tags: ['Documents'],
            summary: 'Upload a document file (multipart) OR request a presigned-like PUT URL',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(idParamSchema)
        }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const actor = request.user?.id ?? 'system'
        await documentService.get(id)

        if (!request.isMultipart?.()) {
            const bodySchema = z.object({ filename: z.string().min(1), mimeType: z.string().optional() })
            const body = bodySchema.parse(request.body ?? {})
            const ext = path.extname(body.filename).toLowerCase()
            if (!DOC_FILE_EXT_ALLOWLIST.has(ext)) throw new BadRequestError(`Unsupported file type: ${ext}`)
            const { storageKey } = buildStorageKey(id, body.filename)
            const exp = Date.now() + 10 * 60 * 1000
            const token = signUploadToken({ documentId: id, userId: actor, storageKey, filename: body.filename, mimeType: body.mimeType ?? null, exp })
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
        if (!DOC_FILE_EXT_ALLOWLIST.has(ext)) throw new BadRequestError(`Unsupported file type: ${ext}`)

        const { storageKey, filePath } = buildStorageKey(id, filename)
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        const hash = crypto.createHash('sha256')
        let sizeBytes = 0
        file.file.on('data', (chunk: Buffer) => { sizeBytes += chunk.length; hash.update(chunk) })
        await pipeline(file.file, fs.createWriteStream(filePath))
        const sha256 = hash.digest('hex')

        // Access DocumentRepo directly for file meta insertion (not a service concern)
        const docRepo = (documentService as any).repo
        const updated = await docRepo.insertFileMeta(id, { storageKey, filename, sha256, sizeBytes, mimeType: file.mimetype ?? null })
        if (!updated) throw new NotFoundError('Document not found')

        await audit(request, 'docs.upload', id, { storageKey, filename, sizeBytes, sha256 })
        return reply.send({ data: updated })
    })

    fastify.put('/docs/:id/upload', {
        schema: {
            tags: ['Documents'],
            summary: 'Presigned-like PUT upload (tokenized)',
            params: zodToJsonSchema(idParamSchema),
            querystring: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] }
        }
    }, async (request: any, reply) => {
        const { id } = idParamSchema.parse(request.params)
        const token = String((request.query as any)?.token ?? '')
        const payload = verifyUploadToken(token)

        if (payload.documentId !== id) throw new ForbiddenError('Upload token does not match target document')

        const filePath = path.resolve(UPLOAD_ROOT, payload.storageKey)
        if (!filePath.startsWith(UPLOAD_ROOT)) throw new NotFoundError('Invalid storage path')

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        const hash = crypto.createHash('sha256')
        let sizeBytes = 0
        request.raw.on('data', (chunk: Buffer) => { sizeBytes += chunk.length; hash.update(chunk) })
        await pipeline(request.raw, fs.createWriteStream(filePath))
        const sha256 = hash.digest('hex')

        const docRepo = (documentService as any).repo
        const updated = await docRepo.insertFileMeta(id, {
            storageKey: payload.storageKey,
            filename: payload.filename,
            sha256,
            sizeBytes,
            mimeType: payload.mimeType ?? (request.headers['content-type'] as string | undefined) ?? null
        })
        if (!updated) throw new NotFoundError('Document not found')

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

    fastify.get('/docs/:id/download/:fileId', {
        schema: {
            tags: ['Documents'],
            summary: 'Download a document file',
            security: [{ bearerAuth: [] }],
            params: zodToJsonSchema(downloadParamsSchema)
        }
    }, async (request: any, reply) => {
        const { id, fileId } = downloadParamsSchema.parse(request.params)
        const doc = await documentService.get(id)

        if (!isAdmin(request)) {
            if (doc.approval.status !== 'approved') throw new ForbiddenError('Document is not approved')
            if (doc.visibility === 'private') throw new ForbiddenError('Document is private')
        }

        const docRepo = (documentService as any).repo
        const file = await docRepo.getFile(fileId)
        if (!file || file.document_id !== id) throw new NotFoundError('File not found')

        const filePath = path.resolve(UPLOAD_ROOT, file.storage_key)
        if (!filePath.startsWith(UPLOAD_ROOT)) throw new NotFoundError('Invalid storage path')
        await fs.promises.access(filePath).catch(() => { throw new NotFoundError('File missing') })

        await audit(request, 'docs.download', id, { fileId, storageKey: file.storage_key })

        reply.header('Content-Type', file.mime_type ?? 'application/octet-stream')
        reply.header('Content-Disposition', `attachment; filename="${sanitizeFileName(file.filename)}"`)
        return reply.send(fs.createReadStream(filePath))
    })

    // ── Approval Workflow ─────────────────────────────────────────────────────

    fastify.post('/docs/:id/submit-approval', {
        schema: { tags: ['Documents'], summary: 'Submit document for approval', security: [{ bearerAuth: [] }], params: zodToJsonSchema(idParamSchema) }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const actor = request.user?.id ?? 'system'
        const updated = await documentService.submitApproval(id, actor)
        await audit(request, 'docs.submit_approval', id, {})
        return reply.send({ data: updated })
    })

    fastify.post('/docs/:id/approve', {
        schema: { tags: ['Documents'], summary: 'Approve document', security: [{ bearerAuth: [] }], params: zodToJsonSchema(idParamSchema), body: zodToJsonSchema(approvalActionSchema) }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = approvalActionSchema.parse(request.body)
        const actor = request.user?.id ?? 'system'
        const updated = await documentService.approve(id, body, actor)
        await audit(request, 'docs.approve', id, { reason: body.reason ?? null })
        return reply.send({ data: updated })
    })

    fastify.post('/docs/:id/reject', {
        schema: { tags: ['Documents'], summary: 'Reject document', security: [{ bearerAuth: [] }], params: zodToJsonSchema(idParamSchema), body: zodToJsonSchema(approvalActionSchema) }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const { id } = idParamSchema.parse(request.params)
        const body = approvalActionSchema.parse(request.body)
        const actor = request.user?.id ?? 'system'
        const updated = await documentService.reject(id, body, actor)
        await audit(request, 'docs.reject', id, { reason: body.reason ?? null })
        return reply.send({ data: updated })
    })

    // ── Bulk ──────────────────────────────────────────────────────────────────

    fastify.post('/docs/bulk', {
        schema: { tags: ['Documents'], summary: 'Bulk document actions', security: [{ bearerAuth: [] }], body: zodToJsonSchema(bulkKbDocSchema) }
    }, async (request: any, reply) => {
        requireAdmin(request)
        const body = bulkKbDocSchema.parse(request.body)
        const actor = request.user?.id ?? 'system'
        const result = await documentService.bulk(body, actor)
        await audit(request, 'docs.bulk', undefined, { action: body.action, ids: body.ids })
        return reply.send({ data: result })
    })
}
