import type { FastifyInstance } from 'fastify'
import type { AssetService } from '@qltb/application'
import type { PgClient } from '@qltb/infra-postgres'
import {
    assetCreateSchema,
    assetIdParamsSchema,
    assetSearchSchema,
    assetUpdateSchema,
    assignmentSchema,
    moveSchema,
    returnSchema,
    statusSchema,
    timelineSchema
} from './assets.schemas.js'
import type { AssetRecord } from '@qltb/contracts'
import { getUserContext, requirePermission } from './assets.helpers.js'

interface AssetRoutesOptions {
    assetService: AssetService
    pgClient?: PgClient
}

async function resolveUserOrganizationId(pgClient: PgClient | undefined, userId: string): Promise<string | null> {
    if (!pgClient) return null

    // Preferred path: explicit OU -> Organization mapping (supports inherited mapping from parent OUs).
    try {
        const res = await pgClient.query<{ organization_id: string | null }>(
            `SELECT map.organization_id
             FROM rbac_users ru
             JOIN org_units user_ou ON user_ou.id = ru.ou_id
             JOIN org_units ancestor_ou ON user_ou.path LIKE ancestor_ou.path || '%'
             JOIN ou_organization_mappings map ON map.ou_id = ancestor_ou.id
             WHERE ru.linked_user_id = $1
             ORDER BY LENGTH(ancestor_ou.path) DESC
             LIMIT 1`,
            [userId]
        )
        return res.rows[0]?.organization_id ?? null
    } catch {
        // Fallback path for environments that have not run the mapping migration yet.
        try {
            const fallback = await pgClient.query<{ organization_id: string | null }>(
                `SELECT o.id AS organization_id
                 FROM rbac_users ru
                 JOIN org_units ou ON ou.id = ru.ou_id
                 JOIN organizations o ON LOWER(TRIM(o.name)) = LOWER(TRIM(ou.name))
                 WHERE ru.linked_user_id = $1
                 LIMIT 1`,
                [userId]
            )
            return fallback.rows[0]?.organization_id ?? null
        } catch {
            return null
        }
    }
}

