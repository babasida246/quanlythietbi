<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import { getCategorySpecDefs, type AssetCategory, type CategorySpecDef } from '$lib/api/assetCatalogs';

  let { categories = [], onapply, onclear, onerror } = $props<{
    categories?: AssetCategory[];
    onapply?: (data: { categoryId: string; specFilters: Record<string, unknown> }) => void;
    onclear?: () => void;
    onerror?: (msg: string) => void;
  }>();

  // Ensure categories is always an array
  const safeCategories = $derived(Array.isArray(categories) ? categories : []);

  let categoryId = $state('');
  let specDefs = $state<CategorySpecDef[]>([]);
  let filterValues = $state<Record<string, unknown>>({});
  let loading = $state(false);
  let error = $state('');
  let jsonError = $state('');

  const filterDefs = $derived(specDefs.filter((def) => def.isFilterable));

  async function loadSpecDefs(id: string) {
    if (!id) {
      specDefs = [];
      filterValues = {};
      error = '';
      jsonError = '';
      return;
    }
    try {
      loading = true;
      error = '';
      jsonError = '';
      const response = await getCategorySpecDefs(id);
      specDefs = response.data;
      filterValues = {};
    } catch (err) {
      specDefs = [];
      const message = err instanceof Error ? err.message : 'Failed to load filters';
      error = message;
      onerror?.(message);
    } finally {
      loading = false;
    }
  }

  function setValue(key: string, value: unknown) {
    const next = { ...filterValues };
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    filterValues = next;
  }

  function getStringValue(key: string): string {
    const value = filterValues[key];
    return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  }

  function getNumberValue(key: string): string {
    const value = filterValues[key];
    if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
    if (typeof value === 'string') return value;
    return '';
  }

  function getBooleanValue(key: string): string {
    const value = filterValues[key];
    if (value === true) return 'true';
    if (value === false) return 'false';
    return '';
  }

  function getMultiEnumValue(key: string): string[] {
    const value = filterValues[key];
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  }

  function toggleMultiEnum(key: string, option: string, checked: boolean) {
    const current = new Set(getMultiEnumValue(key));
    if (checked) {
      current.add(option);
    } else {
      current.delete(option);
    }
    setValue(key, Array.from(current));
  }

  function buildSpecFilters(): Record<string, unknown> | null {
    const result: Record<string, unknown> = {};
    jsonError = '';
    for (const def of filterDefs) {
      const value = filterValues[def.key];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
      if (def.fieldType === 'number' || def.fieldType === 'port') {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(parsed)) continue;
        result[def.key] = parsed;
        continue;
      }
      if (def.fieldType === 'boolean') {
        if (value === 'true' || value === true) result[def.key] = true;
        if (value === 'false' || value === false) result[def.key] = false;
        continue;
      }
      if (def.fieldType === 'json') {
        if (typeof value !== 'string') continue;
        try {
          result[def.key] = JSON.parse(value);
        } catch {
          jsonError = `Invalid JSON for ${def.label}`;
          return null;
        }
        continue;
      }
      result[def.key] = value;
    }
    return result;
  }

  function applyFilters() {
    const specFilters = buildSpecFilters();
    if (!specFilters) return;
    onapply?.({ categoryId, specFilters });
  }

  function clearFilters() {
    categoryId = '';
    specDefs = [];
    filterValues = {};
    jsonError = '';
    error = '';
    onclear?.();
  }
</script>

<div class="bg-surface-2 border border-slate-700 rounded-lg p-4 space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
    <div>
        <label for="model-filter-category" class="label-base mb-2">{$isLoading ? 'Category Filter' : $_('assets.categoryFilter')}</label>
      <select
        id="model-filter-category"
        class="select-base"
        bind:value={categoryId}
        onchange={(event) => loadSpecDefs((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">{$isLoading ? 'All categories' : $_('assets.allCategories')}</option>
        {#each safeCategories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </div>
    <div class="flex gap-2">
        <Button variant="secondary" onclick={clearFilters}>{$isLoading ? 'Clear' : $_('common.clear')}</Button>
        <Button onclick={applyFilters}>{$isLoading ? 'Apply' : $_('common.apply')}</Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
  {:else if filterDefs.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each filterDefs as def}
        <div class="space-y-1">
          <p class="label-base mb-1">{def.label}</p>
          {#if def.fieldType === 'enum'}
            <select class="select-base" value={getStringValue(def.key)} onchange={(event) => setValue(def.key, (event.currentTarget as HTMLSelectElement).value)}>
              <option value="">{$isLoading ? 'Any' : $_('assets.any')}</option>
              {#each def.enumValues ?? [] as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          {:else if def.fieldType === 'multi_enum'}
            <div class="flex flex-wrap gap-3">
              {#each def.enumValues ?? [] as option}
                <label class="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      class="rounded border-slate-700"
                      checked={getMultiEnumValue(def.key).includes(option)}
                      onchange={(event) => toggleMultiEnum(def.key, option, (event.currentTarget as HTMLInputElement).checked)}
                    />
                  {option}
                </label>
              {/each}
            </div>
          {:else if def.fieldType === 'boolean'}
            <select class="select-base" value={getBooleanValue(def.key)} onchange={(event) => setValue(def.key, (event.currentTarget as HTMLSelectElement).value)}>
              <option value="">{$isLoading ? 'Any' : $_('assets.any')}</option>
            <option value="true">{$isLoading ? 'Yes' : $_('common.yes')}</option>
            <option value="false">{$isLoading ? 'No' : $_('common.no')}</option>
            </select>
          {:else if def.fieldType === 'number' || def.fieldType === 'port'}
            <input
              class="input-base"
              type="number"
              value={getNumberValue(def.key)}
              oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
            />
          {:else if def.fieldType === 'date'}
            <input
              class="input-base"
              type="date"
              value={getStringValue(def.key)}
              oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
            />
          {:else if def.fieldType === 'json'}
            <textarea
              class="textarea-base"
              rows={3}
              value={getStringValue(def.key)}
              placeholder={'{ "key": "value" }'}
              oninput={(event) => setValue(def.key, (event.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          {:else}
            <input
              class="input-base"
              value={getStringValue(def.key)}
              oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
            />
          {/if}
        </div>
      {/each}
    </div>
  {:else if categoryId}
    <p class="text-sm text-slate-500">No filterable fields for this category.</p>
  {/if}

  {#if error}
    <p class="text-sm text-red-600">{error}</p>
  {/if}
  {#if jsonError}
    <p class="text-sm text-red-600">{jsonError}</p>
  {/if}
</div>
