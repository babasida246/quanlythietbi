<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  type Props = {
    open?: boolean;
    title: string;
    size?: ModalSize;
    dismissable?: boolean;
    dataTestid?: string;
    children?: Snippet;
    footer?: Snippet;
  };

  let {
    open = $bindable(false),
    title,
    size = 'md',
    dismissable = true,
    dataTestid,
    children,
    footer
  }: Props = $props();

  const sizeClass: Record<ModalSize, string> = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg',
    xl: 'modal-xl'
  };

  function handleBackdrop() {
    if (dismissable) open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && dismissable) open = false;
  }

  function stopPanelInteraction(e: Event) {
    e.stopPropagation();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdrop} onkeydown={handleKeydown}></div>
  <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-testid={dataTestid}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-panel {sizeClass[size]}" onclick={stopPanelInteraction} onkeydown={stopPanelInteraction}>
      <div class="modal-header">
        <h3 id="modal-title" class="text-base font-semibold text-slate-100">{title}</h3>
        {#if dismissable}
          <button
            type="button"
            class="btn-icon btn-xs btn-ghost"
            onclick={() => (open = false)}
            aria-label={$isLoading ? 'Close' : $_('common.close')}
          >
            <X class="h-4 w-4" />
          </button>
        {/if}
      </div>

      <div class="modal-body space-y-4">
        {@render children?.()}
      </div>

      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
