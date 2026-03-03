<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    class?: string;
    align?: 'left' | 'center' | 'right';
    children: Snippet;
  }

  let { class: className = '', align = 'left', children }: Props = $props();

  const alignClasses = {
    left: 'text-left',
    center: 'text-center', 
    right: 'text-right'
  };
</script>

<th class={cn(
  'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 h-10',
  alignClasses[align],
  className
)}>
  {@render children()}
</th>