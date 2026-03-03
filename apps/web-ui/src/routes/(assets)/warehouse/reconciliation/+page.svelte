<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-svelte';
  import {
    listWarehouses,
    listSpareParts,
    reportStockOnHand,
    createStockDocument,
    type WarehouseRecord,
    type SparePartRecord,
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
  }

  let warehouses = $state<WarehouseRecord[]>([]);
  let selectedWarehouse = $state('');
  let stockOnHand = $state<StockOnHandRow[]>([]);
  let rows = $state<ReconciliationRow[]>([]);
  let loading = $state(true);
  let submitting = $state(false);

  const hasVariance = $derived(rows.some(r => r.variance !== 0));
  const varianceCount = $derived(rows.filter(r => r.variance !== 0).length);

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
        variance: 0
      }));
    } catch (err) {
      toast.error('Khong the tai du lieu kiem ke');
    } finally {
      loading = false;
    }
  }

  function updatePhysicalQty(index: number, value: string) {
    const qty = parseInt(value) || 0;
    rows[index].physicalQty = qty;
    rows[index].variance = qty - rows[index].systemQty;
  }

  async function submitReconciliation() {
    const adjustments = rows.filter(r => r.variance !== 0);
    if (adjustments.length === 0) {
      toast.info('Khong co chenh lech de dieu chinh');
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
            qty: item.variance,
            note: `Kiem ke: he thong ${item.systemQty}, thuc te ${item.physicalQty}`
          })),
          note: `Kiem ke kho ngay ${new Date().toLocaleDateString('vi-VN')}`
        });
      }

      toast.success(`Da tao ${byWarehouse.size} phieu dieu chinh cho ${adjustments.length} chenh lech`);
      await loadData();
    } catch (err) {
      toast.error('Khong the tao phieu dieu chinh');
    } finally {
      submitting = false;
    }
  }

  onMount(() => { void loadData(); });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">Kiem ke kho</h2>
      <p class="text-sm text-slate-500">So sanh ton kho he thong va kiem dem thuc te</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={loadData}>
        <RefreshCw class="h-4 w-4 mr-1" /> Tai lai
      </Button>
      <Button disabled={!hasVariance || submitting} onclick={submitReconciliation} data-testid="reconcile-submit">
        <CheckCircle class="h-4 w-4 mr-1" /> {submitting ? 'Dang xu ly...' : `Tao phieu dieu chinh (${varianceCount})`}
      </Button>
    </div>
  </div>

  <div class="flex gap-3 items-end">
    <div>
      <label class="label-base mb-1" for="recon-warehouse">Kho hang</label>
      <select class="select-base" id="recon-warehouse" bind:value={selectedWarehouse} onchange={() => loadData()}>
        <option value="">Tat ca kho</option>
        {#each warehouses as wh}
          <option value={wh.id}>{wh.name} ({wh.code})</option>
        {/each}
      </select>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if rows.length === 0}
    <div class="text-center py-10 text-slate-500">Khong co du lieu ton kho de kiem ke</div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase text-slate-300">
          <tr>
            <th class="px-3 py-2">Ma LK</th>
            <th class="px-3 py-2">Ten linh kien</th>
            <th class="px-3 py-2">Kho</th>
            <th class="px-3 py-2 text-right">He thong</th>
            <th class="px-3 py-2 text-right">Thuc te</th>
            <th class="px-3 py-2 text-right">Chenh lech</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i}
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
                  data-testid={`recon-qty-${i}`}
                  oninput={(e) => updatePhysicalQty(i, (e.target as HTMLInputElement).value)}
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
