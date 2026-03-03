<script lang="ts">
  import { Button } from '$lib/components/ui';
  import Modal from './Modal.svelte';
  import { _, isLoading } from '$lib/i18n';

  type Props = {
    open?: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    loading?: boolean;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
    dataTestid?: string;
  };

  let {
    open = $bindable(false),
    title,
    description,
    confirmLabel,
    cancelLabel,
    danger = false,
    loading = false,
    onConfirm,
    onCancel,
    dataTestid = 'modal-delete'
  }: Props = $props();

  let submitting = $state(false);
  let submitError = $state('');
  const busy = $derived(loading || submitting);

  async function handleConfirm() {
    if (busy) return;
    submitError = '';
    submitting = true;
    try {
      await onConfirm?.();
      open = false;
    } catch (err) {
      submitError = err instanceof Error ? err.message : ($isLoading ? 'Operation failed' : $_('confirmDialog.failed'));
    } finally {
      submitting = false;
    }
  }
</script>

<Modal bind:open title={title} dismissable={!busy} dataTestid={dataTestid}>
  <p class="text-sm text-slate-300">{description}</p>
  {#if submitError}
    <p class="alert alert-error">{submitError}</p>
  {/if}

  {#snippet footer()}
    <Button
      variant="secondary"
      size="sm"
      data-testid="btn-cancel"
      disabled={busy}
      onclick={() => {
        open = false;
        onCancel?.();
      }}
    >
      {cancelLabel ?? ($isLoading ? 'Cancel' : $_('confirmDialog.cancel'))}
    </Button>
    <Button
      variant={danger ? 'danger' : 'primary'}
      size="sm"
      data-testid="btn-submit"
      disabled={busy}
      onclick={handleConfirm}
    >
      {busy ? ($isLoading ? 'Processing...' : $_('confirmDialog.processing')) : (confirmLabel ?? ($isLoading ? 'Confirm' : $_('confirmDialog.confirm')))}
    </Button>
  {/snippet}
</Modal>
