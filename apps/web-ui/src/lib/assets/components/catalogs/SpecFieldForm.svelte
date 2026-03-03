<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import type { SpecFieldType } from '$lib/api/assetCatalogs';

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

  const fieldTypes: Array<{ value: SpecFieldType; label: string }> = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'enum', label: 'Enum' },
    { value: 'date', label: 'Date' },
    { value: 'ip', label: 'IP Address' },
    { value: 'mac', label: 'MAC Address' },
    { value: 'hostname', label: 'Hostname' },
    { value: 'cidr', label: 'CIDR' },
    { value: 'port', label: 'Port' },
    { value: 'regex', label: 'Regex' },
    { value: 'json', label: 'JSON' },
    { value: 'multi_enum', label: 'Multi Enum' }
  ];

  const emptyDraft: SpecFieldDraft = {
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
  };

  let { draft = $bindable<SpecFieldDraft>({ ...emptyDraft }) } = $props<{ draft?: SpecFieldDraft }>();

  const enumTypes: SpecFieldType[] = ['enum', 'multi_enum'];
  const numberTypes: SpecFieldType[] = ['number', 'port'];
  const stringTypes: SpecFieldType[] = ['string', 'hostname', 'mac', 'ip', 'cidr', 'regex'];

  function handleFieldTypeChange(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value as SpecFieldType;
    draft.fieldType = next;
    if (!enumTypes.includes(next)) {
      draft.enumValues = '';
    }
    if (!numberTypes.includes(next)) {
      draft.minValue = '';
      draft.maxValue = '';
      draft.stepValue = '';
      draft.precision = '';
      draft.scale = '';
    }
    if (!stringTypes.includes(next)) {
      draft.pattern = '';
      draft.minLen = '';
      draft.maxLen = '';
      draft.normalize = '';
    }
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Label' : $_('specField.label')}</div>
      <input class="input-base" name="label" bind:value={draft.label} placeholder={$isLoading ? 'Enter field name...' : $_('specField.placeholder.name')} />
    </div>
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Key' : $_('specField.key')}</div>
      <input class="input-base" name="key" bind:value={draft.key} placeholder="memorySizeGb" />
    </div>
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Data type' : $_('specField.dataType')}</div>
      <select class="select-base" name="fieldType" bind:value={draft.fieldType} onchange={handleFieldTypeChange}>
        {#each fieldTypes as field}
          <option value={field.value}>{field.label}</option>
        {/each}
      </select>
    </div>
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Unit' : $_('specField.unit')}</div>
      <input class="input-base" name="unit" bind:value={draft.unit} placeholder="GB" />
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Display order' : $_('specField.displayOrder')}</div>
      <input class="input-base" name="sortOrder" type="number" bind:value={draft.sortOrder} placeholder="0" />
    </div>
    <div class="flex items-end">
      <label class="flex items-center gap-2 text-sm text-slate-400">
        <input name="required" type="checkbox" class="rounded border-slate-300" bind:checked={draft.required} />
        {$isLoading ? 'Required' : $_('specField.required')}
      </label>
    </div>
    <div class="flex items-end">
      <label class="flex items-center gap-2 text-sm text-slate-400">
        <input name="isReadonly" type="checkbox" class="rounded border-slate-300" bind:checked={draft.isReadonly} />
        {$isLoading ? 'Read only' : $_('specField.readOnly')}
      </label>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <label class="flex items-center gap-2 text-sm text-slate-400">
      <input name="isSearchable" type="checkbox" class="rounded border-slate-300" bind:checked={draft.isSearchable} />
      {$isLoading ? 'Searchable' : $_('specField.searchable')}
    </label>
    <label class="flex items-center gap-2 text-sm text-slate-400">
      <input name="isFilterable" type="checkbox" class="rounded border-slate-300" bind:checked={draft.isFilterable} />
      {$isLoading ? 'Filterable' : $_('specField.filterable')}
    </label>
  </div>

  {#if enumTypes.includes(draft.fieldType)}
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Enum values' : $_('specField.enumValues')}</div>
      <input class="input-base" name="enumValues" bind:value={draft.enumValues} placeholder="DDR3, DDR4, DDR5" />
      <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Comma separated' : $_('specField.commaSeparated')}.</p>
    </div>
  {/if}

  {#if numberTypes.includes(draft.fieldType)}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Min' : $_('specField.min')}</div>
        <input class="input-base" name="minValue" type="number" bind:value={draft.minValue} placeholder="0" />
      </div>
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Max' : $_('specField.max')}</div>
        <input class="input-base" name="maxValue" type="number" bind:value={draft.maxValue} placeholder="1024" />
      </div>
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Step' : $_('specField.step')}</div>
        <input class="input-base" name="stepValue" type="number" bind:value={draft.stepValue} placeholder="1" />
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Precision' : $_('specField.precision')}</div>
        <input class="input-base" name="precision" type="number" bind:value={draft.precision} placeholder="10" />
      </div>
      <div>
        <div class="label-base mb-2">Scale</div>
        <input class="input-base" name="scale" type="number" bind:value={draft.scale} placeholder="2" />
      </div>
    </div>
  {/if}

  {#if stringTypes.includes(draft.fieldType)}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Min length' : $_('specField.minLength')}</div>
        <input class="input-base" name="minLen" type="number" bind:value={draft.minLen} placeholder="0" />
      </div>
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Max length' : $_('specField.maxLength')}</div>
        <input class="input-base" name="maxLen" type="number" bind:value={draft.maxLen} placeholder="255" />
      </div>
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Normalize' : $_('specField.normalize')}</div>
        <select class="select-base" name="normalize" bind:value={draft.normalize}>
          <option value="">{$isLoading ? 'None' : $_('specField.normalizeNone')}</option>
          <option value="trim">Trim</option>
          <option value="upper">{$isLoading ? 'Uppercase' : $_('specField.uppercase')}</option>
          <option value="lower">{$isLoading ? 'Lowercase' : $_('specField.lowercase')}</option>
        </select>
      </div>
    </div>
    <div>
      <div class="label-base mb-2">Pattern</div>
      <input class="input-base" name="pattern" bind:value={draft.pattern} placeholder="^[A-Z0-9-]+$" />
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Default value' : $_('specField.defaultValue')}</div>
      <input class="input-base" name="defaultValue" bind:value={draft.defaultValue} placeholder={$isLoading ? 'Default value (optional)' : $_('specField.placeholder.defaultValue')} />
    </div>
    <div>
      <div class="label-base mb-2">{$isLoading ? 'Hint' : $_('specField.hint')}</div>
      <textarea class="textarea-base" name="helpText" rows={2} bind:value={draft.helpText} placeholder={$isLoading ? 'Describe how to fill this field' : $_('specField.placeholder.helpText')}></textarea>
    </div>
  </div>

  <div>
    <div class="label-base mb-2">{$isLoading ? 'Compute expression' : $_('specField.computeExpression')}</div>
    <input class="input-base" name="computedExpr" bind:value={draft.computedExpr} placeholder="modelName.capacityGb" />
    <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Auto-extract hint' : $_('specField.autoExtractHint')} (optional).</p>
  </div>
</div>
