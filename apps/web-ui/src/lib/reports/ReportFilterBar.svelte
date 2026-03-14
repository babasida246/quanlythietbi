<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui'
  import { Filter, RefreshCw, RotateCcw, Download, Bookmark } from 'lucide-svelte'
  import type { ReportDefinition, ReportFilters } from '$lib/api/reports'
  import { defaultDateRange } from '$lib/api/reports'
  import { toast } from '$lib/components/toast'
  import { _, isLoading } from '$lib/i18n'

  let {
    reportDef,
    filters = $bindable<ReportFilters>({}),
    loading = false,
    onApply,
    onExport
  }: {
    reportDef: ReportDefinition
    filters?: ReportFilters
    loading?: boolean
    onApply?: () => void
    onExport?: () => void
  } = $props()

  // Local draft filters (applied on submit)
  let draft = $state<ReportFilters>({ ...filters })

  $effect(() => {
    draft = { ...filters }
  })

  function apply() {
    filters = { ...draft }
    syncToUrl(draft)
    onApply?.()
  }

  function reset() {
    const defaults = reportDef.defaultDateDays ? defaultDateRange(reportDef.defaultDateDays) : {}
    draft = { ...defaults, page: 1 }
    filters = { ...draft }
    syncToUrl(draft)
    onApply?.()
  }

  function syncToUrl(f: ReportFilters) {
    const params = new URLSearchParams(page.url.searchParams)
    for (const [k, v] of Object.entries(f)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
      else params.delete(k)
    }
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true })
  }

  function saveView() {
    const views: Record<string, ReportFilters> = JSON.parse(localStorage.getItem('report_saved_views') ?? '{}')
    const name = reportDef.key + '_' + new Date().toISOString().slice(0, 10)
    views[name] = { ...filters }
    localStorage.setItem('report_saved_views', JSON.stringify(views))
    toast.success($_('reports.filter.savedView') + ': ' + name)
  }

  const hasDateRange   = $derived(reportDef.filterFields.includes('dateRange'))
  const hasCategoryId  = $derived(reportDef.filterFields.includes('categoryId'))
  const hasLocationId  = $derived(reportDef.filterFields.includes('locationId'))
  const hasWarehouseId = $derived(reportDef.filterFields.includes('warehouseId'))
  const hasStatus      = $derived(reportDef.filterFields.includes('status'))
</script>

<div class="card mb-4 report-filter-shell">
  <div class="report-filter-grid">
    <div class="flex items-center gap-2" style="color: var(--color-text-muted)">
      <Filter class="h-4 w-4" />
      <span class="text-sm font-medium">{$isLoading ? 'Filters' : $_('reports.filter.title')}</span>
    </div>

    <!-- Date range -->
    {#if hasDateRange}
      <div class="flex items-center gap-2">
        <div>
          <label for="rf-dateFrom" class="label-base text-xs">{$isLoading ? 'From Date' : $_('common.dateFrom')}</label>
          <input id="rf-dateFrom" type="date" class="input-base mt-0.5 h-8 py-1 text-sm" bind:value={draft.dateFrom} />
        </div>
        <div>
          <label for="rf-dateTo" class="label-base text-xs">{$isLoading ? 'To Date' : $_('common.dateTo')}</label>
          <input id="rf-dateTo" type="date" class="input-base mt-0.5 h-8 py-1 text-sm" bind:value={draft.dateTo} />
        </div>
      </div>
    {/if}

    <!-- Category filter (placeholder — would need catalog API) -->
    {#if hasCategoryId}
      <div>
        <label for="rf-categoryId" class="label-base text-xs">{$isLoading ? 'Category' : $_('reports.filter.category')}</label>
        <input id="rf-categoryId" type="text" class="input-base mt-0.5 h-8 py-1 text-sm w-32" placeholder="Category ID..." bind:value={draft.categoryId} />
      </div>
    {/if}

    <!-- Location filter -->
    {#if hasLocationId}
      <div>
        <label for="rf-locationId" class="label-base text-xs">{$isLoading ? 'Location' : $_('reports.filter.location')}</label>
        <input id="rf-locationId" type="text" class="input-base mt-0.5 h-8 py-1 text-sm w-32" placeholder="Location ID..." bind:value={draft.locationId} />
      </div>
    {/if}

    <!-- Warehouse filter -->
    {#if hasWarehouseId}
      <div>
        <label for="rf-warehouseId" class="label-base text-xs">{$isLoading ? 'Warehouse' : $_('warehouse.warehouse')}</label>
        <input id="rf-warehouseId" type="text" class="input-base mt-0.5 h-8 py-1 text-sm w-32" placeholder="Warehouse ID..." bind:value={draft.warehouseId} />
      </div>
    {/if}

    <!-- Status filter -->
    {#if hasStatus}
      <div>
        <label for="rf-status" class="label-base text-xs">{$isLoading ? 'Status' : $_('reports.filter.status')}</label>
        <input id="rf-status" type="text" class="input-base mt-0.5 h-8 py-1 text-sm w-28" placeholder={$isLoading ? 'Status...' : $_('reports.filter.statusPlaceholder')} bind:value={draft.status} />
      </div>
    {/if}

    <!-- Actions -->
    <div class="report-filter-actions flex items-center gap-2">
      <Button size="sm" variant="ghost" onclick={reset} title={$isLoading ? 'Reset' : $_('common.reset')}>
        <RotateCcw class="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onclick={saveView} title={$isLoading ? 'Save filter' : $_('reports.filter.saveView')}>
        <Bookmark class="h-3.5 w-3.5" />
      </Button>
      {#if onExport}
        <Button size="sm" variant="secondary" onclick={onExport}>
          <Download class="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      {/if}
      <Button size="sm" variant="primary" onclick={apply} disabled={loading}>
        {#if loading}
          <RefreshCw class="h-3.5 w-3.5 mr-1 animate-spin" />
        {/if}
        {$isLoading ? 'Apply' : $_('common.apply')}
      </Button>
    </div>
  </div>
</div>

<style>
  .report-filter-shell {
    border: 1px solid var(--color-border);
    background: rgb(var(--color-surface));
  }
  .report-filter-grid {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }
  .report-filter-actions {
    margin-left: auto;
  }
</style>
