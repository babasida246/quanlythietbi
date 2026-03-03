<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    class?: string;
    align?: 'left' | 'center' | 'right';
    colspan?: number;
    children: Snippet;
  }

  let { class: className = '', align = 'left', colspan, children }: Props = $props();

  const alignClasses = {
    left: 'text-left',
    center: 'text-center', 
    right: 'text-right'
  };
</script>

<td 
  class={cn(
    'px-3 py-2 text-slate-200 h-10',
    alignClasses[align],
    className
  )}
  {colspan}
>
  {@render children()}
</td>