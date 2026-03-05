/**
 * Unified Report Aggregation Routes
 * GET /v1/reports/:key  — returns { kpis, charts, table, meta }
 * GET /v1/reports/:key/drilldown — drilldown by dimension+value
 *
 * Supported report keys:
 *   assets-overview, assets-trend, assets-warranty, assets-by-location
 *   inventory-stock, inventory-movement, inventory-low-stock
 *   maintenance-sla, maintenance-status
 *   workflow-summary
 *   cmdb-overview, cmdb-data-quality
 */
import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'
import { getUserContext } from '../assets/assets.helpers.js'

export interface ReportAggregationRoutesOptions {
    pgClient: PgClient
}

const VALID_KEYS = [
    'assets-overview',
    'assets-trend',
    'assets-warranty',
    'assets-by-location',
    'inventory-stock',
    'inventory-movement',
    'inventory-low-stock',
    'maintenance-sla',
    'maintenance-status',
    'workflow-summary',
    'cmdb-overview',
    'cmdb-data-quality',
    'warehouse-stock-on-hand',
    'warehouse-valuation',
    'warehouse-reorder-alerts',
    'warehouse-fefo-lots',
    'warehouse-stock-available'
] as const

type ReportKey = typeof VALID_KEYS[number]

const filterSchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(20),
})

const drilldownSchema = filterSchema.extend({
    dimension: z.string().min(1),
    value: z.string().min(1),
})

type FilterParams = z.infer<typeof filterSchema>

function buildDateFilter(
    alias: string,
    col: string,
    dateFrom?: string,
    dateTo?: string,
    params: unknown[] = []
): string {
    const parts: string[] = []
    if (dateFrom) {
        params.push(dateFrom)
        parts.push(`${alias}.${col} >= $${params.length}`)
    }
    if (dateTo) {
        params.push(dateTo)
        parts.push(`${alias}.${col} <= $${params.length}`)
    }
    return parts.join(' AND ')
}

export async function reportAggregationRoutes(
    fastify: FastifyInstance,
    opts: ReportAggregationRoutesOptions
): Promise<void> {
    const pool = opts.pgClient.getPool()

    // ─── Main unified endpoint ─────────────────────────────────────────────
    fastify.get<{ Params: { key: string } }>('/reports/:key', async (request, reply) => {
        getUserContext(request)
        const { key } = request.params

        if (!VALID_KEYS.includes(key as ReportKey)) {
            return reply.status(404).send({ error: `Unknown report key: ${key}` })
        }

        const filters = filterSchema.parse(request.query)
        const result = await runReport(pool, key as ReportKey, filters)

        return reply.send({
            ...result,
            meta: {
                reportKey: key,
                generatedAt: new Date().toISOString(),
                filters
            }
        })
    })

    // ─── Drilldown endpoint ────────────────────────────────────────────────
    fastify.get<{ Params: { key: string } }>('/reports/:key/drilldown', async (request, reply) => {
        getUserContext(request)
        const { key } = request.params

        if (!VALID_KEYS.includes(key as ReportKey)) {
            return reply.status(404).send({ error: `Unknown report key: ${key}` })
        }

        const params = drilldownSchema.parse(request.query)
        const result = await runDrilldown(pool, key as ReportKey, params)

        return reply.send({
            ...result,
            meta: { reportKey: key, dimension: params.dimension, value: params.value, generatedAt: new Date().toISOString() }
        })
    })

    // ─── List available reports ────────────────────────────────────────────
    fastify.get('/reports', async (_request, reply) => {
        return reply.send({
            data: VALID_KEYS.map(k => ({
                key: k,
                module: k.split('-')[0],
                title: REPORT_TITLES[k]
            }))
        })
    })
}

const REPORT_TITLES: Record<ReportKey, string> = {
    'assets-overview': 'Tổng quan tài sản',
    'assets-trend': 'Biến động tài sản theo thời gian',
    'assets-warranty': 'Tài sản sắp hết bảo hành',
    'assets-by-location': 'Phân bổ tài sản theo vị trí',
    'inventory-stock': 'Tồn kho theo kho',
    'inventory-movement': 'Nhập / Xuất kho theo thời gian',
    'inventory-low-stock': 'Cảnh báo tồn thấp',
    'maintenance-sla': 'SLA bảo trì & sửa chữa',
    'maintenance-status': 'Trạng thái phiếu bảo trì',
    'workflow-summary': 'Tổng quan yêu cầu / phê duyệt',
    'cmdb-overview': 'CI theo loại (CMDB)',
    'cmdb-data-quality': 'Chất lượng dữ liệu CMDB',
    'warehouse-stock-on-hand': 'Tồn kho hiện tại theo kho',
    'warehouse-valuation': 'Định giá tồn kho',
    'warehouse-reorder-alerts': 'Cảnh báo cần đặt hàng',
    'warehouse-fefo-lots': 'Quản lý lô hàng theo FEFO',
    'warehouse-stock-available': 'Hàng tồn có thể sử dụng',
}

// ─── Report runners ─────────────────────────────────────────────────────────

async function runReport(pool: import('pg').Pool, key: ReportKey, f: FilterParams) {
    switch (key) {
        case 'assets-overview': return assetsOverview(pool, f)
        case 'assets-trend': return assetsTrend(pool, f)
        case 'assets-warranty': return assetsWarranty(pool, f)
        case 'assets-by-location': return assetsByLocation(pool, f)
        case 'inventory-stock': return inventoryStock(pool, f)
        case 'inventory-movement': return inventoryMovement(pool, f)
        case 'inventory-low-stock': return inventoryLowStock(pool, f)
        case 'maintenance-sla': return maintenanceSla(pool, f)
        case 'maintenance-status': return maintenanceStatus(pool, f)
        case 'workflow-summary': return workflowSummary(pool, f)
        case 'cmdb-overview': return cmdbOverview(pool, f)
        case 'cmdb-data-quality': return cmdbDataQuality(pool, f)
        case 'warehouse-stock-on-hand': return warehouseStockOnHand(pool, f)
        case 'warehouse-valuation': return warehouseValuation(pool, f)
        case 'warehouse-reorder-alerts': return warehouseReorderAlerts(pool, f)
        case 'warehouse-fefo-lots': return warehouseFEFOLots(pool, f)
        case 'warehouse-stock-available': return warehouseStockAvailable(pool, f)
    }
}

