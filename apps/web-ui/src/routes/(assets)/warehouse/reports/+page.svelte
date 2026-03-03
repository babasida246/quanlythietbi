<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';
  import {
    listWarehouses,
    reportFefoLots,
    reportReorderAlerts,
    reportStockAvailable,
    reportStockOnHand,
    reportValuation,
    type FefoLotRow,
    type ReorderAlertRow,
    type StockAvailableRow,
    type StockOnHandRow,
    type ValuationResult,
    type WarehouseRecord
  } from '$lib/api/warehouse';
  import ReportsTable from '$lib/warehouse/ReportsTable.svelte';

  type ReportType = 'stockOnHand' | 'stockAvailable' | 'reorderAlerts' | 'fefoLots' | 'valuation';

  let reportType = $state<ReportType>('stockOnHand');
  let warehouses = $state<WarehouseRecord[]>([]);
  let warehouseId = $state('');
  let loading = $state(false);
  let error = $state('');

  let stockOnHandRows = $state<StockOnHandRow[]>([]);
  let stockAvailableRows = $state<StockAvailableRow[]>([]);
  let reorderRows = $state<ReorderAlertRow[]>([]);
  let fefoRows = $state<FefoLotRow[]>([]);
  let valuation = $state<ValuationResult | null>(null);

  async function loadWarehouses() {
    const response = await listWarehouses();
    warehouses = response.data ?? [];
  }

  async function loadReport() {
    try {
      loading = true;
      error = '';
      if (reportType === 'stockOnHand') {
        stockOnHandRows = await reportStockOnHand({ warehouseId: warehouseId || undefined, limit: 200 });
      } else if (reportType === 'stockAvailable') {
        stockAvailableRows = await reportStockAvailable({ warehouseId: warehouseId || undefined, limit: 200 });
      } else if (reportType === 'reorderAlerts') {
        reorderRows = await reportReorderAlerts({ warehouseId: warehouseId || undefined, limit: 200 });
      } else if (reportType === 'fefoLots') {
        fefoRows = await reportFefoLots({ warehouseId: warehouseId || undefined, daysThreshold: 30, limit: 200 });
      } else if (reportType === 'valuation') {
        valuation = await reportValuation({ warehouseId: warehouseId || undefined, limit: 200 });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadReportFailed');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void loadWarehouses();
    void loadReport();
  });
</script>

<div class="space-y-4">
  <div class="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Stock Reports' : $_('warehouse.reports')}</h2>
      <p class="text-sm text-slate-500">
        {$isLoading ? 'Quick insight into stock and valuation' : $_('warehouse.reportsSubtitle')}
      </p>
    </div>
    <div class="flex flex-wrap gap-3">
      <div>
        <label for="report-type" class="text-sm font-medium text-slate-300">{$isLoading ? 'Report' : $_('warehouse.reportType')}</label>
        <select id="report-type" class="select-base" bind:value={reportType} onchange={() => loadReport()}>
          <option value="stockOnHand">{$isLoading ? 'Stock on hand' : $_('warehouse.reportOptions.stockOnHand')}</option>
          <option value="stockAvailable">{$isLoading ? 'Stock available' : $_('warehouse.reportOptions.stockAvailable')}</option>
          <option value="reorderAlerts">{$isLoading ? 'Reorder alerts' : $_('warehouse.reportOptions.reorderAlerts')}</option>
          <option value="fefoLots">{$isLoading ? 'FEFO lots' : $_('warehouse.reportOptions.fefoLots')}</option>
          <option value="valuation">{$isLoading ? 'Valuation' : $_('warehouse.reportOptions.valuation')}</option>
        </select>
      </div>
      <div>
        <label for="report-warehouse" class="text-sm font-medium text-slate-300">{$isLoading ? 'Warehouse' : $_('warehouse.warehouse')}</label>
        <select id="report-warehouse" class="select-base" bind:value={warehouseId} onchange={() => loadReport()}>
          <option value="">{$isLoading ? 'All warehouses' : $_('common.allWarehouses')}</option>
          {#each warehouses as wh}
            <option value={wh.id}>{wh.name} ({wh.code})</option>
          {/each}
        </select>
      </div>
      <Button variant="secondary" onclick={loadReport}>{$isLoading ? 'Refresh' : $_('common.refresh')}</Button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <ReportsTable
      {reportType}
      {stockOnHandRows}
      {stockAvailableRows}
      {reorderRows}
      {fefoRows}
      {valuation}
      {loading}
    />
  {/if}
</div>
