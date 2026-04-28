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
    timelineSchema,
    verifyScanSchema
} from './assets.schemas.js'
import type { AssetRecord, AssetSearchFilters } from '@qltb/contracts'
import { getUserContext, requirePermission } from './assets.helpers.js'
import { ForbiddenError } from '../../../shared/errors/http-errors.js'

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
        const { export: exportType, scope, ...baseSearchFilters } = filters
        const searchFilters: AssetSearchFilters = { ...baseSearchFilters }

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

    fastify.post('/assets', async (_request, _reply) => {
        throw new ForbiddenError('Chỉ cho phép thêm tài sản từ phiếu nhập kho')
    })

    fastify.get('/assets/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = assetIdParamsSchema.parse(request.params)
        const detail = await assetService.getAssetDetail(id)
        return reply.send({ data: detail })
    })

    fastify.put('/assets/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:update')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = assetUpdateSchema.parse(request.body)
        const updated = await assetService.updateAsset(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/assets/:id', async (request, reply) => {
        await requirePermission(request, 'assets:delete')
        const { id } = assetIdParamsSchema.parse(request.params)
        await assetService.deleteAsset(id)
        return reply.send({ data: { id } })
    })

    // POST /assets/verify-scan
    // Kiểm tra mã thiết bị vừa quét có nằm trong phiếu yêu cầu đã duyệt không
    fastify.post('/assets/verify-scan', async (request, reply) => {
        await requirePermission(request, 'assets:assign')
        const body = verifyScanSchema.parse(request.body)

        if (!pgClient) {
            return reply.status(503).send({ success: false, error: 'Database not available' })
        }

        type ScanRow = {
            asset_id: string
            asset_code: string
            asset_name: string
            asset_status: string
            model_name: string | null
            line_id: string | null
            line_no: number | null
            line_status: string | null
        }

        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const isUuid = uuidRe.test(body.scannedCode)

        const { rows } = await pgClient.query<ScanRow>(
            `SELECT
                 a.id          AS asset_id,
                 a.asset_code,
                 a.name        AS asset_name,
                 a.status      AS asset_status,
                 am.model      AS model_name,
                 rl.id         AS line_id,
                 rl.line_no,
                 rl.status     AS line_status
             FROM assets a
             LEFT JOIN asset_models am ON am.id = a.model_id
             LEFT JOIN wf_request_lines rl
                 ON rl.asset_id = a.id
                 AND rl.request_id = $2
                 AND rl.item_type = 'asset'
                 AND rl.status NOT IN ('cancelled')
             WHERE ${isUuid ? 'a.id = $1' : 'UPPER(a.asset_code) = UPPER($1)'}
             LIMIT 1`,
            [body.scannedCode, body.requestId]
        )

        if (rows.length === 0) {
            return reply.send({
                success: true,
                data: { match: false, message: 'Không tìm thấy thiết bị trong hệ thống' }
            })
        }

        const row = rows[0]
        const asset = {
            id: row.asset_id,
            assetCode: row.asset_code,
            name: row.asset_name,
            status: row.asset_status,
            modelName: row.model_name
        }

        if (!row.line_id) {
            return reply.send({
                success: true,
                data: {
                    match: false,
                    asset,
                    message: 'Thiết bị không có trong phiếu yêu cầu này'
                }
            })
        }

        return reply.send({
            success: true,
            data: {
                match: true,
                asset,
                lineId: row.line_id,
                lineNo: row.line_no,
                lineStatus: row.line_status
            }
        })
    })

    fastify.post('/assets/:id/assign', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:assign')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = assignmentSchema.parse(request.body)
        const result = await assetService.assignAsset(id, body, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/return', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:assign')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = returnSchema.parse(request.body)
        const result = await assetService.returnAsset(id, {
            note: body.note,
            verificationMethod: body.verificationMethod ?? null,
            verifiedAt: body.verifiedAt ?? null,
            wfRequestId: body.wfRequestId ?? null
        }, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/move', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:update')
        const { id } = assetIdParamsSchema.parse(request.params)
        const body = moveSchema.parse(request.body)
        const result = await assetService.moveAsset(id, body.locationId, ctx)
        return reply.send({ data: result })
    })

    fastify.post('/assets/:id/status', async (request, reply) => {
        const ctx = await requirePermission(request, 'assets:update')
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
