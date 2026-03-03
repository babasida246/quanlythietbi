<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import { Package, FileText, Wrench, AlertTriangle, TrendingUp, Warehouse as WarehouseIcon } from 'lucide-svelte';
  import { addNotification } from '$lib/stores/notifications';
  import {
    listWarehouses,
    listSpareParts,
    listStockDocuments,
    listRepairOrders,
    reportReorderAlerts,
    reportStockOnHand,
    type WarehouseRecord,
    type ReorderAlertRow
  } from '$lib/api/warehouse';

  let warehouseCount = $state(0);
  let partCount = $state(0);
  let docCount = $state(0);
  let repairCount = $state(0);
  let reorderAlerts = $state<ReorderAlertRow[]>([]);
  let lowStockCount = $state(0);
  let loading = $state(true);

  const cards = $derived([
    { label: $isLoading ? 'Warehouses' : $_('warehouse.cards.warehouses'), value: warehouseCount, icon: WarehouseIcon, color: 'text-blue-400', bg: 'bg-blue-900/30', href: '/warehouse/warehouses' },
    { label: $isLoading ? 'Parts' : $_('warehouse.cards.parts'), value: partCount, icon: Package, color: 'text-green-400', bg: 'bg-green-900/30', href: '/warehouse/parts' },
    { label: $isLoading ? 'Documents' : $_('warehouse.cards.documents'), value: docCount, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-900/30', href: '/warehouse/documents' },
    { label: $isLoading ? 'Repairs' : $_('warehouse.cards.repairs'), value: repairCount, icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-900/30', href: '/warehouse/repairs' },
    { label: $isLoading ? 'Below minimum' : $_('warehouse.cards.belowMin'), value: lowStockCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-900/30', href: '/warehouse/reports' },
  ]);

  async function loadDashboard() {
    try {
      loading = true;
      const [wh, sp, docs, rp, alerts] = await Promise.all([
        listWarehouses().catch(() => ({ data: [] })),
        listSpareParts({ limit: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
        listStockDocuments({ limit: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
        listRepairOrders({ limit: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
        reportReorderAlerts({}).catch(() => ({ data: [] }))
      ]);
      warehouseCount = (wh as any).data?.length ?? 0;
      partCount = (sp as any).meta?.total ?? (sp as any).data?.length ?? 0;
      docCount = (docs as any).meta?.total ?? (docs as any).data?.length ?? 0;
      repairCount = (rp as any).meta?.total ?? (rp as any).data?.length ?? 0;
      reorderAlerts = (alerts as any).data ?? [];
      lowStockCount = reorderAlerts.length;
      if (lowStockCount > 0) {
        addNotification($isLoading ? `${lowStockCount} parts below minimum stock level` : $_('warehouse.lowStockNotification', { values: { count: lowStockCount } }), 'warning');
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => { void loadDashboard(); });
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold">{$isLoading ? 'Warehouse Overview' : $_('warehouse.overview')}</h2>
    <p class="text-sm text-slate-500">{$isLoading ? 'Key metrics of the warehouse system' : $_('warehouse.overviewSubtitle')}</p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {#each cards as card}
        <a href={card.href} class="card flex items-center gap-3 hover:ring-1 hover:ring-primary/50 transition cursor-pointer" data-testid={`dashboard-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <div class={`rounded-lg p-2 ${card.bg}`}>
            <card.icon class={`h-5 w-5 ${card.color}`} />
          </div>
          <div>
            <p class="text-xs text-slate-500">{card.label}</p>
            <p class="text-xl font-bold">{card.value}</p>
          </div>
        </a>
      {/each}
    </div>

    {#if reorderAlerts.length > 0}
      <div class="card">
        <h3 class="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-red-400" />
          {$isLoading ? `Low stock alerts (${reorderAlerts.length})` : $_('warehouse.reorderAlert', { values: { count: reorderAlerts.length } })}
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-800 text-left text-xs uppercase text-slate-300">
              <tr>
                <th class="px-3 py-2">{$isLoading ? 'Part' : $_('warehouse.alertHeaders.part')}</th>
                <th class="px-3 py-2">{$isLoading ? 'Warehouse' : $_('warehouse.alertHeaders.warehouse')}</th>
                <th class="px-3 py-2">{$isLoading ? 'Stock' : $_('warehouse.alertHeaders.stock')}</th>
                <th class="px-3 py-2">{$isLoading ? 'Min level' : $_('warehouse.alertHeaders.minLevel')}</th>
                <th class="px-3 py-2">{$isLoading ? 'To order' : $_('warehouse.alertHeaders.toOrder')}</th>
              </tr>
            </thead>
            <tbody>
              {#each reorderAlerts.slice(0, 10) as alert}
                <tr class="border-t border-slate-800">
                  <td class="px-3 py-2">{alert.partName}</td>
                  <td class="px-3 py-2">{alert.warehouseName ?? '-'}</td>
                  <td class="px-3 py-2 text-red-400 font-medium">{alert.onHand}</td>
                  <td class="px-3 py-2">{alert.minLevel}</td>
                  <td class="px-3 py-2 text-orange-400">{alert.minLevel - alert.onHand}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if reorderAlerts.length > 10}
          <div class="mt-2 text-center">
            <a href="/warehouse/reports" class="text-sm text-primary hover:underline">{$isLoading ? `View all ${reorderAlerts.length} alerts` : $_('warehouse.viewAllAlerts', { values: { count: reorderAlerts.length } })}</a>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
