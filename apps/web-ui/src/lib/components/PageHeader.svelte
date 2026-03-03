<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    subtitle?: string;
    compact?: boolean;
    actions?: Snippet;
  };

  let { title, subtitle = '', compact = false, actions }: Props = $props();
</script>

<div class={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${compact ? '' : 'mb-4'}`}>
  <div class="min-w-0">
    <h1 class="truncate text-lg font-semibold tracking-tight text-slate-100">{title}</h1>
    {#if subtitle}
      <p class="mt-0.5 text-xs text-slate-400">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-1.5 shrink-0">
      {@render actions()}
    </div>
  {/if}
</div>