function csvEscape(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}`
    }
    return value
}

function toCsv(items: AssetRecord[]): string {
    const headers = [
        'asset_code',
        'status',
        'model',
        'vendor',
        'location',
        'serial_no',
        'mgmt_ip',
        'warranty_end'
    ]
    const lines = items.map(item => ([
        item.assetCode,
        item.status,
        item.modelName ?? '',
        item.vendorName ?? '',
        item.locationName ?? '',
        item.serialNo ?? '',
        item.mgmtIp ?? '',
        item.warrantyEnd ? item.warrantyEnd.toISOString().slice(0, 10) : ''
    ]).map(value => csvEscape(String(value))).join(','))
    return [headers.join(','), ...lines].join('\n')
}

export async function assetsRoutes(fastify: FastifyInstance, opts: AssetRoutesOptions): Promise<void> {
    const assetService = opts.assetService
    const pgClient = opts.pgClient

    fastify.get('/assets', async (request, reply) => {
        const ctx = getUserContext(request)
        const filters = assetSearchSchema.parse(request.query)
        const { export: exportType, scope, ...searchFilters } = filters

        if (scope === 'my_ou') {
            const organizationId = await resolveUserOrganizationId(pgClient, ctx.userId)
            if (!organizationId) {
                return reply.send({ data: [], meta: { total: 0, page: searchFilters.page ?? 1, limit: searchFilters.limit ?? 20 } })
            }
            searchFilters.organizationId = organizationId
        }

        const result = await assetService.searchAssets(searchFilters)

        if (exportType === 'csv') {
            const csv = toCsv(await assetService.exportAssetsCsvData(searchFilters))
            return reply.type('text/csv').send(csv)
        }

        return reply.send({
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit }
        })
    })

    fastify.get('/assets/status-counts', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = assetSearchSchema.partial().parse(request.query)

        // Intentionally keep this endpoint simple and backward-compatible:
        // it returns counts per status to help the UI avoid fanning out many HTTP requests.
        const statuses = ['in_stock', 'in_use', 'in_repair', 'retired', 'disposed', 'lost'] as const

        const counts = {
            in_stock: 0,
            in_use: 0,
            in_repair: 0,
            retired: 0,
            disposed: 0,
            lost: 0
        } satisfies Record<(typeof statuses)[number], number>

        if (pgClient) {
            const params: unknown[] = []
            const where: string[] = []

            if (query.scope === 'my_ou') {
                const organizationId = await resolveUserOrganizationId(pgClient, ctx.userId)
                if (!organizationId) {
                    return reply.send({ data: counts })
                }
                params.push(organizationId)
                const idx = params.length
                where.push(`(
                    EXISTS (
                        SELECT 1 FROM locations l
                        WHERE l.id = a.location_id
                          AND l.organization_id = $${idx}
                    )
                    OR EXISTS (
                        SELECT 1 FROM asset_assignments aa
                        WHERE aa.asset_id = a.id
                          AND aa.returned_at IS NULL
                          AND aa.organization_id = $${idx}
                    )
                )`)
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
            const result = (await pgClient.query(
                `SELECT COALESCE(a.status, 'in_stock') AS status, COUNT(*) AS count
                 FROM assets a
                 ${whereSql}
                 GROUP BY COALESCE(a.status, 'in_stock')`,
                params
            )) as { rows: Array<{ status: string; count: string }> }

            for (const row of result.rows) {
                if (row.status in counts) {
                    counts[row.status as (typeof statuses)[number]] = parseInt(row.count ?? '0', 10) || 0
                }
            }
        } else {
            const results = await Promise.all(
                statuses.map(async (status) => {
                    const page = await assetService.searchAssets({ status, page: 1, limit: 1 })
                    return page.total ?? page.items.length
                })
            )

            for (const [index, status] of statuses.entries()) {
                counts[status] = results[index] ?? 0
            }
        }

        return reply.send({ data: counts })
    })

    fastify.get('/assets/export', async (request, reply) => {
        getUserContext(request)
        const filters = assetSearchSchema.parse(request.query)
        const { export: _export, ...searchFilters } = filters
        const csv = toCsv(await assetService.exportAssetsCsvData(searchFilters))
        return reply.type('text/csv').send(csv)
    })

    fastify.post('/assets', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:create')
        const body = assetCreateSchema.parse(request.body)
        const created = await assetService.createAsset({
            ...body,
            status: body.status ?? 'in_stock'
        }, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.get('/assets/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = assetIdParamsSchema.parse(request.params)
        const detail = await assetService.getAssetDetail(id)
        return reply.send({ data: detail })
    })

    fastify.put('/assets/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = assetUpdateSchema.parse(request.body)
        const updated = await assetService.updateAsset(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/:id', async (request, reply) => {
        await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        await assetService.deleteAsset(id)
        return reply.send({ data: { id } })
    })

    fastify.post('/assets/:id/assign', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = assignmentSchema.parse(request.body)
        const result = await assetService.assignAsset(id, body, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/return', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = returnSchema.parse(request.body)
        const result = await assetService.returnAsset(id, body.note, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/move', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = moveSchema.parse(request.body)
        const result = await assetService.moveAsset(id, body.locationId, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/status', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:manage')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = statusSchema.parse(request.body)
        const result = await assetService.changeStatus(id, body.status, ctx)
        return reply.send({ data: result })
    })

    fastify.get('/assets/:id/timeline', async (request, reply) => {
        getUserContext(request)
        const { id } = assetIdParamsSchema.parse(request.params)
        const query = timelineSchema.parse(request.query)
        const result = await assetService.listTimeline(id, query.page ?? 1, query.limit ?? 20)
        return reply.send({ data: result.items, meta: { page: result.page, limit: result.limit } })
    })
}
