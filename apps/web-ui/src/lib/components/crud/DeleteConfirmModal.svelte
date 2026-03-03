<script lang="ts">
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { _, isLoading } from '$lib/i18n';

  type Props = {
    open?: boolean;
    entityName: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
  };

  let {
    open = $bindable(false),
    entityName,
    description = '',
    onConfirm
  }: Props = $props();
</script>

<ConfirmDialog
  bind:open
  dataTestid="modal-delete"
  title={$isLoading ? 'Confirm delete' : $_('crud.confirmDelete')}
  description={description || ($isLoading ? `Are you sure you want to delete ${entityName}?` : $_('crud.deletePrompt', { values: { name: entityName } }))}
  confirmLabel={$isLoading ? 'Delete' : $_('crud.delete')}
  cancelLabel={$isLoading ? 'Cancel' : $_('crud.cancel')}
  danger={true}
  {onConfirm}
/>