type Params = unknown[]

function p(params: Params, value: unknown): string {
    params.push(value)
    return `$${params.length}`
}

// ─── 1. Assets Overview ──────────────────────────────────────────────────────

async function assetsOverview(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateCond = f.dateFrom || f.dateTo
        ? `AND a.created_at BETWEEN ${f.dateFrom ? p(params, f.dateFrom) : 'to_timestamp(0)'} AND ${f.dateTo ? p(params, f.dateTo + ' 23:59:59') : 'NOW()'}`
        : ''
    const locCond = f.locationId ? `AND a.location_id = ${p(params, f.locationId)}` : ''
    const catCond = f.categoryId ? `AND m.category_id = ${p(params, f.categoryId)}` : ''

    const [statusRows, categoryRows, locationRows, totalRow] = await Promise.all([
        pool.query<{ status: string; cnt: string }>(`
            SELECT a.status, COUNT(*) AS cnt
            FROM assets a
            LEFT JOIN asset_models m ON a.model_id = m.id
            WHERE 1=1 ${dateCond} ${locCond} ${catCond}
            GROUP BY a.status
            ORDER BY cnt DESC
        `, params),
        pool.query<{ name: string; cnt: string }>(`
            SELECT COALESCE(c.name,'Unknown') AS name, COUNT(*) AS cnt
            FROM assets a
            LEFT JOIN asset_models m ON a.model_id = m.id
            LEFT JOIN asset_categories c ON m.category_id = c.id
            WHERE 1=1 ${dateCond} ${locCond} ${catCond}
            GROUP BY c.name
            ORDER BY cnt DESC
            LIMIT 10
        `, params),
        pool.query<{ name: string; cnt: string }>(`
            SELECT COALESCE(l.name,'(Chưa xác định)') AS name, COUNT(*) AS cnt
            FROM assets a
            LEFT JOIN asset_models m ON a.model_id = m.id
            LEFT JOIN locations l ON a.location_id = l.id
            WHERE 1=1 ${dateCond} ${locCond} ${catCond}
            GROUP BY l.name
            ORDER BY cnt DESC
            LIMIT 10
        `, params),
        pool.query<{ total: string; in_use: string; in_stock: string; in_repair: string; retired: string; lost: string }>(
            `SELECT COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE a.status='in_use')    AS in_use,
                    COUNT(*) FILTER (WHERE a.status='in_stock')  AS in_stock,
                    COUNT(*) FILTER (WHERE a.status='in_repair') AS in_repair,
                    COUNT(*) FILTER (WHERE a.status='retired')   AS retired,
                    COUNT(*) FILTER (WHERE a.status='lost')      AS lost
             FROM assets a
             LEFT JOIN asset_models m ON a.model_id = m.id
             WHERE 1=1 ${dateCond} ${locCond} ${catCond}
            `, params)
    ])

    const t = totalRow.rows[0]
    const offset = (f.page - 1) * f.pageSize
    const tableParams: Params = [...params]
    tableParams.push(f.pageSize)
    const tableRows = await pool.query<{
        id: string; asset_code: string; model_name: string | null; category_name: string | null;
        location_name: string | null; status: string; created_at: Date
    }>(`
        SELECT a.id, a.asset_code, m.model AS model_name,
               c.name AS category_name, l.name AS location_name,
               a.status, a.created_at
        FROM assets a
        LEFT JOIN asset_models m ON a.model_id = m.id
        LEFT JOIN asset_categories c ON m.category_id = c.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE 1=1 ${dateCond} ${locCond} ${catCond}
        ORDER BY a.created_at DESC
        LIMIT ${f.pageSize} OFFSET ${offset}
    `, params)

    return {
        kpis: [
            { key: 'total', label: 'Tổng tài sản', value: Number(t?.total ?? 0), unit: '' },
            { key: 'in_use', label: 'Đang sử dụng', value: Number(t?.in_use ?? 0), unit: '' },
            { key: 'in_stock', label: 'Trong kho', value: Number(t?.in_stock ?? 0), unit: '' },
            { key: 'in_repair', label: 'Đang sửa chữa', value: Number(t?.in_repair ?? 0), unit: '' },
            { key: 'lost', label: 'Mất / Thanh lý', value: Number((t?.lost ?? 0)), unit: '' },
        ],
        charts: {
            byStatus: { labels: statusRows.rows.map(r => r.status), series: statusRows.rows.map(r => Number(r.cnt)) },
            byCategory: { labels: categoryRows.rows.map(r => r.name), series: categoryRows.rows.map(r => Number(r.cnt)) },
            byLocation: { labels: locationRows.rows.map(r => r.name), series: locationRows.rows.map(r => Number(r.cnt)) },
        },
        table: {
            rows: tableRows.rows.map(r => ({
                id: r.id,
                code: r.asset_code,
                model: r.model_name,
                category: r.category_name,
                location: r.location_name,
                status: r.status,
                createdAt: r.created_at
            })),
            total: Number(t?.total ?? 0),
            page: f.page,
            pageSize: f.pageSize
        }
    }
}

// ─── 2. Assets Trend ─────────────────────────────────────────────────────────

