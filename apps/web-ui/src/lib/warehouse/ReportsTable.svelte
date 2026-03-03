<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import DataTable from '$lib/components/DataTable.svelte';
  import type {
    FefoLotRow,
    ReorderAlertRow,
    StockAvailableRow,
    StockOnHandRow,
    ValuationResult
  } from '$lib/api/warehouse';

  type ReportType = 'stockOnHand' | 'stockAvailable' | 'reorderAlerts' | 'fefoLots' | 'valuation';

  type Props = {
    reportType: ReportType;
    stockOnHandRows?: StockOnHandRow[];
    stockAvailableRows?: StockAvailableRow[];
    reorderRows?: ReorderAlertRow[];
    fefoRows?: FefoLotRow[];
    valuation?: ValuationResult | null;
    loading?: boolean;
  };

  let {
    reportType,
    stockOnHandRows = [],
    stockAvailableRows = [],
    reorderRows = [],
    fefoRows = [],
    valuation = null,
    loading = false
  }: Props = $props();

  // Stock On Hand columns
  const stockOnHandColumns = [
    { key: 'warehouseName', label: $isLoading ? 'Warehouse' : $_('warehouse.warehouse'), sortable: true, filterable: true },
    { 
      key: 'partCode', 
      label: $isLoading ? 'Part' : $_('warehouse.part'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: StockOnHandRow) => `${row.partCode} - ${row.partName}`
    },
    { 
      key: 'onHand', 
      label: $isLoading ? 'On hand' : $_('inventory.onHand'), 
      sortable: true,
      render: (_value: unknown, row: StockOnHandRow) => `<span class="text-right block">${row.onHand}</span>`
    },
    { 
      key: 'minLevel', 
      label: $isLoading ? 'Min level' : $_('common.minLevel'), 
      sortable: true,
      render: (_value: unknown, row: StockOnHandRow) => `<span class="text-right block">${row.minLevel}</span>`
    }
  ];

  // Stock Available columns
  const stockAvailableColumns = [
    { key: 'warehouseName', label: $isLoading ? 'Warehouse' : $_('warehouse.warehouse'), sortable: true, filterable: true },
    { 
      key: 'partCode', 
      label: $isLoading ? 'Part' : $_('warehouse.part'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: StockAvailableRow) => `${row.partCode} - ${row.partName}`
    },
    { 
      key: 'onHand', 
      label: $isLoading ? 'On hand' : $_('inventory.onHand'), 
      sortable: true,
      render: (_value: unknown, row: StockAvailableRow) => `<span class="text-right block">${row.onHand}</span>`
    },
    { 
      key: 'reserved', 
      label: $isLoading ? 'Reserved' : $_('inventory.reserved'), 
      sortable: true,
      render: (_value: unknown, row: StockAvailableRow) => `<span class="text-right block">${row.reserved}</span>`
    },
    { 
      key: 'available', 
      label: $isLoading ? 'Available' : $_('inventory.available'), 
      sortable: true,
      render: (_value: unknown, row: StockAvailableRow) => `<span class="text-right block">${row.available}</span>`
    }
  ];

  // Reorder Alerts columns
  const reorderAlertsColumns = [
    { key: 'warehouseName', label: $isLoading ? 'Warehouse' : $_('warehouse.warehouse'), sortable: true, filterable: true },
    { 
      key: 'partCode', 
      label: $isLoading ? 'Part' : $_('warehouse.part'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: ReorderAlertRow) => `${row.partCode} - ${row.partName}`
    },
    { 
      key: 'onHand', 
      label: $isLoading ? 'On hand' : $_('inventory.onHand'), 
      sortable: true,
      render: (_value: unknown, row: ReorderAlertRow) => `<span class="text-right block">${row.onHand}</span>`
    },
    { 
      key: 'minLevel', 
      label: $isLoading ? 'Min level' : $_('common.minLevel'), 
      sortable: true,
      render: (_value: unknown, row: ReorderAlertRow) => `<span class="text-right block">${row.minLevel}</span>`
    }
  ];

  // FEFO Lots columns
  const fefoLotsColumns = [
    { key: 'warehouseName', label: $isLoading ? 'Warehouse' : $_('warehouse.warehouse'), sortable: true, filterable: true },
    { 
      key: 'partCode', 
      label: $isLoading ? 'Part' : $_('warehouse.part'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: FefoLotRow) => `${row.partCode} - ${row.partName}`
    },
    { key: 'lotNumber', label: $isLoading ? 'Lot' : $_('warehouse.lot'), sortable: true, filterable: true },
    { 
      key: 'expiryDate', 
      label: $isLoading ? 'Expiry' : $_('warehouse.expiry'), 
      sortable: true,
      render: (_value: unknown, row: FefoLotRow) => row.expiryDate ?? '-'
    },
    { key: 'status', label: $isLoading ? 'Status' : $_('assets.status'), sortable: true, filterable: true }
  ];

  // Valuation columns
  const valuationColumns = [
    { 
      key: 'partCode', 
      label: $isLoading ? 'Part' : $_('warehouse.part'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: any) => `${row.partCode} - ${row.partName}`
    },
    { 
      key: 'onHand', 
      label: $isLoading ? 'On hand' : $_('inventory.onHand'), 
      sortable: true,
      render: (_value: unknown, row: any) => `<span class="text-right block">${row.onHand}</span>`
    },
    { 
      key: 'avgCost', 
      label: $isLoading ? 'Avg cost' : $_('warehouse.avgCost'), 
      sortable: true,
      render: (_value: unknown, row: any) => `<span class="text-right block">${row.avgCost}</span>`
    },
    { 
      key: 'value', 
      label: $isLoading ? 'Value' : $_('warehouse.value'), 
      sortable: true,
      render: (_value: unknown, row: any) => `<span class="text-right block">${row.value}</span>`
    }
  ];

  const rawData = $derived.by(() => {
    switch (reportType) {
      case 'stockOnHand':
        return stockOnHandRows;
      case 'stockAvailable':
        return stockAvailableRows;
      case 'reorderAlerts':
        return reorderRows;
      case 'fefoLots':
        return fefoRows;
      case 'valuation':
        return valuation?.items ?? [];
      default:
        return [];
    }
  });

  // Add a unique _rowKey to prevent duplicate key errors when the same part
  // appears in multiple warehouses (partCode is not unique across warehouses)
  const data = $derived(
    (rawData as Record<string, unknown>[]).map((row, i) => ({
      ...row,
      _rowKey: `${reportType}-${i}-${(row['warehouseId'] ?? '') as string}-${(row['partId'] ?? row['partCode'] ?? i) as string}`
    }))
  );

  const columns = $derived.by(() => {
    switch (reportType) {
      case 'stockOnHand':
        return stockOnHandColumns;
      case 'stockAvailable':
        return stockAvailableColumns;
      case 'reorderAlerts':
        return reorderAlertsColumns;
      case 'fefoLots':
        return fefoLotsColumns;
      case 'valuation':
        return valuationColumns;
      default:
        return [];
    }
  });
</script>

{#if reportType === 'valuation' && valuation}
  <div class="space-y-3">
    <div class="text-sm text-slate-600 dark:text-slate-400">
      {$isLoading ? 'Total value:' : $_('warehouse.totalValue')}
      <span class="font-semibold">{valuation.currency ?? ''} {valuation.total ?? 0}</span>
    </div>
    <DataTable
      data={data as any[]}
      columns={columns as any[]}
      rowKey="_rowKey"
      selectable={false}
      {loading}
    />
  </div>
{:else}
  <DataTable
    data={data as any[]}
    columns={columns as any[]}
    rowKey="_rowKey"
    selectable={false}
    {loading}
  />
{/if}

