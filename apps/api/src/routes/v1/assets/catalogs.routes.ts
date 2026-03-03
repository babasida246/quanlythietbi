import type { FastifyInstance } from 'fastify'
import type { CatalogService } from '@qltb/application'
import type { PgClient } from '@qltb/infra-postgres'
import { AppError } from '@qltb/domain'
import { getUserContext, requirePermission } from './assets.helpers.js'
import {
    catalogIdParamsSchema,
    categoryCreateSchema,
    categoryUpdateSchema,
    locationCreateSchema,
    locationUpdateSchema,
    modelCreateSchema,
    modelSearchQuerySchema,
    modelUpdateSchema,
    statusCatalogCreateSchema,
    statusCatalogUpdateSchema,
    vendorCreateSchema,
    vendorUpdateSchema
} from './catalogs.schemas.js'

interface CatalogRoutesOptions {
    catalogService: CatalogService
    pgClient: PgClient
}

type StatusCatalogRow = {
    id: string
    name: string
    code: string
    is_terminal: boolean
    color: string | null
    created_at: Date
}

export async function catalogRoutes(
    fastify: FastifyInstance,
    opts: CatalogRoutesOptions
): Promise<void> {
    const catalogService = opts.catalogService
    const pgClient = opts.pgClient

    fastify.get('/assets/catalogs', async (request, reply) => {
        getUserContext(request)
        const catalogs = await catalogService.listCatalogs()
        return reply.send({ data: catalogs })
    })

    fastify.get('/assets/catalogs/categories', async (request, reply) => {
        getUserContext(request)
        const categories = await catalogService.listCategories()
        return reply.send({ data: categories })
    })

    fastify.post('/assets/catalogs/categories', async (request, reply) => {
        const ctx = await requirePermission(request, 'categories:manage')
        const body = categoryCreateSchema.parse(request.body)
        const result = await catalogService.createCategory(body, ctx)
        return reply.status(201).send({ data: result.category })
    })

    fastify.put('/assets/catalogs/categories/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const body = categoryUpdateSchema.parse(request.body)
        const updated = await catalogService.updateCategory(id, body)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/catalogs/categories/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        await catalogService.deleteCategory(id)
        return reply.send({ data: { id } })
    })

    fastify.get('/assets/catalogs/vendors', async (request, reply) => {
        getUserContext(request)
        const vendors = await catalogService.listVendors()
        return reply.send({ data: vendors })
    })

    fastify.post('/assets/catalogs/vendors', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const body = vendorCreateSchema.parse(request.body)
        const created = await catalogService.createVendor(body)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/assets/catalogs/vendors/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const body = vendorUpdateSchema.parse(request.body)
        const updated = await catalogService.updateVendor(id, body)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/catalogs/vendors/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        await catalogService.deleteVendor(id)
        return reply.send({ data: { id } })
    })

    fastify.post('/assets/catalogs/models', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const body = modelCreateSchema.parse(request.body)
        const created = await catalogService.createModel(body)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/assets/catalogs/models/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const body = modelUpdateSchema.parse(request.body)
        const updated = await catalogService.updateModel(id, body)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/catalogs/models/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        await catalogService.deleteModel(id)
        return reply.send({ data: { id } })
    })

    fastify.get('/assets/catalogs/locations', async (request, reply) => {
        getUserContext(request)
        const locations = await catalogService.listLocations()
        return reply.send({ data: locations })
    })

    fastify.get('/asset-models', async (request, reply) => {
        getUserContext(request)
        const query = modelSearchQuerySchema.parse(request.query)
        let specFilters: Record<string, unknown> | undefined
        if (query.specFilters) {
            try {
                const parsed = JSON.parse(query.specFilters) as Record<string, unknown>
                specFilters = parsed && typeof parsed === 'object' ? parsed : undefined
            } catch {
                throw AppError.badRequest('Invalid specFilters JSON')
            }
        }
        const models = await catalogService.searchModels({
            categoryId: query.categoryId,
            specFilters
        })
        return reply.send({ data: models })
    })

    fastify.post('/assets/catalogs/locations', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const body = locationCreateSchema.parse(request.body)
        const created = await catalogService.createLocation(body)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/assets/catalogs/locations/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const body = locationUpdateSchema.parse(request.body)
        const updated = await catalogService.updateLocation(id, body)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/catalogs/locations/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        await catalogService.deleteLocation(id)
        return reply.send({ data: { id } })
    })

    fastify.get('/assets/catalogs/statuses', async (request, reply) => {
        getUserContext(request)
        const result = await pgClient.query<StatusCatalogRow>(
            `SELECT id, name, code, is_terminal, color, created_at
             FROM asset_status_catalogs
             ORDER BY name ASC`
        )
        return reply.send({
            data: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                code: row.code,
                isTerminal: row.is_terminal,
                color: row.color,
                createdAt: row.created_at
            }))
        })
    })

    fastify.post('/assets/catalogs/statuses', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const body = statusCatalogCreateSchema.parse(request.body)
        const result = await pgClient.query<StatusCatalogRow>(
            `INSERT INTO asset_status_catalogs (name, code, is_terminal, color)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, code, is_terminal, color, created_at`,
            [body.name, body.code, body.isTerminal ?? false, body.color ?? null]
        )
        return reply.status(201).send({
            data: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                code: result.rows[0].code,
                isTerminal: result.rows[0].is_terminal,
                color: result.rows[0].color,
                createdAt: result.rows[0].created_at
            }
        })
    })

    fastify.put('/assets/catalogs/statuses/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const body = statusCatalogUpdateSchema.parse(request.body)

        const fields: string[] = []
        const params: Array<string | boolean | null> = []

        if (body.name !== undefined) {
            params.push(body.name)
            fields.push(`name = $${params.length}`)
        }
        if (body.code !== undefined) {
            params.push(body.code)
            fields.push(`code = $${params.length}`)
        }
        if (body.isTerminal !== undefined) {
            params.push(body.isTerminal)
            fields.push(`is_terminal = $${params.length}`)
        }
        if (body.color !== undefined) {
            params.push(body.color ?? null)
            fields.push(`color = $${params.length}`)
        }

        if (fields.length === 0) {
            const current = await pgClient.query<StatusCatalogRow>(
                `SELECT id, name, code, is_terminal, color, created_at
                 FROM asset_status_catalogs
                 WHERE id = $1`,
                [id]
            )
            if (current.rowCount === 0) throw AppError.notFound('Status not found')
            const row = current.rows[0]
            return reply.send({
                data: {
                    id: row.id,
                    name: row.name,
                    code: row.code,
                    isTerminal: row.is_terminal,
                    color: row.color,
                    createdAt: row.created_at
                }
            })
        }

        params.push(id)
        const result = await pgClient.query<StatusCatalogRow>(
            `UPDATE asset_status_catalogs
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, name, code, is_terminal, color, created_at`,
            params
        )

        if (result.rowCount === 0) {
            throw AppError.notFound('Status not found')
        }

        const row = result.rows[0]
        return reply.send({
            data: {
                id: row.id,
                name: row.name,
                code: row.code,
                isTerminal: row.is_terminal,
                color: row.color,
                createdAt: row.created_at
            }
        })
    })

    fastify.delete('/assets/catalogs/statuses/:id', async (request, reply) => {
        await requirePermission(request, 'categories:manage')
        const { id } = catalogIdParamsSchema.parse(request.params)
        const result = await pgClient.query(
            `DELETE FROM asset_status_catalogs
             WHERE id = $1`,
            [id]
        )
        if ((result.rowCount ?? 0) === 0) {
            throw AppError.notFound('Status not found')
        }
        return reply.send({ data: { id } })
    })
}