async function assetsTrend(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateFrom = f.dateFrom ?? new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10)
    const dateTo = f.dateTo ?? new Date().toISOString().slice(0, 10)

    const trendRows = await pool.query<{ month: string; created: string; retired: string }>(`
        SELECT TO_CHAR(DATE_TRUNC('month', a.created_at), 'YYYY-MM') AS month,
               COUNT(*) FILTER (WHERE a.status != 'retired' AND a.status != 'disposed') AS created,
               COUNT(*) FILTER (WHERE a.status IN ('retired','disposed')) AS retired
        FROM assets a
        WHERE a.created_at BETWEEN ${p(params, dateFrom)} AND ${p(params, dateTo + ' 23:59:59')}
        GROUP BY DATE_TRUNC('month', a.created_at)
        ORDER BY DATE_TRUNC('month', a.created_at)
    `, params)

    const months = trendRows.rows.map(r => r.month)
    const created = trendRows.rows.map(r => Number(r.created))
    const retired = trendRows.rows.map(r => Number(r.retired))
    const peak = Math.max(...created, 0)
    const avgMonthly = created.length ? Math.round(created.reduce((a, b) => a + b, 0) / created.length) : 0

    return {
        kpis: [
            { key: 'peak_month', label: 'Tháng cao nhất', value: peak, unit: 'tài sản' },
            { key: 'avg_monthly', label: 'TB tài sản/tháng', value: avgMonthly, unit: 'tài sản' },
            { key: 'months_tracked', label: 'Số tháng theo dõi', value: months.length, unit: 'tháng' },
        ],
        charts: {
            trend: {
                labels: months, series: [
                    { name: 'Tạo mới', data: created },
                    { name: 'Thanh lý', data: retired }
                ]
            }
        },
        table: { rows: trendRows.rows.map(r => ({ month: r.month, created: Number(r.created), retired: Number(r.retired) })), total: trendRows.rows.length, page: 1, pageSize: 200 }
    }
}

// ─── 3. Assets Warranty ──────────────────────────────────────────────────────

async function assetsWarranty(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const locCond = f.locationId ? `AND a.location_id = ${p(params, f.locationId)}` : ''

    const rows = await pool.query<{
        bucket: string; cnt: string
    }>(`
        SELECT
          CASE
            WHEN a.warranty_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'  THEN '0–30 ngày'
            WHEN a.warranty_end BETWEEN NOW() AND NOW() + INTERVAL '60 days'  THEN '31–60 ngày'
            WHEN a.warranty_end BETWEEN NOW() AND NOW() + INTERVAL '90 days'  THEN '61–90 ngày'
            WHEN a.warranty_end < NOW() THEN 'Đã hết hạn'
            ELSE '>90 ngày'
          END AS bucket,
          COUNT(*) AS cnt
        FROM assets a
        WHERE a.warranty_end IS NOT NULL ${locCond}
        GROUP BY bucket
        ORDER BY bucket
    `, params)

    const tableRows = await pool.query<{
        id: string; asset_code: string; model_name: string | null; location_name: string | null; warranty_end: Date
    }>(`
        SELECT a.id, a.asset_code, m.model AS model_name, l.name AS location_name, a.warranty_end
        FROM assets a
        LEFT JOIN asset_models m ON a.model_id = m.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.warranty_end IS NOT NULL
          AND a.warranty_end <= NOW() + INTERVAL '90 days'
          ${locCond}
        ORDER BY a.warranty_end
        LIMIT 100
    `, params)

    const soonCount = tableRows.rowCount ?? 0

    return {
        kpis: [
            { key: 'expiring_30', label: 'Hết hạn trong 30 ngày', value: Number(rows.rows.find(r => r.bucket === '0–30 ngày')?.cnt ?? 0), unit: '' },
            { key: 'expiring_60', label: 'Hết hạn trong 60 ngày', value: Number(rows.rows.find(r => r.bucket === '31–60 ngày')?.cnt ?? 0), unit: '' },
            { key: 'expiring_90', label: 'Hết hạn trong 90 ngày', value: Number(rows.rows.find(r => r.bucket === '61–90 ngày')?.cnt ?? 0), unit: '' },
            { key: 'total_expiring', label: 'Sắp hết hạn (<90 ngày)', value: soonCount, unit: '' },
        ],
        charts: {
            byBucket: { labels: rows.rows.map(r => r.bucket), series: rows.rows.map(r => Number(r.cnt)) }
        },
        table: {
            rows: tableRows.rows.map(r => ({
                id: r.id, code: r.asset_code, model: r.model_name, location: r.location_name,
                warrantyEnd: r.warranty_end
            })),
            total: soonCount, page: 1, pageSize: 100
        }
    }
}

// ─── 4. Assets By Location ───────────────────────────────────────────────────

async function assetsByLocation(pool: import('pg').Pool, _f: FilterParams) {
    const rows = await pool.query<{ location: string; total: string; in_use: string; in_stock: string }>(`
        SELECT COALESCE(l.name, '(Chưa xác định)') AS location,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE a.status = 'in_use')   AS in_use,
               COUNT(*) FILTER (WHERE a.status = 'in_stock') AS in_stock
        FROM assets a
        LEFT JOIN locations l ON a.location_id = l.id
        GROUP BY l.name
        ORDER BY total DESC
        LIMIT 20
    `)

    return {
        kpis: [
            { key: 'locations', label: 'Số vị trí có tài sản', value: rows.rows.length, unit: '' },
            { key: 'top_location', label: 'Vị trí nhiều nhất', value: rows.rows[0]?.location ?? '-', unit: '' },
        ],
        charts: {
            byLocation: {
                labels: rows.rows.map(r => r.location),
                series: [
                    { name: 'Đang dùng', data: rows.rows.map(r => Number(r.in_use)) },
                    { name: 'Trong kho', data: rows.rows.map(r => Number(r.in_stock)) },
                ]
            }
        },
        table: {
            rows: rows.rows.map(r => ({ location: r.location, total: Number(r.total), in_use: Number(r.in_use), in_stock: Number(r.in_stock) })),
            total: rows.rows.length, page: 1, pageSize: 20
        }
    }
}

