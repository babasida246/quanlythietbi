<script lang="ts">

  import {
    deleteModel,
    searchAssetModels,
    type AssetCategory,
    type AssetModel,
    type Vendor
  } from '$lib/api/assetCatalogs';
  import ModelForm from './ModelForm.svelte';
  import ModelFilters from './ModelFilters.svelte';
  import ModelTable from './ModelTable.svelte';

  let {
    models = [],
    categories = [],
    vendors = [],
    onupdated,
    onerror
  } = $props<{
    models?: AssetModel[];
    categories?: AssetCategory[];
    vendors?: Vendor[];
    onupdated?: () => void;
    onerror?: (msg: string) => void;
  }>();

  // Ensure all props are always arrays
  const safeModels = $derived(Array.isArray(models) ? models.filter((item): item is AssetModel => Boolean(item)) : []);
  const safeCategories = $derived(Array.isArray(categories) ? categories.filter((item): item is AssetCategory => Boolean(item)) : []);
  const safeVendors = $derived(Array.isArray(vendors) ? vendors.filter((item): item is Vendor => Boolean(item)) : []);

  let list = $state<AssetModel[]>([]);
  let filterActive = $state(false);
  let filterLoading = $state(false);
  let lastFilters = $state<{ categoryId: string; specFilters: Record<string, unknown> } | null>(null);
  let selectedModel = $state<AssetModel | null>(null);
  let error = $state('');

  $effect(() => {
    if (!filterActive) {
      list = safeModels;
    }
  });

  async function runSearch(filters: { categoryId: string; specFilters: Record<string, unknown> }) {
    try {
      filterLoading = true;
      error = '';
      const response = await searchAssetModels({
        categoryId: filters.categoryId || undefined,
        specFilters: filters.specFilters
      });
      list = response.data;
      filterActive = true;
      lastFilters = filters;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load models';
      error = message;
      onerror?.(message);
    } finally {
      filterLoading = false;
    }
  }

  function clearFilters() {
    filterActive = false;
    lastFilters = null;
    list = safeModels;
    error = '';
  }

  async function refreshFilters() {
    if (!lastFilters) return;
    await runSearch(lastFilters);
  }

  async function handleUpdated() {
    selectedModel = null;
    if (filterActive) {
      await refreshFilters();
    }
    onupdated?.();
  }

  function handleEdit(model: AssetModel) {
    selectedModel = model;
  }

  async function remove(id: string) {
    if (!confirm('Delete this model?')) return;
    try {
      await deleteModel(id);
      await handleUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete model';
      error = message;
      onerror?.(message);
    }
  }
</script>

<div class="py-4 space-y-4">
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <ModelForm
    categories={safeCategories}
    vendors={safeVendors}
    selectedModel={selectedModel}
    onupdated={handleUpdated}
    oncleared={() => selectedModel = null}
    onerror={(msg) => onerror?.(msg)}
  />

  <ModelFilters
    categories={safeCategories}
    onapply={(data) => runSearch(data)}
    onclear={clearFilters}
    onerror={(msg) => onerror?.(msg)}
  />

  {#if filterLoading}
    <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
  {/if}

  <ModelTable
    models={list}
    categories={safeCategories}
    vendors={safeVendors}
    disabled={filterLoading}
    onedit={(model) => handleEdit(model)}
    onremove={(id) => remove(id)}
  />
</div>
