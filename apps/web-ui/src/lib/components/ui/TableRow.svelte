<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    class?: string;
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    [key: string]: any;
  }

  let { class: className = '', children, onclick, ...rest }: Props = $props();
</script>

<tr class={cn('border-t border-slate-700/40 transition-colors hover:bg-surface-3/30', className)} {onclick} {...rest}>
  {@render children()}
</tr>