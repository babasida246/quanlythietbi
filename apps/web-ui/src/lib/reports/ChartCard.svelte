<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { _, isLoading } from '$lib/i18n'

  type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'stacked-bar'

  interface SeriesItem {
    name: string
    data: number[]
  }

  let {
    title = '',
    labels = [],
    series = [] as number[] | SeriesItem[],
    type = 'bar' as ChartType,
    loading = false,
    height = 280,
    colors,
    onclick
  }: {
    title?: string
    labels?: string[]
    series?: number[] | SeriesItem[]
    type?: ChartType
    loading?: boolean
    height?: number
    colors?: string[]
    onclick?: (label: string, value: number) => void
  } = $props()

  let container = $state<HTMLDivElement | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: any = null
  let themeObserver: MutationObserver | null = null

  const DEFAULT_COLORS = [
    'var(--color-chart-1, #6366F1)',
    'var(--color-chart-2, #22D3EE)',
    'var(--color-chart-3, #10B981)',
    'var(--color-chart-4, #F59E0B)',
    'var(--color-chart-5, #EF4444)',
    'var(--color-chart-6, #8B5CF6)',
    'var(--color-chart-7, #F97316)',
    'var(--color-chart-8, #14B8A6)'
  ]

  // Read resolved chart colors from CSS tokens (supports dark/light theme switch)
  function getChartTheme() {
    const s = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null
    const get = (v: string, fallback: string) => s?.getPropertyValue(v).trim() || fallback
    return {
      bg:             get('--color-chart-bg',             '#0F172A'),
      grid:           get('--color-chart-grid',           '#1E293B'),
      text:           get('--color-chart-text',           '#94A3B8'),
      tooltipBg:      get('--color-chart-tooltip-bg',     '#1E293B'),
      tooltipBorder:  get('--color-chart-tooltip-border', '#334155'),
      // Resolve chart palette tokens to actual hex
      palette: Array.from({ length: 8 }, (_, i) =>
        get(`--color-chart-${i + 1}`, DEFAULT_COLORS[i])
      )
    }
  }

  function isSeriesArray(s: number[] | SeriesItem[]): s is SeriesItem[] {
    return s.length > 0 && typeof (s as SeriesItem[])[0] === 'object'
  }

  function buildOption(): Record<string, unknown> {
    const theme = getChartTheme()
    const THEME_COLORS = colors ?? theme.palette

    const baseTooltip = {
      trigger: type === 'pie' || type === 'donut' ? 'item' : 'axis',
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.text, fontSize: 12 },
      axisPointer: { type: 'shadow' }
    }

    const baseLegend = {
      textStyle: { color: theme.text },
      pageIconColor: theme.text,
      show: (type === 'pie' || type === 'donut' || isSeriesArray(series)) && labels.length > 0
    }

    if (type === 'pie' || type === 'donut') {
      const data = isSeriesArray(series)
        ? (series as SeriesItem[]).map((s, i) => ({ name: s.name, value: s.data.reduce((a, b) => a + b, 0), itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length] } }))
        : (series as number[]).map((v, i) => ({ name: labels[i] ?? `Item ${i}`, value: v, itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length] } }))

      return {
        backgroundColor: theme.bg,
        tooltip: { ...baseTooltip, formatter: '{a} <br/>{b}: {c} ({d}%)' },
        legend: { ...baseLegend, orient: 'vertical', right: 10, top: 'center' },
        series: [{
          type: 'pie',
          radius: type === 'donut' ? ['45%', '70%'] : '65%',
          center: ['40%', '50%'],
          data,
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } }
        }]
      }
    }

    const xAxis = {
      type: 'category',
      data: labels,
      axisLabel: { color: theme.text, fontSize: 11, rotate: labels.length > 6 ? 30 : 0, overflow: 'truncate', width: 80 },
      axisLine: { lineStyle: { color: theme.grid } },
      splitLine: { show: false }
    }

    const yAxis = {
      type: 'value',
      axisLabel: { color: theme.text, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.grid } },
      axisLine: { show: false }
    }

    if (type === 'line') {
      const seriesData = isSeriesArray(series)
        ? (series as SeriesItem[]).map((s_, i) => ({
            name: s_.name,
            type: 'line',
            data: s_.data,
            smooth: true,
            lineStyle: { color: THEME_COLORS[i % THEME_COLORS.length], width: 2 },
            itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length] },
            areaStyle: { opacity: 0.08, color: THEME_COLORS[i % THEME_COLORS.length] }
          }))
        : [{ name: title, type: 'line', data: series as number[], smooth: true, lineStyle: { color: THEME_COLORS[0], width: 2 }, itemStyle: { color: THEME_COLORS[0] }, areaStyle: { opacity: 0.08, color: THEME_COLORS[0] } }]

      return { backgroundColor: theme.bg, tooltip: baseTooltip, legend: baseLegend, xAxis, yAxis, series: seriesData, grid: { left: 50, right: 20, top: 30, bottom: labels.length > 6 ? 60 : 30 } }
    }

    if (type === 'stacked-bar') {
      const seriesData = isSeriesArray(series)
        ? (series as SeriesItem[]).map((s_, i) => ({
            name: s_.name,
            type: 'bar',
            stack: 'total',
            data: s_.data,
            itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length] }
          }))
        : []

      return { backgroundColor: theme.bg, tooltip: { ...baseTooltip, trigger: 'axis' }, legend: baseLegend, xAxis, yAxis, series: seriesData, grid: { left: 50, right: 20, top: 40, bottom: labels.length > 6 ? 60 : 30 } }
    }

    // default: bar (grouped or simple)
    const seriesData = isSeriesArray(series)
      ? (series as SeriesItem[]).map((s_, i) => ({
          name: s_.name,
          type: 'bar',
          data: s_.data,
          itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length], borderRadius: [2, 2, 0, 0] }
        }))
      : [{
          name: title,
          type: 'bar',
          data: (series as number[]).map((v, i) => ({ value: v, itemStyle: { color: THEME_COLORS[i % THEME_COLORS.length] } })),
          itemStyle: { borderRadius: [2, 2, 0, 0] }
        }]

    return {
      backgroundColor: theme.bg,
      tooltip: baseTooltip,
      legend: isSeriesArray(series) ? baseLegend : undefined,
      xAxis,
      yAxis,
      series: seriesData,
      grid: { left: 50, right: 20, top: isSeriesArray(series) ? 40 : 20, bottom: labels.length > 6 ? 60 : 30 }
    }
  }

  onMount(async () => {
    if (!container) return
    const echarts = await import('echarts')
    chart = echarts.init(container)

    if (onclick) {
      chart.on('click', (params: { name: string; value: number }) => {
        onclick(params.name, params.value)
      })
    }

    chart.setOption(buildOption())

    const ro = new ResizeObserver(() => { chart?.resize() })
    ro.observe(container)

    // Re-render chart when dark/light mode or color preset toggles.
    themeObserver = new MutationObserver(() => {
      if (chart) chart.setOption(buildOption(), { notMerge: true })
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-scheme']
    })
  })

  $effect(() => {
    if (!chart) return
    const option = buildOption()
    // Re-read reactive deps
    void labels.length
    void series.length
    chart.setOption(option, { notMerge: false })
  })

  onDestroy(() => {
    chart?.dispose()
    themeObserver?.disconnect()
  })
</script>

<div class="card h-full">
  {#if title}
    <p class="mb-3 text-sm font-semibold" style="color: var(--color-text);">{title}</p>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center animate-pulse rounded skeleton" style="height: {height}px">
      <div class="h-32 w-32 rounded-full border-4 border-t-primary animate-spin" style="border-color: var(--color-border); border-top-color: var(--color-primary);"></div>
    </div>
  {:else if !labels.length && !series.length}
    <div class="empty-state" style="height: {height}px">
      {$isLoading ? 'No data' : $_('reports.noData')}
    </div>
  {:else}
    <div bind:this={container} style="height: {height}px; width: 100%;"></div>
  {/if}
</div>
