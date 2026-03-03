<!--
  StatsCard — enterprise-grade KPI card for dashboards.
  Has a 2px left accent coloured by tone.
  Never looks like an input (bg-surface-2, shadow, no height constraint).

  Props:
    label   — short uppercase label
    value   — numeric or formatted string
    hint?   — secondary info below value
    icon?   — Lucide icon component (optional)
    tone    — 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
    testid? — data-testid for QA
-->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    label:   string;
    value:   string | number;
    hint?:   string;
    icon?:   Component<{ class?: string }>;
    tone?:   'neutral' | 'primary' | 'success' | 'warning' | 'danger';
    testid?: string;
  }

  const {
    label,
    value,
    hint,
    icon: Icon,
    tone = 'neutral',
    testid,
  }: Props = $props();

  const accentBorder: Record<string, string> = {
    neutral: 'border-l-slate-500',
    primary: 'border-l-blue-500',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger:  'border-l-red-500',
  };

  const valueColour: Record<string, string> = {
    neutral: 'text-slate-100',
    primary: 'text-blue-300',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger:  'text-red-300',
  };
</script>

<div
  class="card card-body flex flex-col gap-1 border-l-2 {accentBorder[tone]}"
  data-testid={testid}
>
  <div class="flex items-start justify-between gap-2">
    <p class="label-base mb-0 text-2xs uppercase tracking-widest">{label}</p>
    {#if Icon}
      <Icon class="h-4 w-4 shrink-0 text-slate-500" />
    {/if}
  </div>
  <p class="text-2xl font-bold leading-tight {valueColour[tone]}">{value}</p>
  {#if hint}
    <p class="text-2xs text-slate-500">{hint}</p>
  {/if}
</div>
