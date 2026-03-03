<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw, Eye } from 'lucide-svelte';
  import { z } from 'zod';
  import {
    createWarehouse,
    deleteWarehouse,
    listWarehouses,
    listStockView,
    listWarehouseAssets,
    updateWarehouse,
    type WarehouseRecord,
    type StockViewRecord
  } from '$lib/api/warehouse';
  import type { Asset } from '$lib/api/assets';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';

  type WarehouseTab = 'warehouses' | 'stock' | 'assets';

  const tabLabels: Record<WarehouseTab, string> = {
    warehouses: 'Kho hàng',
    stock: 'Tồn kho',
    assets: 'Tài sản trong kho'
  };

  const warehouseSchema = z.object({
    name: z.string().trim().min(1, 'Tên kho là bắt buộc'),
    locationId: z.string().optional()
  });

  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<WarehouseTab>('warehouses');
  let searchQuery = $state('');

  let warehouses = $state<WarehouseRecord[]>([]);
  let stockItems = $state<StockViewRecord[]>([]);
  let stockLoading = $state(false);
  let stockWarehouseFilter = $state('');
  let locations = $state<Location[]>([]);

  let selectedWarehouseForAssets = $state<WarehouseRecord | null>(null);
  let warehouseAssets = $state<Asset[]>([]);
  let assetsLoading = $state(false);
  let assetsMeta = $state({ total: 0, page: 1, limit: 50 });

  let createOpen = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let editingItem = $state<WarehouseRecord | null>(null);
  let deletingItem = $state<WarehouseRecord | null>(null);

  const filteredWarehouses = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  });

  const filteredStock = $derived.by(() => {
    let items = stockWarehouseFilter ? stockItems.filter((s) => s.warehouseId === stockWarehouseFilter) : stockItems;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.partName.toLowerCase().includes(q) || s.partCode.toLowerCase().includes(q) || s.warehouseName.toLowerCase().includes(q));
  });

  const warehouseOptions = $derived(warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })));
  const locationOptions = $derived(locations.map((l) => ({ value: l.id, label: l.name })));

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [warehouseResponse, catalogResponse] = await Promise.all([
        listWarehouses().catch(() => ({ data: [] as WarehouseRecord[] })),
        getAssetCatalogs().catch(() => ({ data: null }))
      ]);
      warehouses = warehouseResponse.data ?? [];
      locations = catalogResponse.data?.locations ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Không thể tải dữ liệu kho';
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadStockView() {
    try {
      stockLoading = true;
      const response = await listStockView({ warehouseId: stockWarehouseFilter || undefined, limit: 200 });
      stockItems = response.data ?? [];
    } catch {
      toast.error('Không thể tải tồn kho');
    } finally {
      stockLoading = false;
    }
  }

  async function createWarehouseItem(values: Record<string, unknown>) {
    const parsed = warehouseSchema.parse(values);
    await createWarehouse({
      code: `WH-${Date.now().toString().slice(-6)}`,
      name: parsed.name,
      locationId: parsed.locationId || null
    });
    toast.success('Tạo kho thành công');
    await loadData();
  }

  async function updateWarehouseItem(values: Record<string, unknown>) {
    if (!editingItem) return;
    const parsed = warehouseSchema.parse(values);
    await updateWarehouse(editingItem.id, {
      name: parsed.name,
      locationId: parsed.locationId || null
    });
    toast.success('Cập nhật kho thành công');
    editOpen = false;
    editingItem = null;
    await loadData();
  }

  async function deleteWarehouseItem() {
    if (!deletingItem) return;
    await deleteWarehouse(deletingItem.id);
    toast.success('Xóa kho thành công');
    deleteOpen = false;
    deletingItem = null;
    await loadData();
  }

  const assetStatusLabel: Record<string, string> = {
    in_stock: 'Trong kho',
    in_use: 'Đang sử dụng',
    in_repair: 'Đang sửa chữa',
    retired: 'Nghỉ hưu',
    disposed: 'Đã thanh lý',
    lost: 'Mất'
  };

  const assetStatusClass: Record<string, string> = {
    in_stock: 'bg-green-900/40 text-green-300',
    in_use: 'bg-blue-900/40 text-blue-300',
    in_repair: 'bg-yellow-900/40 text-yellow-300',
    retired: 'bg-slate-700 text-slate-400',
    disposed: 'bg-red-900/40 text-red-300',
    lost: 'bg-red-900/40 text-red-300'
  };

  async function loadWarehouseAssets(wh: WarehouseRecord, page = 1) {
    selectedWarehouseForAssets = wh;
    activeTab = 'assets';
    assetsLoading = true;
    try {
      const res = await listWarehouseAssets(wh.id, { page, limit: assetsMeta.limit });
      warehouseAssets = (res as unknown as { data: Asset[] }).data ?? [];
      const meta = (res as unknown as { meta?: { total?: number; page?: number; limit?: number } }).meta;
      assetsMeta = { total: meta?.total ?? warehouseAssets.length, page, limit: assetsMeta.limit };
    } catch {
      toast.error('Không thể tải tài sản của kho');
    } finally {
      assetsLoading = false;
    }
  }

  onMount(() => {
    void loadData();
  });