// ─── 5. Inventory Stock ──────────────────────────────────────────────────────

async function inventoryStock(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const [kpiRow, stockRows] = await Promise.all([
        pool.query<{ total_lines: string; total_qty: string; warehouses: string }>(`
            SELECT COUNT(*) AS total_lines,
                   SUM(sps.on_hand) AS total_qty,
                   COUNT(DISTINCT sps.warehouse_id) AS warehouses
            FROM spare_part_stock sps
            WHERE sps.on_hand > 0 ${whCond}
        `, params),
        pool.query<{ part_name: string; part_code: string; warehouse_name: string; on_hand: string; reserved: string }>(`
            SELECT p.part_name, p.part_code,
                   COALESCE(w.name,'?') AS warehouse_name,
                   sps.on_hand, sps.reserved
            FROM spare_part_stock sps
            JOIN spare_parts p ON p.id = sps.part_id
            LEFT JOIN warehouses w ON w.id = sps.warehouse_id
            WHERE sps.on_hand > 0 ${whCond}
            ORDER BY sps.on_hand DESC
            LIMIT 30
        `, params)
    ])

    const k = kpiRow.rows[0]
    return {
        kpis: [
            { key: 'total_lines', label: 'Mặt hàng tồn', value: Number(k?.total_lines ?? 0), unit: '' },
            { key: 'total_qty', label: 'Tổng số lượng tồn', value: Number(k?.total_qty ?? 0), unit: '' },
            { key: 'warehouses', label: 'Kho có hàng', value: Number(k?.warehouses ?? 0), unit: '' },
        ],
        charts: {
            topItems: {
                labels: stockRows.rows.slice(0, 10).map(r => r.part_name),
                series: stockRows.rows.slice(0, 10).map(r => Number(r.on_hand))
            }
        },
        table: {
            rows: stockRows.rows.map(r => ({
                partName: r.part_name, partCode: r.part_code, warehouse: r.warehouse_name,
                onHand: Number(r.on_hand), reserved: Number(r.reserved ?? 0)
            })),
            total: Number(k?.total_lines ?? 0), page: f.page, pageSize: f.pageSize
        }
    }
}

// ─── 6. Inventory Movement ───────────────────────────────────────────────────

