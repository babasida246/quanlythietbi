<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import type { KpiCard } from '$lib/api/reports'

  let {
    kpi,
    loading = false,
    onclick
  }: {
    kpi?: KpiCard
    loading?: boolean
    onclick?: () => void
  } = $props()

  const formatted = $derived.by(() => {
    if (!kpi) return '-'
    const val = kpi.value
    if (typeof val === 'string') return val
    if (typeof val === 'number') {
      if (kpi.unit === '%') return val.toFixed(1) + '%'
      if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M'
      if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K'
      return val.toLocaleString('vi-VN')
    }
    return '-'
  })

  const trendClass = $derived.by(() => {
    if (!kpi?.trend) return ''
    return kpi.trend === 'up' ? 'text-green-400' : kpi.trend === 'down' ? 'text-red-400' : 'text-slate-400'
  })

  const trendIcon = $derived.by(() => {
    if (!kpi?.trend) return ''
    return kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'
  })
</script>

<div
  class="card group relative overflow-hidden transition-shadow hover:shadow-lg {onclick ? 'cursor-pointer' : ''}"
  role={onclick ? 'button' : undefined}
  onkeydown={onclick ? (e) => e.key === 'Enter' && onclick?.() : undefined}
  {onclick}
>
  {#if loading}
    <div class="animate-pulse space-y-2 p-4">
      <div class="h-3 w-24 rounded bg-slate-700"></div>
      <div class="h-8 w-16 rounded bg-slate-600"></div>
      <div class="h-3 w-12 rounded bg-slate-700"></div>
    </div>
  {:else if kpi}
    <div class="p-4">
      <p class="text-xs font-medium uppercase tracking-wider text-slate-400">{kpi.label}</p>
      <p class="mt-1 text-3xl font-bold text-white tabular-nums">{formatted}</p>
      {#if kpi.unit && kpi.unit !== '%'}
        <p class="mt-0.5 text-xs text-slate-500">{kpi.unit}</p>
      {/if}
      {#if kpi.delta !== null && kpi.delta !== undefined}
        <p class="mt-2 flex items-center gap-1 text-xs {trendClass}">
          <span>{trendIcon}</span>
          <span>{kpi.delta > 0 ? '+' : ''}{kpi.delta.toFixed(1)}% {$isLoading ? 'vs previous period' : $_('reports.vsPreviousPeriod')}</span>
        </p>
      {/if}
    </div>
    {#if onclick}
      <div class="absolute inset-x-0 bottom-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100"></div>
    {/if}
  {:else}
    <div class="p-4">
      <div class="h-3 w-24 rounded bg-slate-700"></div>
    </div>
  {/if}
</div>
