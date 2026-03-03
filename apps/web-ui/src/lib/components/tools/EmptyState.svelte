<script lang="ts">
  import { Button } from '$lib/components/ui';

  const { title, description = '', actionLabel = '', onAction } = $props<{
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  }>();
</script>

<div class="border border-dashed border-slate-600 rounded-lg p-3 text-sm space-y-2">
  <div class="font-semibold text-slate-200">{title}</div>
  {#if description}
    <div class="text-xs text-slate-500">{description}</div>
  {/if}
  {#if actionLabel}
    <Button size="sm" onclick={() => onAction?.()}>{actionLabel}</Button>
  {/if}
</div>
