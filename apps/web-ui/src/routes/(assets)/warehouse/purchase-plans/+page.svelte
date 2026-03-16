<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { ShoppingCart, Download, RefreshCw, Lightbulb, SlidersHorizontal } from 'lucide-svelte';
  import {
    reportStockOnHand,
    listSpareParts,
    type StockOnHandRow,
    type SparePartRecord
  } from '$lib/api/warehouse';
  import { getAdminWfRequestDetail, listAllWfRequests, type WfRequest, type WfRequestDetail } from '$lib/api/wf';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';

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
    requestDemand: number;
    demandWeighted: number;
    suggestionQty: number;
    orderQty: number;
    estimatedCost: number;
    reason: string;
  }

  let loading = $state(true);
  let rows = $state<PurchasePlanRow[]>([]);
  let showOnlySuggested = $state(true);
  let includeWorkflowDemand = $state(true);
  let coverageDays = $state(30);
  let safetyFactor = $state(1.15);
  let totalCost = $derived(rows.reduce((sum, r) => sum + r.estimatedCost, 0));
  let totalSuggestedQty = $derived(rows.reduce((sum, r) => sum + r.suggestionQty, 0));
  let totalDemandQty = $derived(rows.reduce((sum, r) => sum + r.requestDemand, 0));
  let totalOrderQty = $derived(rows.reduce((sum, r) => sum + r.orderQty, 0));

  const visibleRows = $derived.by(() => {
    if (!showOnlySuggested) return rows;
    return rows.filter((row) => row.suggestionQty > 0);
  });

  function priorityWeight(priority: WfRequest['priority']): number {
    if (priority === 'urgent') return 1.8;
    if (priority === 'high') return 1.45;
    if (priority === 'normal') return 1.15;
    return 1;
  }

  async function loadWorkflowDemandByPart(): Promise<Map<string, number>> {
    const demandByPart = new Map<string, number>();

    try {
      const activeStatuses = ['submitted', 'in_review', 'approved'] as const;
      const requestTypes = ['purchase', 'asset_request'] as const;
      const requestIds = new Set<string>();
      const candidates: WfRequest[] = [];

      for (const requestType of requestTypes) {
        for (const status of activeStatuses) {
          let page = 1;
          while (page <= 3) {
            const response = await listAllWfRequests({ requestType, status, page, limit: 50 });
            for (const request of response.data ?? []) {
              if (!requestIds.has(request.id)) {
                requestIds.add(request.id);
                candidates.push(request);
              }
            }
            const total = response.meta?.total ?? 0;
            const limit = response.meta?.limit ?? 50;
            if (page * limit >= total) break;
            page += 1;
          }
        }
      }

      for (const request of candidates) {
        try {
          const detailResponse = await getAdminWfRequestDetail(request.id);
          const detail: WfRequestDetail = detailResponse.data;
          const scale = priorityWeight(request.priority);

          for (const line of detail.lines ?? []) {
            if (line.itemType !== 'part' || !line.partId) continue;
            const requested = Number(line.requestedQty ?? 0);
            const fulfilled = Number(line.fulfilledQty ?? 0);
            const outstanding = Math.max(requested - fulfilled, 0);
            if (outstanding <= 0) continue;

            const previous = demandByPart.get(line.partId) ?? 0;
            demandByPart.set(line.partId, previous + outstanding * scale);
          }
        } catch {
          // Skip inaccessible request detail; keep remaining signals.
        }
      }
    } catch {
      // Permission or endpoint issues should not break purchase planning.
    }

    return demandByPart;
  }

  async function loadPlan() {
    try {
      loading = true;
      const [stockResp, partsResp, demandByPart] = await Promise.all([
        reportStockOnHand({}),
        listSpareParts({ limit: 1000 })
        , includeWorkflowDemand ? loadWorkflowDemandByPart() : Promise.resolve(new Map<string, number>())
      ]);
      const stockRows = stockResp;
      const parts = partsResp.data ?? [];
      const partMap = new Map(parts.map((p: SparePartRecord) => [p.id, p]));
      const coverageScale = Math.max(coverageDays, 1) / 30;
      const factor = Math.max(safetyFactor, 0.5);

      rows = stockRows.map((stock: StockOnHandRow) => {
        const part = partMap.get(stock.partId);
        const minLevel = stock.minLevel ?? part?.minLevel ?? 0;
        const deficit = Math.max(minLevel - (stock.onHand ?? 0), 0);
        const requestDemand = includeWorkflowDemand
          ? Math.ceil((demandByPart.get(stock.partId) ?? 0) * coverageScale)
          : 0;
        const demandWeighted = Math.ceil(requestDemand * factor);
        const suggestionQty = Math.max(deficit + demandWeighted, 0);

        const reasonParts: string[] = [];
        if (deficit > 0) reasonParts.push($_('warehouse.purchasePlan.reasonMinStock', { values: { deficit } }));
        if (requestDemand > 0) reasonParts.push($_('warehouse.purchasePlan.reasonWorkflowDemand', { values: { demand: requestDemand } }));
        const reason = reasonParts.length > 0
          ? reasonParts.join(' + ')
          : $_('warehouse.purchasePlan.reasonHealthyStock');

        return {
          partId: stock.partId,
          partCode: stock.partCode ?? part?.partCode ?? '',
          partName: stock.partName,
          uom: (part as Record<string, unknown>)?.uom as string ?? 'pcs',
          warehouseId: stock.warehouseId,
          warehouseName: stock.warehouseName ?? '-',
          currentStock: stock.onHand,
          minLevel,
          deficit,
          requestDemand,
          demandWeighted,
          suggestionQty,
          orderQty: Math.max(suggestionQty, 0),
          estimatedCost: 0,
          reason
        };
      });
    } catch {
      toast.error($_('warehouse.purchasePlan.loadError'));
    } finally {
      loading = false;
    }
  }

  function updateOrderQty(index: number, value: string) {
    rows[index].orderQty = Math.max(parseInt(value) || 0, 0);
  }

  function updateEstimatedCost(index: number, value: string) {
    rows[index].estimatedCost = parseFloat(value) || 0;
  }

  function exportPlan() {
    const header = $_('warehouse.purchasePlan.csvHeader');
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
    toast.success($_('warehouse.purchasePlan.exportSuccess'));
  }

  function applySuggestedQtyToAll() {
    rows = rows.map((row) => ({ ...row, orderQty: row.suggestionQty }));
  }

  onMount(() => { void loadPlan(); });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Purchase Plans' : $_('warehouse.purchasePlan.title')}</h2>
      <p class="text-sm text-slate-500">{$isLoading ? 'Auto-suggest purchases by stock and demand.' : $_('warehouse.purchasePlan.subtitle')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={loadPlan}>
        <RefreshCw class="h-4 w-4 mr-1" /> {$isLoading ? 'Reload' : $_('warehouse.purchasePlan.reload')}
      </Button>
      <Button variant="secondary" onclick={exportPlan} disabled={rows.length === 0}>
        <Download class="h-4 w-4 mr-1" /> {$isLoading ? 'Export CSV' : $_('warehouse.purchasePlan.exportCsv')}
      </Button>
      <Button variant="secondary" onclick={applySuggestedQtyToAll} disabled={rows.length === 0}>
        <Lightbulb class="h-4 w-4 mr-1" /> {$isLoading ? 'Apply suggestions' : $_('warehouse.purchasePlan.applySuggested')}
      </Button>
    </div>
  </div>

  <div class="card p-3 space-y-3">
    <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
      <SlidersHorizontal class="h-4 w-4 text-slate-400" />
      {$isLoading ? 'Suggestion Settings' : $_('warehouse.purchasePlan.settingsTitle')}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <label class="text-xs text-slate-400 space-y-1">
        <span>{$isLoading ? 'Coverage days' : $_('warehouse.purchasePlan.coverageDays')}</span>
        <input class="input-base" type="number" min="1" max="365" bind:value={coverageDays} />
      </label>
      <label class="text-xs text-slate-400 space-y-1">
        <span>{$isLoading ? 'Safety factor' : $_('warehouse.purchasePlan.safetyFactor')}</span>
        <input class="input-base" type="number" min="0.5" max="3" step="0.05" bind:value={safetyFactor} />
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" bind:checked={includeWorkflowDemand} />
        {$isLoading ? 'Include workflow demand' : $_('warehouse.purchasePlan.includeWorkflowDemand')}
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" bind:checked={showOnlySuggested} />
        {$isLoading ? 'Only suggested rows' : $_('warehouse.purchasePlan.showOnlySuggested')}
      </label>
    </div>
    <div class="text-xs text-slate-500">{$isLoading ? 'Update settings then click Reload to recalculate.' : $_('warehouse.purchasePlan.settingsHint')}</div>
  </div>

  {#if rows.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div class="card">
        <p class="text-xs text-slate-500">{$isLoading ? 'Items to purchase' : $_('warehouse.purchasePlan.statsItems')}</p>
        <p class="text-xl font-bold">{visibleRows.length}</p>
      </div>
      <div class="card">
        <p class="text-xs text-slate-500">{$isLoading ? 'Suggested qty' : $_('warehouse.purchasePlan.statsSuggestedQty')}</p>
        <p class="text-xl font-bold">{totalSuggestedQty}</p>
      </div>
      <div class="card">
        <p class="text-xs text-slate-500">{$isLoading ? 'Demand from requests' : $_('warehouse.purchasePlan.statsDemandQty')}</p>
        <p class="text-xl font-bold">{totalDemandQty}</p>
      </div>
      <div class="card">
        <p class="text-xs text-slate-500">{$isLoading ? 'Total estimated cost' : $_('warehouse.purchasePlan.statsTotalCost')}</p>
        <p class="text-xl font-bold">{new Intl.NumberFormat('vi-VN').format(totalCost)} VND</p>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if visibleRows.length === 0}
    <div class="card text-center py-10">
      <ShoppingCart class="mx-auto h-10 w-10 text-slate-500 mb-3" />
      <p class="text-slate-500">{$isLoading ? 'All parts have sufficient stock.' : $_('warehouse.purchasePlan.emptyState')}</p>
    </div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase text-slate-300">
          <tr>
            <th class="px-3 py-2">{$isLoading ? 'Part Code' : $_('warehouse.purchasePlan.colPartCode')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Part Name' : $_('warehouse.purchasePlan.colPartName')}</th>
            <th class="px-3 py-2">{$isLoading ? 'UoM' : $_('warehouse.purchasePlan.colUom')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Warehouse' : $_('warehouse.purchasePlan.colWarehouse')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Stock' : $_('warehouse.purchasePlan.colStock')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Min' : $_('warehouse.purchasePlan.colMin')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Deficit' : $_('warehouse.purchasePlan.colDeficit')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Request demand' : $_('warehouse.purchasePlan.colRequestDemand')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Suggested' : $_('warehouse.purchasePlan.colSuggested')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Order Qty' : $_('warehouse.purchasePlan.colOrderQty')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Cost (VND)' : $_('warehouse.purchasePlan.colEstCost')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Reason' : $_('warehouse.purchasePlan.colReason')}</th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as row, i}
            <tr class="border-t border-slate-800">
              <td class="px-3 py-2 font-mono text-xs">{row.partCode}</td>
              <td class="px-3 py-2">{row.partName}</td>
              <td class="px-3 py-2">{row.uom}</td>
              <td class="px-3 py-2">{row.warehouseName}</td>
              <td class="px-3 py-2 text-right text-red-400">{row.currentStock}</td>
              <td class="px-3 py-2 text-right">{row.minLevel}</td>
              <td class="px-3 py-2 text-right text-orange-400">{row.deficit}</td>
              <td class="px-3 py-2 text-right">{row.requestDemand}</td>
              <td class="px-3 py-2 text-right text-blue-300 font-semibold">{row.suggestionQty}</td>
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
              <td class="px-3 py-2 text-xs text-slate-400">{row.reason}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-slate-600 bg-slate-800/50">
            <td colspan="9" class="px-3 py-2 font-semibold text-right">{$isLoading ? 'Total:' : $_('warehouse.purchasePlan.totalLabel')}</td>
            <td class="px-3 py-2 text-right font-bold">{totalOrderQty}</td>
            <td class="px-3 py-2 text-right font-bold">{new Intl.NumberFormat('vi-VN').format(totalCost)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}
</div>
