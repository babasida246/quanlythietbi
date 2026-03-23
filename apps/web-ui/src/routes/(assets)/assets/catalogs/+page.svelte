<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Plus, RefreshCw, Edit, Trash2, Settings } from 'lucide-svelte';
  import CategorySpecPanel from '$lib/assets/components/catalogs/CategorySpecPanel.svelte';
  import ModelCatalog from '$lib/assets/components/catalogs/ModelCatalog.svelte';
  import { z } from 'zod';
  import {
    createCategory,
    createLocation,
    createModel,
    createStatusCatalog,
    createVendor,
    deleteCategory,
    deleteLocation,
    deleteModel,
    deleteStatusCatalog,
    deleteVendor,
    getAssetCatalogs,
    listStatusCatalogs,
    updateCategory,
    updateLocation,
    updateModel,
    updateStatusCatalog,
    updateVendor,
    type AssetCategory,
    type AssetModel,
    type AssetStatusCatalog,
    type Location,
    type Vendor
  } from '$lib/api/assetCatalogs';
  import {
    listOrganizations,
    type OrganizationDto
  } from '$lib/api/organizations';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { 
    Button,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableCell,
    Tabs,
    TabsList,
    TabsTrigger
  } from '$lib/components/ui';

  type CatalogTab = 'categories' | 'vendors' | 'models' | 'locations' | 'statuses';

  const tabLabels: Record<CatalogTab, string> = $derived({
    categories: $_('catalogs.tab.categories'),
    vendors: $_('catalogs.tab.vendors'),
    models: $_('catalogs.tab.models'),
    locations: $_('catalogs.tab.locations'),
    statuses: $_('catalogs.tab.statuses')
  });

  const categorySchema = $derived(z.object({
    name: z.string().trim().min(1, $_('catalogs.validation.categoryNameRequired')),
    parentId: z.string().optional()
  }));

  const vendorSchema = $derived(z.object({
    name: z.string().trim().min(1, $_('catalogs.validation.vendorNameRequired')),
    taxCode: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional()
  }));

  const modelSchema = $derived(z.object({
    name: z.string().trim().min(1, $_('catalogs.validation.modelNameRequired')),
    brand: z.string().optional(),
    categoryId: z.string().trim().min(1, $_('catalogs.validation.categoryRequired')),
    vendorId: z.string().optional(),
    notes: z.string().optional()
  }));

  const locationSchema = $derived(z.object({
    name: z.string().trim().min(1, $_('catalogs.validation.locationNameRequired')),
    parentId: z.string().optional(),
    organizationId: z.string().optional()
  }));

  const statusSchema = $derived(z.object({
    name: z.string().trim().min(1, $_('catalogs.validation.statusNameRequired')),
    code: z.string().trim().min(1, $_('catalogs.validation.codeRequired')),
    isTerminal: z.boolean().optional(),
    color: z.string().optional()
  }));

  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<CatalogTab>('categories');

  let categories = $state<AssetCategory[]>([]);
  let vendors = $state<Vendor[]>([]);
  let models = $state<AssetModel[]>([]);
  let locations = $state<Location[]>([]);
  let statuses = $state<AssetStatusCatalog[]>([]);
  let organizations = $state<OrganizationDto[]>([]); // for dropdown only

  let createOpen = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let editingItem = $state<Record<string, unknown> | null>(null);
  let deletingItem = $state<Record<string, unknown> | null>(null);
  let showSpecPanel = $state(false);
  let specPanelCategory = $state<AssetCategory | null>(null);

  function openSpecPanel(category: AssetCategory) {
    specPanelCategory = category;
    showSpecPanel = true;
  }

  const currentRows = $derived.by(() => {
    if (activeTab === 'categories') return categories;
    if (activeTab === 'vendors') return vendors;
    if (activeTab === 'models') return models;
    if (activeTab === 'locations') return locations;
    return statuses;
  });

  const currentSchema = $derived.by(() => {
    if (activeTab === 'categories') return categorySchema;
    if (activeTab === 'vendors') return vendorSchema;
    if (activeTab === 'models') return modelSchema;
    if (activeTab === 'locations') return locationSchema;
    return statusSchema;
  });

  const categoryOptions = $derived(categories.map((item) => ({ value: item.id, label: item.name })));
  const vendorOptions = $derived(vendors.map((item) => ({ value: item.id, label: item.name })));
  const locationOptions = $derived(locations.map((item) => ({ value: item.id, label: item.name })));
  const orgOptions = $derived(organizations.map((item) => ({ value: item.id, label: item.path || item.name })));

  function getCreateValues(tab: CatalogTab): Record<string, unknown> {
    if (tab === 'categories') return { name: '', parentId: '' };
    if (tab === 'vendors') return { name: '', taxCode: '', phone: '', email: '', address: '' };
    if (tab === 'models') return { name: '', brand: '', categoryId: '', vendorId: '', notes: '' };
    if (tab === 'locations') return { name: '', parentId: '', organizationId: '' };
    return { name: '', code: '', isTerminal: false, color: '' };
  }

  function getEditValues(tab: CatalogTab, item: Record<string, unknown> | null): Record<string, unknown> {
    if (!item) return getCreateValues(tab);
    if (tab === 'categories') {
      return { name: String(item.name ?? ''), parentId: '' };
    }
    if (tab === 'vendors') {
      return {
        name: String(item.name ?? ''),
        taxCode: String(item.taxCode ?? ''),
        phone: String(item.phone ?? ''),
        email: String(item.email ?? ''),
        address: String(item.address ?? '')
      };
    }
    if (tab === 'models') {
      return {
        name: String(item.model ?? item.name ?? ''),
        brand: String(item.brand ?? ''),
        categoryId: String(item.categoryId ?? ''),
        vendorId: String(item.vendorId ?? ''),
        notes: String((item.spec as Record<string, unknown> | undefined)?.notes ?? '')
      };
    }
    if (tab === 'locations') {
      return {
        name: String(item.name ?? ''),
        parentId: String(item.parentId ?? ''),
        organizationId: String(item.organizationId ?? '')
      };
    }
    return {
      name: String(item.name ?? ''),
      code: String(item.code ?? ''),
      isTerminal: Boolean(item.isTerminal),
      color: String(item.color ?? '')
    };
  }

  function getRowId(row: Record<string, unknown>): string {
    return String(row.id ?? '');
  }

  function getRowName(row: Record<string, unknown>): string {
    if (activeTab === 'models') return String(row.model ?? row.name ?? '');
    return String(row.name ?? row.code ?? row.id ?? '');
  }

  async function loadCatalogData() {
    try {
      loading = true;
      error = '';
      const [catalogResponse, statusResponse, orgResponse] = await Promise.all([
        getAssetCatalogs(),
        listStatusCatalogs().catch(() => ({ data: [] as AssetStatusCatalog[] })),
        listOrganizations({ flat: true, limit: 200 }).catch(() => ({ data: [] as OrganizationDto[] }))
      ]);
      categories = catalogResponse.data?.categories ?? [];
      vendors = catalogResponse.data?.vendors ?? [];
      models = catalogResponse.data?.models ?? [];
      locations = catalogResponse.data?.locations ?? [];
      statuses = statusResponse.data ?? [];
      organizations = orgResponse.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Khong the tai danh muc';
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function createCurrent(values: Record<string, unknown>) {
    if (activeTab === 'categories') {
      const parsed = categorySchema.parse(values);
      await createCategory({ name: parsed.name });
    } else if (activeTab === 'vendors') {
      const parsed = vendorSchema.parse(values);
      await createVendor({
        name: parsed.name,
        taxCode: parsed.taxCode?.trim() || null,
        phone: parsed.phone?.trim() || null,
        email: parsed.email?.trim() || null,
        address: parsed.address?.trim() || null
      });
    } else if (activeTab === 'models') {
      const parsed = modelSchema.parse(values);
      await createModel({
        model: parsed.name,
        brand: parsed.brand?.trim() || null,
        categoryId: parsed.categoryId || null,
        vendorId: parsed.vendorId || null,
        spec: parsed.notes?.trim() ? { notes: parsed.notes.trim() } : {}
      });
    } else if (activeTab === 'locations') {
      const parsed = locationSchema.parse(values);
      await createLocation({
        name: parsed.name,
        parentId: parsed.parentId || null,
        organizationId: parsed.organizationId || null
      });
    } else {
      const parsed = statusSchema.parse(values);
      await createStatusCatalog({
        name: parsed.name,
        code: parsed.code,
        isTerminal: parsed.isTerminal ?? false,
        color: parsed.color?.trim() || null
      });
    }

    toast.success($_('common.createSuccess'));
    await loadCatalogData();
  }

  async function updateCurrent(values: Record<string, unknown>) {
    if (!editingItem) return;
    const id = String(editingItem.id);

    if (activeTab === 'categories') {
      const parsed = categorySchema.parse(values);
      await updateCategory(id, { name: parsed.name });
    } else if (activeTab === 'vendors') {
      const parsed = vendorSchema.parse(values);
      await updateVendor(id, {
        name: parsed.name,
        taxCode: parsed.taxCode?.trim() || null,
        phone: parsed.phone?.trim() || null,
        email: parsed.email?.trim() || null,
        address: parsed.address?.trim() || null
      });
    } else if (activeTab === 'models') {
      const parsed = modelSchema.parse(values);
      await updateModel(id, {
        model: parsed.name,
        brand: parsed.brand?.trim() || null,
        categoryId: parsed.categoryId || null,
        vendorId: parsed.vendorId || null,
        spec: parsed.notes?.trim() ? { notes: parsed.notes.trim() } : {}
      });
    } else if (activeTab === 'locations') {
      const parsed = locationSchema.parse(values);
      await updateLocation(id, {
        name: parsed.name,
        parentId: parsed.parentId || null,
        organizationId: parsed.organizationId || null
      });
    } else {
      const parsed = statusSchema.parse(values);
      await updateStatusCatalog(id, {
        name: parsed.name,
        code: parsed.code,
        isTerminal: parsed.isTerminal ?? false,
        color: parsed.color?.trim() || null
      });
    }

    toast.success($_('common.updateSuccess'));
    await loadCatalogData();
  }

  async function deleteCurrent() {
    if (!deletingItem) return;
    const id = String(deletingItem.id);

    if (activeTab === 'categories') {
      await deleteCategory(id);
    } else if (activeTab === 'vendors') {
      await deleteVendor(id);
    } else if (activeTab === 'models') {
      await deleteModel(id);
    } else if (activeTab === 'locations') {
      await deleteLocation(id);
    } else {
      await deleteStatusCatalog(id);
    }

    toast.success($_('common.deleteSuccess'));
    deleteOpen = false;
    deletingItem = null;
    await loadCatalogData();
  }

  onMount(() => {
    void loadCatalogData();
  });
</script>

<div class="page-shell page-content">
  <PageHeader title={$isLoading ? 'Asset Catalogs' : $_('catalogs.pageTitle')} subtitle={`${currentRows.length} ${$isLoading ? 'records' : $_('common.records')}`}>
    {#snippet actions()}
      {#if activeTab !== 'models'}
      <Button variant="primary" size="sm" data-testid="btn-create" onclick={() => (createOpen = true)}>
        {#snippet leftIcon()}
          <Plus class="h-3.5 w-3.5" />
        {/snippet}
        {$isLoading ? 'Create' : $_('common.create')}
      </Button>
      {/if}
      <Button variant="secondary" size="sm" data-testid="btn-refresh" onclick={() => loadCatalogData()}>
        {#snippet leftIcon()}
          <RefreshCw class="h-3.5 w-3.5" />
        {/snippet}
        {$isLoading ? 'Refresh' : $_('common.refresh')}
      </Button>
    {/snippet}
  </PageHeader>

  <Tabs>
    <TabsList>
      {#each Object.keys(tabLabels) as tabKey}
        {@const tab = tabKey as CatalogTab}
        <TabsTrigger 
          active={activeTab === tab}
          onclick={() => {
            activeTab = tab;
            editingItem = null;
            deletingItem = null;
          }}
        >
          {tabLabels[tab]}
        </TabsTrigger>
      {/each}
    </TabsList>
  </Tabs>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if activeTab === 'models'}
    {#if loading}
      <Skeleton rows={5} />
    {:else}
      <ModelCatalog
        models={models}
        categories={categories}
        vendors={vendors}
        onupdated={loadCatalogData}
        onerror={(msg) => { error = msg; }}
      />
    {/if}
  {:else if loading}
    <Skeleton rows={5} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          {#if activeTab === 'categories'}
            <TableHeaderCell>{$isLoading ? 'Category Name' : $_('catalogs.header.categoryName')}</TableHeaderCell>
            <TableHeaderCell>Parent</TableHeaderCell>
          {:else if activeTab === 'vendors'}
            <TableHeaderCell>{$isLoading ? 'Name' : $_('common.name')}</TableHeaderCell>
            <TableHeaderCell>Tax Code</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
          {:else if activeTab === 'locations'}
            <TableHeaderCell>{$isLoading ? 'Location Name' : $_('catalogs.header.locationName')}</TableHeaderCell>
            <TableHeaderCell>Parent</TableHeaderCell>
            <TableHeaderCell>Path</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Organization (OU)' : $_('catalogs.header.organization')}</TableHeaderCell>
          {:else}
            <TableHeaderCell>{$isLoading ? 'Name' : $_('common.name')}</TableHeaderCell>
            <TableHeaderCell>Code</TableHeaderCell>
            <TableHeaderCell>Terminal</TableHeaderCell>
            <TableHeaderCell>Color</TableHeaderCell>
          {/if}
          <TableHeaderCell align="right">{$isLoading ? 'Actions' : $_('common.actions')}</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <tbody>
        {#if currentRows.length === 0}
          <TableRow>
            <TableCell class="py-6 text-center text-slate-500" colspan={6}>
              {$isLoading ? 'No data' : $_('common.noData')}
            </TableCell>
          </TableRow>
        {:else}
          {#each currentRows as row}
            {@const rowAny = row as any}
            <TableRow>
              {#if activeTab === 'categories'}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell>-</TableCell>
              {:else if activeTab === 'vendors'}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell>{rowAny.taxCode ?? '-'}</TableCell>
                <TableCell>{rowAny.phone ?? '-'}</TableCell>
                <TableCell>{rowAny.email ?? '-'}</TableCell>
              {:else if activeTab === 'locations'}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell>{locations.find((item) => item.id === rowAny.parentId)?.name ?? '-'}</TableCell>
                <TableCell>{rowAny.path}</TableCell>
                <TableCell class="text-slate-400">{rowAny.organizationName ?? '-'}</TableCell>
              {:else}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell class="font-mono text-xs">{rowAny.code}</TableCell>
                <TableCell>{rowAny.isTerminal ? 'Yes' : 'No'}</TableCell>
                <TableCell>{rowAny.color ?? '-'}</TableCell>
              {/if}
              <TableCell align="right">
                <div class="flex justify-end gap-2">
                  {#if activeTab === 'categories'}
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid={`row-specs-${getRowId(rowAny)}`}
                      onclick={() => openSpecPanel(rowAny as AssetCategory)}
                    >
                      {#snippet leftIcon()}
                        <Settings class="h-3 w-3" />
                      {/snippet}
                      Spec
                    </Button>
                  {/if}
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`row-edit-${getRowId(rowAny)}`}
                    onclick={() => {
                      editingItem = rowAny as Record<string, unknown>;
                      editOpen = true;
                    }}
                  >
                    {#snippet leftIcon()}
                      <Edit class="h-3 w-3" />
                    {/snippet}
                    {$isLoading ? 'Edit' : $_('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    data-testid={`row-delete-${getRowId(rowAny)}`}
                    onclick={() => {
                      deletingItem = rowAny as Record<string, unknown>;
                      deleteOpen = true;
                    }}
                  >
                    {#snippet leftIcon()}
                      <Trash2 class="h-3 w-3" />
                    {/snippet}
                    {$isLoading ? 'Delete' : $_('common.delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </tbody>
    </Table>
  {/if}
</div>

<CreateEditModal
  bind:open={createOpen}
  mode="create"
  title={$isLoading ? `Create ${tabLabels[activeTab]}` : $_('catalogs.createTitle', { values: { entity: tabLabels[activeTab] } })}
  schema={currentSchema}
  initialValues={getCreateValues(activeTab)}
  onSubmit={createCurrent}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    {#if activeTab === 'categories'}
      <TextField id="category-name-create" label={$isLoading ? 'Category Name' : $_('catalogs.field.categoryName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="category-parent-create" label={$isLoading ? 'Parent Category' : $_('catalogs.field.parentCategory')} value={String(values.parentId ?? '')} options={categoryOptions} placeholder={$isLoading ? 'No parent category' : $_('catalogs.placeholder.noParentCategory')} onValueChange={(v) => setValue('parentId', v)} disabled={disabled} />
    {:else if activeTab === 'vendors'}
      <TextField id="vendor-name-create" label={$isLoading ? 'Vendor Name' : $_('catalogs.field.vendorName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="vendor-tax-create" label="Tax Code" value={String(values.taxCode ?? '')} onValueChange={(v) => setValue('taxCode', v)} disabled={disabled} />
      <TextField id="vendor-phone-create" label="Phone" value={String(values.phone ?? '')} onValueChange={(v) => setValue('phone', v)} disabled={disabled} />
      <TextField id="vendor-email-create" label="Email" type="email" value={String(values.email ?? '')} onValueChange={(v) => setValue('email', v)} disabled={disabled} />
      <TextareaField id="vendor-address-create" label="Address" value={String(values.address ?? '')} onValueChange={(v) => setValue('address', v)} disabled={disabled} />
    {:else if activeTab === 'models'}
      <TextField id="model-name-create" label={$isLoading ? 'Model Name' : $_('catalogs.field.modelName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="model-brand-create" label="Brand" value={String(values.brand ?? '')} onValueChange={(v) => setValue('brand', v)} disabled={disabled} />
      <SelectField id="model-category-create" label={$isLoading ? 'Category' : $_('catalogs.field.category')} required value={String(values.categoryId ?? '')} options={categoryOptions} placeholder={$isLoading ? 'Select category' : $_('catalogs.placeholder.selectCategory')} error={errors.categoryId} onValueChange={(v) => setValue('categoryId', v)} disabled={disabled} />
      <SelectField id="model-vendor-create" label={$isLoading ? 'Vendor' : $_('catalogs.field.vendor')} value={String(values.vendorId ?? '')} options={vendorOptions} placeholder={$isLoading ? 'Select vendor' : $_('catalogs.placeholder.selectVendor')} onValueChange={(v) => setValue('vendorId', v)} disabled={disabled} />
      <TextareaField id="model-notes-create" label="Notes/Specs" value={String(values.notes ?? '')} onValueChange={(v) => setValue('notes', v)} disabled={disabled} />
    {:else if activeTab === 'locations'}
      <TextField id="location-name-create" label={$isLoading ? 'Location Name' : $_('catalogs.field.locationName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="location-parent-create" label={$isLoading ? 'Parent Location' : $_('catalogs.field.parentLocation')} value={String(values.parentId ?? '')} options={locationOptions} placeholder={$isLoading ? 'No parent location' : $_('catalogs.placeholder.noParentLocation')} onValueChange={(v) => setValue('parentId', v)} disabled={disabled} />
      {#if organizations.length > 0}
      <SelectField id="location-org-create" label={$isLoading ? 'Organization (OU)' : $_('catalogs.field.locationOrganization')} value={String(values.organizationId ?? '')} options={orgOptions} placeholder={$isLoading ? 'No organization' : $_('catalogs.placeholder.noOrganization')} onValueChange={(v) => setValue('organizationId', v)} disabled={disabled} />
      {/if}
    {:else}
      <TextField id="status-name-create" label={$isLoading ? 'Status Name' : $_('catalogs.field.statusName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="status-code-create" label={$isLoading ? 'Status Code' : $_('catalogs.field.statusCode')} required value={String(values.code ?? '')} error={errors.code} onValueChange={(v) => setValue('code', v)} disabled={disabled} />
      <div class="space-y-1">
        <label class="flex items-center gap-2 text-sm font-medium text-slate-300">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" checked={Boolean(values.isTerminal)} disabled={disabled} onchange={(event) => setValue('isTerminal', (event.currentTarget as HTMLInputElement).checked)} />
          {$isLoading ? 'Terminal status' : $_('catalogs.field.isTerminal')}
        </label>
      </div>
      <TextField id="status-color-create" label={$isLoading ? 'Color' : $_('catalogs.field.color')} value={String(values.color ?? '')} onValueChange={(v) => setValue('color', v)} disabled={disabled} />
    {/if}
  {/snippet}
</CreateEditModal>

<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title={$isLoading ? `Edit ${tabLabels[activeTab]}` : $_('catalogs.editTitle', { values: { entity: tabLabels[activeTab] } })}
  schema={currentSchema}
  initialValues={getEditValues(activeTab, editingItem)}
  onSubmit={updateCurrent}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    {#if activeTab === 'categories'}
      <TextField id="category-name-edit" label={$isLoading ? 'Category Name' : $_('catalogs.field.categoryName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="category-parent-edit" label={$isLoading ? 'Parent Category' : $_('catalogs.field.parentCategory')} value={String(values.parentId ?? '')} options={categoryOptions} placeholder={$isLoading ? 'No parent category' : $_('catalogs.placeholder.noParentCategory')} onValueChange={(v) => setValue('parentId', v)} disabled={disabled} />
    {:else if activeTab === 'vendors'}
      <TextField id="vendor-name-edit" label={$isLoading ? 'Vendor Name' : $_('catalogs.field.vendorName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="vendor-tax-edit" label="Tax Code" value={String(values.taxCode ?? '')} onValueChange={(v) => setValue('taxCode', v)} disabled={disabled} />
      <TextField id="vendor-phone-edit" label="Phone" value={String(values.phone ?? '')} onValueChange={(v) => setValue('phone', v)} disabled={disabled} />
      <TextField id="vendor-email-edit" label="Email" type="email" value={String(values.email ?? '')} onValueChange={(v) => setValue('email', v)} disabled={disabled} />
      <TextareaField id="vendor-address-edit" label="Address" value={String(values.address ?? '')} onValueChange={(v) => setValue('address', v)} disabled={disabled} />
    {:else if activeTab === 'models'}
      <TextField id="model-name-edit" label={$isLoading ? 'Model Name' : $_('catalogs.field.modelName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="model-brand-edit" label="Brand" value={String(values.brand ?? '')} onValueChange={(v) => setValue('brand', v)} disabled={disabled} />
      <SelectField id="model-category-edit" label={$isLoading ? 'Category' : $_('catalogs.field.category')} required value={String(values.categoryId ?? '')} options={categoryOptions} placeholder={$isLoading ? 'Select category' : $_('catalogs.placeholder.selectCategory')} error={errors.categoryId} onValueChange={(v) => setValue('categoryId', v)} disabled={disabled} />
      <SelectField id="model-vendor-edit" label={$isLoading ? 'Vendor' : $_('catalogs.field.vendor')} value={String(values.vendorId ?? '')} options={vendorOptions} placeholder={$isLoading ? 'Select vendor' : $_('catalogs.placeholder.selectVendor')} onValueChange={(v) => setValue('vendorId', v)} disabled={disabled} />
      <TextareaField id="model-notes-edit" label="Notes/Specs" value={String(values.notes ?? '')} onValueChange={(v) => setValue('notes', v)} disabled={disabled} />
    {:else if activeTab === 'locations'}
      <TextField id="location-name-edit" label={$isLoading ? 'Location Name' : $_('catalogs.field.locationName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="location-parent-edit" label={$isLoading ? 'Parent Location' : $_('catalogs.field.parentLocation')} value={String(values.parentId ?? '')} options={locationOptions} placeholder={$isLoading ? 'No parent location' : $_('catalogs.placeholder.noParentLocation')} onValueChange={(v) => setValue('parentId', v)} disabled={disabled} />
      {#if organizations.length > 0}
      <SelectField id="location-org-edit" label={$isLoading ? 'Organization (OU)' : $_('catalogs.field.locationOrganization')} value={String(values.organizationId ?? '')} options={orgOptions} placeholder={$isLoading ? 'No organization' : $_('catalogs.placeholder.noOrganization')} onValueChange={(v) => setValue('organizationId', v)} disabled={disabled} />
      {/if}
    {:else}
      <TextField id="status-name-edit" label={$isLoading ? 'Status Name' : $_('catalogs.field.statusName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="status-code-edit" label={$isLoading ? 'Status Code' : $_('catalogs.field.statusCode')} required value={String(values.code ?? '')} error={errors.code} onValueChange={(v) => setValue('code', v)} disabled={disabled} />
      <div class="space-y-1">
        <label class="flex items-center gap-2 text-sm font-medium text-slate-300">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" checked={Boolean(values.isTerminal)} disabled={disabled} onchange={(event) => setValue('isTerminal', (event.currentTarget as HTMLInputElement).checked)} />
          {$isLoading ? 'Terminal status' : $_('catalogs.field.isTerminal')}
        </label>
      </div>
      <TextField id="status-color-edit" label={$isLoading ? 'Color' : $_('catalogs.field.color')} value={String(values.color ?? '')} onValueChange={(v) => setValue('color', v)} disabled={disabled} />
    {/if}
  {/snippet}
</CreateEditModal>

<DeleteConfirmModal
  bind:open={deleteOpen}
  entityName={getRowName(deletingItem ?? {})}
  onConfirm={deleteCurrent}
/>

<CategorySpecPanel
  bind:open={showSpecPanel}
  category={specPanelCategory}
  onupdated={loadCatalogData}
/>
