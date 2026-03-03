<script lang="ts">
  import type { Snippet } from 'svelte';

  const { title, subtitle = '', sticky = false, actions, children } = $props<{
    title: string;
    subtitle?: string;
    sticky?: boolean;
    actions?: Snippet;
    children?: Snippet;
  }>();
</script>

<div
  class={`space-y-3 ${sticky ? 'sticky top-16 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur pb-3 border-b border-slate-200 dark:border-slate-800' : ''}`}
>
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
      {#if subtitle}
        <p class="text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if actions}
        {@render actions()}
      {/if}
    </div>
  </div>
  <div class="space-y-2">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
