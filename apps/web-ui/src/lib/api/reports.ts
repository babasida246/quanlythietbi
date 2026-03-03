/**
 * Reports API client — unified /v1/reports/:key endpoint
 */
import { API_BASE, apiJson } from './httpClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export type KpiCard = {
    key: string
    label: string
    value: number | string
    delta?: number | null
    unit?: string
    trend?: 'up' | 'down' | 'neutral'
}

export type ChartSeries =
    | number[]
    | { name: string; data: number[] }[]

export type ChartData = {
    labels: string[]
    series: ChartSeries
}

export type ReportTable = {
    rows: Record<string, unknown>[]
    total: number
    page: number
    pageSize: number
}

export type ReportResponse = {
    kpis: KpiCard[]
    charts: Record<string, ChartData>
    table: ReportTable
    meta: { reportKey: string; generatedAt: string; filters: ReportFilters }
}

export type DrilldownResponse = {
    rows: Record<string, unknown>[]
    total: number
    dimension: string
    value: string
    meta: { reportKey: string; generatedAt: string }
}

export type ReportInfo = {
    key: string
    module: string
    title: string
}

export type ReportFilters = {
    dateFrom?: string
    dateTo?: string
    status?: string
    categoryId?: string
    locationId?: string
    warehouseId?: string
    page?: number
    pageSize?: number
}

export type DrilldownFilters = ReportFilters & {
    dimension: string
    value: string
}

// ─── Report registry (matches backend VALID_KEYS) ──────────────────────────

export type ReportKey =
    | 'assets-overview'
    | 'assets-trend'
    | 'assets-warranty'
    | 'assets-by-location'
    | 'inventory-stock'
    | 'inventory-movement'
    | 'inventory-low-stock'
    | 'maintenance-sla'
    | 'maintenance-status'
    | 'workflow-summary'
    | 'cmdb-overview'
    | 'cmdb-data-quality'
    | 'warehouse-stock-on-hand'
    | 'warehouse-valuation'
    | 'warehouse-reorder-alerts'
    | 'warehouse-fefo-lots'
    | 'warehouse-stock-available'

export type ReportModule = 'assets' | 'inventory' | 'maintenance' | 'workflow' | 'cmdb' | 'warehouse'

export type ReportDefinition = {
    key: ReportKey
    title: string
    module: ReportModule
    icon: string
    description: string
    defaultDateDays?: number
    filterFields: ('dateRange' | 'status' | 'categoryId' | 'locationId' | 'warehouseId')[]
}

