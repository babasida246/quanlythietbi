import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { AttachmentService } from '@qltb/application'
import { BadRequestError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { getUserContext, requirePermission } from './assets.helpers.js'
import { attachmentAssetParamsSchema, attachmentDownloadParamsSchema } from './attachments.schemas.js'

const UPLOAD_ROOT = process.env.ASSET_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')
const ASSET_UPLOAD_ROOT = path.join(UPLOAD_ROOT, 'assets')

function sanitizeFileName(name: string): string {
    const base = path.basename(name)
    return base.replace(/[^\w.-]/g, '_')
}

function buildStorageKey(assetId: string, fileName: string): { storageKey: string; filePath: string } {
    const safeName = sanitizeFileName(fileName)
    const storageKey = path.posix.join('assets', assetId, `${randomUUID()}-${safeName || 'attachment'}`)
    const filePath = path.resolve(UPLOAD_ROOT, storageKey)
    return { storageKey, filePath }
}

export async function attachmentRoutes(
    fastify: FastifyInstance,
    opts: { attachmentService: AttachmentService }
): Promise<void> {
    const attachmentService = opts.attachmentService

    fastify.post('/assets/:id/attachments', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = attachmentAssetParamsSchema.parse(request.params)
        const file = await request.file()

        if (!file) {
            throw new BadRequestError('Attachment file is required')
        }

        const { storageKey, filePath } = buildStorageKey(id, file.filename ?? 'attachment')
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

        let sizeBytes = 0
        file.file.on('data', chunk => {
            sizeBytes += chunk.length
        })

        await pipeline(file.file, fs.createWriteStream(filePath))

        const record = await attachmentService.addAttachmentMeta(id, {
            fileName: file.filename ?? 'attachment',
            mimeType: file.mimetype ?? null,
            storageKey,
            sizeBytes
        }, ctx)

        return reply.status(201).send({ data: record })
    })

    fastify.get('/assets/:id/attachments', async (request, reply) => {
        getUserContext(request)
        const { id } = attachmentAssetParamsSchema.parse(request.params)
        const records = await attachmentService.listAttachments(id)
        return reply.send({ data: records })
    })

    fastify.get('/assets/:id/attachments/:attachmentId/download', async (request, reply) => {
        getUserContext(request)
        const { id, attachmentId } = attachmentDownloadParamsSchema.parse(request.params)
        const record = await attachmentService.getAttachment(attachmentId)
        if (record.assetId !== id) {
            throw new NotFoundError('Attachment not found for asset')
        }

        const filePath = path.resolve(UPLOAD_ROOT, record.storageKey)
        if (!filePath.startsWith(UPLOAD_ROOT)) {
            throw new NotFoundError('Attachment path invalid')
        }

        await fs.promises.access(filePath).catch(() => {
            throw new NotFoundError('Attachment file missing')
        })

        const fileName = sanitizeFileName(record.fileName)
        reply.header('Content-Type', record.mimeType ?? 'application/octet-stream')
        reply.header('Content-Disposition', `attachment; filename="${fileName || 'attachment'}"`)
        return reply.send(fs.createReadStream(filePath))
    })
}
