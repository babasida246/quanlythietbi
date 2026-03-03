<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { BarChart3, RefreshCw } from 'lucide-svelte'
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
    type ReportKey,
    type ReportModule,
    type ReportFilters,
    type ReportResponse
  } from '$lib/api/reports'
  import { toast } from '$lib/components/toast'
  import { _, isLoading } from '$lib/i18n'

  // ─── State ───────────────────────────────────────────────────────────────
  let activeKey    = $state<ReportKey>('assets-overview')
  let filters      = $state<ReportFilters>({})
  let loading      = $state(false)
  let error        = $state('')
  let report       = $state<ReportResponse | null>(null)

  // Drilldown
  let drillOpen    = $state(false)
  let drillDim     = $state('')
  let drillVal     = $state('')

  // ─── Derived ─────────────────────────────────────────────────────────────
  const activeReport = $derived(REPORT_REGISTRY.find(r => r.key === activeKey)!)

  const moduleGroups = $derived.by(() => {
    const mods = ['assets', 'inventory', 'warehouse', 'maintenance', 'workflow', 'cmdb'] as ReportModule[]
    return mods.map(mod => ({
      mod,
      label: MODULE_LABELS[mod],
      icon: MODULE_ICONS[mod],
      reports: REPORT_REGISTRY.filter(r => r.module === mod)
    }))
  })

  // ─── Data loading ─────────────────────────────────────────────────────────
  async function loadReport() {
    if (!activeKey) return
    try {
      loading = true
      error = ''
      report = await fetchReport(activeKey, { ...filters, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20 })
    } catch (e) {
      error = e instanceof Error ? e.message : $_('common.unknownError')
      toast.error(error)
    } finally {
      loading = false
    }
  }

  function setReport(key: ReportKey) {
    activeKey = key
    const def = REPORT_REGISTRY.find(r => r.key === key)!
    filters = def.defaultDateDays ? defaultDateRange(def.defaultDateDays) : {}
    report = null
    const params = new URLSearchParams(page.url.searchParams)
    params.set('report', key)
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true })
    void loadReport()
  }

  function handleDrilldown(dimension: string, value: string) {
    drillDim = dimension
    drillVal = String(value)
    drillOpen = true
  }

  function handlePageChange(pg: number) {
    filters = { ...filters, page: pg }
    void loadReport()
  }

  function handleExport() {
    if (!report?.table?.rows?.length) return
    exportToCsv(report.table.rows, `${activeKey}-${new Date().toISOString().slice(0,10)}.csv`)
  }

  // ─── Saved views ──────────────────────────────────────────────────────────
  let savedViews = $state<Record<string, ReportFilters>>({})

  function loadSavedViews() {
    try {
      savedViews = JSON.parse(localStorage.getItem('report_saved_views') ?? '{}')
    } catch { savedViews = {} }
  }

  function applySavedView(name: string) {
    const view = savedViews[name]
    if (!view) return
    filters = { ...view }
    void loadReport()
    toast.success($_('reports.appliedView') + name)
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  onMount(() => {
    loadSavedViews()
    const reportParam = page.url.searchParams.get('report') as ReportKey | null
    const def = reportParam && REPORT_REGISTRY.find(r => r.key === reportParam) ? reportParam : 'assets-overview'
    activeKey = def

    // Restore filters from URL
    const fromUrl: ReportFilters = {}
    const sp = page.url.searchParams
    if (sp.get('dateFrom')) fromUrl.dateFrom = sp.get('dateFrom')!
    if (sp.get('dateTo'))   fromUrl.dateTo   = sp.get('dateTo')!
    if (sp.get('status'))   fromUrl.status   = sp.get('status')!
    if (sp.get('locationId'))  fromUrl.locationId  = sp.get('locationId')!
    if (sp.get('warehouseId')) fromUrl.warehouseId = sp.get('warehouseId')!
    if (sp.get('page'))    fromUrl.page    = Number(sp.get('page'))
    if (sp.get('pageSize')) fromUrl.pageSize = Number(sp.get('pageSize'))

    if (Object.keys(fromUrl).length) {
      filters = fromUrl
    } else if (activeReport?.defaultDateDays) {
      filters = defaultDateRange(activeReport.defaultDateDays)
    }

    void loadReport()
  })

  // ─── Chart helpers ────────────────────────────────────────────────────────
  function getChartData(chartKey: string) {
    return report?.charts?.[chartKey] ?? { labels: [], series: [] }
  }

  function isMultiSeries(series: unknown): series is { name: string; data: number[] }[] {
    return Array.isArray(series) && series.length > 0 && typeof (series[0] as { name?: string }).name === 'string'
  }

  // ─── Table column definitions per report key ───────────────────────────
  type Column = { key: string; label: string; format?: (v: unknown) => string; sortable?: boolean; align?: 'left' | 'right' }

  const TABLE_COLUMNS: Partial<Record<ReportKey, Column[]>> = $derived({
    'assets-overview': [
      { key: 'code', label: $_('reports.col.assetCode'), sortable: true },
      { key: 'model', label: 'Model', sortable: true },
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
      { key: 'model', label: 'Model', sortable: true },
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
      { key: 'ciCode', label: 'CI Code', sortable: true },
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
      { key: 'unitCost', label: $_('reports.col.unitCost'), sortable: true, align: 'right', format: (v) => v ? Number(v).toLocaleString('vi-VN') + ' ₫' : '-' },
      { key: 'totalValue', label: $_('reports.col.totalValue'), sortable: true, align: 'right', format: (v) => v ? Number(v).toLocaleString('vi-VN') + ' ₫' : '-' }
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

  const effectiveColumns = $derived(TABLE_COLUMNS[activeKey] ?? [])

  // ─── Chart layout per report ───────────────────────────────────────────
  type ChartConfig = {
    chartKey: string
    title: string
    type: 'bar' | 'line' | 'pie' | 'donut' | 'stacked-bar'
    drillDimension?: string
  }

  const CHART_LAYOUT: Partial<Record<ReportKey, ChartConfig[]>> = $derived({
    'assets-overview': [
      { chartKey: 'byStatus',   title: $_('reports.chart.byStatus'),        type: 'bar',  drillDimension: 'status' },
      { chartKey: 'byCategory', title: $_('reports.chart.byCategoryTop10'), type: 'pie',  drillDimension: 'category' },
      { chartKey: 'byLocation', title: $_('reports.chart.byLocationTop10'), type: 'bar',  drillDimension: 'location' }
    ],
    'assets-trend': [
      { chartKey: 'trend', title: $_('reports.chart.monthlyTrend'), type: 'line' }
    ],
    'assets-warranty': [
      { chartKey: 'byBucket', title: $_('reports.chart.warrantyExpiring'), type: 'donut' }
    ],
    'assets-by-location': [
      { chartKey: 'byLocation', title: $_('reports.chart.assetsByLocation'), type: 'stacked-bar' }
    ],
    'inventory-stock': [
      { chartKey: 'topItems', title: $_('reports.chart.topStockItems'), type: 'bar' }
    ],
    'inventory-movement': [
      { chartKey: 'movement', title: $_('reports.chart.monthlyMovement'), type: 'line' }
    ],
    'inventory-low-stock': [
      { chartKey: 'lowStock', title: $_('reports.chart.lowStockTop10'), type: 'bar' }
    ],
    'maintenance-sla': [
      { chartKey: 'bySeverity', title: $_('reports.chart.bySeverity'),      type: 'stacked-bar', drillDimension: 'severity' },
      { chartKey: 'avgHours',   title: $_('reports.chart.avgProcessingHours'), type: 'bar' }
    ],
    'maintenance-status': [
      { chartKey: 'byStatus', title: $_('reports.chart.maintenanceStatus'), type: 'pie', drillDimension: 'status' }
    ],
    'workflow-summary': [
      { chartKey: 'byStatus', title: $_('reports.chart.requestsByStatus'), type: 'donut', drillDimension: 'status' },
      { chartKey: 'byType',   title: $_('reports.chart.byRequestType'),    type: 'bar' }
    ],
    'cmdb-overview': [
      { chartKey: 'byType',      title: $_('reports.chart.cisByType'),       type: 'pie' },
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
    'warehouse-reorder-alerts': [
      { chartKey: 'shortfallTop10', title: $_('reports.chart.shortfallTop10'), type: 'bar' }
    ],
    'warehouse-fefo-lots': [
      { chartKey: 'expiringByMonth', title: $_('reports.chart.expiringByMonth'), type: 'bar' }
    ],
    'warehouse-stock-available': [
      { chartKey: 'availableByWarehouse', title: $_('reports.chart.availableByWarehouse'), type: 'bar' }
    ]
  })

  const effectiveCharts = $derived(CHART_LAYOUT[activeKey] ?? [])
</script>

<div class="page-shell flex h-full overflow-hidden">
  <!-- ─── Left sidebar: report selector ─────────────────────────────────── -->
  <aside class="w-60 flex-none overflow-y-auto border-r border-slate-700 bg-surface-2 py-3">
    <div class="px-3 pb-2">
      <div class="flex items-center gap-2 text-slate-400">
        <BarChart3 class="h-4 w-4" />
        <span class="text-xs font-semibold uppercase tracking-wider">{$isLoading ? 'Reports' : $_('reports.title')}</span>
      </div>
    </div>

    {#each moduleGroups as group}
      <div class="mt-2">
        <p class="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {group.icon} {group.label}
        </p>
        {#each group.reports as rep}
          <button
            class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-700/60
              {activeKey === rep.key ? 'bg-primary/20 text-primary font-medium' : 'text-slate-300'}"
            onclick={() => setReport(rep.key)}
          >
            {rep.title}
          </button>
        {/each}
      </div>
    {/each}

    <!-- Saved views -->
    {#if Object.keys(savedViews).length}
      <div class="mt-4 border-t border-slate-700 pt-3">
        <p class="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">{$isLoading ? 'Saved' : $_('reports.sidebar.saved')}</p>
        {#each Object.keys(savedViews) as name}
          <button
            class="w-full truncate px-3 py-1.5 text-left text-xs text-slate-400 hover:text-white"
            onclick={() => applySavedView(name)}
            title={name}
          >
            {name}
          </button>
        {/each}
      </div>
    {/if}
  </aside>

  <!-- ─── Main content ──────────────────────────────────────────────────── -->
  <div class="flex flex-1 flex-col overflow-y-auto">
    <div class="page-content">
      <!-- Header -->
      <PageHeader
        title={activeReport?.title ?? ($isLoading ? 'Reports' : $_('reports.title'))}
        subtitle={activeReport?.description ?? ''}
      >
        {#snippet actions()}
          <Button size="sm" variant="ghost" onclick={() => loadReport()} title={$isLoading ? 'Refresh data' : $_('reports.refreshData')}>
            <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
          </Button>
        {/snippet}
      </PageHeader>

      <!-- Filter bar -->
      {#if activeReport}
        <ReportFilterBar
          reportDef={activeReport}
          bind:filters
          {loading}
          onApply={() => { filters = { ...filters, page: 1 }; loadReport() }}
          onExport={handleExport}
        />
      {/if}

      <!-- Error -->
      {#if error}
        <div class="alert alert-error mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button class="text-red-300 hover:text-white" onclick={() => loadReport()}>{$isLoading ? 'Retry' : $_('common.retry')}</button>
        </div>
      {/if}

      <!-- KPI cards -->
      <section class="mb-6">
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

      <!-- Charts grid -->
      {#if effectiveCharts.length}
        <section class="mb-6">
          <div class="grid gap-4 {effectiveCharts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}">
            {#each effectiveCharts as cfg}
              {@const cd = getChartData(cfg.chartKey)}
              {@const multiSeries = isMultiSeries(cd.series)}
              <ChartCard
                title={cfg.title}
                labels={cd.labels}
                series={cd.series}
                type={cfg.type}
                loading={loading && !report}
                onclick={cfg.drillDimension ? (label) => handleDrilldown(cfg.drillDimension!, label) : undefined}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Detail table -->
      {#if report || loading}
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Detail Data' : $_('reports.detailData')}</h3>
            {#if report?.table?.total}
              <span class="text-xs text-slate-500">{report.table.total.toLocaleString('vi-VN')} {$isLoading ? 'results' : $_('reports.results')}</span>
            {/if}
          </div>

          <ReportTable
            tableData={report?.table}
            columns={effectiveColumns}
            {loading}
            onPageChange={handlePageChange}
            onRowClick={report?.kpis?.length ? (row) => {
              const statusVal = String(row.status ?? row.typeName ?? '')
              if (statusVal) handleDrilldown('status', statusVal)
            } : undefined}
          />
        </section>
      {/if}

      <!-- Meta -->
      {#if report?.meta?.generatedAt}
        <p class="mt-4 text-right text-xs text-slate-600">
          {$isLoading ? 'Updated at' : $_('reports.updatedAt')} {new Date(report.meta.generatedAt).toLocaleString('vi-VN')}
        </p>
      {/if}
    </div>
  </div>
</div>

<!-- Drilldown drawer -->
<DrilldownDrawer
  bind:open={drillOpen}
  reportKey={activeKey}
  dimension={drillDim}
  value={drillVal}
  {filters}
/>
