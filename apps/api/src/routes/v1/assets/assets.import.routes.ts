import type { FastifyInstance } from 'fastify'
import type { AssetService } from '@qltb/application'
import { assetImportCommitSchema, assetImportPreviewSchema } from './assets.import.schemas.js'
import { requirePermission } from './assets.helpers.js'

interface AssetImportRoutesOptions {
    assetService: AssetService
}

export async function assetImportRoutes(
    fastify: FastifyInstance,
    opts: AssetImportRoutesOptions
): Promise<void> {
    const assetService = opts.assetService

    fastify.post('/assets/import/preview', async (request, reply) => {
        await requirePermission(request, 'assets:manage')
        const body = assetImportPreviewSchema.parse(request.body)
        const result = await assetService.bulkImportPreview(body.rows)
        return reply.send({ data: result })
    })

    fastify.post('/assets/import/commit', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const body = assetImportCommitSchema.parse(request.body)
        const result = await assetService.bulkImportCommit(body.rows, ctx)
        return reply.send({ data: result })
    })
}
