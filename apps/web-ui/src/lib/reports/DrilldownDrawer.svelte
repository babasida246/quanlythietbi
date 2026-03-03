<script lang="ts">
  import { X, ExternalLink } from 'lucide-svelte'
  import type { DrilldownResponse, ReportFilters } from '$lib/api/reports'
  import { fetchDrilldown, exportToCsv, type ReportKey } from '$lib/api/reports'
  import { Button } from '$lib/components/ui'
  import { _, isLoading } from '$lib/i18n'

  let {
    open = $bindable(false),
    reportKey,
    dimension,
    value,
    filters = {}
  }: {
    open?: boolean
    reportKey: ReportKey
    dimension: string
    value: string
    filters?: ReportFilters
  } = $props()

  let loading = $state(false)
  let error = $state('')
  let data = $state<DrilldownResponse | null>(null)

  $effect(() => {
    if (open && dimension && value) {
      void load()
    }
  })

  async function load() {
    try {
      loading = true
      error = ''
      data = await fetchDrilldown(reportKey, { ...filters, dimension, value })
    } catch (e) {
      error = e instanceof Error ? e.message : ($isLoading ? 'Unknown error' : $_('reports.unknownError'))
    } finally {
      loading = false
    }
  }

  function handleExport() {
    if (!data?.rows?.length) return
    exportToCsv(data.rows, `drilldown-${reportKey}-${dimension}-${value}.csv`)
  }

  const colKeys = $derived.by(() => {
    if (!data?.rows?.length) return []
    return Object.keys(data.rows[0])
  })

  function fmtCell(v: unknown): string {
    if (v === null || v === undefined) return '-'
    if (v instanceof Date) return v.toLocaleDateString('vi-VN')
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString('vi-VN')
    if (typeof v === 'number') return v.toLocaleString('vi-VN')
    return String(v)
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    onclick={() => (open = false)}
    role="presentation"
  ></div>

  <!-- Drawer -->
  <aside class="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-surface-1 shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-700 px-5 py-4">
      <div>
        <h2 class="text-base font-semibold">Drilldown: {dimension} = {value}</h2>
        {#if data}
          <p class="text-xs text-slate-400 mt-0.5">{$isLoading ? `${data.total} results` : $_('reports.results', { values: { count: data.total } })}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if data?.rows?.length}
          <Button size="sm" variant="secondary" onclick={handleExport}>{$isLoading ? 'Export CSV' : $_('reports.exportCsv')}</Button>
        {/if}
        <button
          class="rounded p-1 hover:bg-slate-700 text-slate-400 hover:text-white"
          onclick={() => (open = false)}
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-5">
      {#if loading}
        <div class="space-y-2">
          {#each Array(5) as _}
            <div class="h-8 animate-pulse rounded bg-slate-700"></div>
          {/each}
        </div>
      {:else if error}
        <div class="alert alert-error">{error}</div>
      {:else if !data?.rows?.length}
        <div class="flex h-32 items-center justify-center text-slate-500">{$isLoading ? 'No data' : $_('reports.noData')}</div>
      {:else}
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-surface-1">
            <tr class="border-b border-slate-700">
              {#each colKeys as k}
                <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">{k}</th>
              {/each}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            {#each data.rows as row}
              <tr class="hover:bg-slate-800/50">
                {#each colKeys as k}
                  <td class="px-3 py-2 text-slate-200">{fmtCell(row[k])}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if (data?.total ?? 0) > data.rows.length}
          <p class="mt-3 text-center text-xs text-slate-500">
            {$isLoading ? `Showing ${data.rows.length} / ${data.total} \u2014` : $_('reports.showingOfTotal', { values: { shown: data.rows.length, total: data.total } })} <span class="text-primary">{$isLoading ? 'Export CSV' : $_('reports.exportCsv')}</span> {$isLoading ? 'for all' : $_('reports.forAll')}
          </p>
        {/if}
      {/if}
    </div>
  </aside>
{/if}
