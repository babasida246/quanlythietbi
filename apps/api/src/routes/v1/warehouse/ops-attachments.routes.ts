import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import type { OpsAttachmentService } from '@qltb/application'
import type { OpsAttachmentEntityType } from '@qltb/contracts'
import { BadRequestError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

const UPLOAD_ROOT = process.env.ASSET_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')

const entityParamsSchema = z.object({ id: z.string().uuid() })
const attachmentParamsSchema = z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() })

function sanitizeFileName(name: string): string {
    return path.basename(name).replace(/[^\w.\-]/g, '_')
}

function buildStorageKey(folder: string, entityId: string, fileName: string) {
    const safeName = sanitizeFileName(fileName) || 'attachment'
    const storageKey = path.posix.join(folder, entityId, `${randomUUID()}-${safeName}`)
    const filePath = path.resolve(UPLOAD_ROOT, storageKey)
    return { storageKey, filePath }
}

function registerEntityAttachmentRoutes(
    fastify: FastifyInstance,
    prefix: string,
    entityType: OpsAttachmentEntityType,
    storageFolder: string,
    service: OpsAttachmentService,
    writePermission: string
) {
    // Upload attachment
    fastify.post(`${prefix}/:id/attachments`, async (request, reply) => {
        const ctx = requirePermission(request, writePermission)
        const { id } = entityParamsSchema.parse(request.params)
        const file = await request.file()
        if (!file) throw new BadRequestError('No file uploaded')

        const { storageKey, filePath } = buildStorageKey(storageFolder, id, file.filename ?? 'attachment')
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        let sizeBytes = 0
        file.file.on('data', (chunk: Buffer) => { sizeBytes += chunk.length })
        await pipeline(file.file, fs.createWriteStream(filePath))

        const record = await service.addAttachment(entityType, id, {
            fileName: file.filename ?? 'attachment',
            mimeType: file.mimetype ?? null,
            storageKey,
            sizeBytes
        }, ctx)

        return reply.status(201).send({ data: record })
    })

    // List attachments
    fastify.get(`${prefix}/:id/attachments`, async (request, reply) => {
        getUserContext(request)
        const { id } = entityParamsSchema.parse(request.params)
        const records = await service.listAttachments(entityType, id)
        return reply.send({ data: records })
    })

    // Download attachment
    fastify.get(`${prefix}/:id/attachments/:attachmentId/download`, async (request, reply) => {
        getUserContext(request)
        const { id, attachmentId } = attachmentParamsSchema.parse(request.params)
        const record = await service.getAttachment(attachmentId)

        if (record.entityType !== entityType || record.entityId !== id) {
            throw new NotFoundError('Attachment not found')
        }

        const filePath = path.resolve(UPLOAD_ROOT, record.storageKey)
        if (!filePath.startsWith(UPLOAD_ROOT)) throw new NotFoundError('Invalid path')

        await fs.promises.access(filePath).catch(() => { throw new NotFoundError('File missing') })

        const safeFileName = sanitizeFileName(record.fileName)
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(safeFileName)
        reply.header('Content-Type', record.mimeType ?? 'application/octet-stream')
        reply.header('Content-Disposition',
            `${isImage ? 'inline' : 'attachment'}; filename="${safeFileName || 'attachment'}"`
        )
        return reply.send(fs.createReadStream(filePath))
    })

    // Delete attachment
    fastify.delete(`${prefix}/:id/attachments/:attachmentId`, async (request, reply) => {
        const ctx = requirePermission(request, writePermission)
        const { id, attachmentId } = attachmentParamsSchema.parse(request.params)
        const record = await service.deleteAttachment(attachmentId, ctx)

        if (record.entityType !== entityType || record.entityId !== id) {
            throw new NotFoundError('Attachment not found')
        }

        // Best-effort file removal — don't fail if file already gone
        const filePath = path.resolve(UPLOAD_ROOT, record.storageKey)
        if (filePath.startsWith(UPLOAD_ROOT)) {
            await fs.promises.unlink(filePath).catch(() => { /* ignore */ })
        }

        return reply.send({ data: { id: attachmentId, deleted: true } })
    })
}

export async function opsAttachmentRoutes(
    fastify: FastifyInstance,
    opts: { opsAttachmentService: OpsAttachmentService }
): Promise<void> {
    const { opsAttachmentService } = opts

    registerEntityAttachmentRoutes(
        fastify,
        '/stock-documents',
        'stock_document',
        'stock-docs',
        opsAttachmentService,
        'warehouse:create'
    )

    registerEntityAttachmentRoutes(
        fastify,
        '/asset-models',
        'asset_model',
        'asset-models',
        opsAttachmentService,
        'assets:manage'
    )
}
