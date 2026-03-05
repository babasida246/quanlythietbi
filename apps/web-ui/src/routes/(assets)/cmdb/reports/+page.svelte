<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { ArrowLeft, RefreshCw } from 'lucide-svelte'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { Button, Tabs, TabsList, TabsTrigger } from '$lib/components/ui'
  import KpiCard from '$lib/reports/KpiCard.svelte'
  import ChartCard from '$lib/reports/ChartCard.svelte'
  import ReportFilterBar from '$lib/reports/ReportFilterBar.svelte'
  import ReportTable from '$lib/reports/ReportTable.svelte'
  import {
    fetchReport,
    exportToCsv,
    REPORT_REGISTRY,
    type ReportKey,
    type ReportFilters,
    type ReportResponse,
    type ReportDefinition
  } from '$lib/api/reports'
  import { toast } from '$lib/components/toast'
  import { _, isLoading } from '$lib/i18n'

  //  Config 
  const CMDB_KEYS: ReportKey[] = ['cmdb-overview', 'cmdb-data-quality']

  //  State 
  let activeKey = $state<ReportKey>('cmdb-overview')
  let filters   = $state<ReportFilters>({})
  let loading   = $state(false)
  let error     = $state('')
  let report    = $state<ReportResponse | null>(null)

  //  Derived 
  const activeReport = $derived(REPORT_REGISTRY.find(r => r.key === activeKey))

  //  Data loading 
  async function loadReport() {
    try {
      loading = true
      error = ''
      report = await fetchReport(activeKey, { ...filters, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20 })
    } catch (e) {
      error = e instanceof Error ? e.message : ($isLoading ? 'Unknown error' : $_('common.unknownError'))
      toast.error(error)
    } finally {
      loading = false
    }
  }

  function setKey(key: ReportKey) {
    activeKey = key
    filters = {}
    report = null
    void loadReport()
  }

  function handlePageChange(pg: number) {
    filters = { ...filters, page: pg }
    void loadReport()
  }

  function handleExport() {
    if (!report?.table?.rows?.length) return
    exportToCsv(report.table.rows, `${activeKey}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  //  Init 
  onMount(() => {
    void loadReport()
  })
</script>

<div class="page-shell page-content">
  <PageHeader title={$isLoading ? 'Configuration Management Reports' : $_('cmdb.report.pageTitle')} subtitle={$isLoading ? 'Configuration item overview & data quality' : $_('cmdb.report.subtitle')}>
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={() => goto('/cmdb')}>
        <ArrowLeft class="h-3.5 w-3.5 mr-1" />{$isLoading ? 'Back' : $_('cmdb.backToCmdb')}
      </Button>
    {/snippet}
  </PageHeader>

  <!-- Tab navigation -->
  <Tabs>
    <TabsList>
      {#each CMDB_KEYS as key}
        {@const reg = REPORT_REGISTRY.find(r => r.key === key)}
        <TabsTrigger active={activeKey === key} onclick={() => setKey(key)}>
          {reg?.title ?? key}
        </TabsTrigger>
      {/each}
    </TabsList>
  </Tabs>

  <!-- Filter bar -->
  {#if activeReport?.filterFields?.length}
    <ReportFilterBar
      reportDef={activeReport as ReportDefinition}
      bind:filters
      onApply={() => { filters = { ...filters, page: 1 }; loadReport() }}
    />
  {/if}

  <!-- Toolbar -->
  <div class="flex items-center justify-between">
    <div>
      {#if report}
        <p class="text-sm text-slate-400">
          {$isLoading ? 'Updated' : $_('cmdb.report.updated')}: {new Date(report.meta?.generatedAt ?? '').toLocaleString()}
        </p>
      {/if}
    </div>
    <div class="flex gap-2">
      {#if report?.table?.rows?.length}
        <Button variant="secondary" size="sm" onclick={handleExport}>{$isLoading ? 'Export CSV' : $_('cmdb.report.exportCsv')}</Button>
      {/if}
      <Button size="sm" onclick={() => loadReport()} disabled={loading}>
        <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
        {loading ? ($isLoading ? 'Loading...' : $_('common.processing')) : ($isLoading ? 'Load report' : $_('cmdb.report.load'))}
      </Button>
    </div>
  </div>

  <!-- Error -->
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading && !report}
    <div class="flex items-center justify-center py-16 gap-3">
      <div class="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <span class="text-sm text-slate-400">{$isLoading ? 'Loading report...' : $_('cmdb.report.loading')}</span>
    </div>
  {:else if report}
    <!-- KPI Cards -->
    {#if report.kpis?.length}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each report.kpis as kpi}
          <KpiCard {kpi} />
        {/each}
      </div>
    {/if}

    <!-- Charts -->
    {#if report.charts && Object.keys(report.charts).length > 0}
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {#each Object.entries(report.charts) as [chartKey, chartData]}
          {#if chartData}
            <ChartCard title={chartKey} labels={chartData.labels} series={chartData.series} />
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Table -->
    {#if report.table}
      <ReportTable
        tableData={report.table}
        onPageChange={handlePageChange}
      />
    {/if}

    <!-- Empty state -->
    {#if !report.kpis?.length && !report.table?.rows?.length}
      <div class="empty-state py-16">
        <p class="empty-state-title">{$isLoading ? 'No data' : $_('cmdb.report.noData')}</p>
        <p class="empty-state-desc">{$isLoading ? 'Try changing filters or check CMDB data.' : $_('cmdb.report.noDataHint')}</p>
      </div>
    {/if}
  {:else}
    <div class="empty-state py-16">
      <p class="empty-state-title">{$isLoading ? 'Report not loaded' : $_('cmdb.report.notLoaded')}</p>
      <p class="empty-state-desc">{$isLoading ? 'Click "Load report" to view data.' : $_('cmdb.report.notLoadedHint')}</p>
    </div>
  {/if}
</div>
