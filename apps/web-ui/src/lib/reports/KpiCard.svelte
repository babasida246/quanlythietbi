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
    return kpi.trend === 'up' ? 'kpi-trend-up' : kpi.trend === 'down' ? 'kpi-trend-down' : 'kpi-trend-neutral'
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
      <div class="h-3 w-24 rounded bg-surface-3/60"></div>
      <div class="h-8 w-16 rounded bg-surface-3/80"></div>
      <div class="h-3 w-12 rounded bg-surface-3/60"></div>
    </div>
  {:else if kpi}
    <div class="p-4">
      <p class="text-[11px] font-semibold uppercase tracking-[0.08em]" style="color: var(--color-text-muted)">{kpi.label}</p>
      <p class="mt-1 text-3xl font-bold tabular-nums leading-none" style="color: var(--color-text)">{formatted}</p>
      {#if kpi.unit && kpi.unit !== '%'}
        <p class="mt-0.5 text-xs" style="color: var(--color-text-dim)">{kpi.unit}</p>
      {/if}
      {#if kpi.delta !== null && kpi.delta !== undefined}
        <p class="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] {trendClass}" style="background: rgb(var(--color-surface-2)); border: 1px solid var(--color-border)">
          <span class="font-semibold">{trendIcon}</span>
          <span>{kpi.delta > 0 ? '+' : ''}{kpi.delta.toFixed(1)}% {$isLoading ? 'vs previous period' : $_('reports.vsPreviousPeriod')}</span>
        </p>
      {/if}
    </div>
    {#if onclick}
      <div class="absolute inset-x-0 bottom-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100"></div>
    {/if}
  {:else}
    <div class="p-4">
      <div class="h-3 w-24 rounded bg-surface-3/60"></div>
    </div>
  {/if}
</div>

<style>
  .kpi-trend-up { color: var(--color-success); }
  .kpi-trend-down { color: var(--color-danger); }
  .kpi-trend-neutral { color: var(--color-text-muted); }
</style>
