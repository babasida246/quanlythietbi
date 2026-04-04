<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Activity, BarChart3, RefreshCw } from 'lucide-svelte'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { Button } from '$lib/components/ui'
  import KpiCard from '$lib/reports/KpiCard.svelte'
  import ChartCard from '$lib/reports/ChartCard.svelte'
  import ReportFilterBar from '$lib/reports/ReportFilterBar.svelte'
  import ReportTable from '$lib/reports/ReportTable.svelte'
  import DrilldownDrawer from '$lib/reports/DrilldownDrawer.svelte'
  import {
    fetchReport,
    exportToCsv,
    defaultDateRange,
    REPORT_REGISTRY,
    MODULE_LABELS,
    MODULE_ICONS,
    type ChartData,
    type ChartSeries,
    type ReportFilters,
    type ReportKey,
    type ReportModule,
    type ReportResponse
  } from '$lib/api/reports'
  import { toast } from '$lib/components/toast'
  import { _, isLoading } from '$lib/i18n'

  type Column = {
    key: string
    label: string
    format?: (v: unknown) => string
    sortable?: boolean
    align?: 'left' | 'right'
  }

  type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'stacked-bar'
  type ChartConfig = {
    chartKey: string
    title: string
    type: ChartType
    drillDimension?: string
  }

  let activeKey = $state<ReportKey>('assets-overview')
  let selectedModule = $state<ReportModule>('assets')
  let filters = $state<ReportFilters>({})
  let loading = $state(false)
  let error = $state('')
  let report = $state<ReportResponse | null>(null)

  let autoRefresh = $state(true)
  let refreshEverySec = $state(30)
  let refreshCountdown = $state(30)
  let lastUpdatedAt = $state('')

  let drillOpen = $state(false)
  let drillDim = $state('')
  let drillVal = $state('')

  let savedViews = $state<Record<string, ReportFilters>>({})

  const activeReport = $derived(REPORT_REGISTRY.find((r) => r.key === activeKey)!)

  const moduleGroups = $derived.by(() => {
    const mods = ['assets', 'inventory', 'warehouse', 'maintenance', 'workflow', 'cmdb'] as ReportModule[]
    return mods.map((mod) => ({
      mod,
      label: MODULE_LABELS[mod],
      icon: MODULE_ICONS[mod],
      reports: REPORT_REGISTRY.filter((r) => r.module === mod)
    }))
  })

  const moduleReports = $derived.by(() => REPORT_REGISTRY.filter((r) => r.module === selectedModule))

  const warehouseUnifiedReports = $derived.by(() =>
    REPORT_REGISTRY.filter((r) => r.module === 'inventory' || r.module === 'warehouse')
  )

  const printTemplateFeatureList = $derived.by(() => [
    {
      feature: $_('reports.printFeatures.items.stockReceipt.feature'),
      templateCode: 'doc-warehouse-receipt',
      owner: $_('reports.printFeatures.ownerWarehouse'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.stockIssue.feature'),
      templateCode: 'doc-warehouse-issue',
      owner: $_('reports.printFeatures.ownerWarehouse'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.assetHandover.feature'),
      templateCode: 'doc-ban-giao-tai-san',
      owner: $_('reports.printFeatures.ownerAssets'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.maintenanceTicket.feature'),
      templateCode: 'doc-phieu-bao-tri',
      owner: $_('reports.printFeatures.ownerMaintenance'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.repairOrder.feature'),
      templateCode: 'doc-lenh-sua-chua',
      owner: $_('reports.printFeatures.ownerMaintenance'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.inventoryAudit.feature'),
      templateCode: 'doc-bien-ban-kiem-ke',
      owner: $_('reports.printFeatures.ownerInventory'),
      priority: 'P1'
    },
    {
      feature: $_('reports.printFeatures.items.assetRecall.feature'),
      templateCode: 'doc-bien-ban-thu-hoi',
      owner: $_('reports.printFeatures.ownerAssets'),
      priority: 'P2'
    },
    {
      feature: $_('reports.printFeatures.items.assetTransfer.feature'),
      templateCode: 'doc-bien-ban-luan-chuyen',
      owner: $_('reports.printFeatures.ownerAssets'),
      priority: 'P2'
    },
    {
      feature: $_('reports.printFeatures.items.purchaseRequest.feature'),
      templateCode: 'doc-yeu-cau-mua-sam',
      owner: $_('reports.printFeatures.ownerRequests'),
      priority: 'P2'
    },
    {
      feature: $_('reports.printFeatures.items.assetDisposal.feature'),
      templateCode: 'doc-bien-ban-thanh-ly',
      owner: $_('reports.printFeatures.ownerAssets'),
      priority: 'P3'
    }
  ])

  const TABLE_COLUMNS: Partial<Record<ReportKey, Column[]>> = $derived({
    'assets-overview': [
      { key: 'code', label: $_('reports.col.assetCode'), sortable: true },
      { key: 'model', label: $_('reports.col.model'), sortable: true },
      { key: 'category', label: $_('reports.col.category'), sortable: true },
      { key: 'location', label: $_('reports.col.location'), sortable: true },
      { key: 'status', label: $_('reports.col.status'), sortable: true },
      { key: 'createdAt', label: $_('reports.col.createdAt'), sortable: true, format: (v) => v ? new Date(v as string).toLocaleDateString('vi-VN') : '-' }
    ],
    'assets-trend': [
      { key: 'month', label: $_('reports.col.month'), sortable: true },
      { key: 'created', label: $_('reports.col.created'), sortable: true, align: 'right' },
      { key: 'retired', label: $_('reports.col.retired'), sortable: true, align: 'right' }
    ],
    'assets-warranty': [
      { key: 'code', label: $_('reports.col.assetCodeShort'), sortable: true },
      { key: 'model', label: $_('reports.col.model'), sortable: true },
      { key: 'location', label: $_('reports.col.location'), sortable: true },
      { key: 'warrantyEnd', label: $_('reports.col.warrantyEnd'), sortable: true, format: (v) => v ? new Date(v as string).toLocaleDateString('vi-VN') : '-' }
    ],
    'assets-by-location': [
      { key: 'location', label: $_('reports.col.location'), sortable: true },
      { key: 'total', label: $_('reports.col.total'), sortable: true, align: 'right' },
      { key: 'in_use', label: $_('reports.col.inUse'), sortable: true, align: 'right' },
      { key: 'in_stock', label: $_('reports.col.inStock'), sortable: true, align: 'right' }
    ],
    'inventory-stock': [
      { key: 'partCode', label: $_('reports.col.code'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'onHand', label: $_('reports.col.onHand'), sortable: true, align: 'right' },
      { key: 'reserved', label: $_('reports.col.reserved'), sortable: true, align: 'right' }
    ],
    'inventory-movement': [
      { key: 'month', label: $_('reports.col.month'), sortable: true },
      { key: 'receipts', label: $_('reports.col.receipts'), sortable: true, align: 'right' },
      { key: 'issues', label: $_('reports.col.issues'), sortable: true, align: 'right' }
    ],
    'inventory-low-stock': [
      { key: 'partCode', label: $_('reports.col.code'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'onHand', label: $_('reports.col.onHand'), sortable: true, align: 'right' },
      { key: 'minLevel', label: $_('reports.col.minLevel'), sortable: true, align: 'right' },
      { key: 'shortfall', label: $_('reports.col.shortfall'), sortable: true, align: 'right' }
    ],
    'maintenance-sla': [
      { key: 'severity', label: $_('reports.col.severity'), sortable: true },
      { key: 'total', label: $_('reports.col.total'), sortable: true, align: 'right' },
      { key: 'closed', label: $_('reports.col.closed'), sortable: true, align: 'right' },
      { key: 'avgHours', label: $_('reports.col.avgHours'), sortable: true, align: 'right' }
    ],
    'maintenance-status': [
      { key: 'title', label: $_('reports.col.title'), sortable: true },
      { key: 'status', label: $_('reports.col.status'), sortable: true },
      { key: 'severity', label: $_('reports.col.severity'), sortable: true },
      { key: 'openedAt', label: $_('reports.col.openedAt'), sortable: true, format: (v) => v ? new Date(v as string).toLocaleDateString('vi-VN') : '-' },
      { key: 'asset', label: $_('reports.col.asset'), sortable: true }
    ],
    'workflow-summary': [
      { key: 'type', label: $_('reports.col.requestType'), sortable: true },
      { key: 'status', label: $_('reports.col.status'), sortable: true },
      { key: 'createdAt', label: $_('reports.col.createdAt'), sortable: true, format: (v) => v ? new Date(v as string).toLocaleDateString('vi-VN') : '-' }
    ],
    'cmdb-overview': [
      { key: 'typeName', label: $_('reports.col.ciType'), sortable: true },
      { key: 'total', label: $_('reports.col.totalCis'), sortable: true, align: 'right' },
      { key: 'active', label: $_('reports.col.active'), sortable: true, align: 'right' }
    ],
    'cmdb-data-quality': [
      { key: 'ciCode', label: $_('reports.col.ciCode'), sortable: true },
      { key: 'name', label: $_('reports.col.ciName'), sortable: true },
      { key: 'type', label: $_('reports.col.type'), sortable: true },
      { key: 'attrCount', label: $_('reports.col.attrCount'), sortable: true, align: 'right' }
    ],
    'warehouse-stock-on-hand': [
      { key: 'partCode', label: $_('reports.col.code'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'materialGroup', label: $_('reports.col.materialGroup'), sortable: true },
      { key: 'onHand', label: $_('reports.col.onHand'), sortable: true, align: 'right' },
      { key: 'unit', label: $_('reports.col.unit'), sortable: true }
    ],
    'warehouse-valuation': [
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'materialGroup', label: $_('reports.col.materialGroup'), sortable: true },
      { key: 'totalQty', label: $_('reports.col.totalQty'), sortable: true, align: 'right' },
      { key: 'unitCost', label: $_('reports.col.unitCost'), sortable: true, align: 'right', format: (v) => v ? Number(v).toLocaleString('vi-VN') + ' VND' : '-' },
      { key: 'totalValue', label: $_('reports.col.totalValue'), sortable: true, align: 'right', format: (v) => v ? Number(v).toLocaleString('vi-VN') + ' VND' : '-' }
    ],
    'warehouse-reorder-alerts': [
      { key: 'partCode', label: $_('reports.col.code'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'onHand', label: $_('reports.col.onHand'), sortable: true, align: 'right' },
      { key: 'reorderPoint', label: $_('reports.col.reorderPoint'), sortable: true, align: 'right' },
      { key: 'shortfall', label: $_('reports.col.shortfall'), sortable: true, align: 'right' }
    ],
    'warehouse-fefo-lots': [
      { key: 'lotNumber', label: $_('reports.col.lotNumber'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'expiryDate', label: $_('reports.col.expiryDate'), sortable: true, format: (v) => v ? new Date(v as string).toLocaleDateString('vi-VN') : '-' },
      { key: 'qty', label: $_('reports.col.quantity'), sortable: true, align: 'right' }
    ],
    'warehouse-stock-available': [
      { key: 'partCode', label: $_('reports.col.code'), sortable: true },
      { key: 'partName', label: $_('reports.col.partName'), sortable: true },
      { key: 'warehouse', label: $_('reports.col.warehouse'), sortable: true },
      { key: 'onHand', label: $_('reports.col.onHand'), sortable: true, align: 'right' },
      { key: 'reserved', label: $_('reports.col.reserved'), sortable: true, align: 'right' },
      { key: 'available', label: $_('reports.col.available'), sortable: true, align: 'right' }
    ]
  })

  const CHART_LAYOUT: Partial<Record<ReportKey, ChartConfig[]>> = $derived({
    'assets-overview': [
      { chartKey: 'byStatus', title: $_('reports.chart.byStatus'), type: 'bar', drillDimension: 'status' },
      { chartKey: 'byCategory', title: $_('reports.chart.byCategoryTop10'), type: 'pie', drillDimension: 'category' },
      { chartKey: 'byLocation', title: $_('reports.chart.byLocationTop10'), type: 'bar', drillDimension: 'location' }
    ],
    'assets-trend': [{ chartKey: 'trend', title: $_('reports.chart.monthlyTrend'), type: 'line' }],
    'assets-warranty': [{ chartKey: 'byBucket', title: $_('reports.chart.warrantyExpiring'), type: 'donut' }],
    'assets-by-location': [{ chartKey: 'byLocation', title: $_('reports.chart.assetsByLocation'), type: 'stacked-bar' }],
    'inventory-stock': [{ chartKey: 'topItems', title: $_('reports.chart.topStockItems'), type: 'bar' }],
    'inventory-movement': [{ chartKey: 'movement', title: $_('reports.chart.monthlyMovement'), type: 'line' }],
    'inventory-low-stock': [{ chartKey: 'lowStock', title: $_('reports.chart.lowStockTop10'), type: 'bar' }],
    'maintenance-sla': [
      { chartKey: 'bySeverity', title: $_('reports.chart.bySeverity'), type: 'stacked-bar', drillDimension: 'severity' },
      { chartKey: 'avgHours', title: $_('reports.chart.avgProcessingHours'), type: 'bar' }
    ],
    'maintenance-status': [{ chartKey: 'byStatus', title: $_('reports.chart.maintenanceStatus'), type: 'pie', drillDimension: 'status' }],
    'workflow-summary': [
      { chartKey: 'byStatus', title: $_('reports.chart.requestsByStatus'), type: 'donut', drillDimension: 'status' },
      { chartKey: 'byType', title: $_('reports.chart.byRequestType'), type: 'bar' }
    ],
    'cmdb-overview': [
      { chartKey: 'byType', title: $_('reports.chart.cisByType'), type: 'pie' },
      { chartKey: 'activeByType', title: $_('reports.chart.activeVsOther'), type: 'stacked-bar' }
    ],
    'cmdb-data-quality': [],
    'warehouse-stock-on-hand': [
      { chartKey: 'byWarehouse', title: $_('reports.chart.stockByWarehouse'), type: 'bar', drillDimension: 'warehouse' },
      { chartKey: 'byMaterialGroup', title: $_('reports.chart.stockByMaterialGroup'), type: 'pie', drillDimension: 'materialGroup' }
    ],
    'warehouse-valuation': [
      { chartKey: 'valuationByWarehouse', title: $_('reports.chart.valuationByWarehouse'), type: 'stacked-bar' },
      { chartKey: 'valuationByGroup', title: $_('reports.chart.valuationByGroup'), type: 'pie' }
    ],
    'warehouse-reorder-alerts': [{ chartKey: 'shortfallTop10', title: $_('reports.chart.shortfallTop10'), type: 'bar' }],
    'warehouse-fefo-lots': [{ chartKey: 'expiringByMonth', title: $_('reports.chart.expiringByMonth'), type: 'bar' }],
    'warehouse-stock-available': [{ chartKey: 'availableByWarehouse', title: $_('reports.chart.availableByWarehouse'), type: 'bar' }]
  })

  const effectiveColumns = $derived(TABLE_COLUMNS[activeKey] ?? [])
  const effectiveCharts = $derived(CHART_LAYOUT[activeKey] ?? [])

  const normalizedRows = $derived.by(() => {
    const rows = report?.table?.rows ?? []
    return rows.map((row) => normalizeRow(row, effectiveColumns))
  })

  const totalRows = $derived(report?.table?.total ?? normalizedRows.length)
  const activeFiltersCount = $derived.by(() => Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 1).length)

  const fieldCoveragePct = $derived.by(() => {
    if (!normalizedRows.length || !effectiveColumns.length) return 0
    let totalCells = 0
    let validCells = 0

    for (const row of normalizedRows) {
      for (const col of effectiveColumns) {
        totalCells += 1
        const val = row[col.key]
        if (val !== null && val !== undefined && String(val).trim() !== '' && String(val) !== '-') {
          validCells += 1
        }
      }
    }

    return Math.round((validCells / totalCells) * 100)
  })

  const freshnessSec = $derived.by(() => {
    if (!lastUpdatedAt) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 1000))
  })

  const topHighlights = $derived.by(() => buildHighlights(normalizedRows, effectiveColumns))

  const preparedCharts = $derived.by(() => {
    return effectiveCharts
      .map((cfg) => {
        const base = report?.charts?.[cfg.chartKey] ?? { labels: [], series: [] }
        const fallback = deriveFallbackChart(cfg.chartKey, normalizedRows)
        const chartData = hasChartData(base) ? base : fallback
        return { ...cfg, chartData }
      })
      .filter((x) => hasChartData(x.chartData))
  })

  async function loadReport(options?: { silent?: boolean }) {
    if (!activeKey || loading) return
    const silent = options?.silent ?? false

    try {
      if (!silent) loading = true
      error = ''

      const data = await fetchReport(activeKey, {
        ...filters,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20
      })

      report = data
      lastUpdatedAt = data.meta.generatedAt || new Date().toISOString()
      refreshCountdown = refreshEverySec
    } catch (e) {
      error = e instanceof Error ? e.message : $_('common.unknownError')
      if (!silent) {
        toast.error(error)
      }
    } finally {
      loading = false
    }
  }

  function setReport(key: ReportKey) {
    activeKey = key
    selectedModule = REPORT_REGISTRY.find((r) => r.key === key)?.module ?? selectedModule

    const def = REPORT_REGISTRY.find((r) => r.key === key)!
    filters = def.defaultDateDays ? defaultDateRange(def.defaultDateDays) : {}
    report = null

    const params = new URLSearchParams(page.url.searchParams)
    params.set('report', key)
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true })
    void loadReport()
  }

  function selectModule(mod: ReportModule) {
    selectedModule = mod
    if (activeReport?.module !== mod) {
      const first = REPORT_REGISTRY.find((r) => r.module === mod)
      if (first) setReport(first.key)
    }
  }

  function handleReportSelect(event: Event) {
    const key = (event.currentTarget as HTMLSelectElement).value as ReportKey
    if (key) setReport(key)
  }

  function handleDrilldown(dimension: string, value: string) {
    drillDim = dimension
    drillVal = String(value)
    drillOpen = true
  }

  function handlePageChange(pg: number) {
    filters = { ...filters, page: pg }
    void loadReport({ silent: true })
  }

  function handleExport() {
    if (!normalizedRows.length) return
    exportToCsv(normalizedRows, `${activeKey}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function loadSavedViews() {
    try {
      savedViews = JSON.parse(localStorage.getItem('report_saved_views') ?? '{}')
    } catch {
      savedViews = {}
    }
  }

  function applySavedView(name: string) {
    const view = savedViews[name]
    if (!view) return
    filters = { ...view }
    void loadReport()
    toast.success($_('reports.appliedView') + name)
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh
    refreshCountdown = refreshEverySec
  }

  onMount(() => {
    loadSavedViews()

    const reportParam = page.url.searchParams.get('report') as ReportKey | null
    const def = reportParam && REPORT_REGISTRY.find((r) => r.key === reportParam) ? reportParam : 'assets-overview'
    activeKey = def
    selectedModule = REPORT_REGISTRY.find((r) => r.key === def)?.module ?? 'assets'

    const fromUrl: ReportFilters = {}
    const sp = page.url.searchParams
    if (sp.get('dateFrom')) fromUrl.dateFrom = sp.get('dateFrom')!
    if (sp.get('dateTo')) fromUrl.dateTo = sp.get('dateTo')!
    if (sp.get('status')) fromUrl.status = sp.get('status')!
    if (sp.get('locationId')) fromUrl.locationId = sp.get('locationId')!
    if (sp.get('warehouseId')) fromUrl.warehouseId = sp.get('warehouseId')!
    if (sp.get('page')) fromUrl.page = Number(sp.get('page'))
    if (sp.get('pageSize')) fromUrl.pageSize = Number(sp.get('pageSize'))

    if (Object.keys(fromUrl).length) {
      filters = fromUrl
    } else if (activeReport?.defaultDateDays) {
      filters = defaultDateRange(activeReport.defaultDateDays)
    }

    void loadReport()

    const ticker = window.setInterval(() => {
      if (!autoRefresh || loading) return
      if (refreshCountdown <= 1) {
        void loadReport({ silent: true })
        refreshCountdown = refreshEverySec
        return
      }
      refreshCountdown -= 1
    }, 1000)

    return () => {
      clearInterval(ticker)
    }
  })

  $effect(() => {
    if (!autoRefresh) return
    refreshCountdown = refreshEverySec
  })

  function normalizeKey(input: string): string {
    return input.toLowerCase().replace(/[_\-\s]/g, '')
  }

  function toSnakeCase(input: string): string {
    return input.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  }

  function normalizeRow(row: Record<string, unknown>, columns: Column[]): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...row }
    const keyMap = new Map<string, string>()

    for (const key of Object.keys(row)) {
      keyMap.set(normalizeKey(key), key)
    }

    const aliases: Record<string, string[]> = {
      ciCode: ['code'],
      partCode: ['sku', 'itemCode', 'code'],
      partName: ['itemName', 'name'],
      in_use: ['inUse'],
      in_stock: ['inStock'],
      totalValue: ['value'],
      totalQty: ['qty'],
      qty: ['quantity']
    }

    for (const col of columns) {
      if (copy[col.key] !== undefined && copy[col.key] !== null && copy[col.key] !== '') continue

      const candidates = [
        col.key,
        toSnakeCase(col.key),
        ...(aliases[col.key] ?? [])
      ]

      let found: unknown = null
      for (const c of candidates) {
        const actual = keyMap.get(normalizeKey(c))
        if (actual && row[actual] !== undefined && row[actual] !== null && row[actual] !== '') {
          found = row[actual]
          break
        }
      }

      if (found !== null) {
        copy[col.key] = found
      }
    }

    return copy
  }

  function toNumber(v: unknown): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    if (typeof v === 'string') {
      const p = Number(v)
      return Number.isFinite(p) ? p : 0
    }
    return 0
  }

  function asSeriesArray(series: ChartSeries): Array<{ name: string; data: number[] }> {
    if (!Array.isArray(series) || !series.length) return []
    if (typeof series[0] === 'number') {
      return [{ name: 'value', data: series as number[] }]
    }
    return series as Array<{ name: string; data: number[] }>
  }

  function hasChartData(chart: ChartData): boolean {
    if (!chart.labels.length) return false
    if (!Array.isArray(chart.series) || !chart.series.length) return false

    const all = asSeriesArray(chart.series).flatMap((s) => s.data)
    return all.some((n) => Number.isFinite(n) && n > 0)
  }

  function deriveFallbackChart(chartKey: string, rows: Record<string, unknown>[]): ChartData {
    if (!rows.length) return { labels: [], series: [] }

    const groupedBar = (labelField: string, valueField?: string): ChartData => {
      const map = new Map<string, number>()
      for (const row of rows) {
        const label = String(row[labelField] ?? '-').trim() || '-'
        const value = valueField ? toNumber(row[valueField]) : 1
        map.set(label, (map.get(label) ?? 0) + value)
      }
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      return {
        labels: sorted.map(([label]) => label),
        series: sorted.map(([, value]) => value)
      }
    }

    const monthly = (createdKey: string, retiredKey?: string): ChartData => {
      const labels = rows.map((r) => String(r.month ?? r.period ?? '-'))
      const created = rows.map((r) => toNumber(r[createdKey]))
      const retired = retiredKey ? rows.map((r) => toNumber(r[retiredKey])) : []
      return {
        labels,
        series: retired.length
          ? [
              { name: createdKey, data: created },
              { name: retiredKey ?? 'second', data: retired }
            ]
          : created
      }
    }

    const chartSource: Record<string, () => ChartData> = {
      byStatus: () => groupedBar('status', 'total'),
      byCategory: () => groupedBar('category', 'total'),
      byLocation: () => groupedBar('location', 'total'),
      topItems: () => groupedBar('partName', 'onHand'),
      movement: () => monthly('receipts', 'issues'),
      lowStock: () => groupedBar('partName', 'shortfall'),
      bySeverity: () => groupedBar('severity', 'total'),
      avgHours: () => groupedBar('severity', 'avgHours'),
      byType: () => groupedBar('type', 'total'),
      activeByType: () => ({
        labels: rows.map((r) => String(r.typeName ?? r.type ?? '-')),
        series: [
          { name: 'active', data: rows.map((r) => toNumber(r.active)) },
          { name: 'other', data: rows.map((r) => Math.max(0, toNumber(r.total) - toNumber(r.active))) }
        ]
      }),
      trend: () => monthly('created', 'retired'),
      byWarehouse: () => groupedBar('warehouse', 'onHand'),
      byMaterialGroup: () => groupedBar('materialGroup', 'onHand'),
      valuationByWarehouse: () => groupedBar('warehouse', 'totalValue'),
      valuationByGroup: () => groupedBar('materialGroup', 'totalValue'),
      shortfallTop10: () => groupedBar('partName', 'shortfall'),
      expiringByMonth: () => groupedBar('expiryDate', 'qty'),
      availableByWarehouse: () => groupedBar('warehouse', 'available')
    }

    return chartSource[chartKey]?.() ?? { labels: [], series: [] }
  }

  function buildHighlights(rows: Record<string, unknown>[], columns: Column[]): Array<{ label: string; value: string }> {
    if (!rows.length || !columns.length) return []

    const numericCol = columns.find((c) => rows.some((r) => Number.isFinite(toNumber(r[c.key])) && toNumber(r[c.key]) > 0))
    const labelCol = columns.find((c) => c.key !== numericCol?.key && rows.some((r) => typeof r[c.key] === 'string' && String(r[c.key]).trim() !== ''))

    if (!numericCol || !labelCol) return []

    return rows
      .map((row) => ({
        label: String(row[labelCol.key] ?? '-'),
        value: toNumber(row[numericCol.key])
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((x) => ({
        label: x.label,
        value: x.value.toLocaleString('vi-VN')
      }))
  }
</script>

<div class="page-shell page-content space-y-4">
  <PageHeader
    title={activeReport?.title ?? ($isLoading ? 'Reports' : $_('reports.title'))}
    subtitle={activeReport?.description ?? ''}
  >
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <Button size="sm" variant={autoRefresh ? 'primary' : 'ghost'} onclick={toggleAutoRefresh} title={$isLoading ? 'Auto refresh' : $_('reports.autoRefresh')}>
          <Activity class="h-3.5 w-3.5 mr-1" />
          {autoRefresh ? ($isLoading ? 'Live' : $_('reports.live')) : ($isLoading ? 'Paused' : $_('reports.paused'))}
        </Button>
        <Button size="sm" variant="ghost" onclick={() => loadReport()} title={$isLoading ? 'Refresh data' : $_('reports.refreshData')}>
          <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
        </Button>
      </div>
    {/snippet}
  </PageHeader>

  <section class="card p-4 space-y-3 report-shell-nav">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2" style="color: var(--color-text-muted)">
        <BarChart3 class="h-4 w-4" />
        <span class="text-xs font-semibold uppercase tracking-wider">{$isLoading ? 'Report Navigator' : $_('reports.navigator')}</span>
      </div>
      <div class="text-xs" style="color: var(--color-text-muted)">
        {#if autoRefresh}
          {$isLoading ? 'Next refresh' : $_('reports.nextRefresh')} <span class="font-semibold" style="color: var(--color-text)">{refreshCountdown}s</span>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      {#each moduleGroups as group}
        <button
          class="rounded-full border px-3 py-1 text-xs transition-colors report-module-chip {selectedModule === group.mod ? 'report-module-chip-active' : ''}"
          onclick={() => selectModule(group.mod)}
        >
          {group.icon} {group.label}
        </button>
      {/each}
    </div>

    <div class="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto]">
      <div>
        <label for="report-picker" class="label-base text-xs">{$isLoading ? 'Report' : $_('reports.title')}</label>
        <select id="report-picker" class="select-base mt-1" value={activeKey} onchange={handleReportSelect}>
          {#each moduleReports as rep}
            <option value={rep.key}>{rep.title}</option>
          {/each}
        </select>
      </div>
      {#if Object.keys(savedViews).length}
        <div class="flex flex-wrap items-end gap-2">
          {#each Object.keys(savedViews) as name}
            <button
              class="rounded-full border px-2.5 py-1 text-xs transition-colors report-saved-chip"
              onclick={() => applySavedView(name)}
              title={name}
            >
              {name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
    <div class="card p-4 space-y-3 report-hub-card">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold" style="color: var(--color-text)">
            {$isLoading ? 'Warehouse Report Hub' : $_('reports.warehouseHub.title')}
          </h3>
          <p class="text-xs mt-1" style="color: var(--color-text-muted)">
            {$isLoading ? 'Integrated inventory + warehouse analytics in one place' : $_('reports.warehouseHub.subtitle')}
          </p>
        </div>
        <span class="rounded-full px-2 py-1 text-[11px] font-semibold report-pill">
          {warehouseUnifiedReports.length} {$isLoading ? 'reports' : $_('reports.warehouseHub.reportCount')}
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        {#each warehouseUnifiedReports as rep}
          <button
            class="report-quick-item"
            onclick={() => setReport(rep.key)}
            title={rep.description}
          >
            <span class="text-sm">{rep.icon}</span>
            <span>{rep.title}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="card p-4 space-y-3 report-print-card">
      <div>
        <h3 class="text-sm font-semibold" style="color: var(--color-text)">
          {$isLoading ? 'Print Template Backlog' : $_('reports.printFeatures.title')}
        </h3>
        <p class="text-xs mt-1" style="color: var(--color-text-muted)">
          {$isLoading ? 'Feature checklist that should have printable templates' : $_('reports.printFeatures.subtitle')}
        </p>
      </div>

      <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
        {#each printTemplateFeatureList as item}
          <div class="report-print-item">
            <div class="min-w-0">
              <p class="text-xs font-semibold truncate" style="color: var(--color-text)">{item.feature}</p>
              <p class="text-[11px] truncate" style="color: var(--color-text-muted)">{item.templateCode} · {item.owner}</p>
            </div>
            <span class="report-priority">{item.priority}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  {#if activeReport}
    <ReportFilterBar
      reportDef={activeReport}
      bind:filters
      {loading}
      onApply={() => {
        filters = { ...filters, page: 1 }
        loadReport()
      }}
      onExport={handleExport}
    />
  {/if}

  <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Rows' : $_('reports.totalRows')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{totalRows.toLocaleString('vi-VN')}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Filters active' : $_('reports.filter.title')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{activeFiltersCount}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Field coverage' : $_('reports.fieldCoverage')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{fieldCoveragePct}%</p>
    </div>
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Freshness' : $_('reports.freshness')}</p>
      <p class="mt-1 text-sm font-semibold" style="color: var(--color-text)">
        {#if lastUpdatedAt}
          {freshnessSec}s
        {:else}
          -
        {/if}
      </p>
      <p class="mt-1 text-[11px]" style="color: var(--color-text-muted)">
        {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString('vi-VN') : '-'}
      </p>
    </div>
  </section>

  {#if error}
    <div class="alert alert-error flex items-center justify-between">
      <span>{error}</span>
      <button class="report-retry-btn" onclick={() => loadReport()}>{$isLoading ? 'Retry' : $_('common.retry')}</button>
    </div>
  {/if}

  <section>
    {#if loading && !report}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {#each Array(5) as _}
          <KpiCard loading={true} />
        {/each}
      </div>
    {:else if report?.kpis?.length}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {#each report.kpis as kpi}
          <KpiCard {kpi} />
        {/each}
      </div>
    {/if}
  </section>

  {#if preparedCharts.length}
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Visual analysis' : $_('reports.visualAnalysis')}</h3>
      </div>
      <div class="grid gap-4 {preparedCharts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}">
        {#each preparedCharts as cfg}
          <ChartCard
            title={cfg.title}
            labels={cfg.chartData.labels}
            series={cfg.chartData.series}
            type={cfg.type}
            loading={loading && !report}
            onclick={cfg.drillDimension ? (label) => handleDrilldown(cfg.drillDimension!, label) : undefined}
          />
        {/each}
      </div>
    </section>
  {:else if !loading}
    <section class="card p-4">
      <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Top highlights' : $_('reports.topHighlights')}</h3>
      {#if topHighlights.length}
        <div class="mt-3 grid gap-2 md:grid-cols-3">
          {#each topHighlights as h}
            <div class="rounded-md border p-3" style="border-color: var(--color-border); background: rgb(var(--color-surface-2) / 0.4)">
              <p class="text-xs" style="color: var(--color-text-muted)">{h.label}</p>
              <p class="mt-1 text-lg font-semibold" style="color: var(--color-text)">{h.value}</p>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-2 text-sm" style="color: var(--color-text-muted)">{$isLoading ? 'No visual data' : $_('reports.noVisualData')}</p>
      {/if}
    </section>
  {/if}

  {#if report || loading}
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Detail Data' : $_('reports.detailData')}</h3>
        {#if totalRows}
          <span class="text-xs" style="color: var(--color-text-muted)">{totalRows.toLocaleString('vi-VN')} {$isLoading ? 'results' : $_('reports.resultItems')}</span>
        {/if}
      </div>

      <ReportTable
        tableData={report?.table ? { ...report.table, rows: normalizedRows } : undefined}
        columns={effectiveColumns}
        {loading}
        onPageChange={handlePageChange}
        onRowClick={report?.kpis?.length
          ? (row) => {
              const statusVal = String(row.status ?? row.typeName ?? '')
              if (statusVal) handleDrilldown('status', statusVal)
            }
          : undefined}
      />
    </section>
  {/if}

  {#if report?.meta?.generatedAt}
    <p class="text-right text-xs" style="color: var(--color-text-muted)">
      {$isLoading ? 'Updated at' : $_('reports.updatedAt')} {new Date(report.meta.generatedAt).toLocaleString('vi-VN')}
    </p>
  {/if}
</div>

<style>
  .report-shell-nav {
    border: 1px solid var(--color-border);
    background: rgb(var(--color-surface));
  }
  .report-module-chip {
    border-color: var(--color-border);
    color: var(--color-text-muted);
    background: rgb(var(--color-surface-2) / 0.35);
  }
  .report-module-chip:hover {
    color: var(--color-text);
    border-color: var(--color-primary);
  }
  .report-module-chip-active {
    color: var(--color-text);
    border-color: var(--color-primary);
    background: var(--color-primary-muted);
  }
  .report-saved-chip {
    border-color: var(--color-border);
    color: var(--color-text-muted);
    background: rgb(var(--color-surface-2) / 0.35);
  }
  .report-saved-chip:hover {
    color: var(--color-text);
    border-color: var(--color-primary);
  }
  .report-retry-btn {
    color: var(--color-danger);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .report-retry-btn:hover {
    text-decoration: underline;
  }
  .report-hub-card {
    border: 1px solid var(--color-border);
    background: linear-gradient(155deg, rgb(var(--color-surface) / 1), rgb(var(--color-surface-2) / 0.35));
  }
  .report-pill {
    background: var(--color-primary-muted);
    color: var(--color-primary);
  }
  .report-quick-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    background: rgb(var(--color-surface-2) / 0.3);
    transition: all 150ms ease;
  }
  .report-quick-item:hover {
    color: var(--color-text);
    border-color: var(--color-primary);
    background: var(--color-primary-muted);
  }
  .report-print-card {
    border: 1px solid var(--color-border);
    background: linear-gradient(180deg, rgb(var(--color-surface) / 1), rgb(var(--color-surface-3) / 0.25));
  }
  .report-print-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 0.45rem 0.6rem;
    background: rgb(var(--color-surface-2) / 0.35);
  }
  .report-priority {
    border-radius: 999px;
    background: rgb(var(--color-warning) / 0.15);
    color: var(--color-warning);
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.125rem 0.45rem;
    white-space: nowrap;
  }
</style>

<DrilldownDrawer
  bind:open={drillOpen}
  reportKey={activeKey}
  dimension={drillDim}
  value={drillVal}
  {filters}
/>
