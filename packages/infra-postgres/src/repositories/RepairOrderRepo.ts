import type {
    IRepairOrderRepo,
    RepairOrderCreateInput,
    RepairOrderFilters,
    RepairOrderPage,
    RepairOrderRecord,
    RepairOrderSummary,
    RepairOrderSummaryFilters,
    RepairOrderUpdatePatch
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type RepairOrderRow = {
    id: string
    asset_id: string
    ci_id: string | null
    code: string
    title: string
    description: string | null
    severity: RepairOrderRecord['severity']
    status: RepairOrderRecord['status']
    opened_at: Date
    closed_at: Date | null
    diagnosis: string | null
    resolution: string | null
    repair_type: RepairOrderRecord['repairType']
    technician_name: string | null
    vendor_id: string | null
    labor_cost: number | string | null
    parts_cost: number | string | null
    downtime_minutes: number | null
    created_by: string | null
    correlation_id: string | null
    created_at: Date
    updated_at: Date
}

type Update = { column: string; value: unknown }

type RepairOrderSummaryRow = {
    total: string
    status_open: string
    status_diagnosing: string
    status_waiting_parts: string
    status_repaired: string
    status_closed: string
    status_canceled: string
    severity_low: string
    severity_medium: string
    severity_high: string
    severity_critical: string
    type_internal: string
    type_vendor: string
    total_labor_cost: number | string | null
    total_parts_cost: number | string | null
    total_downtime_minutes: number | string | null
    avg_downtime_minutes: number | string | null
    avg_resolution_hours: number | string | null
}

const mapRepairOrder = (row: RepairOrderRow): RepairOrderRecord => ({
    id: row.id,
    assetId: row.asset_id,
    ciId: row.ci_id ?? null,
    code: row.code,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    openedAt: row.opened_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : null,
    diagnosis: row.diagnosis,
    resolution: row.resolution,
    repairType: row.repair_type,
    technicianName: row.technician_name,
    vendorId: row.vendor_id,
    laborCost: row.labor_cost === null ? null : Number(row.labor_cost),
    partsCost: row.parts_cost === null ? null : Number(row.parts_cost),
    downtimeMinutes: row.downtime_minutes ?? null,
    createdBy: row.created_by,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
})

function buildUpdates(patch: RepairOrderUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.title !== undefined) updates.push({ column: 'title', value: patch.title })
    if (patch.description !== undefined) updates.push({ column: 'description', value: patch.description })
    if (patch.severity !== undefined) updates.push({ column: 'severity', value: patch.severity })
    if (patch.status !== undefined) updates.push({ column: 'status', value: patch.status })
    if (patch.diagnosis !== undefined) updates.push({ column: 'diagnosis', value: patch.diagnosis })
    if (patch.resolution !== undefined) updates.push({ column: 'resolution', value: patch.resolution })
    if (patch.repairType !== undefined) updates.push({ column: 'repair_type', value: patch.repairType })
    if (patch.technicianName !== undefined) updates.push({ column: 'technician_name', value: patch.technicianName })
    if (patch.vendorId !== undefined) updates.push({ column: 'vendor_id', value: patch.vendorId })
    if (patch.laborCost !== undefined) updates.push({ column: 'labor_cost', value: patch.laborCost })
    if (patch.partsCost !== undefined) updates.push({ column: 'parts_cost', value: patch.partsCost })
    if (patch.downtimeMinutes !== undefined) updates.push({ column: 'downtime_minutes', value: patch.downtimeMinutes })
    if (patch.closedAt !== undefined) updates.push({ column: 'closed_at', value: patch.closedAt })
    if (patch.correlationId !== undefined) updates.push({ column: 'correlation_id', value: patch.correlationId })
    if (patch.ciId !== undefined) updates.push({ column: 'ci_id', value: patch.ciId })
    return updates
}

