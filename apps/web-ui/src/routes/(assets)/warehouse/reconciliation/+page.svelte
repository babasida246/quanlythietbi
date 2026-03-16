<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';
  import { RefreshCw, CheckCircle, AlertTriangle, Search } from 'lucide-svelte';
  import {
    listWarehouses,
    reportStockOnHand,
    createStockDocument,
    type WarehouseRecord,
    type StockOnHandRow
  } from '$lib/api/warehouse';
  import { toast } from '$lib/components/toast';

  interface ReconciliationRow {
    partId: string;
    partCode: string;
    partName: string;
    warehouseId: string;
    warehouseName: string;
    systemQty: number;
    physicalQty: number;
    variance: number;
    counted: boolean;
  }

  let warehouses = $state<WarehouseRecord[]>([]);
  let selectedWarehouse = $state('');
  let stockOnHand = $state<StockOnHandRow[]>([]);
  let rows = $state<ReconciliationRow[]>([]);
  let searchQuery = $state('');
  let varianceOnly = $state(false);
  let loading = $state(true);
  let submitting = $state(false);

  const filteredRows = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (varianceOnly && row.variance === 0) return false;
      if (!q) return true;
      return row.partCode.toLowerCase().includes(q) || row.partName.toLowerCase().includes(q);
    });
  });

  const hasVariance = $derived(rows.some((r) => r.variance !== 0));
  const varianceCount = $derived(rows.filter((r) => r.variance !== 0).length);
  const checkedCount = $derived(rows.filter((r) => r.counted).length);
  const totalSystemQty = $derived(rows.reduce((sum, row) => sum + row.systemQty, 0));
  const totalPhysicalQty = $derived(rows.reduce((sum, row) => sum + row.physicalQty, 0));
  const netVariance = $derived(rows.reduce((sum, row) => sum + row.variance, 0));

  async function loadData() {
    try {
      loading = true;
      const [whResp, sohResp] = await Promise.all([
        listWarehouses(),
        reportStockOnHand({ warehouseId: selectedWarehouse || undefined })
      ]);
      warehouses = whResp.data ?? [];
      stockOnHand = sohResp ?? [];

      rows = stockOnHand.map((s) => ({
        partId: s.partId,
        partCode: s.partCode ?? '',
        partName: s.partName,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouseName ?? '-',
        systemQty: s.onHand,
        physicalQty: s.onHand,
        variance: 0,
        counted: false
      }));
    } catch (err) {
      toast.error($isLoading ? 'Failed to load reconciliation data' : $_('warehouse.reconciliation.loadError'));
    } finally {
      loading = false;
    }
  }

  function updatePhysicalQty(index: number, value: string) {
    const qty = parseInt(value) || 0;
    rows[index].physicalQty = qty;
    rows[index].variance = qty - rows[index].systemQty;
    rows[index].counted = true;
  }

  function resetCounts() {
    rows = rows.map((row) => ({
      ...row,
      physicalQty: row.systemQty,
      variance: 0,
      counted: false
    }));
  }

  function markAllAsCounted() {
    rows = rows.map((row) => ({ ...row, counted: true }));
  }

  async function submitReconciliation() {
    const adjustments = rows.filter(r => r.variance !== 0);
    if (adjustments.length === 0) {
      toast.info($isLoading ? 'No stock variance to adjust' : $_('warehouse.reconciliation.noVariance'));
      return;
    }

    try {
      submitting = true;
      // Group adjustments by warehouse
      const byWarehouse = new Map<string, ReconciliationRow[]>();
      for (const adj of adjustments) {
        const existing = byWarehouse.get(adj.warehouseId) ?? [];
        existing.push(adj);
        byWarehouse.set(adj.warehouseId, existing);
      }

      for (const [whId, items] of byWarehouse) {
        await createStockDocument({
          docType: 'adjust',
          code: `RECON-${new Date().toISOString().slice(0, 10)}-${whId.slice(0, 8)}`,
          warehouseId: whId,
          lines: items.map(item => ({
            partId: item.partId,
            qty: Math.max(Math.abs(item.variance), 1),
            adjustDirection: item.variance >= 0 ? 'plus' : 'minus',
            note: `Reconciliation: system ${item.systemQty}, physical ${item.physicalQty}`
          })),
          note: `Reconciliation ${new Date().toLocaleDateString('vi-VN')}`
        });
      }

      toast.success(
        $isLoading
          ? `Created ${byWarehouse.size} adjustment docs`
          : $_('warehouse.reconciliation.submitSuccess', { values: { documents: byWarehouse.size, variances: adjustments.length } })
      );
      await loadData();
    } catch (err) {
      toast.error($isLoading ? 'Failed to create adjustment document' : $_('warehouse.reconciliation.submitError'));
    } finally {
      submitting = false;
    }
  }

  onMount(() => { void loadData(); });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Stock Reconciliation' : $_('warehouse.reconciliation.title')}</h2>
      <p class="text-sm text-slate-500">{$isLoading ? 'Compare system stock with physical count.' : $_('warehouse.reconciliation.subtitle')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={loadData}>
        <RefreshCw class="h-4 w-4 mr-1" /> {$isLoading ? 'Reload' : $_('warehouse.reconciliation.reload')}
      </Button>
      <Button variant="secondary" onclick={markAllAsCounted} disabled={rows.length === 0 || loading}>
        {$isLoading ? 'Mark all counted' : $_('warehouse.reconciliation.markAllCounted')}
      </Button>
      <Button variant="secondary" onclick={resetCounts} disabled={rows.length === 0 || loading}>
        {$isLoading ? 'Reset counted values' : $_('warehouse.reconciliation.reset')}
      </Button>
      <Button disabled={!hasVariance || submitting} onclick={submitReconciliation} data-testid="reconcile-submit">
        <CheckCircle class="h-4 w-4 mr-1" />
        {#if submitting}
          {$isLoading ? 'Submitting...' : $_('warehouse.reconciliation.submitting')}
        {:else}
          {$isLoading ? `Create adjustment (${varianceCount})` : $_('warehouse.reconciliation.createAdjustment', { values: { count: varianceCount } })}
        {/if}
      </Button>
    </div>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
    <div class="card p-3">
      <p class="text-xs text-slate-500">{$isLoading ? 'Rows' : $_('warehouse.reconciliation.statsRows')}</p>
      <p class="text-lg font-semibold">{rows.length}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs text-slate-500">{$isLoading ? 'Counted' : $_('warehouse.reconciliation.statsCounted')}</p>
      <p class="text-lg font-semibold">{checkedCount}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs text-slate-500">{$isLoading ? 'System Qty' : $_('warehouse.reconciliation.statsSystem')}</p>
      <p class="text-lg font-semibold">{totalSystemQty}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs text-slate-500">{$isLoading ? 'Physical Qty' : $_('warehouse.reconciliation.statsPhysical')}</p>
      <p class="text-lg font-semibold">{totalPhysicalQty}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs text-slate-500">{$isLoading ? 'Net variance' : $_('warehouse.reconciliation.statsNetVariance')}</p>
      <p class="text-lg font-semibold" class:text-red-400={netVariance < 0} class:text-green-400={netVariance > 0}>
        {netVariance > 0 ? '+' : ''}{netVariance}
      </p>
    </div>
  </div>

  <div class="flex gap-3 items-end">
    <div>
      <label class="label-base mb-1" for="recon-warehouse">{$isLoading ? 'Warehouse' : $_('warehouse.reconciliation.filterWarehouse')}</label>
      <select class="select-base" id="recon-warehouse" bind:value={selectedWarehouse} onchange={() => loadData()}>
        <option value="">{$isLoading ? 'All warehouses' : $_('warehouse.reconciliation.allWarehouses')}</option>
        {#each warehouses as wh}
          <option value={wh.id}>{wh.name} ({wh.code})</option>
        {/each}
      </select>
    </div>
    <div>
      <label class="label-base mb-1" for="recon-search">{$isLoading ? 'Search part' : $_('warehouse.reconciliation.filterSearch')}</label>
      <div class="relative">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
        <input
          id="recon-search"
          class="input-base pl-8"
          placeholder={$isLoading ? 'Code or name...' : $_('warehouse.reconciliation.searchPlaceholder')}
          bind:value={searchQuery}
        />
      </div>
    </div>
    <label class="inline-flex items-center gap-2 text-sm text-slate-300 mb-1">
      <input type="checkbox" bind:checked={varianceOnly} />
      {$isLoading ? 'Only show variances' : $_('warehouse.reconciliation.varianceOnly')}
    </label>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if filteredRows.length === 0}
    <div class="text-center py-10 text-slate-500">{$isLoading ? 'No reconciliation records' : $_('warehouse.reconciliation.empty')}</div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase text-slate-300">
          <tr>
            <th class="px-3 py-2">{$isLoading ? 'Code' : $_('warehouse.reconciliation.colPartCode')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Part name' : $_('warehouse.reconciliation.colPartName')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Warehouse' : $_('warehouse.reconciliation.colWarehouse')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'System' : $_('warehouse.reconciliation.colSystem')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Physical' : $_('warehouse.reconciliation.colPhysical')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Variance' : $_('warehouse.reconciliation.colVariance')}</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredRows as row}
            {@const index = rows.findIndex((candidate) => candidate.partId === row.partId && candidate.warehouseId === row.warehouseId)}
            <tr class={`border-t border-slate-800 ${row.variance !== 0 ? 'bg-red-900/10' : ''}`}>
              <td class="px-3 py-2 font-mono text-xs">{row.partCode}</td>
              <td class="px-3 py-2">{row.partName}</td>
              <td class="px-3 py-2">{row.warehouseName}</td>
              <td class="px-3 py-2 text-right">{row.systemQty}</td>
              <td class="px-3 py-1">
                <input
                  type="number"
                  class="input-base w-24 text-right"
                  value={row.physicalQty}
                  data-testid={`recon-qty-${index}`}
                  oninput={(e) => updatePhysicalQty(index, (e.target as HTMLInputElement).value)}
                  min="0"
                />
              </td>
              <td class="px-3 py-2 text-right font-medium" class:text-red-400={row.variance < 0} class:text-green-400={row.variance > 0}>
                {row.variance > 0 ? '+' : ''}{row.variance}
                {#if row.variance !== 0}
                  <AlertTriangle class="inline h-3 w-3 ml-1" />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
