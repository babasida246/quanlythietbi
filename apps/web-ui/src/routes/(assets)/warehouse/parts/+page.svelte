<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus, Search } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { z } from 'zod';
  import { createSparePart, deleteSparePart, listSpareParts, updateSparePart, type SparePartRecord } from '$lib/api/warehouse';
  import { getAssetCatalogs, searchAssetModels, type AssetCategory, type AssetModel } from '$lib/api/assetCatalogs';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/components/toast';
  import DataTable from '$lib/components/DataTable.svelte';

  let parts      = $state<SparePartRecord[]>([]);
  let loading    = $state(true);
  let error      = $state('');
  let categories = $state<AssetCategory[]>([]);

  let query = $state('');
  let filterCategoryId = $state('');
  let meta  = $state({ total: 0, page: 1, limit: 20 });

  let showModal = $state(false);
  let saving    = $state(false);
  let editing   = $state<SparePartRecord | null>(null);

  let partCode       = $state('');
  let name           = $state('');
  let categoryId     = $state('');
  let modelId        = $state('');
  let availableModels= $state<AssetModel[]>([]);
  let uom            = $state('');
  let manufacturer   = $state('');
  let model          = $state('');
  let minLevel       = $state('0');
  let unitCost       = $state('');
  let fieldErrors    = $state<{ partCode?: string; name?: string; minLevel?: string }>({});

  const partFormSchema = z.object({
    partCode:   z.string().trim().min(1),
    name:       z.string().trim().min(1),
    categoryId: z.string().uuid().nullable().optional(),
    uom:        z.string().optional(),
    manufacturer: z.string().optional(),
    model:      z.string().optional(),
    minLevel:   z.coerce.number().int().min(0),
    unitCost:   z.preprocess(v => v === '' ? null : Number(v), z.number().min(0).nullable().optional())
  });

  async function loadCategories() {
    try {
      const res = await getAssetCatalogs();
      categories = (res.data?.categories ?? []).filter(c => c.itemType === 'spare_part' || !c.itemType);
    } catch {
      // non-fatal
    }
  }

  async function loadModels(catId: string) {
    if (!catId) { availableModels = []; return; }
    try {
      const res = await searchAssetModels({ categoryId: catId });
      availableModels = res.data ?? [];
    } catch {
      availableModels = [];
    }
  }

  function onModelSelect(selectedModelId: string) {
    modelId = selectedModelId;
    if (!selectedModelId) return;
    const m = availableModels.find(x => x.id === selectedModelId);
    if (!m) return;
    if (m.brand) manufacturer = m.brand;
    if (m.model) model = m.model;
  }

  async function loadParts(page = 1) {
    try {
      loading = true;
      error = '';
      const response = await listSpareParts({
        q: query || undefined,
        page,
        limit: meta.limit,
        ...(filterCategoryId ? { categoryId: filterCategoryId } : {})
      });
      parts = response.data ?? [];
      meta = {
        total: response.meta?.total ?? parts.length,
        page:  response.meta?.page ?? page,
        limit: response.meta?.limit ?? meta.limit
      };
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadPartsFailed');
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editing          = null;
    partCode         = '';
    name             = '';
    categoryId       = '';
    modelId          = '';
    availableModels  = [];
    uom              = '';
    manufacturer     = '';
    model            = '';
    minLevel         = '0';
    unitCost         = '';
    fieldErrors      = {};
    showModal        = true;
  }

  function openEdit(part: SparePartRecord) {
    editing      = part;
    partCode     = part.partCode;
    name         = part.name;
    categoryId   = part.categoryId ?? '';
    modelId      = part.modelId ?? '';
    uom          = part.uom ?? '';
    manufacturer = part.manufacturer ?? '';
    model        = part.model ?? '';
    minLevel     = String(part.minLevel ?? 0);
    unitCost     = part.unitCost != null ? String(part.unitCost) : '';
    fieldErrors  = {};
    showModal    = true;
    if (categoryId) void loadModels(categoryId);
  }

  function validateForm() {
    const parsed = partFormSchema.safeParse({ partCode, name, categoryId: categoryId || null, uom, manufacturer, model, minLevel, unitCost });
    if (!parsed.success) {
      const nextErrors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'partCode') nextErrors.partCode = issue.message;
        if (field === 'name')     nextErrors.name     = issue.message;
        if (field === 'minLevel') nextErrors.minLevel = issue.message;
      }
      fieldErrors = nextErrors;
      return null;
    }
    fieldErrors = {};
    return parsed.data;
  }

  async function savePart() {
    const validData = validateForm();
    if (!validData) return;
    try {
      saving = true;
      error  = '';
      const payload = {
        partCode:     validData.partCode,
        name:         validData.name,
        categoryId:   validData.categoryId ?? null,
        modelId:      modelId || null,
        uom:          validData.uom || null,
        manufacturer: validData.manufacturer || null,
        model:        validData.model || null,
        minLevel:     validData.minLevel,
        unitCost:     validData.unitCost ?? null
      };
      if (editing) {
        await updateSparePart(editing.id, payload);
        toast.success($_('common.updatedSuccess'));
      } else {
        await createSparePart(payload);
        toast.success($_('common.createdSuccess'));
      }
      showModal = false;
      await loadParts(1);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.savePartFailed');
      toast.error(error);
    } finally {
      saving = false;
    }
  }

  async function handleDelete(rows: SparePartRecord[]) {
    try {
      for (const row of rows) await deleteSparePart(row.id);
      toast.success($_('common.deletedSuccess'));
      await loadParts(meta.page);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.savePartFailed');
      toast.error(error);
    }
  }

  function categoryName(id: string | null | undefined): string {
    if (!id) return '—';
    return categories.find(c => c.id === id)?.name ?? id;
  }

  onMount(async () => {
    await loadCategories();
    void loadParts(1);
  });