export const REPORT_REGISTRY: ReportDefinition[] = [
    // Assets
    {
        key: 'assets-overview',
        title: 'Tổng quan tài sản',
        module: 'assets',
        icon: '📦',
        description: 'KPI, phân bổ theo trạng thái, danh mục và vị trí',
        defaultDateDays: 365,
        filterFields: ['dateRange', 'categoryId', 'locationId']
    },
    {
        key: 'assets-trend',
        title: 'Biến động theo thời gian',
        module: 'assets',
        icon: '📈',
        description: 'Xu hướng tạo mới / thanh lý tài sản theo tháng',
        defaultDateDays: 365,
        filterFields: ['dateRange']
    },
    {
        key: 'assets-warranty',
        title: 'Sắp hết bảo hành',
        module: 'assets',
        icon: '⚠️',
        description: 'Tài sản sắp hết hạn bảo hành trong 30/60/90 ngày',
        filterFields: ['locationId']
    },
    {
        key: 'assets-by-location',
        title: 'Phân bổ theo vị trí',
        module: 'assets',
        icon: '📍',
        description: 'Top 20 vị trí theo số tài sản (stacked bar)',
        filterFields: ['locationId']
    },
    // Inventory
    {
        key: 'inventory-stock',
        title: 'Tồn kho theo kho',
        module: 'inventory',
        icon: '🏪',
        description: 'Số lượng tồn kho theo từng kho, top mặt hàng',
        filterFields: ['warehouseId']
    },
    {
        key: 'inventory-movement',
        title: 'Nhập / Xuất kho',
        module: 'inventory',
        icon: '↕️',
        description: 'So sánh phiếu nhập và xuất theo tháng',
        defaultDateDays: 180,
        filterFields: ['dateRange', 'warehouseId']
    },
    {
        key: 'inventory-low-stock',
        title: 'Cảnh báo tồn thấp',
        module: 'inventory',
        icon: '🔴',
        description: 'Mặt hàng dưới mức tồn tối thiểu',
        filterFields: ['warehouseId']
    },
    // Maintenance
    {
        key: 'maintenance-sla',
        title: 'SLA bảo trì',
        module: 'maintenance',
        icon: '🛠️',
        description: 'Thống kê thời gian xử lý, tỉ lệ hoàn thành theo mức ưu tiên',
        defaultDateDays: 90,
        filterFields: ['dateRange']
    },
    {
        key: 'maintenance-status',
        title: 'Trạng thái phiếu bảo trì',
        module: 'maintenance',
        icon: '📋',
        description: 'Phân bố phiếu mở/đóng/đang xử lý',
        defaultDateDays: 90,
        filterFields: ['dateRange']
    },
    // Workflow
    {
        key: 'workflow-summary',
        title: 'Yêu cầu & phê duyệt',
        module: 'workflow',
        icon: '✅',
        description: 'Tổng quan trạng thái yêu cầu, tỉ lệ phê duyệt, loại yêu cầu',
        defaultDateDays: 90,
        filterFields: ['dateRange']
    },
    // CMDB
    {
        key: 'cmdb-overview',
        title: 'CI theo loại (CMDB)',
        module: 'cmdb',
        icon: '🔗',
        description: 'CI tổng hợp theo loại, số quan hệ',
        filterFields: []
    },
    {
        key: 'cmdb-data-quality',
        title: 'Chất lượng dữ liệu CMDB',
        module: 'cmdb',
        icon: '🔍',
        description: 'CI thiếu thuộc tính, quan hệ lỗi (orphan)',
        filterFields: []
    },
    // Warehouse
    {
        key: 'warehouse-stock-on-hand',
        title: 'Tồn kho theo kho hàng',
        module: 'warehouse',
        icon: '📦',
        description: 'Số lượng tồn kho hiện tại theo từng kho hàng, nhóm vật tư',
        filterFields: ['warehouseId']
    },
    {
        key: 'warehouse-valuation',
        title: 'Giá trị kho hàng',
        module: 'warehouse',
        icon: '💰',
        description: 'Tổng giá trị tồn kho, phân bố theo nhóm vật tư và kho',
        filterFields: ['warehouseId']
    },
    {
        key: 'warehouse-reorder-alerts',
        title: 'Cảnh báo đặt hàng lại',
        module: 'warehouse',
        icon: '🔴',
        description: 'Vật tư dưới mức tồn tối thiểu, cần đặt hàng bổ sung',
        filterFields: ['warehouseId']
    },
    {
        key: 'warehouse-fefo-lots',
        title: 'Hạn sử dụng (FEFO)',
        module: 'warehouse',
        icon: '📅',
        description: 'Lô hàng sắp hết hạn sử dụng, quản lý theo FEFO',
        filterFields: ['warehouseId', 'dateRange']
    },
    {
        key: 'warehouse-stock-available',
        title: 'Tồn khả dụng',
        module: 'warehouse',
        icon: '✅',
        description: 'Tồn hiện có trừ đã đặt trước, sẵn sàng xuất kho',
        filterFields: ['warehouseId']
    }
]

export const MODULE_LABELS: Record<ReportModule, string> = {
    assets: 'Tài sản',
    inventory: 'Kho hàng',
    maintenance: 'Bảo trì',
    workflow: 'Yêu cầu',
    cmdb: 'CMDB',
    warehouse: 'Kho vật tư'
}

export const MODULE_ICONS: Record<ReportModule, string> = {
    assets: '📦',
    inventory: '🏪',
    maintenance: '🛠️',
    workflow: '✅',
    cmdb: '🔗',
    warehouse: '🏭'
}

// ─── API functions ──────────────────────────────────────────────────────────

function buildQs(filters: Record<string, unknown>): string {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    }
    return q.toString() ? `?${q.toString()}` : ''
}

export async function fetchReport(key: ReportKey, filters: ReportFilters = {}): Promise<ReportResponse> {
    return apiJson<ReportResponse>(`${API_BASE}/v1/reports/${key}${buildQs(filters)}`)
}

export async function fetchDrilldown(key: ReportKey, filters: DrilldownFilters): Promise<DrilldownResponse> {
    return apiJson<DrilldownResponse>(`${API_BASE}/v1/reports/${key}/drilldown${buildQs(filters)}`)
}

export async function listReports(): Promise<{ data: ReportInfo[] }> {
    return apiJson<{ data: ReportInfo[] }>(`${API_BASE}/v1/reports`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function defaultDateRange(days = 365): { dateFrom: string; dateTo: string } {
    const to = new Date()
    const from = new Date(Date.now() - days * 86400 * 1000)
    return {
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10)
    }
}

export function exportToCsv(rows: Record<string, unknown>[], filename = 'export.csv') {
    if (!rows.length) return
    const keys = Object.keys(rows[0])
    const header = keys.join(',')
    const lines = rows.map(row =>
        keys.map(k => {
            const v = row[k]
            if (v === null || v === undefined) return ''
            const s = String(v)
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s
        }).join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
