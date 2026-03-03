<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import SpecFieldForm from './SpecFieldForm.svelte';
  import SpecDefsTable from './SpecDefsTable.svelte';
  import { _, isLoading } from '$lib/i18n';
  import {
    applyCategorySpecTemplate,
    createSpecDefForVersion,
    deleteSpecDef,
    updateSpecDef,
    type CategorySpecDef,
    type CategorySpecDefInput,
    type SpecFieldType
  } from '$lib/api/assetCatalogs';

  type SpecFieldDraft = {
    key: string;
    label: string;
    fieldType: SpecFieldType;
    required: boolean;
    unit: string;
    enumValues: string;
    pattern: string;
    minLen: string;
    maxLen: string;
    minValue: string;
    maxValue: string;
    stepValue: string;
    precision: string;
    scale: string;
    normalize: string;
    defaultValue: string;
    helpText: string;
    sortOrder: string;
    isReadonly: boolean;
    computedExpr: string;
    isSearchable: boolean;
    isFilterable: boolean;
  };

  let {
    specDefs = [],
    categoryId = '',
    selectedVersionId = '',
    disabled = false,
    canApplyTemplate = false,
    onupdated,
    onerror
  } = $props<{
    specDefs?: CategorySpecDef[];
    categoryId?: string;
    selectedVersionId?: string;
    disabled?: boolean;
    canApplyTemplate?: boolean;
    onupdated?: () => void;
    onerror?: (message: string) => void;
  }>();

  // Ensure specDefs is always an array
  const safeSpecDefs = $derived(Array.isArray(specDefs) ? specDefs : []);
  const emptyDraft = (): SpecFieldDraft => ({
    key: '',
    label: '',
    fieldType: 'string',
    required: false,
    unit: '',
    enumValues: '',
    pattern: '',
    minLen: '',
    maxLen: '',
    minValue: '',
    maxValue: '',
    stepValue: '',
    precision: '',
    scale: '',
    normalize: '',
    defaultValue: '',
    helpText: '',
    sortOrder: '',
    isReadonly: false,
    computedExpr: '',
    isSearchable: false,
    isFilterable: false
  });

  let draft = $state<SpecFieldDraft>(emptyDraft());
  let editingId = $state<string | null>(null);
  let saving = $state(false);
  function resetForm() {
    draft = emptyDraft();
    editingId = null;
  }
  function toDraft(def: CategorySpecDef): SpecFieldDraft {
    return {
      key: def.key,
      label: def.label,
      fieldType: def.fieldType,
      required: def.required,
      unit: def.unit ?? '',
      enumValues: def.enumValues?.join(', ') ?? '',
      pattern: def.pattern ?? '',
      minLen: def.minLen !== null && def.minLen !== undefined ? String(def.minLen) : '',
      maxLen: def.maxLen !== null && def.maxLen !== undefined ? String(def.maxLen) : '',
      minValue: def.minValue !== null && def.minValue !== undefined ? String(def.minValue) : '',
      maxValue: def.maxValue !== null && def.maxValue !== undefined ? String(def.maxValue) : '',
      stepValue: def.stepValue !== null && def.stepValue !== undefined ? String(def.stepValue) : '',
      precision: def.precision !== null && def.precision !== undefined ? String(def.precision) : '',
      scale: def.scale !== null && def.scale !== undefined ? String(def.scale) : '',
      normalize: def.normalize ?? '',
      defaultValue: def.defaultValue !== null && def.defaultValue !== undefined ? String(def.defaultValue) : '',
      helpText: def.helpText ?? '',
      sortOrder: def.sortOrder ? String(def.sortOrder) : '',
      isReadonly: def.isReadonly,
      computedExpr: def.computedExpr ?? '',
      isSearchable: def.isSearchable,
      isFilterable: def.isFilterable
    };
  }
  function parseEnumValues(input: string): string[] | undefined {
    const safeInput = String(input || '');
    if (!safeInput.trim()) return undefined;
    const values = safeInput
      .split(',')
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
    return values.length > 0 ? values : undefined;
  }
  function parseNumber(input: string | number | null | undefined): number | undefined {
    if (input === null || input === undefined) return undefined;
    const trimmed = String(input).trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  function parseDefaultValue(input: string | null | undefined, fieldType: SpecFieldType): unknown | undefined {
    if (input === null || input === undefined) return undefined;
    const trimmed = String(input).trim();
    if (!trimmed) return undefined;
    if (fieldType === 'number' || fieldType === 'port') {
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    if (fieldType === 'multi_enum') {
      return parseEnumValues(trimmed) ?? undefined;
    }
    if (fieldType === 'boolean') {
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      return undefined;
    }
    if (fieldType === 'json') {
      try {
        return JSON.parse(trimmed);
      } catch {
        return undefined;
      }
    }
    return trimmed;
  }
  function buildInput(): CategorySpecDefInput {
    const fieldType = draft.fieldType;
    const payload: CategorySpecDefInput = {
      key: String(draft.key || '').trim(),
      label: String(draft.label || '').trim(),
      fieldType,
      unit: String(draft.unit || '').trim() || undefined,
      required: draft.required,
      helpText: String(draft.helpText || '').trim() || undefined,
      sortOrder: parseNumber(draft.sortOrder),
      defaultValue: parseDefaultValue(draft.defaultValue, fieldType),
      pattern: String(draft.pattern || '').trim() || undefined,
      minLen: parseNumber(draft.minLen),
      maxLen: parseNumber(draft.maxLen),
      minValue: parseNumber(draft.minValue),
      maxValue: parseNumber(draft.maxValue),
      stepValue: parseNumber(draft.stepValue),
      precision: parseNumber(draft.precision),
      scale: parseNumber(draft.scale),
      normalize: (draft.normalize || undefined) as 'trim' | 'upper' | 'lower' | undefined,
      isReadonly: draft.isReadonly,
      computedExpr: String(draft.computedExpr || '').trim() || undefined,
      isSearchable: draft.isSearchable,
      isFilterable: draft.isFilterable
    };

    if (draft.fieldType === 'enum' || draft.fieldType === 'multi_enum') {
      payload.enumValues = parseEnumValues(draft.enumValues);
    }
    return payload;
  }
  async function save() {
    const safeKey = String(draft.key || '').trim();
    const safeLabel = String(draft.label || '').trim();
    if (!safeKey || !safeLabel) return;
    if (!selectedVersionId) {
      onerror?.('Select a spec version first');
      return;
    }
    try {
      saving = true;
      const payload = buildInput();
      if (editingId) {
        await updateSpecDef(editingId, payload);
      } else {
        await createSpecDefForVersion(selectedVersionId, payload);
      }
      resetForm();
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to save spec field');
    } finally {
      saving = false;
    }
  }
  function edit(def: CategorySpecDef) {
    editingId = def.id;
    draft = toDraft(def);
  }
  async function remove(def: CategorySpecDef) {
    if (!confirm('Delete this spec field?')) return;
    try {
      await deleteSpecDef(def.id);
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to delete spec field');
    }
  }
  async function applyTemplate() {
    if (!categoryId || !canApplyTemplate) return;
    try {
      saving = true;
      await applyCategorySpecTemplate(categoryId);
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      saving = false;
    }
  }
</script>

<div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
  <SpecFieldForm bind:draft />
  <div class="flex flex-wrap gap-2 mt-4">
    <Button onclick={save} disabled={disabled || saving || !String(draft.key || '').trim() || !String(draft.label || '').trim()}>
      {saving ? 'Saving...' : editingId ? 'Update Field' : 'Add Field'}
    </Button>
    {#if editingId}
      <Button variant="secondary" onclick={resetForm} disabled={disabled}>
        {$isLoading ? 'Cancel' : $_('common.cancel')}
      </Button>
    {/if}
    {#if safeSpecDefs.length === 0 && canApplyTemplate}
      <Button variant="secondary" onclick={applyTemplate} disabled={saving}>
        {$isLoading ? 'Apply Template' : $_('specField.applyTemplate')}
      </Button>
    {/if}
  </div>
</div>

<SpecDefsTable
  specDefs={safeSpecDefs}
  disabled={disabled}
  onedit={(def) => edit(def)}
  onremove={(def) => remove(def)}
/>
