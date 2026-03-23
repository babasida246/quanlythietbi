<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { AlertTriangle, Download, Eye, Filter, HardDrive, Plus, Printer, RefreshCw, Upload, X } from 'lucide-svelte';
  import { z } from 'zod';
  import {
    deleteAsset,
    exportAssetsCsv,
    listAssets,
    openMaintenanceTicket,
    updateAsset,
    type Asset,
    type AssetStatus,
    type MaintenanceSeverity
  } from '$lib/api/assets';
  import { getAssetCatalogs, getCategorySpecDefs, listStatusCatalogs, type AssetStatusCatalog, type Catalogs, type CategorySpecDef } from '$lib/api/assetCatalogs';
  import DynamicSpecForm from '$lib/assets/components/catalogs/DynamicSpecForm.svelte';
  import MaintenanceModal from '$lib/assets/components/MaintenanceModal.svelte';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import ImportWizard from '$lib/assets/components/ImportWizard.svelte';
  import InventoryLabelPrint from '$lib/assets/components/InventoryLabelPrint.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { Button } from '$lib/components/ui';
  import { getCapabilities } from '$lib/auth/capabilities';
  import { allowedPerms } from '$lib/stores/effectivePermsStore';

  let userRole = $state('');
  const caps = $derived.by(() => {
    const perms = $allowedPerms;
    return getCapabilities(userRole, perms.length > 0 ? perms : undefined);
  });

  const assetSchema = z.object({
    name: z.string().trim().min(1, $isLoading ? 'Asset name is required' : $_('assets.validation.nameRequired')),
    assetCode: z.string().trim().optional(),
    categoryId: z.string().optional(),
    modelId: z.string().optional(),
    vendorId: z.string().optional(),
    locationId: z.string().optional(),
    statusId: z.string().optional(),
    serialNumber: z.string().optional(),
    purchaseDate: z.string().optional(),
    warrantyEnd: z.string().optional(),
    note: z.string().optional()
  });

  type AssetFormValues = z.infer<typeof assetSchema>;

  const fallbackStatuses: AssetStatusCatalog[] = [
    { id: 'in_stock', name: 'In Stock', code: 'in_stock', isTerminal: false },
    { id: 'in_use', name: 'In Use', code: 'in_use', isTerminal: false },
    { id: 'in_repair', name: 'In Repair', code: 'in_repair', isTerminal: false },
    { id: 'retired', name: 'Retired', code: 'retired', isTerminal: true },
    { id: 'disposed', name: 'Disposed', code: 'disposed', isTerminal: true },
    { id: 'lost', name: 'Lost', code: 'lost', isTerminal: true }
  ];

  let loading = $state(true);
  let error = $state('');
  let assets = $state<Asset[]>([]);
  let catalogs = $state<Catalogs | null>(null);
  let statuses = $state<AssetStatusCatalog[]>([]);
  let query = $state('');

  let filterStatus = $state('');
  let filterCategory = $state('');
  let filterLocation = $state('');
  let filterVendor = $state('');
  let filterWarranty = $state('');
  let filterExpanded = $state(false);
  let selectedIds = $state(new Set<string>());
  let printOpen = $state(false);

  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let importOpen = $state(false);
  let editingAsset = $state<Asset | null>(null);
  let deletingAsset = $state<Asset | null>(null);
  let reportOpen = $state(false);
  let reportingAsset = $state<Asset | null>(null);

  // Spec state for edit form
  let editSpec = $state<Record<string, unknown>>({});
  let editSpecDefs = $state<CategorySpecDef[]>([]);
  let editSpecLoading = $state(false);

  function emptyAssetForm(): AssetFormValues {
    return {
      name: '',
      assetCode: '',
      categoryId: '',
      modelId: '',
      vendorId: '',
      locationId: '',
      statusId: 'in_stock',
      serialNumber: '',
      purchaseDate: '',
      warrantyEnd: '',
      note: ''
    };
  }

  function toFormValues(asset: Asset): AssetFormValues {
    return {
      name: asset.hostname ?? asset.assetCode,
      assetCode: asset.assetCode,
      categoryId: asset.categoryId ?? '',
      modelId: asset.modelId ?? '',
      vendorId: asset.vendorId ?? '',
      locationId: asset.locationId ?? '',
      statusId: asset.status ?? 'in_stock',
      serialNumber: asset.serialNo ?? '',
      purchaseDate: asset.purchaseDate ?? '',
      warrantyEnd: asset.warrantyEnd ?? '',
      note: asset.notes ?? ''
    };
  }

  function toStatus(value: string): AssetStatus | undefined {
    if (!value) return undefined;
    return value as AssetStatus;
  }

  async function loadPageData() {
    try {
      loading = true;
      error = '';
      const [assetResponse, catalogResponse, statusResponse] = await Promise.all([
        listAssets({ limit: 200 }),
        getAssetCatalogs(),
        listStatusCatalogs().catch(() => ({ data: [] as AssetStatusCatalog[] }))
      ]);
      assets = assetResponse.data ?? [];
      catalogs = catalogResponse.data ?? null;
      statuses = (statusResponse.data ?? []).length > 0 ? statusResponse.data : fallbackStatuses;
    } catch (err) {
      error = err instanceof Error ? err.message : ($isLoading ? 'Failed to load assets' : $_('assets.errors.loadAssetsFailed'));
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadSpecForModel(modelId: string) {
    const model = catalogs?.models?.find((m) => m.id === modelId);
    if (!model) {
      editSpec = {};
      editSpecDefs = [];
      return;
    }
    editSpec = { ...(model.spec || {}) };

    if (!model.categoryId) {
      editSpecDefs = [];
      return;
    }
    editSpecLoading = true;
    try {
      const response = await getCategorySpecDefs(model.categoryId);
      editSpecDefs = response.data;
    } catch {
      editSpecDefs = [];
    } finally {
      editSpecLoading = false;
    }
  }

  $effect(() => {
    if (!editOpen) {
      editSpec = {};
      editSpecDefs = [];
    } else if (editingAsset?.modelId) {
      // Pre-populate spec from existing asset, then load defs
      editSpec = { ...(editingAsset.spec || {}) };
      const model = catalogs?.models?.find((m) => m.id === editingAsset?.modelId);
      if (model?.categoryId) {
        editSpecLoading = true;
        getCategorySpecDefs(model.categoryId)
          .then((r) => { editSpecDefs = r.data; })
          .catch(() => { editSpecDefs = []; })
          .finally(() => { editSpecLoading = false; });
      }
    }
  });

  function makeAssetPayload(values: AssetFormValues, spec?: Record<string, unknown>) {
    const generatedCode = `AST-${Date.now().toString().slice(-6)}`;
    const modelId = values.modelId || (catalogs?.models?.[0]?.id ?? '');
    if (!modelId) {
      throw new Error($isLoading ? 'Please select an asset model' : $_('assets.validation.modelRequired'));
    }

    return {
      assetCode: values.assetCode?.trim() || generatedCode,
      modelId,
      status: toStatus(values.statusId || '') ?? 'in_stock',
      vendorId: values.vendorId || undefined,
      locationId: values.locationId || undefined,
      serialNo: values.serialNumber?.trim() || undefined,
      purchaseDate: values.purchaseDate || undefined,
      warrantyEnd: values.warrantyEnd || undefined,
      notes: values.note?.trim() || undefined,
      hostname: values.name.trim(),
      spec: spec && Object.keys(spec).length > 0 ? spec : undefined
    };
  }

  async function handleEdit(values: Record<string, unknown>) {
    if (!editingAsset) return;
    const parsed = assetSchema.parse(values);
    const payload = makeAssetPayload(parsed, editSpec);
    await updateAsset(editingAsset.id, payload);
    toast.success($isLoading ? 'Asset updated successfully' : $_('assets.toast.updateSuccess'));
    await loadPageData();
  }

  async function handleDelete() {
    if (!deletingAsset) return;
    await deleteAsset(deletingAsset.id);
    toast.success($isLoading ? 'Asset deleted successfully' : $_('assets.toast.deleteSuccess'));
    deleteOpen = false;
    deletingAsset = null;
    await loadPageData();
  }

  async function handleReport(data: { title: string; severity: MaintenanceSeverity; diagnosis?: string; resolution?: string }) {
    if (!reportingAsset) return;
    try {
      await openMaintenanceTicket({ assetId: reportingAsset.id, ...data });
      toast.success($isLoading ? 'Incident reported' : $_('assets.toast.incidentReported'));
      reportOpen = false;
      reportingAsset = null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to report incident');
    }
  }

  async function handleExport() {
    try {
      const csv = await exportAssetsCsv({ query: query.trim() || undefined });
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'assets.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success($isLoading ? 'CSV exported successfully' : $_('assets.toast.exportSuccess'));
    } catch (err) {
      const message = err instanceof Error ? err.message : ($isLoading ? 'Failed to export CSV' : $_('assets.errors.exportFailed'));
      toast.error(message);
    }
  }

  const filteredAssets = $derived.by(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const today = new Date();
    return assets.filter((asset) => {
      // text search
      if (normalizedQuery) {
        const matches = [asset.assetCode, asset.hostname, asset.serialNo, asset.modelName, asset.vendorName, asset.locationName]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(normalizedQuery));
        if (!matches) return false;
      }
      // status filter
      if (filterStatus && asset.status !== filterStatus) return false;
      // category filter
      if (filterCategory && asset.categoryId !== filterCategory) return false;
      // location filter
      if (filterLocation && asset.locationId !== filterLocation) return false;
      // vendor filter
      if (filterVendor && asset.vendorId !== filterVendor) return false;
      // warranty filter
      if (filterWarranty && asset.warrantyEnd) {
        const days = parseInt(filterWarranty, 10);
        const warrantyDate = new Date(asset.warrantyEnd);
        const diffDays = Math.ceil((warrantyDate.getTime() - today.getTime()) / 86400000);
        if (diffDays > days || diffDays < 0) return false;
      } else if (filterWarranty) {
        return false;
      }
      return true;
    });
  });

  const activeFilterCount = $derived(
    [filterStatus, filterCategory, filterLocation, filterVendor, filterWarranty].filter(Boolean).length
  );

  const selectedAssets = $derived(filteredAssets.filter((a) => selectedIds.has(a.id)));

  const allSelected = $derived(filteredAssets.length > 0 && filteredAssets.every((a) => selectedIds.has(a.id)));

  function clearFilters() {
    filterStatus = '';
    filterCategory = '';
    filterLocation = '';
    filterVendor = '';
    filterWarranty = '';
  }

  function toggleSelectAll() {
    if (allSelected) {
      filteredAssets.forEach((a) => selectedIds.delete(a.id));
    } else {
      filteredAssets.forEach((a) => selectedIds.add(a.id));
    }
    selectedIds = new Set(selectedIds);
  }

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds);
  }

  const categoryOptions = $derived((catalogs?.categories ?? []).map((item) => ({ value: item.id, label: item.name })));
  const vendorOptions = $derived((catalogs?.vendors ?? []).map((item) => ({ value: item.id, label: item.name })));
  const locationOptions = $derived((catalogs?.locations ?? []).map((item) => ({ value: item.id, label: item.name })));
  const modelOptions = $derived((catalogs?.models ?? []).map((item) => ({ value: item.id, label: item.brand ? `${item.brand} ${item.model}` : item.model })));
  const statusOptions = $derived(statuses.map((item) => ({ value: item.code, label: `${item.name} (${item.code})` })));

  onMount(() => {
    userRole = localStorage.getItem('userRole') || '';
    void loadPageData();
  });
