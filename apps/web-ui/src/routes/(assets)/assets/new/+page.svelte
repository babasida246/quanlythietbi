<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { ArrowLeft, Printer, CheckCircle } from 'lucide-svelte';
  import { z } from 'zod';
  import { createAsset, type Asset, type AssetStatus } from '$lib/api/assets';
  import {
    getAssetCatalogs,
    getCategorySpecDefs,
    listStatusCatalogs,
    type AssetStatusCatalog,
    type Catalogs,
    type CategorySpecDef,
    type AssetModel
  } from '$lib/api/assetCatalogs';
  import DynamicSpecForm from '$lib/assets/components/catalogs/DynamicSpecForm.svelte';
  import InventoryLabelPrint from '$lib/assets/components/InventoryLabelPrint.svelte';
  import { toast } from '$lib/components/toast';
  import { Button } from '$lib/components/ui';

  const fallbackStatuses: AssetStatusCatalog[] = [
    { id: 'in_stock', name: 'In Stock', code: 'in_stock', isTerminal: false },
    { id: 'in_use', name: 'In Use', code: 'in_use', isTerminal: false },
    { id: 'in_repair', name: 'In Repair', code: 'in_repair', isTerminal: false },
    { id: 'retired', name: 'Retired', code: 'retired', isTerminal: true },
    { id: 'disposed', name: 'Disposed', code: 'disposed', isTerminal: true },
    { id: 'lost', name: 'Lost', code: 'lost', isTerminal: true }
  ];

  // Page state
  let catalogs = $state<Catalogs | null>(null);
  let statuses = $state<AssetStatusCatalog[]>([]);
  let pageLoading = $state(true);
  let saving = $state(false);
  let savedAsset = $state<Asset | null>(null);
  let printOpen = $state(false);

  // Form values
  let name = $state('');
  let assetCode = $state('');
  let categoryId = $state('');
  let modelId = $state('');
  let vendorId = $state('');
  let locationId = $state('');
  let statusCode = $state<AssetStatus>('in_stock');
  let serialNumber = $state('');
  let purchaseDate = $state('');
  let warrantyEnd = $state('');
  let note = $state('');
  let spec = $state<Record<string, unknown>>({});

  // Spec state
  let specDefs = $state<CategorySpecDef[]>([]);
  let specLoading = $state(false);
  let specError = $state('');

  // Validation errors
  let errors = $state<Record<string, string>>({});

  // Derived catalogs
  const safeModels = $derived((catalogs?.models ?? []).filter((m): m is AssetModel => Boolean(m)));
  const filteredModels = $derived(
    categoryId
      ? safeModels.filter((m) => m.categoryId === categoryId)
      : safeModels
  );
  const selectedModel = $derived(safeModels.find((m) => m.id === modelId) ?? null);

  async function loadCatalogs() {
    try {
      pageLoading = true;
      const [catalogRes, statusRes] = await Promise.all([
        getAssetCatalogs(),
        listStatusCatalogs().catch(() => ({ data: [] as AssetStatusCatalog[] }))
      ]);
      catalogs = catalogRes.data ?? null;
      statuses = (statusRes.data ?? []).length > 0 ? statusRes.data : fallbackStatuses;
    } catch {
      toast.error($isLoading ? 'Failed to load catalog data' : $_('assets.errors.loadAssetsFailed'));
    } finally {
      pageLoading = false;
    }
  }

  async function loadSpecDefs(catId: string) {
    specError = '';
    specLoading = true;
    try {
      const res = await getCategorySpecDefs(catId);
      specDefs = res.data;
    } catch {
      specDefs = [];
      specError = $isLoading ? 'Failed to load spec fields' : $_('assets.errors.loadAssetsFailed');
    } finally {
      specLoading = false;
    }
  }

  function onModelChange(newModelId: string) {
    modelId = newModelId;
    const model = safeModels.find((m) => m.id === newModelId);
    if (!model) {
      spec = {};
      specDefs = [];
      return;
    }
    // Auto-fill vendor if model has one
    if (model.vendorId && !vendorId) vendorId = model.vendorId;
    // Pre-fill spec from model defaults
    spec = { ...(model.spec || {}) };
    if (model.categoryId) {
      loadSpecDefs(model.categoryId);
    } else {
      specDefs = [];
    }
  }

  function onCategoryChange(newCatId: string) {
    categoryId = newCatId;
    // Reset model if it doesn't belong to new category
    if (modelId) {
      const model = safeModels.find((m) => m.id === modelId);
      if (model && model.categoryId !== newCatId) {
        modelId = '';
        spec = {};
        specDefs = [];
      }
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = $isLoading ? 'Asset name is required' : $_('assets.validation.nameRequired');
    if (!modelId) errs.modelId = $isLoading ? 'Please select a model' : $_('assets.validation.modelRequired');
    errors = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    saving = true;
    try {
      const generatedCode = `AST-${Date.now().toString().slice(-6)}`;
      const payload = {
        assetCode: assetCode.trim() || generatedCode,
        modelId,
        status: statusCode,
        vendorId: vendorId || undefined,
        locationId: locationId || undefined,
        serialNo: serialNumber.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyEnd: warrantyEnd || undefined,
        notes: note.trim() || undefined,
        hostname: name.trim(),
        spec: Object.keys(spec).length > 0 ? spec : undefined
      };
      const res = await createAsset(payload);
      savedAsset = res.data;
      toast.success($isLoading ? 'Asset created successfully' : $_('assets.toast.createSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ($isLoading ? 'Failed to create asset' : $_('assets.errors.createFailed')));
    } finally {
      saving = false;
    }
  }

  function handlePrintAndDone() {
    printOpen = true;
  }

  function handleDone() {
    goto('/assets');
  }

  function handleCreateAnother() {
    savedAsset = null;
    name = '';
    assetCode = '';
    categoryId = '';
    modelId = '';
    vendorId = '';
    locationId = '';
    statusCode = 'in_stock';
    serialNumber = '';
    purchaseDate = '';
    warrantyEnd = '';
    note = '';
    spec = {};
    specDefs = [];
    errors = {};
  }

  onMount(() => {
    loadCatalogs();
  });
</script>

{#if savedAsset && !printOpen}
  <!-- ──────────────── Success screen ──────────────── -->
  <div class="page-shell page-content">
    <div class="max-w-lg mx-auto mt-16 text-center">
      <div class="flex justify-center mb-4">
        <CheckCircle class="h-16 w-16 text-green-400" />
      </div>
      <h2 class="text-2xl font-bold text-slate-100 mb-2">
        {$isLoading ? 'Asset created!' : $_('assets.createSuccessTitle')}
      </h2>
      <p class="text-slate-400 mb-1">
        {$isLoading ? 'Asset code:' : $_('assets.assetCode')}
        <code class="code-inline ml-1">{savedAsset.assetCode}</code>
      </p>
      {#if savedAsset.hostname}
        <p class="text-slate-400 mb-6">
          {savedAsset.hostname}
        </p>
      {/if}
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="primary" onclick={handlePrintAndDone}>
          {#snippet leftIcon()}<Printer class="h-4 w-4" />{/snippet}
          {$isLoading ? 'Print label' : $_('assets.printLabel')}
        </Button>
        <Button variant="secondary" onclick={handleCreateAnother}>
          {$isLoading ? 'Create another' : $_('assets.createAnother')}
        </Button>
        <Button variant="ghost" onclick={handleDone}>
          {$isLoading ? 'Back to list' : $_('assets.backToList')}
        </Button>
      </div>
    </div>
  </div>
{:else if !savedAsset}
  <!-- ──────────────── Create form ──────────────── -->
  <div class="page-shell page-content">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        type="button"
        class="text-slate-400 hover:text-slate-100 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
        onclick={() => goto('/assets')}
        aria-label={$isLoading ? 'Back' : $_('common.back')}
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div>
        <h1 class="text-lg font-semibold text-slate-100">
          {$isLoading ? 'Create Asset' : $_('assets.createAsset')}
        </h1>
        <p class="text-xs text-slate-400">
          {$isLoading ? 'Fill in the details below. Fields marked * are required.' : $_('assets.createAssetHint')}
        </p>
      </div>
    </div>

    {#if pageLoading}
      <div class="flex items-center justify-center py-16">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    {:else}
      <form
        class="grid grid-cols-1 xl:grid-cols-3 gap-6"
        onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      >
        <!-- Left column: core info + spec -->
        <div class="xl:col-span-2 space-y-6">

          <!-- Basic info card -->
          <div class="card card-body space-y-4">
            <h3 class="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
              {$isLoading ? 'Basic Information' : $_('assets.form.basicInfo')}
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Asset name -->
              <div class="sm:col-span-2">
                <label class="label-base mb-1.5" for="new-name">
                  {$isLoading ? 'Asset name' : $_('assets.assetName')}
                  <span class="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  id="new-name"
                  class="input-base"
                  class:border-red-500={errors.name}
                  bind:value={name}
                  placeholder={$isLoading ? 'e.g. PC-Finance-01' : $_('assets.assetNamePlaceholder')}
                />
                {#if errors.name}
                  <p class="text-xs text-red-400 mt-1">{errors.name}</p>
                {/if}
              </div>

              <!-- Asset code -->
              <div>
                <label class="label-base mb-1.5" for="new-code">
                  {$isLoading ? 'Asset Code' : $_('assets.assetCode')}
                </label>
                <input
                  id="new-code"
                  class="input-base"
                  bind:value={assetCode}
                  placeholder={$isLoading ? 'Auto-generated if empty' : $_('assets.form.autoGenHint')}
                />
              </div>

              <!-- Serial number -->
              <div>
                <label class="label-base mb-1.5" for="new-serial">
                  {$isLoading ? 'Serial Number' : $_('assets.serialNumber')}
                </label>
                <input id="new-serial" class="input-base" bind:value={serialNumber} />
              </div>

              <!-- Purchase date -->
              <div>
                <label class="label-base mb-1.5" for="new-purchase">
                  {$isLoading ? 'Purchase Date' : $_('assets.purchaseDate')}
                </label>
                <input id="new-purchase" type="date" class="input-base" bind:value={purchaseDate} />
              </div>

              <!-- Warranty end -->
              <div>
                <label class="label-base mb-1.5" for="new-warranty">
                  {$isLoading ? 'Warranty End' : $_('assets.warrantyEnd')}
                </label>
                <input id="new-warranty" type="date" class="input-base" bind:value={warrantyEnd} />
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="label-base mb-1.5" for="new-notes">
                {$isLoading ? 'Notes' : $_('assets.form.note')}
              </label>
              <textarea
                id="new-notes"
                class="input-base resize-none"
                rows="3"
                bind:value={note}
              ></textarea>
            </div>
          </div>

          <!-- Spec card (only when model with category is selected) -->
          {#if selectedModel && (specDefs.length > 0 || specLoading)}
            <div class="card card-body space-y-4">
              <h3 class="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
                {$isLoading ? 'Specifications' : $_('assets.specifications')}
                <span class="ml-2 text-xs font-normal text-slate-500">
                  ({$isLoading ? 'from model defaults, can be customized' : $_('assets.specHint')})
                </span>
              </h3>

              {#if specLoading}
                <div class="flex items-center justify-center py-8">
                  <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              {:else if specError}
                <p class="text-sm text-amber-400">{specError}</p>
              {:else}
                <DynamicSpecForm bind:spec {specDefs} />
              {/if}
            </div>
          {/if}
        </div>

        <!-- Right column: catalog selections & actions -->
        <div class="space-y-6">

          <!-- Catalog card -->
          <div class="card card-body space-y-4">
            <h3 class="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
              {$isLoading ? 'Classification' : $_('assets.form.classification')}
            </h3>

            <!-- Category -->
            <div>
              <label class="label-base mb-1.5" for="new-category">
                {$isLoading ? 'Category' : $_('assets.category')}
              </label>
              <select
                id="new-category"
                class="select-base"
                bind:value={categoryId}
                onchange={() => onCategoryChange(categoryId)}
              >
                <option value="">{$isLoading ? 'Select category' : $_('assets.form.selectCategory')}</option>
                {#each catalogs?.categories ?? [] as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>

            <!-- Model -->
            <div>
              <label class="label-base mb-1.5" for="new-model">
                {$isLoading ? 'Model' : $_('assets.model')}
                <span class="text-red-400 ml-0.5">*</span>
              </label>
              <select
                id="new-model"
                class="select-base"
                class:border-red-500={errors.modelId}
                value={modelId}
                onchange={(e) => onModelChange((e.target as HTMLSelectElement).value)}
              >
                <option value="">{$isLoading ? 'Select model' : $_('assets.form.selectModel')}</option>
                {#each filteredModels as m}
                  <option value={m.id}>{[m.brand, m.model].filter(Boolean).join(' ')}</option>
                {/each}
              </select>
              {#if errors.modelId}
                <p class="text-xs text-red-400 mt-1">{errors.modelId}</p>
              {/if}
              {#if selectedModel}
                <p class="text-xs text-slate-500 mt-1">
                  {$isLoading ? 'Spec loaded from model' : $_('assets.specLoadedFromModel')}
                </p>
              {/if}
            </div>

            <!-- Vendor -->
            <div>
              <label class="label-base mb-1.5" for="new-vendor">
                {$isLoading ? 'Vendor' : $_('assets.vendor')}
              </label>
              <select id="new-vendor" class="select-base" bind:value={vendorId}>
                <option value="">{$isLoading ? 'Select vendor' : $_('assets.form.selectVendor')}</option>
                {#each catalogs?.vendors ?? [] as v}
                  <option value={v.id}>{v.name}</option>
                {/each}
              </select>
            </div>

            <!-- Location -->
            <div>
              <label class="label-base mb-1.5" for="new-location">
                {$isLoading ? 'Location' : $_('assets.location')}
              </label>
              <select id="new-location" class="select-base" bind:value={locationId}>
                <option value="">{$isLoading ? 'Select location' : $_('assets.form.selectLocation')}</option>
                {#each catalogs?.locations ?? [] as loc}
                  <option value={loc.id}>{loc.name}</option>
                {/each}
              </select>
            </div>

            <!-- Status -->
            <div>
              <label class="label-base mb-1.5" for="new-status">
                {$isLoading ? 'Status' : $_('assets.status')}
              </label>
              <select id="new-status" class="select-base" bind:value={statusCode}>
                {#each statuses as s}
                  <option value={s.code}>{s.name}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- Actions card -->
          <div class="card card-body">
            <div class="flex flex-col gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                onclick={handleSubmit}
              >
                {saving
                  ? ($isLoading ? 'Saving...' : $_('common.saving'))
                  : ($isLoading ? 'Create Asset' : $_('assets.createAsset'))}
              </Button>
              <Button variant="secondary" disabled={saving} onclick={() => goto('/assets')}>
                {$isLoading ? 'Cancel' : $_('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    {/if}
  </div>
{/if}

<!-- Print label overlay (shown after save when user clicks Print) -->
{#if savedAsset && printOpen}
  <InventoryLabelPrint
    bind:open={printOpen}
    assets={[savedAsset]}
  />
  <!-- After closing print, show success screen again -->
  {#if !printOpen}
    <!-- triggers reactively when printOpen becomes false -->
  {/if}
{/if}