</script>

<div class="space-y-4">
  <PageHeader
    title={$isLoading ? 'Spare Parts' : $_('warehouse.spareParts')}
    subtitle={$isLoading ? `${meta.total} parts` : $_('warehouse.partsTotal', { values: { count: meta.total } })}
    compact={true}
  >
    {#snippet actions()}
    <div class="flex flex-wrap gap-2 items-center">
      <div class="relative">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input class="input-base pl-9" bind:value={query} placeholder={$isLoading ? 'Search parts...' : $_('warehouse.searchParts')} />
      </div>
      <!-- Lọc theo danh mục -->
      <select class="select-base text-sm" bind:value={filterCategoryId}>
        <option value="">{$isLoading ? '-- All categories --' : $_('warehouse.partCategoryPlaceholder')}</option>
        {#each categories as cat}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
      <Button variant="secondary" onclick={() => loadParts(1)}>{$isLoading ? 'Search' : $_('common.search')}</Button>
      <Button onclick={openCreate}>
        <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Part' : $_('warehouse.newPart')}
      </Button>
    </div>
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if !loading && parts.length === 0}
    <EmptyState
      title={$isLoading ? 'No spare parts' : $_('warehouse.emptyPartsTitle')}
      description={$isLoading ? 'Create spare parts to manage warehouse inventory.' : $_('warehouse.emptyPartsSubtitle')}
      actionLabel={$isLoading ? 'New Part' : $_('warehouse.newPart')}
      onAction={openCreate}
    />
  {:else}
    <DataTable
      data={parts}
      columns={[
        { key: 'partCode',      label: $isLoading ? 'Code'         : $_('common.code'),        sortable: true, filterable: true, width: 'w-36' },
        { key: 'name',         label: $isLoading ? 'Name'         : $_('common.name'),        sortable: true, filterable: true },
        { key: 'categoryId',   label: $isLoading ? 'Category'     : $_('warehouse.partCategory'), sortable: false, filterable: false, render: (val) => categoryName(val as string) },
        { key: 'modelName',    label: $isLoading ? 'Model'        : $_('assets.model'),        sortable: false, filterable: false, render: (val) => val ?? '—' },
        { key: 'uom',          label: $isLoading ? 'UOM'          : $_('warehouse.uom'),       sortable: false, filterable: false, width: 'w-20', render: (val) => val ?? '—' },
        { key: 'manufacturer', label: $isLoading ? 'Manufacturer' : $_('warehouse.manufacturer'), sortable: false, filterable: false, render: (val) => val ?? '—' },
        { key: 'unitCost',     label: $isLoading ? 'Unit Cost'    : $_('warehouse.unitCostLabel'), sortable: false, filterable: false, width: 'w-32', render: (val) => val != null ? Number(val).toLocaleString('vi-VN') + ' ₫' : '—' },
        { key: 'minLevel',     label: $isLoading ? 'Min'          : $_('warehouse.minLevel'),  sortable: true, filterable: false, width: 'w-20' }
      ]}
      selectable={true}
      rowKey="id"
      loading={loading}
      onRowClick={(row) => openEdit(row)}
      onDelete={handleDelete}
    />
  {/if}

  {#if !loading && parts.length > 0}
    <div class="flex items-center justify-between text-sm text-slate-500">
      <span>{$isLoading ? 'Page' : $_('table.page')} {meta.page}</span>
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onclick={() => loadParts(meta.page - 1)}>{$isLoading ? 'Prev' : $_('common.previous')}</Button>
        <Button variant="secondary" size="sm" disabled={meta.page * meta.limit >= meta.total} onclick={() => loadParts(meta.page + 1)}>
          {$isLoading ? 'Next' : $_('common.next')}
        </Button>
      </div>
    </div>
  {/if}
</div>

<Modal bind:open={showModal} title={editing ? ($isLoading ? 'Edit Part' : $_('warehouse.editPart')) : ($isLoading ? 'New Part' : $_('warehouse.newPart'))}>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="part-code" class="text-sm font-medium text-slate-300">{$isLoading ? 'Part Code' : $_('warehouse.partCode')} <span class="text-red-400">*</span></label>
      <input id="part-code" class="input-base" bind:value={partCode} placeholder={$isLoading ? 'PART-001' : $_('warehouse.placeholders.partCode')} />
      <InlineError message={fieldErrors.partCode} />
    </div>
    <div>
      <label for="part-name" class="text-sm font-medium text-slate-300">{$isLoading ? 'Name' : $_('common.name')} <span class="text-red-400">*</span></label>
      <input id="part-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Cooling Fan' : $_('warehouse.placeholders.partName')} />
      <InlineError message={fieldErrors.name} />
    </div>
    <div>
      <label for="part-category" class="text-sm font-medium text-slate-300">{$isLoading ? 'Category' : $_('warehouse.partCategory')}</label>
      <select id="part-category" class="select-base" bind:value={categoryId} onchange={() => { modelId = ''; void loadModels(categoryId); }}>
        <option value="">{$isLoading ? '-- Select category --' : $_('warehouse.partCategoryPlaceholder')}</option>
        {#each categories as cat}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="part-model-id" class="text-sm font-medium text-slate-300">{$isLoading ? 'Model (catalog)' : $_('warehouse.partModelCatalog')}</label>
      <select id="part-model-id" class="select-base" value={modelId} onchange={(e) => onModelSelect((e.target as HTMLSelectElement).value)} disabled={availableModels.length === 0 && !modelId}>
        <option value="">{$isLoading ? '-- Select model --' : $_('warehouse.partModelPlaceholder')}</option>
        {#each availableModels as m}
          <option value={m.id}>{m.brand ? m.brand + ' ' : ''}{m.model}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="part-uom" class="text-sm font-medium text-slate-300">{$isLoading ? 'UOM' : $_('warehouse.uom')}</label>
      <input id="part-uom" class="input-base" bind:value={uom} placeholder={$isLoading ? 'pcs' : $_('warehouse.placeholders.uom')} />
    </div>
    <div>
      <label for="part-manufacturer" class="text-sm font-medium text-slate-300">{$isLoading ? 'Manufacturer' : $_('warehouse.manufacturer')}</label>
      <input id="part-manufacturer" class="input-base" bind:value={manufacturer} placeholder={$isLoading ? 'Vendor' : $_('warehouse.placeholders.manufacturer')} />
    </div>
    <div>
      <label for="part-model" class="text-sm font-medium text-slate-300">{$isLoading ? 'Model' : $_('assets.model')}</label>
      <input id="part-model" class="input-base" bind:value={model} placeholder={$isLoading ? 'Model A' : $_('warehouse.placeholders.model')} />
    </div>
    <div>
      <label for="part-unit-cost" class="text-sm font-medium text-slate-300">{$isLoading ? 'Unit Cost (₫)' : $_('warehouse.unitCostLabel')}</label>
      <input id="part-unit-cost" class="input-base" type="number" bind:value={unitCost} min="0" step="1000" placeholder="0" />
    </div>
    <div>
      <label for="part-min-level" class="text-sm font-medium text-slate-300">{$isLoading ? 'Min Level' : $_('warehouse.minLevel')}</label>
      <input id="part-min-level" class="input-base" type="number" bind:value={minLevel} min="0" />
      <InlineError message={fieldErrors.minLevel} />
    </div>
  </div>
  <div class="flex justify-end gap-2 mt-4">
    <Button variant="secondary" onclick={() => showModal = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
    <Button disabled={saving || !partCode || !name} onclick={savePart}>
      {saving ? ($isLoading ? 'Saving...' : $_('common.saving')) : ($isLoading ? 'Save' : $_('common.save'))}
    </Button>
  </div>
</Modal>