</script>

<div class="page-shell page-content">
  <PageHeader
    title="Quản lý kho"
    subtitle={activeTab === 'assets'
      ? `${assetsMeta.total} tài sản`
      : activeTab === 'stock'
        ? `${filteredStock.length} mặt hàng`
        : `${filteredWarehouses.length} kho`}
  >
    {#snippet actions()}
      {#if activeTab === 'warehouses'}
        <Button data-testid="btn-create" onclick={() => (createOpen = true)}>
          <Plus class="mr-2 h-4 w-4" /> Tạo kho mới
        </Button>
      {/if}
      {#if activeTab === 'assets' && selectedWarehouseForAssets}
        <Button variant="secondary" onclick={() => loadWarehouseAssets(selectedWarehouseForAssets!)}>
          <RefreshCw class="h-4 w-4" />
        </Button>
      {:else if activeTab !== 'assets'}
        <Button variant="secondary" data-testid="btn-refresh" onclick={activeTab === 'stock' ? loadStockView : loadData} disabled={activeTab === 'stock' ? stockLoading : loading}>
          <RefreshCw class="h-4 w-4 {(activeTab === 'stock' ? stockLoading : loading) ? 'animate-spin' : ''}" />
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="mb-4 flex flex-wrap items-center gap-2">
    {#each Object.keys(tabLabels) as tabKey}
      {@const tab = tabKey as WarehouseTab}
      <button
        type="button"
        class={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${activeTab === tab ? 'border-primary bg-primary/15 text-primary' : 'border-slate-600 bg-transparent text-slate-400 hover:border-slate-400 hover:text-slate-200'}`}
        onclick={() => {
          activeTab = tab;
          editingItem = null;
          deletingItem = null;
          if (tab === 'stock' && stockItems.length === 0) void loadStockView();
        }}
      >
        {tabLabels[tab]}
      </button>
    {/each}
    <div class="ml-auto flex items-center gap-2">
      {#if activeTab === 'stock'}
        <select class="select-base w-52 text-sm" bind:value={stockWarehouseFilter} onchange={loadStockView}>
          <option value="">Tất cả kho</option>
          {#each warehouses as wh}
            <option value={wh.id}>{wh.name} ({wh.code})</option>
          {/each}
        </select>
      {/if}
      {#if activeTab !== 'assets'}
        <input
          type="text"
          class="input-base w-48"
          placeholder="Tìm kiếm..."
          data-testid="warehouse-search"
          bind:value={searchQuery}
        />
      {/if}
    </div>
  </div>

  {#if error}
    <div class="mb-4 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <span class="ml-3 text-slate-400">Đang tải...</span>
    </div>
  {:else if activeTab === 'warehouses'}
    <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-300">
          <tr>
            <th class="px-4 py-3">Tên kho</th>
            <th class="px-4 py-3">Mã kho</th>
            <th class="px-4 py-3">Vị trí</th>
            <th class="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredWarehouses.length === 0}
            <tr>
              <td colspan="4" class="px-4 py-8 text-center text-slate-500">Không có kho nào</td>
            </tr>
          {:else}
            {#each filteredWarehouses as wh}
              <tr class="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td class="px-4 py-3 font-medium">{wh.name}</td>
                <td class="px-4 py-3 font-mono text-xs text-slate-300">{wh.code}</td>
                <td class="px-4 py-3 text-slate-400">{locations.find((l) => l.id === wh.locationId)?.name ?? '-'}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onclick={() => loadWarehouseAssets(wh)} title="Xem tài sản trong kho">
                      <Eye class="h-3.5 w-3.5 mr-1" /> Tài sản
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      data-testid={`row-edit-${wh.id}`}
                      onclick={() => { editingItem = wh; editOpen = true; }}
                    >
                      Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      data-testid={`row-delete-${wh.id}`}
                      onclick={() => { deletingItem = wh; deleteOpen = true; }}
                    >
                      Xóa
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

  {:else if activeTab === 'stock'}
    {#if stockLoading}
      <div class="flex items-center justify-center py-10">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span class="ml-3 text-slate-400">Đang tải tồn kho...</span>
      </div>
    {:else if filteredStock.length === 0}
      <div class="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-16 text-slate-500">
        <p class="text-base">Không có dữ liệu tồn kho</p>
        <p class="mt-1 text-sm">Nhấn nút làm mới hoặc chọn kho cụ thể</p>
      </div>
    {:else}
      <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th class="px-4 py-3">Mã linh kiện</th>
              <th class="px-4 py-3">Tên linh kiện</th>
              <th class="px-4 py-3">Kho</th>
              <th class="px-4 py-3 text-right">Tồn kho</th>
              <th class="px-4 py-3 text-right">Dự trữ</th>
              <th class="px-4 py-3 text-right">Khả dụng</th>
              <th class="px-4 py-3">ĐVT</th>
              <th class="px-4 py-3 text-right">Tối thiểu</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredStock as item}
              <tr class={`border-t border-slate-800 hover:bg-slate-800/40 transition-colors ${item.onHand < item.minLevel ? 'bg-red-950/20' : ''}`}>
                <td class="px-4 py-3 font-mono text-xs text-primary">{item.partCode}</td>
                <td class="px-4 py-3">{item.partName}</td>
                <td class="px-4 py-3 text-slate-400">
                  {item.warehouseName}
                  <span class="ml-1 font-mono text-xs text-slate-500">({item.warehouseCode})</span>
                </td>
                <td class="px-4 py-3 text-right font-medium">{item.onHand}</td>
                <td class="px-4 py-3 text-right text-slate-400">{item.reserved}</td>
                <td class="px-4 py-3 text-right">
                  <span class={item.available <= 0 ? 'font-medium text-red-400' : 'font-medium text-green-400'}>{item.available}</span>
                </td>
                <td class="px-4 py-3 text-slate-400">{item.uom ?? 'pcs'}</td>
                <td class="px-4 py-3 text-right">
                  {#if item.onHand < item.minLevel}
                    <span class="rounded border border-red-700 bg-red-900/40 px-1.5 py-0.5 text-xs text-red-300">{item.minLevel} ⚠</span>
                  {:else}
                    <span class="text-slate-400">{item.minLevel}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

  {:else if activeTab === 'assets'}
    {#if !selectedWarehouseForAssets}
      <div class="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-16 text-slate-500">
        <p class="text-base">Chọn một kho để xem tài sản</p>
        <p class="mt-1 text-sm">Chuyển sang tab <strong class="text-slate-300">Kho hàng</strong> và nhấn nút <strong class="text-slate-300">Tài sản</strong> trên dòng kho muốn xem.</p>
      </div>
    {:else if assetsLoading}
      <div class="flex items-center justify-center py-10">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span class="ml-3 text-slate-400">Đang tải tài sản...</span>
      </div>
    {:else}
      <div class="mb-4 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
        <span class="text-sm text-slate-400">Kho:</span>
        <span class="font-semibold text-white">{selectedWarehouseForAssets.name}</span>
        <span class="font-mono text-xs text-slate-500">({selectedWarehouseForAssets.code})</span>
        <button type="button" class="ml-auto text-xs text-slate-500 underline hover:text-slate-300" onclick={() => { activeTab = 'warehouses'; }}>
          ← Chọn kho khác
        </button>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th class="px-4 py-3">Mã tài sản</th>
              <th class="px-4 py-3">Model</th>
              <th class="px-4 py-3">Serial</th>
              <th class="px-4 py-3">Trạng thái</th>
              <th class="px-4 py-3">Vị trí</th>
            </tr>
          </thead>
          <tbody>
            {#if warehouseAssets.length === 0}
              <tr>
                <td class="px-4 py-8 text-center text-slate-500" colspan="5">Không có tài sản nào trong kho này</td>
              </tr>
            {:else}
              {#each warehouseAssets as asset}
                <tr class="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
                  <td class="px-4 py-3 font-mono text-xs text-primary">{asset.assetCode}</td>
                  <td class="px-4 py-3">{asset.modelName ?? '-'}</td>
                  <td class="px-4 py-3 font-mono text-xs text-slate-400">{asset.serialNo ?? '-'}</td>
                  <td class="px-4 py-3">
                    <span class={`rounded px-1.5 py-0.5 text-xs ${assetStatusClass[asset.status] ?? 'bg-slate-700 text-slate-400'}`}>
                      {assetStatusLabel[asset.status] ?? asset.status}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-slate-400">{asset.locationName ?? '-'}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
      {#if assetsMeta.total > assetsMeta.limit}
        <div class="mt-3 flex items-center justify-between text-sm text-slate-400">
          <span>Hiển thị {warehouseAssets.length} / {assetsMeta.total} tài sản</span>
          <div class="flex gap-2">
            {#if assetsMeta.page > 1}
              <button type="button" class="rounded border border-slate-600 px-3 py-1 hover:bg-slate-700 transition-colors" onclick={() => loadWarehouseAssets(selectedWarehouseForAssets!, assetsMeta.page - 1)}>← Trước</button>
            {/if}
            {#if assetsMeta.page * assetsMeta.limit < assetsMeta.total}
              <button type="button" class="rounded border border-slate-600 px-3 py-1 hover:bg-slate-700 transition-colors" onclick={() => loadWarehouseAssets(selectedWarehouseForAssets!, assetsMeta.page + 1)}>Tiếp →</button>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<!-- Tạo mới kho -->
<CreateEditModal
  bind:open={createOpen}
  mode="create"
  title="Tạo kho mới"
  schema={warehouseSchema}
  initialValues={{ name: '', locationId: '' }}
  onSubmit={createWarehouseItem}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField
      id="warehouse-name-create"
      label="Tên kho"
      required
      value={String(values.name ?? '')}
      error={errors.name}
      onValueChange={(v) => setValue('name', v)}
      {disabled}
    />
    <SelectField
      id="warehouse-location-create"
      label="Vị trí"
      value={String(values.locationId ?? '')}
      options={locationOptions}
      placeholder="Chọn vị trí"
      onValueChange={(v) => setValue('locationId', v)}
      {disabled}
    />
  {/snippet}
</CreateEditModal>

<!-- Chỉnh sửa kho -->
<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title="Chỉnh sửa kho"
  schema={warehouseSchema}
  initialValues={editingItem ? { name: editingItem.name, locationId: editingItem.locationId ?? '' } : { name: '', locationId: '' }}
  onSubmit={updateWarehouseItem}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField
      id="warehouse-name-edit"
      label="Tên kho"
      required
      value={String(values.name ?? '')}
      error={errors.name}
      onValueChange={(v) => setValue('name', v)}
      {disabled}
    />
    <SelectField
      id="warehouse-location-edit"
      label="Vị trí"
      value={String(values.locationId ?? '')}
      options={locationOptions}
      placeholder="Chọn vị trí"
      onValueChange={(v) => setValue('locationId', v)}
      {disabled}
    />
  {/snippet}
</CreateEditModal>

<!-- Xóa kho -->
<DeleteConfirmModal
  bind:open={deleteOpen}
  entityName={deletingItem?.name ?? ''}
  onConfirm={deleteWarehouseItem}
/>
