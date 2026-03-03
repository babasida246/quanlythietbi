<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { ChevronUp, ChevronDown } from 'lucide-svelte'
  import type { ReportTable } from '$lib/api/reports'

  type Column = {
    key: string
    label: string
    format?: (v: unknown) => string
    align?: 'left' | 'right' | 'center'
    sortable?: boolean
  }

  let {
    tableData,
    columns = [],
    loading = false,
    onPageChange,
    onRowClick
  }: {
    tableData?: ReportTable
    columns?: Column[]
    loading?: boolean
    onPageChange?: (page: number) => void
    onRowClick?: (row: Record<string, unknown>) => void
  } = $props()

  let sortKey = $state('')
  let sortDir = $state<'asc' | 'desc'>('asc')

  const rows = $derived.by(() => {
    if (!tableData?.rows?.length) return []
    if (!sortKey) return tableData.rows
    return [...tableData.rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''), 'vi')
      return sortDir === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = $derived(tableData
    ? Math.max(1, Math.ceil(tableData.total / tableData.pageSize))
    : 1)

  const currentPage = $derived(tableData?.page ?? 1)

  function toggleSort(key: string) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey = key
      sortDir = 'asc'
    }
  }

  function fmt(col: Column, row: Record<string, unknown>): string {
    const v = row[col.key]
    if (col.format) return col.format(v)
    if (v === null || v === undefined) return '-'
    if (v instanceof Date) return v.toLocaleDateString('vi-VN')
    if (typeof v === 'number') return v.toLocaleString('vi-VN')
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return new Date(v).toLocaleDateString('vi-VN')
    }
    return String(v)
  }

  // Auto-derive columns from first row if not specified
  const effectiveCols = $derived.by((): Column[] => {
    if (columns.length) return columns
    if (!tableData?.rows?.length) return []
    return Object.keys(tableData.rows[0]).map(k => ({ key: k, label: k, sortable: true }))
  })
</script>

<div class="card overflow-hidden p-0">
  {#if loading}
    <div class="p-4 space-y-2">
      {#each Array(5) as _}
        <div class="h-8 animate-pulse rounded bg-slate-700"></div>
      {/each}
    </div>
  {:else if !rows.length}
    <div class="flex h-32 items-center justify-center text-slate-500 text-sm">
      {$isLoading ? 'No data' : $_('common.noData')}
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-700 bg-slate-800">
          <tr>
            {#each effectiveCols as col}
              <th
                class="px-4 py-3 text-{col.align ?? 'left'} text-xs font-semibold uppercase tracking-wider text-slate-400 {col.sortable ? 'cursor-pointer select-none hover:text-white' : ''}"
                onclick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <div class="flex items-center gap-1 {col.align === 'right' ? 'justify-end' : ''}">
                  {col.label}
                  {#if col.sortable && sortKey === col.key}
                    {#if sortDir === 'asc'}
                      <ChevronUp class="h-3 w-3" />
                    {:else}
                      <ChevronDown class="h-3 w-3" />
                    {/if}
                  {/if}
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          {#each rows as row, i}
            <tr
              class="hover:bg-slate-800/50 transition-colors {onRowClick ? 'cursor-pointer' : ''}"
              onclick={() => onRowClick?.(row)}
            >
              {#each effectiveCols as col}
                <td class="px-4 py-2.5 text-{col.align ?? 'left'} text-slate-200">
                  {fmt(col, row)}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if onPageChange && totalPages > 1}
      <div class="flex items-center justify-between border-t border-slate-700 px-4 py-3 text-sm text-slate-400">
        <span>
          {#if $isLoading}
            Showing {((currentPage - 1) * (tableData?.pageSize ?? 20)) + 1}–{Math.min(currentPage * (tableData?.pageSize ?? 20), tableData?.total ?? 0)} / {tableData?.total ?? 0} results
          {:else}
            {$_('reports.showingResults', { values: { from: ((currentPage - 1) * (tableData?.pageSize ?? 20)) + 1, to: Math.min(currentPage * (tableData?.pageSize ?? 20), tableData?.total ?? 0), total: tableData?.total ?? 0 } })}
          {/if}
        </span>
        <div class="flex gap-1">
          <button
            class="rounded px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-30"
            disabled={currentPage <= 1}
            onclick={() => onPageChange?.(currentPage - 1)}
          >
            {$isLoading ? '‹ Prev' : '‹ ' + $_('common.previous')}
          </button>
          {#each Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const mid = Math.max(3, Math.min(currentPage, totalPages - 2))
            return mid - 2 + i
          }) as pg}
            {#if pg >= 1 && pg <= totalPages}
              <button
                class="rounded px-2 py-1 text-xs {pg === currentPage ? 'bg-primary text-white' : 'hover:bg-slate-700'}"
                onclick={() => onPageChange?.(pg)}
              >
                {pg}
              </button>
            {/if}
          {/each}
          <button
            class="rounded px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-30"
            disabled={currentPage >= totalPages}
            onclick={() => onPageChange?.(currentPage + 1)}
          >
            Sau ›
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
