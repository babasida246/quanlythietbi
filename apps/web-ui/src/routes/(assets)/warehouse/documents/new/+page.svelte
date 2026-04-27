<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import StockDocumentLines from '$lib/warehouse/StockDocumentLines.svelte';
  import {
    createStockDocument,
    listSpareParts,
    listWarehouses,
    listStockAssets,
    listOrgUnits,
    type SparePartRecord,
    type StockDocumentLine,
    type WarehouseRecord,
    type WarehouseAssetOption,
    type OrgUnitOption
  } from '$lib/api/warehouse';
  import { getAssetCatalogs, listLocations, type Vendor, type Location, type CategoryItemType, type AssetCategory } from '$lib/api/assetCatalogs';
  import { listEquipmentGroups, type EquipmentGroup } from '$lib/api/equipmentGroups';

  type ModelOption = { id: string; name: string; categoryName?: string | null; categoryItemType?: CategoryItemType | null };

  let warehouses       = $state<WarehouseRecord[]>([]);
  let parts            = $state<SparePartRecord[]>([]);
  let vendors          = $state<Vendor[]>([]);
  let locations        = $state<Location[]>([]);
  let models           = $state<ModelOption[]>([]);
  let warehouseAssets  = $state<WarehouseAssetOption[]>([]);
  let orgUnits         = $state<OrgUnitOption[]>([]);
  let equipmentGroups  = $state<EquipmentGroup[]>([]);
  let assetCats        = $state<AssetCategory[]>([]);
  let lines            = $state<StockDocumentLine[]>([]);

  let loading  = $state(true);
  let saving   = $state(false);
  let error    = $state('');

  let docType          = $state<'receipt' | 'issue' | 'adjust' | 'transfer' | 'return'>('receipt');
  let equipmentGroupId = $state('');
  let warehouseId      = $state('');
  let targetWarehouseId= $state('');
  let locationId       = $state('');
  let docDate          = $state(new Date().toISOString().slice(0, 10));
  let note             = $state('');
  let supplier         = $state('');
  let submitterName    = $state('');
  let receiverName     = $state('');
  let recipientOuId    = $state('');

  async function loadCatalogs() {
    try {
      loading = true;
      const [warehousesRes, partsRes, catalogsRes, locationsRes, orgUnitsRes, eqGroupsRes] = await Promise.all([
        listWarehouses(),
        listSpareParts({ page: 1, limit: 200 }),
        getAssetCatalogs(),
        listLocations(),
        listOrgUnits(),
        listEquipmentGroups(true)
      ]);
      warehouses      = warehousesRes.data ?? [];
      parts           = partsRes.data ?? [];
      vendors         = catalogsRes.data?.vendors ?? [];
      locations       = locationsRes.data ?? [];
      orgUnits        = orgUnitsRes.data ?? [];
      equipmentGroups = eqGroupsRes ?? [];
      const allCats = catalogsRes.data?.categories ?? [];
      const categoryById = Object.fromEntries(allCats.map(c => [c.id, c]));
      assetCats = allCats.filter(c => !c.itemType || c.itemType === 'asset');
      models = (catalogsRes.data?.models ?? []).map(m => {
        const cat = m.categoryId ? categoryById[m.categoryId] : null;
        return { id: m.id, name: m.model, categoryName: cat?.name ?? null, categoryItemType: cat?.itemType ?? 'asset' };
      });
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadCatalogsFailed');
    } finally {
      loading = false;
    }
  }

  // Reload in-stock assets when warehouse or docType changes
  $effect(() => {
    if (warehouseId && (docType === 'issue' || docType === 'transfer' || docType === 'return')) {
      listStockAssets(warehouseId).then(r => { warehouseAssets = r; }).catch(() => {});
    } else {
      warehouseAssets = [];
    }
  });

  function validateLines(): string {
    for (const l of lines) {
      if (l.lineType === 'asset') {
        if ((docType === 'issue' || docType === 'transfer') && !l.assetId) {
          return $_('warehouse.errors.missingAssetId');
        }
        if (docType === 'receipt' && !l.assetModelId) {
          return $_('warehouse.errors.missingAssetModel');
        }
      } else {
        if (!l.partId) return $_('warehouse.errors.missingCodeOrPart');
      }
    }
    return '';
  }

  async function submit() {
    if (!warehouseId) { error = $_('warehouse.errors.missingWarehouse'); return; }
    if (lines.length === 0) { error = $_('warehouse.errors.atLeastOneLine'); return; }
    const lineErr = validateLines();
    if (lineErr) { error = lineErr; return; }
    try {
      saving = true;
      error  = '';
      const response = await createStockDocument({
        docType,
        equipmentGroupId: equipmentGroupId || null,
        warehouseId: warehouseId || null,
        targetWarehouseId: docType === 'transfer' ? (targetWarehouseId || null) : null,
        locationId: docType === 'issue' ? (locationId || null) : null,
        docDate,
        note: note || null,
        supplier: supplier || null,
        submitterName: submitterName || null,
        receiverName: receiverName || null,
        recipientOuId: recipientOuId || null,
        lines
      });
      await goto(`/warehouse/documents/${response.data.document.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.createDocumentFailed');
    } finally {
      saving = false;
    }
  }

  $effect(() => { void loadCatalogs(); });
</script>

<div class="space-y-0">
  <!-- ── Top action bar ─────────────────────────────────────────────────── -->
  <div class="mb-4 flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-100">{$isLoading ? 'New Document' : $_('warehouse.newDocument')}</h2>
      <p class="text-xs text-slate-500">{$isLoading ? 'Create a new warehouse document...' : $_('warehouse.newDocumentHint')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => goto('/warehouse/documents')}>{$isLoading ? 'Cancel' : $_('warehouse.action.cancel')}</Button>
      <Button disabled={saving} onclick={submit}>
        {saving ? '...' : $isLoading ? 'Save Document' : $_('warehouse.saveDocument')}
      </Button>
    </div>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg border border-red-700 bg-red-900/20 px-4 py-2.5 text-sm text-red-400">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <!-- ── Header form ─────────────────────────────────────────────────── -->
    <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">

        <!-- Loại phiếu -->
        <div>
          <label for="new-doc-type" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Document Type' : $_('warehouse.field.docType')} <span class="text-red-400">*</span></label>
          <select id="new-doc-type" class="select-base text-sm" bind:value={docType}>
            <option value="receipt">{$isLoading ? 'Receipt' : $_('warehouse.docType.receipt')}</option>
            <option value="issue">{$isLoading ? 'Issue' : $_('warehouse.docType.issue')}</option>
            <option value="return">{$isLoading ? 'Return' : $_('warehouse.docType.return')}</option>
            <option value="adjust">{$isLoading ? 'Adjustment' : $_('warehouse.docType.adjust')}</option>
            <option value="transfer">{$isLoading ? 'Transfer' : $_('warehouse.docType.transfer')}</option>
          </select>
        </div>

        <!-- Nhóm vật tư -->
        <div>
          <label for="new-doc-item-group" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Item Group' : $_('warehouse.itemGroup.label')}</label>
          <select id="new-doc-item-group" class="select-base text-sm" bind:value={equipmentGroupId}>
            <option value="">{$isLoading ? '-- All groups --' : $_('warehouse.itemGroup.placeholder')}</option>
            {#each equipmentGroups as eg}
              <option value={eg.id}>{eg.name}</option>
            {/each}
          </select>
        </div>

        <!-- Ngày lập -->
        <div>
          <label for="new-doc-date" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Date' : $_('warehouse.field.docDate')} <span class="text-red-400">*</span></label>
          <input id="new-doc-date" class="input-base text-sm" type="date" bind:value={docDate} />
        </div>

        <!-- Kho nguồn -->
        <div>
          <label for="new-doc-warehouse" class="mb-1 block text-xs font-medium text-slate-400">
            {docType === 'transfer' || docType === 'issue' ? ($isLoading ? 'Source Warehouse' : $_('warehouse.field.sourceWarehouse')) : ($isLoading ? 'Warehouse' : $_('warehouse.field.warehouse'))} <span class="text-red-400">*</span>
          </label>
          <select id="new-doc-warehouse" class="select-base text-sm" bind:value={warehouseId}>
            <option value="">{$isLoading ? '-- Select --' : $_('warehouse.field.selectWarehouse')}</option>
            {#each warehouses as wh}
              <option value={wh.id}>{wh.name} ({wh.code})</option>
            {/each}
          </select>
        </div>

        <!-- Kho đích (transfer only) -->
        {#if docType === 'transfer'}
          <div>
            <label for="new-doc-target" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Dest. Warehouse' : $_('warehouse.field.destWarehouse')} <span class="text-red-400">*</span></label>
            <select id="new-doc-target" class="select-base text-sm" bind:value={targetWarehouseId}>
              <option value="">{$isLoading ? '-- Select --' : $_('warehouse.field.selectDestWarehouse')}</option>
              {#each warehouses as wh}
                <option value={wh.id}>{wh.name} ({wh.code})</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- receipt: Nhà CC + Người nhập -->
        {#if docType === 'receipt'}
          <div>
            <label for="new-doc-supplier" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Supplier' : $_('warehouse.field.supplier')}</label>
            <select id="new-doc-supplier" class="select-base text-sm" bind:value={supplier}>
              <option value="">{$isLoading ? '-- Select Supplier --' : $_('warehouse.field.selectSupplier')}</option>
              {#each vendors as v}
                <option value={v.name}>{v.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="new-doc-submitter" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Submitter' : $_('warehouse.field.submitter')}</label>
            <input id="new-doc-submitter" class="input-base text-sm" bind:value={submitterName} placeholder={$isLoading ? 'Submitter name...' : $_('warehouse.field.submitterPlaceholder')} />
          </div>
        {/if}

        <!-- issue: Người nhận + Nơi nhận (OU) + Vị trí nhận -->
        {#if docType === 'issue'}
          <div>
            <label for="new-doc-receiver" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Receiver' : $_('warehouse.field.receiver')}</label>
            <input id="new-doc-receiver" class="input-base text-sm" bind:value={receiverName} placeholder={$isLoading ? 'Receiver name...' : $_('warehouse.field.receiverPlaceholder')} />
          </div>
          <div>
            <label for="new-doc-ou" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Recipient' : $_('warehouse.field.department')}</label>
            <select id="new-doc-ou" class="select-base text-sm" bind:value={recipientOuId}>
              <option value="">{$isLoading ? '-- No recipient --' : $_('warehouse.field.noRecipientOu')}</option>
              {#each orgUnits as ou}
                <option value={ou.id} style="padding-left: {ou.depth * 12}px">{'　'.repeat(ou.depth)}{ou.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="new-doc-location" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Receiving Location' : $_('warehouse.field.receivingLocation')}</label>
            <select id="new-doc-location" class="select-base text-sm" bind:value={locationId}>
              <option value="">{$isLoading ? '-- No location --' : $_('warehouse.field.noLocation')}</option>
              {#each locations as loc}
                <option value={loc.id}>{loc.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- return: Người trả + Kho thu hồi -->
        {#if docType === 'return'}
          <div>
            <label for="new-doc-returned-by" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Returned By' : $_('warehouse.field.returnedBy')}</label>
            <input id="new-doc-returned-by" class="input-base text-sm" bind:value={submitterName} placeholder={$isLoading ? 'Person returning...' : $_('warehouse.field.returnedByPlaceholder')} />
          </div>
          <div>
            <label for="new-doc-ou-return" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Department' : $_('warehouse.field.department')}</label>
            <select id="new-doc-ou-return" class="select-base text-sm" bind:value={recipientOuId}>
              <option value="">{$isLoading ? '-- No department --' : $_('warehouse.field.noRecipientOu')}</option>
              {#each orgUnits as ou}
                <option value={ou.id}>{'　'.repeat(ou.depth)}{ou.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- adjust / transfer: Nơi nhận + Người thực hiện -->
        {#if docType === 'adjust' || docType === 'transfer'}
          <div>
            <label for="new-doc-ou2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Recipient' : $_('warehouse.field.department')}</label>
            <select id="new-doc-ou2" class="select-base text-sm" bind:value={recipientOuId}>
              <option value="">{$isLoading ? '-- No recipient --' : $_('warehouse.field.noRecipientOu')}</option>
              {#each orgUnits as ou}
                <option value={ou.id}>{'　'.repeat(ou.depth)}{ou.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="new-doc-submitter2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Executor' : $_('warehouse.field.executor')}</label>
            <input id="new-doc-submitter2" class="input-base text-sm" bind:value={submitterName} placeholder={$isLoading ? 'Executor name...' : $_('warehouse.field.executorPlaceholder')} />
          </div>
        {/if}

        <!-- Ghi chú -->
        <div style="grid-column: span 2">
          <label for="new-doc-note" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Notes' : $_('common.note')}</label>
          <input id="new-doc-note" class="input-base text-sm" bind:value={note} placeholder={$isLoading ? 'Enter notes...' : $_('common.notePlaceholder')} />
        </div>
      </div>
    </div>

    <!-- ── Lines section ─────────────────────────────────────────────────── -->
    <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
      <div class="mb-3 flex items-center gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">{$isLoading ? 'Item Lines' : $_('warehouse.linesHeading')}</h3>
      </div>
      <StockDocumentLines bind:lines {parts} {models} assetCategories={assetCats} {warehouseAssets} {docType} {warehouseId} />
    </div>

    <!-- ── Bottom action bar ─────────────────────────────────────────────── -->
    <div class="mt-4 flex justify-end gap-2">
      <Button variant="secondary" onclick={() => goto('/warehouse/documents')}>{$isLoading ? 'Cancel' : $_('warehouse.action.cancel')}</Button>
      <Button disabled={saving} onclick={submit}>
        {saving ? '...' : $isLoading ? 'Save Document' : $_('warehouse.saveDocument')}
      </Button>
    </div>
  {/if}
</div>
