<script lang="ts">
  import type { Snippet } from 'svelte';

  const { title, subtitle = '', sticky = true, children } = $props<{
    title: string;
    subtitle?: string;
    sticky?: boolean;
    children?: Snippet;
  }>();
</script>

<div class={sticky ? 'lg:sticky lg:top-24 space-y-3' : 'space-y-3'}>
  <div class="card space-y-3">
    <div>
      <div class="text-sm font-semibold text-slate-200">{title}</div>
      {#if subtitle}
        <div class="text-xs text-slate-500">{subtitle}</div>
      {/if}
    </div>
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
