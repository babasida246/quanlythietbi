<!--
  StatsCard — enterprise-grade KPI card for dashboards.
  Has a 2px left accent coloured by tone, with token-driven card backgrounds.

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

  const ACCENT: Record<string, string> = {
    neutral: 'var(--card-neutral-accent)',
    primary: 'var(--card-total-accent)',
    success: 'var(--card-active-accent)',
    warning: 'var(--card-repair-accent)',
    danger:  'var(--card-expired-accent)',
  };

  const BG: Record<string, string> = {
    neutral: 'var(--card-neutral-bg)',
    primary: 'var(--card-total-bg)',
    success: 'var(--card-active-bg)',
    warning: 'var(--card-repair-bg)',
    danger:  'var(--card-expired-bg)',
  };
</script>

<div
  class="card card-body flex flex-col gap-1"
  style="border-left: 2px solid {ACCENT[tone]}; background: {BG[tone]};"
  data-testid={testid}
>
  <div class="flex items-start justify-between gap-2">
    <p class="label-base mb-0 text-2xs uppercase tracking-widest">{label}</p>
    {#if Icon}
      <span style="color: {ACCENT[tone]};">
        <Icon class="h-4 w-4 shrink-0" />
      </span>
    {/if}
  </div>
  <p class="text-2xl font-bold leading-tight" style="color: {ACCENT[tone]};">{value}</p>
  {#if hint}
    <p class="text-2xs" style="color: var(--color-text-dim);">{hint}</p>
  {/if}
</div>
