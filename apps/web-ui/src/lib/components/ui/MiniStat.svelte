<!--
  MiniStat — compact secondary KPI metric.
  Two per row as a supplement to primary StatsCards.

  Props:
    label   — metric name
    value   — formatted value string
    hint?   — small sub-label
    tone    — 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
    testid? — data-testid
-->
<script lang="ts">
  interface Props {
    label:   string;
    value:   string | number;
    hint?:   string;
    tone?:   'neutral' | 'primary' | 'success' | 'warning' | 'danger';
    testid?: string;
  }

  const { label, value, hint, tone = 'neutral', testid }: Props = $props();

  const valueColour: Record<string, string> = {
    neutral: 'text-slate-200',
    primary: 'text-blue-300',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger:  'text-red-300',
  };
</script>

<div
  class="card card-body flex items-center gap-4"
  data-testid={testid}
>
  <div class="min-w-0 flex-1">
    <p class="label-base mb-0 text-2xs uppercase tracking-widest truncate">{label}</p>
    <p class="text-xl font-bold leading-tight {valueColour[tone]}">{value}</p>
    {#if hint}
      <p class="text-2xs text-slate-500 mt-0.5">{hint}</p>
    {/if}
  </div>
</div>