async function inventoryMovement(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateFrom = f.dateFrom ?? new Date(Date.now() - 180 * 86400 * 1000).toISOString().slice(0, 10)
    const dateTo = f.dateTo ?? new Date().toISOString().slice(0, 10)
    const whCond = f.warehouseId ? `AND sd.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const rows = await pool.query<{ month: string; receipts: string; issues: string }>(`
        SELECT TO_CHAR(DATE_TRUNC('month', sd.doc_date), 'YYYY-MM') AS month,
               COUNT(*) FILTER (WHERE sd.doc_type = 'receipt') AS receipts,
               COUNT(*) FILTER (WHERE sd.doc_type = 'issue')   AS issues
        FROM stock_documents sd
        WHERE sd.doc_date BETWEEN ${p(params, dateFrom)} AND ${p(params, dateTo)}
          AND sd.status = 'posted'
          ${whCond}
        GROUP BY DATE_TRUNC('month', sd.doc_date)
        ORDER BY DATE_TRUNC('month', sd.doc_date)
    `, params)

    const totalReceipts = rows.rows.reduce((s, r) => s + Number(r.receipts), 0)
    const totalIssues = rows.rows.reduce((s, r) => s + Number(r.issues), 0)

    return {
        kpis: [
            { key: 'total_receipts', label: 'Tổng phiếu nhập', value: totalReceipts, unit: '' },
            { key: 'total_issues', label: 'Tổng phiếu xuất', value: totalIssues, unit: '' },
            { key: 'net', label: 'Chênh lệch (Nhập−Xuất)', value: totalReceipts - totalIssues, unit: '' },
        ],
        charts: {
            movement: {
                labels: rows.rows.map(r => r.month),
                series: [
                    { name: 'Nhập kho', data: rows.rows.map(r => Number(r.receipts)) },
                    { name: 'Xuất kho', data: rows.rows.map(r => Number(r.issues)) },
                ]
            }
        },
        table: {
            rows: rows.rows.map(r => ({ month: r.month, receipts: Number(r.receipts), issues: Number(r.issues) })),
            total: rows.rows.length, page: 1, pageSize: 200
        }
    }
}

// ─── 7. Inventory Low Stock ──────────────────────────────────────────────────

async function inventoryLowStock(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const rows = await pool.query<{
        part_name: string; part_code: string; warehouse_name: string;
        on_hand: string; min_level: string; shortfall: string
    }>(`
        SELECT p.part_name, p.part_code,
               COALESCE(w.name,'?') AS warehouse_name,
               sps.on_hand, p.min_level,
               (p.min_level - sps.on_hand) AS shortfall
        FROM spare_part_stock sps
        JOIN spare_parts p ON p.id = sps.part_id
        LEFT JOIN warehouses w ON w.id = sps.warehouse_id
        WHERE p.min_level IS NOT NULL AND sps.on_hand < p.min_level
        ${whCond}
        ORDER BY shortfall DESC
        LIMIT 100
    `, params)

    return {
        kpis: [
            { key: 'alert_count', label: 'Mặt hàng dưới mức tối thiểu', value: rows.rowCount ?? 0, unit: '' },
        ],
        charts: {
            lowStock: { labels: rows.rows.slice(0, 10).map(r => r.part_name), series: rows.rows.slice(0, 10).map(r => Number(r.shortfall)) }
        },
        table: {
            rows: rows.rows.map(r => ({
                partName: r.part_name, partCode: r.part_code, warehouse: r.warehouse_name,
                onHand: Number(r.on_hand), minLevel: Number(r.min_level), shortfall: Number(r.shortfall)
            })),
            total: rows.rowCount ?? 0, page: 1, pageSize: 100
        }
    }
}

// ─── 8. Maintenance SLA ──────────────────────────────────────────────────────

async function maintenanceSla(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateCond = f.dateFrom || f.dateTo
        ? `AND mt.opened_at BETWEEN ${f.dateFrom ? p(params, f.dateFrom) : 'to_timestamp(0)'} AND ${f.dateTo ? p(params, f.dateTo + ' 23:59:59') : 'NOW()'}`
        : ''

    const rows = await pool.query<{
        severity: string; cnt: string; closed: string; avg_hours: string | null
    }>(`
        SELECT mt.severity,
               COUNT(*) AS cnt,
               COUNT(*) FILTER (WHERE mt.closed_at IS NOT NULL) AS closed,
               AVG(EXTRACT(EPOCH FROM (COALESCE(mt.closed_at, NOW()) - mt.opened_at))/3600)
                   FILTER (WHERE mt.closed_at IS NOT NULL) AS avg_hours
        FROM maintenance_tickets mt
        WHERE 1=1 ${dateCond}
        GROUP BY mt.severity
        ORDER BY cnt DESC
    `, params)

    const kpiRow = await pool.query<{ total: string; closed: string; open: string; avg_h: string | null }>(`
        SELECT COUNT(*)  AS total,
               COUNT(*) FILTER (WHERE closed_at IS NOT NULL) AS closed,
               COUNT(*) FILTER (WHERE closed_at IS NULL)     AS open,
               AVG(EXTRACT(EPOCH FROM (closed_at - opened_at))/3600) FILTER (WHERE closed_at IS NOT NULL) AS avg_h
        FROM maintenance_tickets
        WHERE 1=1 ${dateCond}
    `, params)

    const k = kpiRow.rows[0]
    const closedPct = Number(k?.total ?? 0) > 0 ? Math.round((Number(k?.closed ?? 0) / Number(k?.total)) * 100) : 0

    return {
        kpis: [
            { key: 'total', label: 'Tổng phiếu', value: Number(k?.total ?? 0), unit: '' },
            { key: 'open', label: 'Đang mở', value: Number(k?.open ?? 0), unit: '' },
            { key: 'closed', label: 'Đã đóng', value: Number(k?.closed ?? 0), unit: '' },
            { key: 'avg_hours', label: 'Thời gian xử lý TB', value: Math.round(Number(k?.avg_h ?? 0)), unit: 'giờ' },
            { key: 'closed_pct', label: 'Tỉ lệ hoàn thành', value: closedPct, unit: '%' },
        ],
        charts: {
            bySeverity: {
                labels: rows.rows.map(r => r.severity),
                series: [
                    { name: 'Tổng', data: rows.rows.map(r => Number(r.cnt)) },
                    { name: 'Đã đóng', data: rows.rows.map(r => Number(r.closed)) },
                ]
            },
            avgHours: {
                labels: rows.rows.map(r => r.severity),
                series: rows.rows.map(r => Math.round(Number(r.avg_hours ?? 0)))
            }
        },
        table: {
            rows: rows.rows.map(r => ({
                severity: r.severity, total: Number(r.cnt), closed: Number(r.closed),
                avgHours: Math.round(Number(r.avg_hours ?? 0))
            })),
            total: rows.rows.length, page: 1, pageSize: 20
        }
    }
}

// ─── 9. Maintenance Status ───────────────────────────────────────────────────

async function maintenanceStatus(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateCond = f.dateFrom || f.dateTo
        ? `WHERE mt.opened_at BETWEEN ${f.dateFrom ? p(params, f.dateFrom) : 'to_timestamp(0)'} AND ${f.dateTo ? p(params, f.dateTo + ' 23:59:59') : 'NOW()'}`
        : ''

    const statusRows = await pool.query<{ status: string; cnt: string }>(`
        SELECT mt.status, COUNT(*) AS cnt
        FROM maintenance_tickets mt
        ${dateCond}
        GROUP BY mt.status
        ORDER BY cnt DESC
    `, params)

    const tableRows = await pool.query<{ id: string; title: string; status: string; severity: string; opened_at: Date; asset_code: string | null }>(`
        SELECT mt.id, mt.title, mt.status, mt.severity, mt.opened_at,
               a.asset_code
        FROM maintenance_tickets mt
        LEFT JOIN assets a ON a.id = mt.asset_id
        ${dateCond}
        ORDER BY mt.opened_at DESC
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
    `, params)

    const total = statusRows.rows.reduce((s, r) => s + Number(r.cnt), 0)
    return {
        kpis: statusRows.rows.map(r => ({
            key: r.status, label: r.status, value: Number(r.cnt), unit: ''
        })),
        charts: {
            byStatus: { labels: statusRows.rows.map(r => r.status), series: statusRows.rows.map(r => Number(r.cnt)) }
        },
        table: {
            rows: tableRows.rows.map(r => ({
                id: r.id, title: r.title, status: r.status, severity: r.severity,
                openedAt: r.opened_at, asset: r.asset_code
            })),
            total, page: f.page, pageSize: f.pageSize
        }
    }
}

// ─── 10. Workflow Summary ─────────────────────────────────────────────────────

async function workflowSummary(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const dateCond = f.dateFrom || f.dateTo
        ? `WHERE wr.created_at BETWEEN ${f.dateFrom ? p(params, f.dateFrom) : 'to_timestamp(0)'} AND ${f.dateTo ? p(params, f.dateTo + ' 23:59:59') : 'NOW()'}`
        : ''

    // Check if wf_requests table exists; if not, return empty
    const tableCheck = await pool.query<{ exists: boolean }>(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables WHERE table_name='wf_requests'
        ) AS exists
    `)
    if (!tableCheck.rows[0]?.exists) {
        return { kpis: [], charts: {}, table: { rows: [], total: 0, page: 1, pageSize: 20 } }
    }

    const [statusRows, typeRows] = await Promise.all([
        pool.query<{ status: string; cnt: string }>(`
            SELECT wr.status, COUNT(*) AS cnt
            FROM wf_requests wr ${dateCond}
            GROUP BY wr.status ORDER BY cnt DESC
        `, params),
        pool.query<{ request_type: string; cnt: string }>(`
            SELECT wr.request_type, COUNT(*) AS cnt
            FROM wf_requests wr ${dateCond}
            GROUP BY wr.request_type ORDER BY cnt DESC LIMIT 10
        `, params)
    ])

    const total = statusRows.rows.reduce((s, r) => s + Number(r.cnt), 0)

    const tableRows = await pool.query<{ id: string; request_type: string; status: string; created_at: Date }>(`
        SELECT wr.id, wr.request_type, wr.status, wr.created_at
        FROM wf_requests wr
        ${dateCond}
        ORDER BY wr.created_at DESC
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
    `, params)

    const approvedCount = Number(statusRows.rows.find(r => r.status === 'approved')?.cnt ?? 0)
    const rejectedCount = Number(statusRows.rows.find(r => r.status === 'rejected')?.cnt ?? 0)
    const approvalRate = total > 0 ? Math.round((approvedCount / total) * 100) : 0

    return {
        kpis: [
            { key: 'total', label: 'Tổng yêu cầu', value: total, unit: '' },
            { key: 'pending', label: 'Đang chờ duyệt', value: Number(statusRows.rows.find(r => r.status === 'in_review' || r.status === 'submitted')?.cnt ?? 0), unit: '' },
            { key: 'approved', label: 'Đã phê duyệt', value: approvedCount, unit: '' },
            { key: 'rejected', label: 'Bị từ chối', value: rejectedCount, unit: '' },
            { key: 'approval_rate', label: 'Tỉ lệ phê duyệt', value: approvalRate, unit: '%' },
        ],
        charts: {
            byStatus: { labels: statusRows.rows.map(r => r.status), series: statusRows.rows.map(r => Number(r.cnt)) },
            byType: { labels: typeRows.rows.map(r => r.request_type), series: typeRows.rows.map(r => Number(r.cnt)) },
        },
        table: {
            rows: tableRows.rows.map(r => ({ id: r.id, type: r.request_type, status: r.status, createdAt: r.created_at })),
            total, page: f.page, pageSize: f.pageSize
        }
    }
}

