import type { FastifyInstance } from 'fastify'
import type { CatalogService, CategorySpecService } from '@qltb/application'
import { AppError } from '@qltb/domain'
import { getUserContext, requirePermission } from './assets.helpers.js'
import {
    categoryIdParamsSchema,
    specDefCreateSchema,
    specDefIdParamsSchema,
    specDefUpdateSchema
} from './category-specs.schemas.js'
import { categoryCreateSchema } from './catalogs.schemas.js'
import { specVersionIdParamsSchema } from './spec-versions.schemas.js'

interface CategorySpecRoutesOptions {
    catalogService: CatalogService
    categorySpecService: CategorySpecService
}

export async function categorySpecRoutes(
    fastify: FastifyInstance,
    opts: CategorySpecRoutesOptions
): Promise<void> {
    const catalogService = opts.catalogService
    const categorySpecService = opts.categorySpecService

    const relaxedRateLimit = {
        config: {
            rateLimit: false
        }
    } as const

    fastify.get('/asset-categories', async (request, reply) => {
        getUserContext(request)
        const categories = await catalogService.listCategories()
        return reply.send({ data: categories })
    })

    fastify.post('/asset-categories', async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const body = categoryCreateSchema.parse(request.body)
        const result = await catalogService.createCategory(body, ctx)
        return reply.status(201).send({ data: result })
    })

    fastify.get('/asset-categories/:id/spec-defs', relaxedRateLimit, async (request, reply) => {
        getUserContext(request)
        const { id } = categoryIdParamsSchema.parse(request.params)
        const defs = await categorySpecService.listCategorySpecDefs(id)
        return reply.send({ data: defs })
    })

    fastify.post('/asset-categories/:id/spec-defs', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { id } = categoryIdParamsSchema.parse(request.params)
        const body = specDefCreateSchema.parse(request.body)
        const versions = await categorySpecService.listSpecVersions(id)
        const target = versions.find((version) => version.status === 'draft') ?? versions.find((version) => version.status === 'active')
        if (!target) {
            throw AppError.notFound('No spec version available')
        }
        const created = await categorySpecService.addSpecDef(target.id, body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.post('/asset-categories/:id/spec-defs/apply-template', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { id } = categoryIdParamsSchema.parse(request.params)
        const defs = await categorySpecService.applyCategorySpecTemplate(id, ctx)
        return reply.send({ data: defs })
    })

    fastify.put('/spec-defs/:specDefId', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { specDefId } = specDefIdParamsSchema.parse(request.params)
        const body = specDefUpdateSchema.parse(request.body)
        const updated = await categorySpecService.updateSpecDef(specDefId, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/spec-defs/:specDefId', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { specDefId } = specDefIdParamsSchema.parse(request.params)
        await categorySpecService.deleteSpecDef(specDefId, ctx)
        return reply.send({ data: { id: specDefId } })
    })

    fastify.get('/asset-categories/:id/spec-versions', relaxedRateLimit, async (request, reply) => {
        getUserContext(request)
        const { id } = categoryIdParamsSchema.parse(request.params)
        const versions = await categorySpecService.listSpecVersions(id)
        return reply.send({ data: versions })
    })

    fastify.post('/asset-categories/:id/spec-versions', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { id } = categoryIdParamsSchema.parse(request.params)
        const result = await categorySpecService.createDraftVersion(id, ctx)
        return reply.status(201).send({ data: result })
    })

    fastify.post('/spec-versions/:versionId/publish', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { versionId } = specVersionIdParamsSchema.parse(request.params)
        const result = await categorySpecService.publishSpecVersion(versionId, ctx)
        return reply.send({ data: result })
    })

    fastify.get('/spec-versions/:versionId/defs', relaxedRateLimit, async (request, reply) => {
        getUserContext(request)
        const { versionId } = specVersionIdParamsSchema.parse(request.params)
        const defs = await categorySpecService.listSpecDefsByVersion(versionId)
        return reply.send({ data: defs })
    })

    fastify.post('/spec-versions/:versionId/defs', relaxedRateLimit, async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const { versionId } = specVersionIdParamsSchema.parse(request.params)
        const body = specDefCreateSchema.parse(request.body)
        const created = await categorySpecService.addSpecDef(versionId, body, ctx)
        return reply.status(201).send({ data: created })
    })
}
