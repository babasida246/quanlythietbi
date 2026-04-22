<script lang="ts">

  import {
    deleteModel,
    searchAssetModels,
    type AssetCategory,
    type AssetModel,
    type Vendor
  } from '$lib/api/assetCatalogs';
  import {
    deleteAssetModelAttachment,
    getAssetModelAttachmentUrl,
    listAssetModelAttachments,
    uploadAssetModelAttachment,
    type OpsAttachment
  } from '$lib/api/warehouse';
  import ModelForm from './ModelForm.svelte';
  import ModelFilters from './ModelFilters.svelte';
  import ModelTable from './ModelTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import FileGallery from '$lib/components/FileGallery.svelte';
  import { _, isLoading } from '$lib/i18n';

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
  let imageModel = $state<AssetModel | null>(null);
  let imageModalOpen = $state(false);
  let imageAttachments = $state<OpsAttachment[]>([]);
  let imageLoading = $state(false);
  let error = $state('');

  async function openImages(model: AssetModel) {
    imageModel = model;
    imageModalOpen = true;
    imageLoading = true;
    try {
      imageAttachments = await listAssetModelAttachments(model.id);
    } catch { imageAttachments = [] } finally { imageLoading = false; }
  }

  async function handleImageUpload(file: File) {
    if (!imageModel) return;
    await uploadAssetModelAttachment(imageModel.id, file);
    imageAttachments = await listAssetModelAttachments(imageModel.id);
  }

  async function handleImageDelete(attachmentId: string) {
    if (!imageModel) return;
    await deleteAssetModelAttachment(imageModel.id, attachmentId);
    imageAttachments = await listAssetModelAttachments(imageModel.id);
  }

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
    onimages={(model) => openImages(model)}
  />
</div>

<Modal
  bind:open={imageModel}
  title={$isLoading ? 'Ảnh thiết bị' : $_('catalogs.model.imagesModalTitle', { values: { name: imageModel?.model ?? '' } })}
  size="lg"
>
  {#snippet children()}
    <FileGallery
      attachments={imageAttachments}
      loading={imageLoading}
      accept="image/*"
      getDownloadUrl={(id) => getAssetModelAttachmentUrl(imageModel?.id ?? '', id)}
      onUpload={handleImageUpload}
      onDelete={handleImageDelete}
    />
  {/snippet}
</Modal>