// ─── 11. CMDB Overview ───────────────────────────────────────────────────────

async function cmdbOverview(pool: import('pg').Pool, _f: FilterParams) {
    const [typeRows, kpiRow, relRow] = await Promise.all([
        pool.query<{ type_name: string; cnt: string; active: string }>(`
            SELECT COALESCE(t.name,'Unknown') AS type_name, COUNT(c.id) AS cnt,
                   COUNT(c.id) FILTER (WHERE c.status='active') AS active
            FROM cmdb_cis c
            LEFT JOIN cmdb_ci_types t ON t.id = c.type_id
            GROUP BY t.name ORDER BY cnt DESC
        `),
        pool.query<{ total_ci: string; active_ci: string }>(`
            SELECT COUNT(*) AS total_ci, COUNT(*) FILTER (WHERE status='active') AS active_ci
            FROM cmdb_cis
        `),
        pool.query<{ total_rel: string }>(`SELECT COUNT(*) AS total_rel FROM cmdb_relationships`)
    ])

    const k = kpiRow.rows[0]
    return {
        kpis: [
            { key: 'total_ci', label: 'Tổng CI', value: Number(k?.total_ci ?? 0), unit: '' },
            { key: 'active_ci', label: 'CI đang hoạt động', value: Number(k?.active_ci ?? 0), unit: '' },
            { key: 'types', label: 'Số loại CI', value: typeRows.rows.length, unit: '' },
            { key: 'relations', label: 'Quan hệ đang hoạt động', value: Number(relRow.rows[0]?.total_rel ?? 0), unit: '' },
        ],
        charts: {
            byType: { labels: typeRows.rows.map(r => r.type_name), series: typeRows.rows.map(r => Number(r.cnt)) },
            activeByType: {
                labels: typeRows.rows.map(r => r.type_name),
                series: [
                    { name: 'Hoạt động', data: typeRows.rows.map(r => Number(r.active)) },
                    { name: 'Khác', data: typeRows.rows.map(r => Number(r.cnt) - Number(r.active)) },
                ]
            }
        },
        table: {
            rows: typeRows.rows.map(r => ({ typeName: r.type_name, total: Number(r.cnt), active: Number(r.active) })),
            total: typeRows.rows.length, page: 1, pageSize: 20
        }
    }
}

// ─── 12. CMDB Data Quality ───────────────────────────────────────────────────

async function cmdbDataQuality(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []

    // CIs with no attribute values at all (no data populated)
    const rows = await pool.query<{ id: string; ci_code: string; name: string; type_name: string; attr_count: string }>(`
        SELECT c.id, c.ci_code, c.name,
               COALESCE(t.name,'Unknown') AS type_name,
               COUNT(v.id) AS attr_count
        FROM cmdb_cis c
        LEFT JOIN cmdb_ci_types t ON t.id = c.type_id
        LEFT JOIN cmdb_ci_attribute_values v ON v.ci_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id, c.ci_code, c.name, t.name
        HAVING COUNT(v.id) = 0
        ORDER BY c.ci_code
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
    `, params)

    const countRow = await pool.query<{ cnt: string }>(`
        SELECT COUNT(*) AS cnt FROM cmdb_cis c
        LEFT JOIN cmdb_ci_attribute_values v ON v.ci_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id
        HAVING COUNT(v.id) = 0
    `)

    const orphanedRels = await pool.query<{ cnt: string }>(`
        SELECT COUNT(*) AS cnt FROM cmdb_relationships cr
        WHERE NOT EXISTS (SELECT 1 FROM cmdb_cis c1 WHERE c1.id = cr.from_ci_id)
           OR NOT EXISTS (SELECT 1 FROM cmdb_cis c2 WHERE c2.id = cr.to_ci_id)
    `)

    return {
        kpis: [
            { key: 'missing_attrs', label: 'CI thiếu dữ liệu', value: countRow.rowCount ?? 0, unit: '' },
            { key: 'orphaned_rels', label: 'Quan hệ lỗi (orphan)', value: Number(orphanedRels.rows[0]?.cnt ?? 0), unit: '' },
        ],
        charts: {},
        table: {
            rows: rows.rows.map(r => ({ id: r.id, ciCode: r.ci_code, name: r.name, type: r.type_name, attrCount: Number(r.attr_count) })),
            total: countRow.rowCount ?? 0, page: f.page, pageSize: f.pageSize
        }
    }
}