function normalizePagination(filters: RepairOrderFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

function buildWhereClause(filters: RepairOrderFilters | RepairOrderSummaryFilters): { params: unknown[]; whereClause: string } {
    const params: unknown[] = []
    const conditions: string[] = []

    if (filters.assetId) {
        params.push(filters.assetId)
        conditions.push(`asset_id = $${params.length}`)
    }
    if (filters.status) {
        params.push(filters.status)
        conditions.push(`status = $${params.length}`)
    }
    if (filters.ciId) {
        params.push(filters.ciId)
        conditions.push(`ci_id = $${params.length}`)
    }
    if (filters.q) {
        params.push(`%${filters.q}%`)
        const index = params.length
        conditions.push(`(code ILIKE $${index} OR title ILIKE $${index})`)
    }
    if (filters.from) {
        params.push(filters.from)
        conditions.push(`opened_at >= $${params.length}::timestamptz`)
    }
    if (filters.to) {
        params.push(filters.to)
        conditions.push(`opened_at <= $${params.length}::timestamptz`)
    }

    return {
        params,
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    }
}

function toNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0
    return Number(value)
}

export class RepairOrderRepo implements IRepairOrderRepo {
    constructor(private pg: Queryable) { }

    async create(input: RepairOrderCreateInput): Promise<RepairOrderRecord> {
        const result = await this.pg.query<RepairOrderRow>(
            `WITH next_code AS (
                SELECT CONCAT(
                    'RO-',
                    TO_CHAR(CURRENT_DATE, 'YYYY'),
                    '-',
                    LPAD((COALESCE(MAX(NULLIF(split_part(code, '-', 3), '')::int), 0) + 1)::text, 6, '0')
                ) AS code
                FROM repair_orders
                WHERE code LIKE CONCAT('RO-', TO_CHAR(CURRENT_DATE, 'YYYY'), '-%')
             )
             INSERT INTO repair_orders (
                asset_id,
                ci_id,
                code,
                title,
                description,
                severity,
                status,
                opened_at,
                repair_type,
                technician_name,
                vendor_id,
                labor_cost,
                downtime_minutes,
                created_by,
                correlation_id
             )
             SELECT $1, $2, next_code.code, $3, $4, $5, 'open', NOW(), $6, $7, $8, $9, $10, $11, $12
             FROM next_code
             RETURNING id, asset_id, ci_id, code, title, description, severity, status, opened_at, closed_at,
                       diagnosis, resolution, repair_type, technician_name, vendor_id, labor_cost,
                       parts_cost, downtime_minutes, created_by, correlation_id, created_at, updated_at`,
            [
                input.assetId,
                input.ciId ?? null,
                input.title,
                input.description ?? null,
                input.severity,
                input.repairType,
                input.technicianName ?? null,
                input.vendorId ?? null,
                input.laborCost ?? null,
                input.downtimeMinutes ?? null,
                input.createdBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapRepairOrder(result.rows[0])
    }

    async update(id: string, patch: RepairOrderUpdatePatch): Promise<RepairOrderRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<RepairOrderRow>(
            `UPDATE repair_orders SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, asset_id, ci_id, code, title, description, severity, status, opened_at, closed_at,
                       diagnosis, resolution, repair_type, technician_name, vendor_id, labor_cost,
                       parts_cost, downtime_minutes, created_by, correlation_id, created_at, updated_at`,
            params
        )
        return result.rows[0] ? mapRepairOrder(result.rows[0]) : null
    }

    async getById(id: string): Promise<RepairOrderRecord | null> {
        const result = await this.pg.query<RepairOrderRow>(
            `SELECT id, asset_id, ci_id, code, title, description, severity, status, opened_at, closed_at,
                    diagnosis, resolution, repair_type, technician_name, vendor_id, labor_cost,
                    parts_cost, downtime_minutes, created_by, correlation_id, created_at, updated_at
             FROM repair_orders WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapRepairOrder(result.rows[0]) : null
    }

    async list(filters: RepairOrderFilters): Promise<RepairOrderPage> {
        const { params, whereClause } = buildWhereClause(filters)
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM repair_orders ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<RepairOrderRow>(
            `SELECT id, asset_id, ci_id, code, title, description, severity, status, opened_at, closed_at,
                    diagnosis, resolution, repair_type, technician_name, vendor_id, labor_cost,
                    parts_cost, downtime_minutes, created_by, correlation_id, created_at, updated_at
             FROM repair_orders
             ${whereClause}
             ORDER BY opened_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: result.rows.map(mapRepairOrder),
            total,
            page,
            limit
        }
    }

    async summary(filters: RepairOrderSummaryFilters): Promise<RepairOrderSummary> {
        const { params, whereClause } = buildWhereClause(filters)
        const result = await this.pg.query<RepairOrderSummaryRow>(
            `SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'open') AS status_open,
                COUNT(*) FILTER (WHERE status = 'diagnosing') AS status_diagnosing,
                COUNT(*) FILTER (WHERE status = 'waiting_parts') AS status_waiting_parts,
                COUNT(*) FILTER (WHERE status = 'repaired') AS status_repaired,
                COUNT(*) FILTER (WHERE status = 'closed') AS status_closed,
                COUNT(*) FILTER (WHERE status = 'canceled') AS status_canceled,
                COUNT(*) FILTER (WHERE severity = 'low') AS severity_low,
                COUNT(*) FILTER (WHERE severity = 'medium') AS severity_medium,
                COUNT(*) FILTER (WHERE severity = 'high') AS severity_high,
                COUNT(*) FILTER (WHERE severity = 'critical') AS severity_critical,
                COUNT(*) FILTER (WHERE repair_type = 'internal') AS type_internal,
                COUNT(*) FILTER (WHERE repair_type = 'vendor') AS type_vendor,
                COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS total_labor_cost,
                COALESCE(SUM(COALESCE(parts_cost, 0)), 0) AS total_parts_cost,
                COALESCE(SUM(COALESCE(downtime_minutes, 0)), 0) AS total_downtime_minutes,
                AVG(downtime_minutes) FILTER (WHERE downtime_minutes IS NOT NULL) AS avg_downtime_minutes,
                AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) / 3600.0)
                    FILTER (WHERE closed_at IS NOT NULL) AS avg_resolution_hours
             FROM repair_orders
             ${whereClause}`,
            params
        )

        const row = result.rows[0]
        const byStatus = {
            open: toNumber(row?.status_open),
            diagnosing: toNumber(row?.status_diagnosing),
            waiting_parts: toNumber(row?.status_waiting_parts),
            repaired: toNumber(row?.status_repaired),
            closed: toNumber(row?.status_closed),
            canceled: toNumber(row?.status_canceled)
        } satisfies RepairOrderSummary['byStatus']

        const bySeverity = {
            low: toNumber(row?.severity_low),
            medium: toNumber(row?.severity_medium),
            high: toNumber(row?.severity_high),
            critical: toNumber(row?.severity_critical)
        } satisfies RepairOrderSummary['bySeverity']

        const byType = {
            internal: toNumber(row?.type_internal),
            vendor: toNumber(row?.type_vendor)
        } satisfies RepairOrderSummary['byType']

        const totalLaborCost = toNumber(row?.total_labor_cost)
        const totalPartsCost = toNumber(row?.total_parts_cost)
        return {
            total: toNumber(row?.total),
            activeCount: byStatus.open + byStatus.diagnosing + byStatus.waiting_parts + byStatus.repaired,
            closedCount: byStatus.closed,
            canceledCount: byStatus.canceled,
            totalLaborCost,
            totalPartsCost,
            totalCost: totalLaborCost + totalPartsCost,
            totalDowntimeMinutes: toNumber(row?.total_downtime_minutes),
            avgDowntimeMinutes: row?.avg_downtime_minutes == null ? null : Number(row.avg_downtime_minutes),
            avgResolutionHours: row?.avg_resolution_hours == null ? null : Number(row.avg_resolution_hours),
            byStatus,
            bySeverity,
            byType
        }
    }
}
