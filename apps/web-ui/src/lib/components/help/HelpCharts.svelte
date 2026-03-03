<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _, isLoading } from '$lib/i18n';

  let funnelEl = $state<HTMLDivElement | null>(null);
  let donutEl = $state<HTMLDivElement | null>(null);
  let barEl = $state<HTMLDivElement | null>(null);

  let charts: Array<{ dispose: () => void; resize: () => void }> = [];

  // TODO: Thay mock data bằng API thực tế (GET /v1/reports/wo-stats)
  const funnelData = [
    { value: 100, name: 'Danh mục' },
    { value: 85, name: 'Tài sản' },
    { value: 70, name: 'Nhập kho' },
    { value: 50, name: 'Work Order' },
    { value: 40, name: 'Đóng WO' },
    { value: 35, name: 'Báo cáo' }
  ];

  // TODO: Thay mock data bằng API thực tế (GET /v1/reports/wo-status-distribution)
  const donutData = [
    { value: 28, name: 'Open' },
    { value: 15, name: 'Diagnosing' },
    { value: 10, name: 'Waiting Parts' },
    { value: 32, name: 'Repaired' },
    { value: 45, name: 'Closed' },
    { value: 5, name: 'Canceled' }
  ];

  // TODO: Thay mock data bằng API thực tế (GET /v1/reports/avg-resolution-time)
  const barLabels = ['Low', 'Medium', 'High', 'Critical'];
  const barValues = [2.5, 4.8, 8.2, 14.5]; // ngày

  const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  const darkBg = 'transparent';

  onMount(async () => {
    const echarts = await import('echarts');

    if (funnelEl) {
      const c = echarts.init(funnelEl, 'dark');
      c.setOption({
        backgroundColor: darkBg,
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        series: [{
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          min: 0,
          max: 100,
          sort: 'descending',
          gap: 2,
          label: { show: true, position: 'inside', color: '#fff', fontSize: 12 },
          itemStyle: { borderWidth: 0 },
          data: funnelData.map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] }
          }))
        }]
      });
      charts.push(c);
    }

    if (donutEl) {
      const c = echarts.init(donutEl, 'dark');
      c.setOption({
        backgroundColor: darkBg,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: {
          orient: 'horizontal',
          bottom: 0,
          textStyle: { color: '#94a3b8', fontSize: 11 }
        },
        series: [{
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#fff' } },
          data: donutData.map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] }
          }))
        }]
      });
      charts.push(c);
    }

    if (barEl) {
      const c = echarts.init(barEl, 'dark');
      c.setOption({
        backgroundColor: darkBg,
        tooltip: { trigger: 'axis', formatter: '{b}: {c} ngày' },
        xAxis: {
          type: 'category',
          data: barLabels,
          axisLabel: { color: '#94a3b8' },
          axisLine: { lineStyle: { color: '#334155' } }
        },
        yAxis: {
          type: 'value',
          name: 'Ngày',
          nameTextStyle: { color: '#94a3b8' },
          axisLabel: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: '#1e293b' } }
        },
        grid: { left: 50, right: 20, top: 30, bottom: 30 },
        series: [{
          type: 'bar',
          data: barValues.map((v, i) => ({
            value: v,
            itemStyle: { color: COLORS[i], borderRadius: [4, 4, 0, 0] }
          })),
          barMaxWidth: 40
        }]
      });
      charts.push(c);
    }

    const ro = new ResizeObserver(() => {
      charts.forEach(c => c.resize());
    });
    if (funnelEl) ro.observe(funnelEl);
    if (donutEl) ro.observe(donutEl);
    if (barEl) ro.observe(barEl);
  });

  onDestroy(() => {
    charts.forEach(c => c.dispose());
    charts = [];
  });
</script>

<section id="charts" class="scroll-mt-20">
  <h2 class="text-xl font-bold text-slate-50 mb-2">{$isLoading ? 'Charts' : $_('help.charts.title')}</h2>
  <p class="text-xs text-amber-400/80 mb-4">{$isLoading ? '' : $_('help.charts.mockNote')}</p>

  <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
    <!-- Chart 1: Funnel -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
      <p class="text-sm font-semibold text-slate-100 mb-1">{$isLoading ? 'Process' : $_('help.charts.funnel')}</p>
      <p class="text-xs text-slate-400 mb-3">{$isLoading ? '' : $_('help.charts.funnelDesc')}</p>
      <div bind:this={funnelEl} style="height: 280px; width: 100%;"></div>
    </div>

    <!-- Chart 2: Donut -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
      <p class="text-sm font-semibold text-slate-100 mb-1">{$isLoading ? 'Status' : $_('help.charts.woStatus')}</p>
      <p class="text-xs text-slate-400 mb-3">{$isLoading ? '' : $_('help.charts.woStatusDesc')}</p>
      <div bind:this={donutEl} style="height: 280px; width: 100%;"></div>
    </div>

    <!-- Chart 3: Bar -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
      <p class="text-sm font-semibold text-slate-100 mb-1">{$isLoading ? 'Avg Time' : $_('help.charts.avgTime')}</p>
      <p class="text-xs text-slate-400 mb-3">{$isLoading ? '' : $_('help.charts.avgTimeDesc')}</p>
      <div bind:this={barEl} style="height: 280px; width: 100%;"></div>
    </div>
  </div>
</section>
