<!--
  BreakdownCard — Breakdown stat card with progress bars.

  Props:
    title   — section heading
    items   — array of { label, value, tone?, percent? }
    total?  — used to auto-compute percent if not provided per item
-->
<script lang="ts">
  interface Item {
    label:    string;
    value:    number;
    tone?:    string;  // 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'cyan'
    percent?: number;  // 0–100; computed from total if omitted
  }

  interface Props {
    title:  string;
    items:  Item[];
    total?: number;
    footer?: string;
  }

  const { title, items, total, footer }: Props = $props();

  const BAR_COLOUR: Record<string, string> = {
    blue:   'bg-blue-500',
    green:  'bg-emerald-500',
    yellow: 'bg-amber-500',
    red:    'bg-red-500',
    purple: 'bg-purple-500',
    gray:   'bg-slate-500',
    cyan:   'bg-cyan-500',
    orange: 'bg-orange-500',
  };

  function pct(item: Item): number {
    if (item.percent !== undefined) return Math.min(100, Math.max(0, item.percent));
    const t = total ?? items.reduce((sum, i) => sum + i.value, 0);
    if (!t) return 0;
    return Math.round((item.value / t) * 100);
  }
</script>

<div class="card card-body flex flex-col gap-3">
  <h4 class="text-sm font-semibold" style="color: var(--color-text);">{title}</h4>
  <div class="space-y-3">
    {#each items as item}
      {@const p = pct(item)}
      <div class="space-y-1">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="truncate" style="color: var(--color-text-muted);">{item.label}</span>
          <span class="shrink-0 font-semibold tabular-nums" style="color: var(--color-text);">{item.value}</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full" style="background: var(--color-border);">
          <div
            class="h-full rounded-full transition-all duration-500 {BAR_COLOUR[item.tone ?? 'blue'] ?? BAR_COLOUR.blue}"
            style="width: {p}%"
          ></div>
        </div>
      </div>
    {/each}
  </div>
  {#if footer}
    <p class="pt-2 text-xs" style="border-top: 1px solid var(--color-border); color: var(--color-text-dim);">{footer}</p>
  {/if}
</div>
