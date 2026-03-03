<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ZodTypeAny } from 'zod';
  import Modal from '$lib/components/Modal.svelte';
  import FormActions from '$lib/components/FormActions.svelte';
  import { _, isLoading } from '$lib/i18n';

  type FormValues = Record<string, unknown>;
  type FieldRendererContext = {
    values: FormValues;
    errors: Record<string, string>;
    setValue: (field: string, value: unknown) => void;
    disabled: boolean;
  };

  type Props = {
    open?: boolean;
    mode: 'create' | 'edit';
    initialValues?: FormValues;
    schema: ZodTypeAny;
    title: string;
    submitLabel?: string;
    cancelLabel?: string;
    onSubmit: (values: FormValues) => void | Promise<void>;
    fields?: Snippet<[FieldRendererContext]>;
  };

  let {
    open = $bindable(false),
    mode,
    initialValues = {},
    schema,
    title,
    submitLabel,
    cancelLabel,
    onSubmit,
    fields
  }: Props = $props();

  const resolvedSubmitLabel = $derived(submitLabel ?? (mode === 'create'
    ? ($isLoading ? 'Create' : $_('crud.createNew'))
    : ($isLoading ? 'Update' : $_('crud.update'))));
  const resolvedCancelLabel = $derived(cancelLabel ?? ($isLoading ? 'Cancel' : $_('crud.cancel')));

  let values = $state<FormValues>({});
  let errors = $state<Record<string, string>>({});
  let submitting = $state(false);
  let submitError = $state('');
  let initialSignature = $state('');
  const formId = $derived(`crud-form-${mode}`);

  function computeSignature(): string {
    return `${open ? '1' : '0'}:${mode}:${JSON.stringify(initialValues)}`;
  }

  function resetState() {
    values = { ...initialValues };
    errors = {};
    submitError = '';
  }

  function setValue(field: string, value: unknown) {
    values = { ...values, [field]: value };
    if (errors[field]) {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      errors = nextErrors;
    }
  }

  function validate(): boolean {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      values = parsed.data as FormValues;
      errors = {};
      return true;
    }

    const nextErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (!field || nextErrors[field]) continue;
      nextErrors[field] = issue.message;
    }
    errors = nextErrors;
    return false;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitError = '';

    if (!validate()) return;

    try {
      submitting = true;
      await onSubmit(values);
      open = false;
    } catch (err) {
      submitError = err instanceof Error ? err.message : ($isLoading ? 'Operation failed' : $_('crud.operationFailed'));
    } finally {
      submitting = false;
    }
  }

  $effect(() => {
    const nextSignature = computeSignature();
    if (nextSignature === initialSignature) return;
    initialSignature = nextSignature;
    if (open) {
      resetState();
    }
  });
</script>

<Modal
  bind:open
  title={title}
  dismissable={!submitting}
  dataTestid={mode === 'create' ? 'modal-create' : 'modal-edit'}
>
  <form id={formId} class="space-y-3" onsubmit={handleSubmit}>
    {#if submitError}
      <p class="alert alert-error">{submitError}</p>
    {/if}

    {@render fields?.({ values, errors, setValue, disabled: submitting })}

    <div class="hidden">
      <button type="submit">submit</button>
    </div>
  </form>

  {#snippet footer()}
    <FormActions
      saving={submitting}
      formId={formId}
      submitLabel={resolvedSubmitLabel}
      cancelLabel={resolvedCancelLabel}
      onCancel={() => {
        open = false;
      }}
    />
  {/snippet}
</Modal>
