<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { AssetCreateInput, AssetStatus } from '$lib/api/assets';
  import type { AssetModel, CategorySpecDef } from '$lib/api/assetCatalogs';
  import { getCategorySpecDefs } from '$lib/api/assetCatalogs';
  import DynamicSpecForm from '$lib/assets/components/catalogs/DynamicSpecForm.svelte';
  import { _, isLoading } from '$lib/i18n';

  let {
    open = $bindable(false),
    models = [],
    vendors = [],
    locations = [],
    error = '',
    oncreate
  } = $props<{
    open?: boolean;
    models?: AssetModel[];
    vendors?: Array<{ id: string; name: string }>;
    locations?: Array<{ id: string; name: string }>;
    error?: string;
    oncreate?: (data: AssetCreateInput) => void;
  }>();

  let form = $state({
    assetCode: '',
    modelId: '',
    status: 'in_stock' as AssetStatus,
    vendorId: '',
    locationId: '',
    serialNo: '',
    macAddress: '',
    mgmtIp: '',
    hostname: '',
    notes: '',
    spec: {} as Record<string, unknown>
  });

  let selectedModel = $state<AssetModel | null>(null);
  let specDefs = $state<CategorySpecDef[]>([]);
  let specLoading = $state(false);
  let specError = $state('');
  const safeModels = $derived(Array.isArray(models) ? models.filter((item): item is AssetModel => Boolean(item)) : []);
  const safeVendors = $derived(Array.isArray(vendors) ? vendors.filter((item): item is { id: string; name: string } => Boolean(item)) : []);
  const safeLocations = $derived(Array.isArray(locations) ? locations.filter((item): item is { id: string; name: string } => Boolean(item)) : []);

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

  function reset() {
    form = {
      assetCode: '',
      modelId: '',
      status: 'in_stock',
      vendorId: '',
      locationId: '',
      serialNo: '',
      macAddress: '',
      mgmtIp: '',
      hostname: '',
      notes: '',
      spec: {}
    };
    selectedModel = null;
    specDefs = [];
    specError = '';
  }

  $effect(() => {
    if (!open) reset();
  });

  function submit() {
    oncreate?.({
      assetCode: form.assetCode,
      modelId: form.modelId,
      status: form.status,
      vendorId: form.vendorId || undefined,
      locationId: form.locationId || undefined,
      serialNo: form.serialNo || undefined,
      macAddress: form.macAddress || undefined,
      mgmtIp: form.mgmtIp || undefined,
      hostname: form.hostname || undefined,
      notes: form.notes || undefined,
      spec: Object.keys(form.spec).length > 0 ? form.spec : undefined
    });
  }

  $effect(() => {
    const modelId = form.modelId;
    if (!modelId) {
      selectedModel = null;
      specDefs = [];
      specError = '';
      return;
    }
    const model = safeModels.find((m: AssetModel) => m.id === modelId);
    if (!model) {
      selectedModel = null;
      specDefs = [];
      return;
    }
    selectedModel = model;
    // Load spec from model as default
    form.spec = { ...(model.spec || {}) };
    // Load spec definitions if category exists
    if (model.categoryId) {
      loadSpecDefs(model.categoryId);
    } else {
      specDefs = [];
    }
  });
</script>

<Modal bind:open title="{$isLoading ? 'Create Asset' : $_('assets.createAsset')}" size="lg">

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  <div class="space-y-4">
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Asset Code' : $_('assets.assetCode')}</label>
      <input class="input-base" bind:value={form.assetCode} placeholder="ASSET-001" />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Model' : $_('assets.model')}</label>
      <select class="select-base" bind:value={form.modelId}>
        <option value="">{$isLoading ? 'Select model' : $_('assets.selectModel')}</option>
        {#each safeModels as model}
          <option value={model.id}>{[model.brand, model.model].filter(Boolean).join(' ') || model.model}</option>
        {/each}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Status' : $_('assets.status')}</label>
        <select class="select-base" bind:value={form.status}>
          <option value="in_stock">{$isLoading ? 'In stock' : $_('assets.filters.inStock')}</option>
          <option value="in_use">{$isLoading ? 'In use' : $_('assets.filters.inUse')}</option>
          <option value="in_repair">{$isLoading ? 'In repair' : $_('assets.filters.inRepair')}</option>
          <option value="retired">{$isLoading ? 'Retired' : $_('assets.filters.retired')}</option>
          <option value="disposed">{$isLoading ? 'Disposed' : $_('assets.filters.disposed')}</option>
          <option value="lost">{$isLoading ? 'Lost' : $_('assets.filters.lost')}</option>
        </select>
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Location' : $_('assets.location')}</label>
        <select class="select-base" bind:value={form.locationId}>
          <option value="">{$isLoading ? 'Select location' : $_('assets.selectLocation')}</option>
          {#each safeLocations as location}
            <option value={location.id}>{location.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Vendor' : $_('assets.vendor')}</label>
        <select class="select-base" bind:value={form.vendorId}>
          <option value="">{$isLoading ? 'Select vendor' : $_('assets.selectVendor')}</option>
          {#each safeVendors as vendor}
            <option value={vendor.id}>{vendor.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Serial No' : $_('assets.serialNo')}</label>
        <input class="input-base" bind:value={form.serialNo} />
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Hostname' : $_('assets.hostname')}</label>
        <input class="input-base" bind:value={form.hostname} />
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Management IP' : $_('assets.managementIp')}</label>
        <input class="input-base" bind:value={form.mgmtIp} />
      </div>
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'MAC Address' : $_('assets.macAddress')}</label>
      <input class="input-base" bind:value={form.macAddress} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Notes' : $_('assets.notes')}</label>
      <input class="input-base" bind:value={form.notes} />
    </div>
    
    {#if selectedModel && selectedModel.categoryId}
      <div class="border-t pt-4 mt-4">
        <h4 class="text-sm font-semibold mb-3">{$isLoading ? 'Specifications' : $_('assets.specifications')}</h4>
        {#if specLoading}
          <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
        {:else if specError}
          <div class="alert alert-warning text-sm">{specError}</div>
        {:else if specDefs.length > 0}
          <DynamicSpecForm bind:spec={form.spec} {specDefs} />
        {:else}
          <p class="text-sm text-slate-500">{$isLoading ? 'No specifications defined' : $_('assets.noSpecifications')}</p>
        {/if}
      </div>
    {/if}
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => open = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={submit} disabled={!form.assetCode || !form.modelId}>{$isLoading ? 'Create' : $_('common.create')}</Button>
      </div>
  {/snippet}
</Modal>

