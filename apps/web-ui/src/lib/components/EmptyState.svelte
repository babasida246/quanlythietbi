<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { PackageOpen } from 'lucide-svelte';

  type Props = {
    icon?: typeof PackageOpen;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };

  let { icon: Icon = PackageOpen, title, description = '', actionLabel = '', onAction }: Props = $props();
</script>

<div class="empty-state rounded-lg border border-dashed border-slate-600 bg-surface-2">
  <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3">
    <Icon class="h-6 w-6 text-slate-500" />
  </div>
  <h3 class="empty-state-title">{title}</h3>
  {#if description}
    <p class="empty-state-desc">{description}</p>
  {/if}
  {#if actionLabel}
    <div class="mt-4">
      <Button size="sm" onclick={() => onAction?.()}>{actionLabel}</Button>
    </div>
  {/if}
</div>
