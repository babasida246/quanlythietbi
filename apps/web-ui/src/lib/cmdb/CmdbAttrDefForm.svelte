<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';

  export type CmdbFieldDraft = {
    key: string;
    label: string;
    fieldType: string;
    required: boolean;
    isSearchable: boolean;
    isFilterable: boolean;
    enumValues: string;
  };

  let {
    draft = $bindable<CmdbFieldDraft>({
      key: '',
      label: '',
      fieldType: 'string',
      required: false,
      isSearchable: false,
      isFilterable: false,
      enumValues: ''
    }),
    fieldTypes = [],
    disabled = false,
    saving = false,
    onSave = () => {},
    onClear = () => {}
  } = $props<{
    draft?: CmdbFieldDraft;
    fieldTypes?: string[];
    disabled?: boolean;
    saving?: boolean;
    onSave?: () => void;
    onClear?: () => void;
  }>();
</script>

<div class="space-y-2">
  <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Add / Edit Attribute' : $_('cmdb.type.addEditAttribute')}</h3>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <label for="attr-key" class="label-base">{$isLoading ? 'Key' : $_('cmdb.type.key')}</label>
      <input
        id="attr-key"
        class="input-base"
        bind:value={draft.key}
        placeholder={$isLoading ? 'hostname' : $_('cmdb.type.placeholders.key')}
      />
    </div>
    <div>
      <label for="attr-label" class="label-base">{$isLoading ? 'Label' : $_('cmdb.type.label')}</label>
      <input
        id="attr-label"
        class="input-base"
        bind:value={draft.label}
        placeholder={$isLoading ? 'Hostname' : $_('cmdb.type.placeholders.hostname')}
      />
    </div>
    <div>
      <label for="attr-type" class="label-base">{$isLoading ? 'Type' : $_('cmdb.type.type')}</label>
      <select id="attr-type" bind:value={draft.fieldType} class="select-base">
        {#each fieldTypes as typeOption}
          <option value={typeOption}>{typeOption}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="attr-enum" class="label-base">{$isLoading ? 'Enum values' : $_('cmdb.type.enumValues')}</label>
      <input id="attr-enum" class="input-base" bind:value={draft.enumValues} placeholder={$isLoading ? 'a, b, c' : $_('cmdb.type.placeholders.enumValues')} />
    </div>
    <label class="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={draft.required} onchange={(e) => draft.required = (e.currentTarget as HTMLInputElement).checked} />
      {$isLoading ? 'Required' : $_('cmdb.type.required')}
    </label>
    <label class="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={draft.isSearchable} onchange={(e) => draft.isSearchable = (e.currentTarget as HTMLInputElement).checked} />
      {$isLoading ? 'Searchable' : $_('cmdb.type.searchable')}
    </label>
    <label class="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={draft.isFilterable} onchange={(e) => draft.isFilterable = (e.currentTarget as HTMLInputElement).checked} />
      {$isLoading ? 'Filterable' : $_('cmdb.type.filterable')}
    </label>
  </div>
  <div class="flex gap-2">
    <Button onclick={onSave} disabled={disabled || !draft.key || !draft.label || saving}>{$isLoading ? 'Save' : $_('common.save')}</Button>
    <Button variant="secondary" onclick={onClear}>{$isLoading ? 'Clear' : $_('common.clear')}</Button>
  </div>
</div>