</script>

<div class="page-shell page-content">
  <PageHeader title={$isLoading ? 'Assets' : $_('assets.title')} subtitle={$isLoading ? `${filteredAssets.length} assets` : $_('assets.subtitleCount', { values: { count: filteredAssets.length } })}>
    {#snippet actions()}
      {#if selectedIds.size > 0}
        <Button variant="primary" size="sm" data-testid="btn-print-labels" onclick={() => (printOpen = true)}>
          {#snippet leftIcon()}<Printer class="h-3.5 w-3.5" />{/snippet}
          {$isLoading ? 'Print labels' : $_('assets.printLabel')} ({selectedIds.size})
        </Button>
      {/if}
      <Button variant="secondary" size="sm" data-testid="btn-export" onclick={handleExport}>
        {#snippet leftIcon()}<Download class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Export CSV' : $_('assets.exportCsv')}
      </Button>
      <Button variant="secondary" size="sm" data-testid="btn-import" onclick={() => (importOpen = true)}>
        {#snippet leftIcon()}<Upload class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Import CSV' : $_('assets.importCsv')}
      </Button>
      {#if caps.assets.create}
        <Button variant="primary" size="sm" data-testid="btn-create" onclick={() => goto('/assets/new')}>
          {#snippet leftIcon()}<Plus class="h-3.5 w-3.5" />{/snippet}
          {$isLoading ? 'Create new' : $_('assets.createNew')}
        </Button>
      {/if}
      <Button variant="ghost" size="sm" data-testid="btn-refresh" onclick={() => loadPageData()}>
        {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Reload' : $_('assets.reload')}
      </Button>
    {/snippet}
  </PageHeader>

  <div class="card card-body">
    <!-- Search + filter toggle row -->
    <div class="flex gap-2 items-end">
      <div class="flex-1">
        <TextField
          id="asset-search"
          label={$isLoading ? 'Search' : $_('assets.search')}
          value={query}
          placeholder={$isLoading ? 'Asset code, hostname, IP...' : $_('assets.searchPlaceholder')}
          onValueChange={(value) => (query = value)}
        />
      </div>
      <button
        type="button"
        class="filter-toggle-btn"
        class:active={filterExpanded || activeFilterCount > 0}
        onclick={() => (filterExpanded = !filterExpanded)}
        aria-expanded={filterExpanded}
        aria-label={$isLoading ? 'Filters' : $_('common.filter')}
      >
        <Filter class="h-4 w-4" />
        {$isLoading ? 'Filters' : $_('common.filter')}
        {#if activeFilterCount > 0}
          <span class="filter-badge">{activeFilterCount}</span>
        {/if}
      </button>
    </div>

    <!-- Expanded filter panel -->
    {#if filterExpanded}
      <div class="filter-panel">
        <div class="filter-grid">
          <div class="filter-field">
            <label class="filter-label" for="filter-status">{$isLoading ? 'Status' : $_('assets.filters.status')}</label>
            <select id="filter-status" class="filter-select" bind:value={filterStatus}>
              <option value="">{$isLoading ? 'All' : $_('assets.filters.allStatus')}</option>
              <option value="in_stock">{$isLoading ? 'In stock' : $_('assets.filters.inStock')}</option>
              <option value="in_use">{$isLoading ? 'In use' : $_('assets.filters.inUse')}</option>
              <option value="in_repair">{$isLoading ? 'In repair' : $_('assets.filters.inRepair')}</option>
              <option value="retired">{$isLoading ? 'Retired' : $_('assets.filters.retired')}</option>
              <option value="disposed">{$isLoading ? 'Disposed' : $_('assets.filters.disposed')}</option>
              <option value="lost">{$isLoading ? 'Lost' : $_('assets.filters.lost')}</option>
            </select>
          </div>

          <div class="filter-field">
            <label class="filter-label" for="filter-category">{$isLoading ? 'Category' : $_('assets.filters.category')}</label>
            <select id="filter-category" class="filter-select" bind:value={filterCategory}>
              <option value="">{$isLoading ? 'All' : $_('assets.filters.allStatus')}</option>
              {#each catalogs?.categories ?? [] as cat}
                <option value={cat.id}>{cat.name}</option>
              {/each}
            </select>
          </div>

          <div class="filter-field">
            <label class="filter-label" for="filter-location">{$isLoading ? 'Location' : $_('assets.locationFilter')}</label>
            <select id="filter-location" class="filter-select" bind:value={filterLocation}>
              <option value="">{$isLoading ? 'All' : $_('assets.filters.allStatus')}</option>
              {#each catalogs?.locations ?? [] as loc}
                <option value={loc.id}>{loc.name}</option>
              {/each}
            </select>
          </div>

          <div class="filter-field">
            <label class="filter-label" for="filter-vendor">{$isLoading ? 'Vendor' : $_('assets.supplier')}</label>
            <select id="filter-vendor" class="filter-select" bind:value={filterVendor}>
              <option value="">{$isLoading ? 'All' : $_('assets.filters.allStatus')}</option>
              {#each catalogs?.vendors ?? [] as v}
                <option value={v.id}>{v.name}</option>
              {/each}
            </select>
          </div>

          <div class="filter-field">
            <label class="filter-label" for="filter-warranty">{$isLoading ? 'Warranty' : $_('assets.filters.warranty')}</label>
            <select id="filter-warranty" class="filter-select" bind:value={filterWarranty}>
              <option value="">{$isLoading ? 'All' : $_('assets.filters.allStatus')}</option>
              <option value="30">{$isLoading ? 'Expiring in 30 days' : $_('assets.filters.warranty30')}</option>
              <option value="60">{$isLoading ? 'Expiring in 60 days' : $_('assets.filters.warranty60')}</option>
              <option value="90">{$isLoading ? 'Expiring in 90 days' : $_('assets.filters.warranty90')}</option>
            </select>
          </div>
        </div>

        {#if activeFilterCount > 0}
          <div class="filter-actions">
            <button type="button" class="clear-filters-btn" onclick={clearFilters}>
              <X class="h-3.5 w-3.5" />
              {$isLoading ? 'Clear filters' : $_('assets.clearFilters')} ({activeFilterCount})
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <div class="alert alert-error" role="alert">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={6} />
  {:else if filteredAssets.length === 0}
    <EmptyState
      icon={HardDrive}
      title={$isLoading ? 'No assets' : $_('assets.noAssets')}
      description={query ? ($isLoading ? 'No matching results. Try different keywords.' : $_('assets.noResults')) : ($isLoading ? 'Start by creating a new asset.' : $_('assets.emptyHint'))}
      actionLabel={query || !caps.assets.create ? '' : ($isLoading ? 'Create Asset' : $_('assets.createAsset'))}
      onAction={() => goto('/assets/new')}
    />
  {:else}
    <div class="data-table-wrap">
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th class="th-check">
                <input
                  type="checkbox"
                  class="row-check"
                  checked={allSelected}
                  aria-label={$isLoading ? 'Select all' : $_('common.selectAll')}
                  onchange={toggleSelectAll}
                />
              </th>
              <th>{$isLoading ? 'Name' : $_('assets.tableHeaders.name')}</th>
              <th>{$isLoading ? 'Asset Code' : $_('assets.tableHeaders.assetCode')}</th>
              <th>{$isLoading ? 'Model' : $_('assets.tableHeaders.model')}</th>
              <th>{$isLoading ? 'Status' : $_('assets.tableHeaders.status')}</th>
              <th>{$isLoading ? 'Location' : $_('assets.tableHeaders.location')}</th>
              <th class="text-right">{$isLoading ? 'Actions' : $_('assets.tableHeaders.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAssets as asset}
              <tr class={selectedIds.has(asset.id) ? 'row-selected' : ''}>
                <td class="td-check">
                  <input
                    type="checkbox"
                    class="row-check"
                    checked={selectedIds.has(asset.id)}
                    aria-label={$isLoading ? `Select ${asset.assetCode}` : $_('assets.select', { values: { item: asset.assetCode } })}
                    onchange={() => toggleSelect(asset.id)}
                  />
                </td>
                <td class="font-medium text-slate-100">{asset.hostname ?? asset.assetCode}</td>
                <td><code class="code-inline">{asset.assetCode}</code></td>
                <td>{asset.modelName ?? '-'}</td>
                <td>
                  <span class={`badge ${
                    asset.status === 'in_use' ? 'badge-green' :
                    asset.status === 'in_stock' ? 'badge-blue' :
                    asset.status === 'in_repair' ? 'badge-yellow' :
                    asset.status === 'retired' || asset.status === 'disposed' ? 'badge-red' :
                    'badge-gray'
                  }`}>
                    {asset.status}
                  </span>
                </td>
                <td>{asset.locationName ?? '-'}</td>
                <td>
                  <div class="cell-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid={`row-view-${asset.id}`}
                      onclick={() => goto(`/assets/${asset.id}`)}
                    >
                      {#snippet leftIcon()}<Eye class="h-3.5 w-3.5" />{/snippet}
                      {$isLoading ? 'View' : $_('common.view')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid={`row-report-${asset.id}`}
                      onclick={() => {
                        reportingAsset = asset;
                        reportOpen = true;
                      }}
                    >
                      {#snippet leftIcon()}<AlertTriangle class="h-3.5 w-3.5" />{/snippet}
                      {$isLoading ? 'Report incident' : $_('assets.reportIncident')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`row-edit-${asset.id}`}
                      onclick={() => {
                        editingAsset = asset;
                        editOpen = true;
                      }}
                    >
                      {$isLoading ? 'Edit' : $_('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      data-testid={`row-delete-${asset.id}`}
                      onclick={() => {
                        deletingAsset = asset;
                        deleteOpen = true;
                      }}
                    >
                      {$isLoading ? 'Delete' : $_('common.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title={$isLoading ? 'Edit asset' : $_('assets.editAsset')}
  schema={assetSchema}
  initialValues={editingAsset ? toFormValues(editingAsset) : emptyAssetForm()}
  onSubmit={handleEdit}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextField id="asset-name-edit" label={$isLoading ? 'Asset name' : $_('assets.assetName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="asset-code-edit" label={$isLoading ? 'Asset Code' : $_('assets.assetCode')} value={String(values.assetCode ?? '')} onValueChange={(v) => setValue('assetCode', v)} disabled={disabled} />
      <SelectField id="asset-category-edit" label={$isLoading ? 'Category' : $_('assets.category')} value={String(values.categoryId ?? '')} options={categoryOptions} placeholder={$isLoading ? 'Select category' : $_('assets.form.selectCategory')} onValueChange={(v) => setValue('categoryId', v)} disabled={disabled} />
      <SelectField id="asset-model-edit" label={$isLoading ? 'Model' : $_('assets.model')} value={String(values.modelId ?? '')} options={modelOptions.filter((option) => !values.categoryId || catalogs?.models.find((m) => m.id === option.value)?.categoryId === values.categoryId)} placeholder={$isLoading ? 'Select model' : $_('assets.form.selectModel')} onValueChange={(v) => { setValue('modelId', v); loadSpecForModel(v); }} disabled={disabled} />
      <SelectField id="asset-vendor-edit" label={$isLoading ? 'Vendor' : $_('assets.vendor')} value={String(values.vendorId ?? '')} options={vendorOptions} placeholder={$isLoading ? 'Select vendor' : $_('assets.form.selectVendor')} onValueChange={(v) => setValue('vendorId', v)} disabled={disabled} />
      <SelectField id="asset-location-edit" label={$isLoading ? 'Location' : $_('assets.location')} value={String(values.locationId ?? '')} options={locationOptions} placeholder={$isLoading ? 'Select location' : $_('assets.form.selectLocation')} onValueChange={(v) => setValue('locationId', v)} disabled={disabled} />
      <SelectField id="asset-status-edit" label={$isLoading ? 'Status' : $_('assets.status')} value={String(values.statusId ?? '')} options={statusOptions} placeholder={$isLoading ? 'Select status' : $_('assets.form.selectStatus')} onValueChange={(v) => setValue('statusId', v)} disabled={disabled} />
      <TextField id="asset-serial-edit" label={$isLoading ? 'Serial Number' : $_('assets.serialNumber')} value={String(values.serialNumber ?? '')} onValueChange={(v) => setValue('serialNumber', v)} disabled={disabled} />
      <TextField id="asset-purchase-edit" type="date" label={$isLoading ? 'Purchase Date' : $_('assets.purchaseDate')} value={String(values.purchaseDate ?? '')} onValueChange={(v) => setValue('purchaseDate', v)} disabled={disabled} />
      <TextField id="asset-warranty-edit" type="date" label={$isLoading ? 'Warranty End' : $_('assets.warrantyEnd')} value={String(values.warrantyEnd ?? '')} onValueChange={(v) => setValue('warrantyEnd', v)} disabled={disabled} />
    </div>
    <TextareaField id="asset-note-edit" label={$isLoading ? 'Note' : $_('assets.form.note')} value={String(values.note ?? '')} onValueChange={(v) => setValue('note', v)} disabled={disabled} />
    {#if editSpecDefs.length > 0 || editSpecLoading}
      <div class="border-t border-slate-700 pt-4 mt-2">
        <h4 class="text-sm font-semibold text-slate-300 mb-3">{$isLoading ? 'Specifications' : $_('assets.specifications')}</h4>
        {#if editSpecLoading}
          <div class="flex items-center justify-center p-6"><div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
        {:else}
          <DynamicSpecForm bind:spec={editSpec} specDefs={editSpecDefs} />
        {/if}
      </div>
    {/if}
  {/snippet}
</CreateEditModal>

<DeleteConfirmModal
  bind:open={deleteOpen}
  entityName={deletingAsset?.hostname ?? deletingAsset?.assetCode ?? ($isLoading ? 'asset' : $_('assets.asset'))}
  description={$isLoading ? `Are you sure you want to delete asset ${deletingAsset?.hostname ?? deletingAsset?.assetCode ?? ''}?` : $_('assets.deleteConfirm', { values: { name: deletingAsset?.hostname ?? deletingAsset?.assetCode ?? '' } })}
  onConfirm={handleDelete}
/>

<ImportWizard bind:open={importOpen} onimported={() => loadPageData()} />

<InventoryLabelPrint bind:open={printOpen} assets={selectedAssets} />

<MaintenanceModal
  bind:open={reportOpen}
  assetCode={reportingAsset?.assetCode ?? ''}
  onsubmit={handleReport}
/>

<style>
  /* Filter toggle button */
  .filter-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary, #94a3b8);
    background: var(--color-surface-3, #1e293b);
    border: 1px solid var(--color-border, #334155);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    height: 2.25rem;
    margin-bottom: 0.25rem;
  }
  .filter-toggle-btn:hover,
  .filter-toggle-btn.active {
    color: var(--color-text-primary, #f1f5f9);
    border-color: var(--color-primary, #3b82f6);
    background: rgba(59, 130, 246, 0.08);
  }
  .filter-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: var(--color-primary, #3b82f6);
    color: #fff;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1;
  }

  /* Filter panel */
  .filter-panel {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, #334155);
  }
  .filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
  }
  .filter-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .filter-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted, #64748b);
  }
  .filter-select {
    width: 100%;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    color: var(--color-text-primary, #f1f5f9);
    background: var(--color-surface-3, #0f172a);
    border: 1px solid var(--color-border, #334155);
    border-radius: 0.375rem;
    outline: none;
    cursor: pointer;
  }
  .filter-select:focus {
    border-color: var(--color-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  /* Clear filters button */
  .filter-actions {
    margin-top: 0.75rem;
    display: flex;
    justify-content: flex-end;
  }
  .clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-danger, #ef4444);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.375rem;
    border-radius: 0.25rem;
    transition: background 0.15s;
  }
  .clear-filters-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Row checkbox column */
  .th-check,
  .td-check {
    width: 2.5rem;
    padding-left: 0.75rem;
  }
  .row-check {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: var(--color-primary, #3b82f6);
  }

  /* Selected row highlight */
  .row-selected {
    background: rgba(59, 130, 246, 0.06) !important;
  }
</style>
