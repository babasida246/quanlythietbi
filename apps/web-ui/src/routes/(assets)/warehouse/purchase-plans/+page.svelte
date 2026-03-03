<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { ShoppingCart, Download, RefreshCw } from 'lucide-svelte';
  import {
    listWarehouses,
    reportReorderAlerts,
    listSpareParts,
    type WarehouseRecord,
    type ReorderAlertRow,
    type SparePartRecord
  } from '$lib/api/warehouse';
  import { toast } from '$lib/components/toast';

  interface PurchasePlanRow {
    partId: string;
    partCode: string;
    partName: string;
    uom: string;
    warehouseId: string;
    warehouseName: string;
    currentStock: number;
    minLevel: number;
    deficit: number;
    orderQty: number;
    estimatedCost: number;
  }

  let loading = $state(true);
  let rows = $state<PurchasePlanRow[]>([]);
  let totalCost = $derived(rows.reduce((sum, r) => sum + r.estimatedCost, 0));

  async function loadPlan() {
    try {
      loading = true;
      const [alertsResp, partsResp] = await Promise.all([
        reportReorderAlerts({}),
        listSpareParts({ limit: 1000 })
      ]);
      const alerts = alertsResp;
      const parts = partsResp.data ?? [];
      const partMap = new Map(parts.map((p: SparePartRecord) => [p.id, p]));

      rows = alerts.map((a: ReorderAlertRow) => {
        const part = partMap.get(a.partId);
        const deficit = Math.max((a.minLevel ?? 0) - (a.onHand ?? 0), 0);
        const orderQty = Math.max(deficit, (a.minLevel ?? 0) * 2 - (a.onHand ?? 0));
        return {
          partId: a.partId,
          partCode: a.partCode ?? part?.partCode ?? '',
          partName: a.partName,
          uom: (part as Record<string, unknown>)?.uom as string ?? 'pcs',
          warehouseId: a.warehouseId,
          warehouseName: a.warehouseName ?? '-',
          currentStock: a.onHand,
          minLevel: a.minLevel ?? 0,
          deficit,
          orderQty: Math.max(orderQty, 1),
          estimatedCost: 0
        };
      });
    } catch {
      toast.error('Khong the tai ke hoach mua sam');
    } finally {
      loading = false;
    }
  }

  function updateOrderQty(index: number, value: string) {
    rows[index].orderQty = Math.max(parseInt(value) || 1, 1);
  }

  function updateEstimatedCost(index: number, value: string) {
    rows[index].estimatedCost = parseFloat(value) || 0;
  }

  function exportPlan() {
    const header = 'Ma LK,Ten linh kien,DVT,Kho,Ton kho,Muc toi thieu,Can mua,Chi phi du kien';
    const csvRows = rows.map(r =>
      [r.partCode, r.partName, r.uom, r.warehouseName, r.currentStock, r.minLevel, r.orderQty, r.estimatedCost]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...csvRows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-plan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Da xuat ke hoach mua sam');
  }

  onMount(() => { void loadPlan(); });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">Ke hoach mua sam</h2>
      <p class="text-sm text-slate-500">Tu dong de xuat mua hang dua tren muc ton kho toi thieu</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={loadPlan}>
        <RefreshCw class="h-4 w-4 mr-1" /> Tai lai
      </Button>
      <Button variant="secondary" onclick={exportPlan} disabled={rows.length === 0}>
        <Download class="h-4 w-4 mr-1" /> Xuat CSV
      </Button>
    </div>
  </div>

  {#if rows.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="card">
        <p class="text-xs text-slate-500">So mat hang can mua</p>
        <p class="text-xl font-bold">{rows.length}</p>
      </div>
      <div class="card">
        <p class="text-xs text-slate-500">Tong so luong can mua</p>
        <p class="text-xl font-bold">{rows.reduce((s, r) => s + r.orderQty, 0)}</p>
      </div>
      <div class="card">
        <p class="text-xs text-slate-500">Tong chi phi du kien</p>
        <p class="text-xl font-bold">{new Intl.NumberFormat('vi-VN').format(totalCost)} VND</p>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if rows.length === 0}
    <div class="card text-center py-10">
      <ShoppingCart class="mx-auto h-10 w-10 text-slate-500 mb-3" />
      <p class="text-slate-500">Tat ca linh kien deu du ton kho. Khong can mua them.</p>
    </div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase text-slate-300">
          <tr>
            <th class="px-3 py-2">Ma LK</th>
            <th class="px-3 py-2">Ten linh kien</th>
            <th class="px-3 py-2">DVT</th>
            <th class="px-3 py-2">Kho</th>
            <th class="px-3 py-2 text-right">Ton kho</th>
            <th class="px-3 py-2 text-right">Min</th>
            <th class="px-3 py-2 text-right">Thieu</th>
            <th class="px-3 py-2 text-right">Can mua</th>
            <th class="px-3 py-2 text-right">Chi phi (VND)</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i}
            <tr class="border-t border-slate-800">
              <td class="px-3 py-2 font-mono text-xs">{row.partCode}</td>
              <td class="px-3 py-2">{row.partName}</td>
              <td class="px-3 py-2">{row.uom}</td>
              <td class="px-3 py-2">{row.warehouseName}</td>
              <td class="px-3 py-2 text-right text-red-400">{row.currentStock}</td>
              <td class="px-3 py-2 text-right">{row.minLevel}</td>
              <td class="px-3 py-2 text-right text-orange-400">{row.deficit}</td>
              <td class="px-3 py-1 text-right">
                <input
                  type="number"
                  class="input-base w-20 text-right"
                  value={row.orderQty}
                  min="1"
                  data-testid={`plan-qty-${i}`}
                  oninput={(e) => updateOrderQty(i, (e.target as HTMLInputElement).value)}
                />
              </td>
              <td class="px-3 py-1 text-right">
                <input
                  type="number"
                  class="input-base w-28 text-right"
                  value={row.estimatedCost}
                  min="0"
                  step="1000"
                  data-testid={`plan-cost-${i}`}
                  oninput={(e) => updateEstimatedCost(i, (e.target as HTMLInputElement).value)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-slate-600 bg-slate-800/50">
            <td colspan="7" class="px-3 py-2 font-semibold text-right">Tong cong:</td>
            <td class="px-3 py-2 text-right font-bold">{rows.reduce((s, r) => s + r.orderQty, 0)}</td>
            <td class="px-3 py-2 text-right font-bold">{new Intl.NumberFormat('vi-VN').format(totalCost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}
</div>
