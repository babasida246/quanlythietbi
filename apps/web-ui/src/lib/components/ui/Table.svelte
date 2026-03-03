<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    class?: string;
    density?: 'compact' | 'normal';
    zebra?: boolean;
    children: Snippet;
  }

  let { class: className = '', density = 'compact', zebra = false, children }: Props = $props();
</script>

<div class={cn('data-table-wrap', className)}>
  <div class="data-table-scroll">
    <table class={cn('data-table', density === 'normal' && '[&_td]:py-3 [&_th]:py-3', zebra && 'data-table-zebra')}>
      {@render children()}
    </table>
  </div>
</div>