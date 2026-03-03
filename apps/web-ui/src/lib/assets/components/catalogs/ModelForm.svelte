<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import {
    createModel,
    getCategorySpecDefs,
    getSpecDefsByVersion,
    updateModel,
    type AssetCategory,
    type AssetModel,
    type CategorySpecDef,
    type Vendor
  } from '$lib/api/assetCatalogs';
  import DynamicSpecForm from './DynamicSpecForm.svelte';

  let {
    categories = [],
    vendors = [],
    selectedModel = null,
    onupdated,
    onerror,
    oncleared
  } = $props<{
    categories?: AssetCategory[];
    vendors?: Vendor[];
    selectedModel?: AssetModel | null;
    onupdated?: () => void;
    onerror?: (message: string) => void;
    oncleared?: () => void;
  }>();

  // Ensure all props are always arrays
  const safeCategories = $derived(Array.isArray(categories) ? categories : []);
  const safeVendors = $derived(Array.isArray(vendors) ? vendors : []);

  let form = $state({
    model: '',
    brand: '',
    categoryId: '',
    vendorId: '',
    spec: {} as Record<string, unknown>
  });
  let editingId = $state<string | null>(null);
  let saving = $state(false);
  let specDefs = $state<CategorySpecDef[]>([]);
  let specLoading = $state(false);
  let specError = $state('');
  let specFieldErrors = $state<Record<string, string>>({});
  let lastCategoryId = $state<string | null>(null);
  let preserveSpec = $state(false);
  let useVersionDefs = $state(false);

  function resetForm(emit = true) {
    form = { model: '', brand: '', categoryId: '', vendorId: '', spec: {} };
    editingId = null;
    specDefs = [];
    specError = '';
    specFieldErrors = {};
    lastCategoryId = null;
    useVersionDefs = false;
    if (emit) oncleared?.();
  }

  function applySelected(model: AssetModel) {
    preserveSpec = true;
    useVersionDefs = Boolean(model.specVersionId);
    form = {
      model: model.model,
      brand: model.brand ?? '',
      categoryId: model.categoryId ?? '',
      vendorId: model.vendorId ?? '',
      spec: model.spec ?? {}
    };
    editingId = model.id;
    if (model.specVersionId) {
      loadSpecDefsByVersion(model.specVersionId);
    }
  }

  async function loadSpecDefs(categoryId: string) {
    try {
      specLoading = true;
      specError = '';
      const response = await getCategorySpecDefs(categoryId);
      specDefs = response.data;
    } catch (err) {
      specDefs = [];
      specError = err instanceof Error ? err.message : 'Failed to load spec fields';
    } finally {
      specLoading = false;
    }
  }

  async function loadSpecDefsByVersion(versionId: string) {
    try {
      specLoading = true;
      specError = '';
      const response = await getSpecDefsByVersion(versionId);
      specDefs = response.data;
    } catch (err) {
      specDefs = [];
      specError = err instanceof Error ? err.message : 'Failed to load spec fields';
    } finally {
      specLoading = false;
    }
  }

  function extractSpecErrors(err: unknown): Record<string, string> | null {
    if (!(err instanceof Error)) return null;
    try {
      const parsed = JSON.parse(err.message) as {
        errors?: { errors?: Array<{ key: string; message: string }> };
        error?: { details?: { errors?: Array<{ key: string; message: string }> } };
      };
      const items = parsed.errors?.errors ?? parsed.error?.details?.errors ?? [];
      if (!Array.isArray(items)) return null;
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item?.key && item?.message) {
          map[String(item.key)] = String(item.message);
        }
      }
      return Object.keys(map).length ? map : null;
    } catch {
      return null;
    }
  }

  $effect(() => {
    if (!selectedModel) {
      if (editingId) resetForm(false);
      return;
    }
    applySelected(selectedModel);
  });

  $effect(() => {
    const categoryId = form.categoryId;
    if (!categoryId) {
      specDefs = [];
      specError = '';
      specFieldErrors = {};
      lastCategoryId = null;
      preserveSpec = false;
      useVersionDefs = false;
      return;
    }
    if (useVersionDefs) return;
    if (categoryId === lastCategoryId) return;
    if (lastCategoryId && !preserveSpec) {
      form.spec = {};
    }
    preserveSpec = false;
    specFieldErrors = {};
    lastCategoryId = categoryId;
    loadSpecDefs(categoryId);
  });

  $effect(() => {
    form.spec;
    if (Object.keys(specFieldErrors).length > 0) {
      specFieldErrors = {};
    }
  });

  async function save() {
    if (!form.model.trim()) return;
    try {
      saving = true;
      specFieldErrors = {};
      const payload = {
        model: form.model.trim(),
        brand: form.brand.trim() ? form.brand.trim() : null,
        categoryId: form.categoryId || null,
        vendorId: form.vendorId || null,
        spec: form.spec
      };
      if (editingId) {
        await updateModel(editingId, payload);
      } else {
        await createModel(payload);
      }
      resetForm();
      onupdated?.();
    } catch (err) {
      const fieldErrors = extractSpecErrors(err);
      if (fieldErrors) {
        specFieldErrors = fieldErrors;
        return;
      }
      onerror?.(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      saving = false;
    }
  }
</script>

<div class="bg-surface-2 border border-slate-700 rounded-lg p-4 space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
        <label class="label-base mb-2">{$isLoading ? 'Model' : $_('common.model')}</label>
      <input class="input-base" bind:value={form.model} placeholder="Latitude 7420" />
    </div>
    <div>
        <label class="label-base mb-2">{$isLoading ? 'Brand' : $_('common.brand')}</label>
        <input class="input-base" bind:value={form.brand} placeholder={$isLoading ? 'Dell' : $_('assets.placeholders.brand')} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Category' : $_('assets.category')}</label>
      <select class="select-base" bind:value={form.categoryId} onchange={() => useVersionDefs = false}>
        <option value="">{$isLoading ? 'No category' : $_('assets.noCategory')}</option>
        {#each safeCategories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </div>
    <div>
        <label class="label-base mb-2">{$isLoading ? 'Vendor' : $_('common.vendor')}</label>
        <select class="select-base" bind:value={form.vendorId}>
          <option value="">{$isLoading ? 'No vendor' : $_('assets.noVendor')}</option>
        {#each safeVendors as vendor}
          <option value={vendor.id}>{vendor.name}</option>
        {/each}
      </select>
    </div>
  </div>
  {#if form.categoryId}
    <div>
        <label class="label-base mb-2">{$isLoading ? 'Specifications' : $_('assets.specifications')}</label>
      {#if specLoading}
        <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
      {:else if specDefs.length > 0}
        <DynamicSpecForm specDefs={specDefs} bind:spec={form.spec} errors={specFieldErrors} />
      {:else}
        <p class="text-sm text-slate-500">No spec fields defined for this category.</p>
      {/if}
      {#if specError}
        <p class="text-sm text-red-600 mt-2">{specError}</p>
      {/if}
    </div>
  {/if}
  <div class="flex gap-2">
    <Button onclick={save} disabled={saving || !form.model.trim()}>
      {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
    </Button>
    {#if editingId}
      <Button variant="secondary" onclick={() => resetForm()}>Cancel</Button>
    {/if}
  </div>
</div>
