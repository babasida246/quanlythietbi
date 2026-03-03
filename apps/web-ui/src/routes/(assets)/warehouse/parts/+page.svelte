<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus, Search } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { z } from 'zod';
  import { createSparePart, deleteSparePart, listSpareParts, updateSparePart, type SparePartRecord } from '$lib/api/warehouse';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/components/toast';
  import DataTable from '$lib/components/DataTable.svelte';

  let parts = $state<SparePartRecord[]>([]);
  let loading = $state(true);
  let error = $state('');

  let query = $state('');
  let meta = $state({ total: 0, page: 1, limit: 20 });

  let showModal = $state(false);
  let saving = $state(false);
  let editing = $state<SparePartRecord | null>(null);

  let partCode = $state('');
  let name = $state('');
  let category = $state('');
  let uom = $state('');
  let manufacturer = $state('');
  let model = $state('');
  let minLevel = $state('0');
  let fieldErrors = $state<{ partCode?: string; name?: string; minLevel?: string }>({});

  const partFormSchema = z.object({
    partCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    category: z.string().optional(),
    uom: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    minLevel: z.coerce.number().int().min(0)
  });

  async function loadParts(page = 1) {
    try {
      loading = true;
      error = '';
      const response = await listSpareParts({ q: query || undefined, page, limit: meta.limit });
      parts = response.data ?? [];
      meta = {
        total: response.meta?.total ?? parts.length,
        page: response.meta?.page ?? page,
        limit: response.meta?.limit ?? meta.limit
      };
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadPartsFailed');
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editing = null;
    partCode = '';
    name = '';
    category = '';
    uom = '';
    manufacturer = '';
    model = '';
    minLevel = '0';
    fieldErrors = {};
    showModal = true;
  }

  function validateForm() {
    const parsed = partFormSchema.safeParse({
      partCode,
      name,
      category,
      uom,
      manufacturer,
      model,
      minLevel
    });

    if (!parsed.success) {
      const nextErrors: { partCode?: string; name?: string; minLevel?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'partCode') nextErrors.partCode = issue.message;
        if (field === 'name') nextErrors.name = issue.message;
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
      error = '';
      const payload = {
        partCode: validData.partCode,
        name: validData.name,
        category: validData.category || null,
        uom: validData.uom || null,
        manufacturer: validData.manufacturer || null,
        model: validData.model || null,
        minLevel: validData.minLevel
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

  async function handleEdit(part: SparePartRecord, changes: Partial<SparePartRecord>) {
    try {
      await updateSparePart(part.id, {
        partCode: changes.partCode,
        name: changes.name,
        category: changes.category,
        uom: changes.uom,
        manufacturer: changes.manufacturer,
        model: changes.model,
        minLevel: changes.minLevel
      });
      toast.success($_('common.updatedSuccess'));
      await loadParts(meta.page);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.savePartFailed');
      toast.error(error);
    }
  }

  async function handleDelete(rows: SparePartRecord[]) {
    try {
      for (const row of rows) {
        await deleteSparePart(row.id);
      }
      toast.success($_('common.deletedSuccess'));
      await loadParts(meta.page);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.savePartFailed');
      toast.error(error);
    }
  }

  onMount(() => {
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
        { key: 'partCode', label: $isLoading ? 'Code' : $_('common.code'), sortable: true, filterable: true, editable: true, width: 'w-40' },
        { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true },
        { key: 'category', label: $isLoading ? 'Category' : $_('assets.category'), sortable: true, filterable: true, editable: true, render: (val) => val ?? '-' },
        { key: 'uom', label: $isLoading ? 'UOM' : $_('warehouse.uom'), sortable: true, filterable: true, editable: true, width: 'w-24', render: (val) => val ?? '-' },
        { key: 'manufacturer', label: $isLoading ? 'Manufacturer' : $_('warehouse.manufacturer'), sortable: true, filterable: true, editable: true, render: (val) => val ?? '-' },
        { key: 'model', label: $isLoading ? 'Model' : $_('assets.model'), sortable: true, filterable: true, editable: true, render: (val) => val ?? '-' },
        { key: 'minLevel', label: $isLoading ? 'Min' : $_('warehouse.minLevel'), sortable: true, filterable: false, editable: true, width: 'w-20' }
      ]}
      selectable={true}
      rowKey="id"
      loading={loading}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  {/if}

  {#if !loading && parts.length > 0}
    <div class="flex items-center justify-between text-sm text-slate-500">
      <span>{$isLoading ? 'Page' : $_('table.page')} {meta.page}</span>
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onclick={() => loadParts(meta.page - 1)}>{$isLoading ? 'Prev' : $_('common.previous')}</Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page * meta.limit >= meta.total}
          onclick={() => loadParts(meta.page + 1)}
        >
          {$isLoading ? 'Next' : $_('common.next')}
        </Button>
      </div>
    </div>
  {/if}
</div>

<Modal bind:open={showModal} title={editing ? ($isLoading ? 'Edit Part' : $_('warehouse.editPart')) : ($isLoading ? 'New Part' : $_('warehouse.newPart'))}>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="part-code" class="text-sm font-medium text-slate-300">{$isLoading ? 'Part Code' : $_('warehouse.partCode')}</label>
      <input id="part-code" class="input-base" bind:value={partCode} placeholder={$isLoading ? 'PART-001' : $_('warehouse.placeholders.partCode')} />
      <InlineError message={fieldErrors.partCode} />
    </div>
    <div>
      <label for="part-name" class="text-sm font-medium text-slate-300">{$isLoading ? 'Name' : $_('common.name')}</label>
      <input id="part-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Cooling Fan' : $_('warehouse.placeholders.partName')} />
      <InlineError message={fieldErrors.name} />
    </div>
    <div>
      <label for="part-category" class="text-sm font-medium text-slate-300">{$isLoading ? 'Category' : $_('assets.category')}</label>
      <input id="part-category" class="input-base" bind:value={category} placeholder={$isLoading ? 'Electronics' : $_('warehouse.placeholders.category')} />
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

