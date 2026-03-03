<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    active?: boolean;
    disabled?: boolean;
    class?: string;
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
  }

  let { active = false, disabled = false, class: className = '', children, onclick }: Props = $props();
</script>

<button
  type="button"
  role="tab"
  {disabled}
  {onclick}
  aria-selected={active}
  data-state={active ? 'active' : 'inactive'}
  class={cn('tabs-trigger', active && 'active', className)}
>
  {@render children()}
</button>