// ─── Drilldown ────────────────────────────────────────────────────────────────

async function runDrilldown(pool: import('pg').Pool, key: ReportKey, p_: z.infer<typeof drilldownSchema>) {
    const params: Params = []
    const { dimension, value } = p_

    if (key === 'assets-overview' || key === 'assets-trend' || key === 'assets-by-location') {
        let cond = ''
        if (dimension === 'status') { params.push(value); cond = `AND a.status = $${params.length}` }
        if (dimension === 'category') { params.push(value); cond = `AND cat.name = $${params.length}` }
        if (dimension === 'location') { params.push(value); cond = `AND l.name = $${params.length}` }

        const rows = await pool.query<{
            id: string; asset_code: string; model_name: string | null; category: string | null; location: string | null; status: string
        }>(`
            SELECT a.id, a.asset_code, m.model AS model_name, cat.name AS category, l.name AS location, a.status
            FROM assets a
            LEFT JOIN asset_models m ON a.model_id = m.id
            LEFT JOIN asset_categories cat ON m.category_id = cat.id
            LEFT JOIN locations l ON a.location_id = l.id
            WHERE 1=1 ${cond}
            ORDER BY a.created_at DESC LIMIT 100
        `, params)

        return { rows: rows.rows, total: rows.rowCount ?? 0, dimension, value }
    }

    if (key === 'maintenance-status' || key === 'maintenance-sla') {
        params.push(value)
        const rows = await pool.query<{ id: string; title: string; status: string; severity: string; opened_at: Date }>(`
            SELECT mt.id, mt.title, mt.status, mt.severity, mt.opened_at
            FROM maintenance_tickets mt
            WHERE mt.${dimension === 'status' ? 'status' : 'severity'} = $1
            ORDER BY mt.opened_at DESC LIMIT 100
        `, params)
        return { rows: rows.rows, total: rows.rowCount ?? 0, dimension, value }
    }

    return { rows: [], total: 0, dimension, value }
}

// ─── Warehouse Reports ───────────────────────────────────────────────────────

async function warehouseStockOnHand(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const [kpiRow, rows] = await Promise.all([
        pool.query<{ lines: string; total_qty: string; wh_count: string }>(`
            SELECT COUNT(*) AS lines, COALESCE(SUM(sps.on_hand),0) AS total_qty,
                   COUNT(DISTINCT sps.warehouse_id) AS wh_count
            FROM spare_part_stock sps WHERE sps.on_hand > 0 ${whCond}
        `, params),
        pool.query<{ part_name: string; part_code: string; warehouse_name: string; on_hand: string; reserved: string }>(`
            SELECT sp.part_name, sp.part_code, COALESCE(w.name,'?') AS warehouse_name,
                   sps.on_hand, sps.reserved
            FROM spare_part_stock sps
            JOIN spare_parts sp ON sp.id = sps.part_id
            LEFT JOIN warehouses w ON w.id = sps.warehouse_id
            WHERE sps.on_hand > 0 ${whCond}
            ORDER BY sps.on_hand DESC
            LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
        `, params)
    ])
    const k = kpiRow.rows[0]
    return {
        kpis: [
            { key: 'lines', label: 'Mặt hàng tồn', value: Number(k?.lines ?? 0), unit: '' },
            { key: 'total_qty', label: 'Tổng số lượng', value: Number(k?.total_qty ?? 0), unit: '' },
            { key: 'wh_count', label: 'Kho có hàng', value: Number(k?.wh_count ?? 0), unit: '' },
        ],
        charts: { topItems: { labels: rows.rows.slice(0, 10).map(r => r.part_name), series: rows.rows.slice(0, 10).map(r => Number(r.on_hand)) } },
        table: {
            rows: rows.rows.map(r => ({ partName: r.part_name, partCode: r.part_code, warehouse: r.warehouse_name, onHand: Number(r.on_hand), reserved: Number(r.reserved ?? 0) })),
            total: Number(k?.lines ?? 0), page: f.page, pageSize: f.pageSize
        }
    }
}

