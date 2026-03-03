<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';

  type Props = {
    saving?: boolean;
    submitDisabled?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    formId?: string;
  };

  let {
    saving = false,
    submitDisabled = false,
    submitLabel,
    cancelLabel,
    onCancel,
    formId = ''
  }: Props = $props();
</script>

<Button variant="secondary" size="sm" data-testid="btn-cancel" disabled={saving} onclick={() => onCancel?.()}>
  {cancelLabel ?? ($isLoading ? 'Cancel' : $_('formActions.cancel'))}
</Button>
<Button type="submit" variant="primary" size="sm" form={formId || undefined} data-testid="btn-submit" disabled={saving || submitDisabled}>
  {saving ? ($isLoading ? 'Saving...' : $_('formActions.saving')) : (submitLabel ?? ($isLoading ? 'Save' : $_('formActions.save')))}
</Button>