async function warehouseValuation(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const [kpiRow, rows] = await Promise.all([
        pool.query<{ total_value: string; lines: string }>(`
            SELECT COALESCE(SUM(sps.on_hand * COALESCE(sp.unit_cost, 0)), 0) AS total_value,
                   COUNT(*) AS lines
            FROM spare_part_stock sps
            JOIN spare_parts sp ON sp.id = sps.part_id
            WHERE sps.on_hand > 0 ${whCond}
        `, params),
        pool.query<{ part_name: string; warehouse_name: string; on_hand: string; unit_cost: string; total_value: string }>(`
            SELECT sp.part_name, COALESCE(w.name,'?') AS warehouse_name,
                   sps.on_hand, COALESCE(sp.unit_cost,0) AS unit_cost,
                   (sps.on_hand * COALESCE(sp.unit_cost, 0)) AS total_value
            FROM spare_part_stock sps
            JOIN spare_parts sp ON sp.id = sps.part_id
            LEFT JOIN warehouses w ON w.id = sps.warehouse_id
            WHERE sps.on_hand > 0 ${whCond}
            ORDER BY (sps.on_hand * COALESCE(sp.unit_cost, 0)) DESC
            LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
        `, params)
    ])
    const k = kpiRow.rows[0]
    return {
        kpis: [
            { key: 'total_value', label: 'Tổng giá trị tồn kho', value: Number(k?.total_value ?? 0), unit: 'VNĐ' },
            { key: 'lines', label: 'Số mặt hàng', value: Number(k?.lines ?? 0), unit: '' },
        ],
        charts: { topValue: { labels: rows.rows.slice(0, 10).map(r => r.part_name), series: rows.rows.slice(0, 10).map(r => Number(r.total_value)) } },
        table: {
            rows: rows.rows.map(r => ({ partName: r.part_name, warehouse: r.warehouse_name, onHand: Number(r.on_hand), unitCost: Number(r.unit_cost), totalValue: Number(r.total_value) })),
            total: Number(k?.lines ?? 0), page: f.page, pageSize: f.pageSize
        }
    }
}

async function warehouseReorderAlerts(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const rows = await pool.query<{ part_name: string; part_code: string; warehouse_name: string; on_hand: string; min_level: string; shortfall: string }>(`
        SELECT sp.part_name, sp.part_code, COALESCE(w.name,'?') AS warehouse_name,
               sps.on_hand, sp.min_level, (sp.min_level - sps.on_hand) AS shortfall
        FROM spare_part_stock sps
        JOIN spare_parts sp ON sp.id = sps.part_id
        LEFT JOIN warehouses w ON w.id = sps.warehouse_id
        WHERE sp.min_level IS NOT NULL AND sps.on_hand < sp.min_level ${whCond}
        ORDER BY shortfall DESC
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
    `, params)

    return {
        kpis: [{ key: 'alert_count', label: 'Mặt hàng cần đặt hàng', value: rows.rowCount ?? 0, unit: '' }],
        charts: { alerts: { labels: rows.rows.slice(0, 10).map(r => r.part_name), series: rows.rows.slice(0, 10).map(r => Number(r.shortfall)) } },
        table: {
            rows: rows.rows.map(r => ({ partName: r.part_name, partCode: r.part_code, warehouse: r.warehouse_name, onHand: Number(r.on_hand), minLevel: Number(r.min_level), shortfall: Number(r.shortfall) })),
            total: rows.rowCount ?? 0, page: f.page, pageSize: f.pageSize
        }
    }
}

async function warehouseFEFOLots(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sl.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const rows = await pool.query<{ part_name: string; lot_number: string; warehouse_name: string; qty: string; expiry_date: string | null }>(`
        SELECT sp.part_name, sl.lot_number, COALESCE(w.name,'?') AS warehouse_name,
               sl.qty, sl.expiry_date
        FROM stock_lots sl
        JOIN spare_parts sp ON sp.id = sl.part_id
        LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE sl.qty > 0 ${whCond}
        ORDER BY sl.expiry_date ASC NULLS LAST
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
    `, params)

    return {
        kpis: [{ key: 'active_lots', label: 'Lô hàng đang hoạt động', value: rows.rowCount ?? 0, unit: '' }],
        charts: {},
        table: {
            rows: rows.rows.map(r => ({ partName: r.part_name, lotNumber: r.lot_number, warehouse: r.warehouse_name, qty: Number(r.qty), expiryDate: r.expiry_date })),
            total: rows.rowCount ?? 0, page: f.page, pageSize: f.pageSize
        }
    }
}

async function warehouseStockAvailable(pool: import('pg').Pool, f: FilterParams) {
    const params: Params = []
    const whCond = f.warehouseId ? `AND sps.warehouse_id = ${p(params, f.warehouseId)}` : ''

    const [kpiRow, rows] = await Promise.all([
        pool.query<{ total_available: string; lines: string }>(`
            SELECT COALESCE(SUM(GREATEST(sps.on_hand - COALESCE(sps.reserved, 0), 0)), 0) AS total_available,
                   COUNT(*) FILTER (WHERE sps.on_hand > COALESCE(sps.reserved, 0)) AS lines
            FROM spare_part_stock sps WHERE 1=1 ${whCond}
        `, params),
        pool.query<{ part_name: string; part_code: string; warehouse_name: string; on_hand: string; reserved: string; available: string }>(`
            SELECT sp.part_name, sp.part_code, COALESCE(w.name,'?') AS warehouse_name,
                   sps.on_hand, COALESCE(sps.reserved,0) AS reserved,
                   GREATEST(sps.on_hand - COALESCE(sps.reserved,0), 0) AS available
            FROM spare_part_stock sps
            JOIN spare_parts sp ON sp.id = sps.part_id
            LEFT JOIN warehouses w ON w.id = sps.warehouse_id
            WHERE sps.on_hand > COALESCE(sps.reserved, 0) ${whCond}
            ORDER BY available DESC
            LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
        `, params)
    ])
    const k = kpiRow.rows[0]
    return {
        kpis: [
            { key: 'total_available', label: 'Tổng có thể sử dụng', value: Number(k?.total_available ?? 0), unit: '' },
            { key: 'lines', label: 'Số mặt hàng khả dụng', value: Number(k?.lines ?? 0), unit: '' },
        ],
        charts: { available: { labels: rows.rows.slice(0, 10).map(r => r.part_name), series: rows.rows.slice(0, 10).map(r => Number(r.available)) } },
        table: {
            rows: rows.rows.map(r => ({ partName: r.part_name, partCode: r.part_code, warehouse: r.warehouse_name, onHand: Number(r.on_hand), reserved: Number(r.reserved), available: Number(r.available) })),
            total: Number(k?.lines ?? 0), page: f.page, pageSize: f.pageSize
        }
    }
}
