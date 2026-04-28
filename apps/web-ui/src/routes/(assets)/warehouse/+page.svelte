<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import { Package, FileText, Wrench, AlertTriangle, TrendingUp, Warehouse as WarehouseIcon, RefreshCw, ArrowUpRight, ArrowDownRight, Clock, DollarSign, BarChart3, Layers } from 'lucide-svelte';
  import { addNotification } from '$lib/stores/notifications';
  import {
    listWarehouses,
    listSpareParts,
    listStockDocuments,
    listRepairOrders,
    reportReorderAlerts,
    reportStockOnHand,
    reportStockAvailable,
    type WarehouseRecord,
    type ReorderAlertRow,
    type StockOnHandRow,
    type StockDocumentRecord
  } from '$lib/api/warehouse';
  import { Button } from '$lib/components/ui';
  import PageHeader from '$lib/components/PageHeader.svelte';

  // ─── State ───────────────────────────────────────────────────────────────
  let warehouseCount = $state(0);
  let partCount = $state(0);
  let docCount = $state(0);
  let repairCount = $state(0);
  let reorderAlerts = $state<ReorderAlertRow[]>([]);
  let lowStockCount = $state(0);
  let loading = $state(true);
  let stockOnHand = $state<StockOnHandRow[]>([]);
  let recentDocs = $state<StockDocumentRecord[]>([]);
  let totalStockValue = $state(0);
  let totalStockQty = $state(0);
  let warehouseNames = $state<string[]>([]);

  // ─── Quick action cards ──────────────────────────────────────────────────
  const quickActions = $derived([
    { label: $isLoading ? 'New Receipt' : $_('warehouse.quickActions.newReceipt'), icon: ArrowDownRight, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40', href: '/warehouse/documents' },
    { label: $isLoading ? 'New Issue' : $_('warehouse.quickActions.newIssue'), icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/40', href: '/warehouse/documents' },
    { label: $isLoading ? 'Reconciliation' : $_('warehouse.quickActions.reconciliation'), icon: Layers, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40', href: '/warehouse/reconciliation' },
    { label: $isLoading ? 'Purchase Plans' : $_('warehouse.quickActions.purchasePlans'), icon: FileText, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40', href: '/warehouse/purchase-plans' },
  ]);

  // ─── Stat cards ──────────────────────────────────────────────────────────
  const cards = $derived([
    { label: $isLoading ? 'Warehouses' : $_('warehouse.cards.warehouses'), value: warehouseCount, icon: WarehouseIcon, color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-800/40', href: '/warehouse/warehouses' },
    { label: $isLoading ? 'Parts' : $_('warehouse.cards.parts'), value: partCount, icon: Package, color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-800/40', href: '/warehouse/parts' },
    { label: $isLoading ? 'Documents' : $_('warehouse.cards.documents'), value: docCount, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-800/40', href: '/warehouse/documents' },
    { label: $isLoading ? 'Repairs' : $_('warehouse.cards.repairs'), value: repairCount, icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-800/40', href: '/maintenance' },
    { label: $isLoading ? 'Below minimum' : $_('warehouse.cards.belowMin'), value: lowStockCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-800/40', href: '/reports?report=warehouse-reorder-alerts' },
  ]);

  // ─── Top movers (by onHand quantity) ──────────────────────────────────────
  const topItems = $derived(
    [...stockOnHand].sort((a, b) => (b.onHand ?? 0) - (a.onHand ?? 0)).slice(0, 8)
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function formatValue(n: number) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('vi-VN');
  }

  function docTypeBadge(type: string) {
    if (type === 'receipt') return 'badge badge-green';
    if (type === 'issue') return 'badge badge-red';
    if (type === 'transfer') return 'badge badge-blue';
    return 'badge badge-gray';
  }

  function docTypeLabel(type: string) {
    if (type === 'receipt') return $isLoading ? 'Receipt' : $_('warehouse.docType.receipt');
    if (type === 'issue') return $isLoading ? 'Issue' : $_('warehouse.docType.issue');
    if (type === 'transfer') return $isLoading ? 'Transfer' : $_('warehouse.docType.transfer');
    return type;
  }

  // ─── Data loading ─────────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      loading = true;
      const [wh, sp, docs, rp, alerts, stock] = await Promise.all([
        listWarehouses().catch(() => ({ data: [] })),
        listSpareParts({ limit: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
        listStockDocuments({ limit: 5 }).catch(() => ({ data: [], meta: { total: 0 } })),
        listRepairOrders({ limit: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
        reportReorderAlerts({}).catch(() => ({ data: [] })),
        reportStockOnHand({}).catch(() => ({ data: [] }))
      ]);
      warehouseCount = (wh as any).data?.length ?? 0;
      warehouseNames = ((wh as any).data ?? []).map((w: any) => w.name ?? w.code ?? 'Unknown');
      partCount = (sp as any).meta?.total ?? (sp as any).data?.length ?? 0;
      docCount = (docs as any).meta?.total ?? (docs as any).data?.length ?? 0;
      recentDocs = ((docs as any).data ?? []).slice(0, 5);
      repairCount = (rp as any).meta?.total ?? (rp as any).data?.length ?? 0;
      reorderAlerts = (alerts as any).data ?? [];
      lowStockCount = reorderAlerts.length;
      stockOnHand = (stock as any).data ?? [];

      // Compute totals
      totalStockQty = stockOnHand.reduce((s, r) => s + (r.onHand ?? 0), 0);
      totalStockValue = stockOnHand.reduce((s, r) => s + ((r.onHand ?? 0) * ((r as any).unitCost ?? 0)), 0);

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
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Warehouse Overview' : $_('warehouse.overview')}</h2>
      <p class="text-sm text-slate-500">{$isLoading ? 'Key metrics and summary of the warehouse system' : $_('warehouse.overviewSubtitle')}</p>
    </div>
    <Button variant="ghost" size="sm" onclick={() => loadDashboard()}>
      <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
    </Button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <!-- Stat cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {#each cards as card}
        <a href={card.href} class="rounded-xl border {card.border} {card.bg} p-4 hover:ring-1 hover:ring-primary/50 transition cursor-pointer" data-testid={`dashboard-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <div class="flex items-center gap-2 mb-2">
            <card.icon class={`h-4 w-4 ${card.color}`} />
            <span class="text-xs text-slate-400">{card.label}</span>
          </div>
          <p class="text-2xl font-bold text-white">{card.value}</p>
        </a>
      {/each}
    </div>

    <!-- Stock value summary + Quick actions row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Stock value -->
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-5 lg:col-span-1">
        <div class="flex items-center gap-2 mb-4">
          <DollarSign class="h-4 w-4 text-emerald-400" />
          <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Stock Value' : $_('warehouse.stockValue')}</h3>
        </div>
        <div class="space-y-3">
          <div>
            <p class="text-xs text-slate-500">{$isLoading ? 'Total value' : $_('warehouse.totalValue')}</p>
            <p class="text-2xl font-bold text-emerald-400">{formatValue(totalStockValue)} ₫</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">{$isLoading ? 'Total quantity' : $_('warehouse.totalQuantity')}</p>
            <p class="text-xl font-semibold text-white">{totalStockQty.toLocaleString('vi-VN')}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">{$isLoading ? 'Warehouses' : $_('warehouse.cards.warehouses')}</p>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each warehouseNames.slice(0, 5) as name}
                <span class="badge badge-blue">{name}</span>
              {/each}
              {#if warehouseNames.length > 5}
                <span class="badge badge-gray">+{warehouseNames.length - 5}</span>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-5 lg:col-span-2">
        <div class="flex items-center gap-2 mb-4">
          <TrendingUp class="h-4 w-4 text-blue-400" />
          <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Quick Actions' : $_('warehouse.quickActionsTitle')}</h3>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {#each quickActions as action}
            <a href={action.href} class="rounded-lg border {action.bg} p-3 text-center hover:ring-1 hover:ring-primary/50 transition group">
              <action.icon class={`h-5 w-5 mx-auto mb-1.5 ${action.color} group-hover:scale-110 transition-transform`} />
              <span class="text-xs font-medium text-slate-300">{action.label}</span>
            </a>
          {/each}
        </div>

        <!-- Recent documents -->
        {#if recentDocs.length > 0}
          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Clock class="h-3.5 w-3.5 text-slate-500" />
                <span class="text-xs font-medium text-slate-400">{$isLoading ? 'Recent Documents' : $_('warehouse.recentDocs')}</span>
              </div>
              <a href="/warehouse/documents" class="text-xs text-primary hover:underline">{$isLoading ? 'View all' : $_('common.viewAll')}</a>
            </div>
            <div class="space-y-1.5">
              {#each recentDocs as doc}
                <div class="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2">
                  <div class="flex items-center gap-2">
                    <span class={docTypeBadge((doc as any).docType ?? (doc as any).type ?? '')}>{docTypeLabel((doc as any).docType ?? (doc as any).type ?? '')}</span>
                    <span class="text-xs text-white font-medium">{(doc as any).docCode ?? (doc as any).code ?? '—'}</span>
                  </div>
                  <span class="text-xs text-slate-500">{(doc as any).createdAt ? new Date((doc as any).createdAt).toLocaleDateString('vi-VN') : ''}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Top stock items -->
    {#if topItems.length > 0}
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <BarChart3 class="h-4 w-4 text-blue-400" />
            <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Top Items by Stock' : $_('warehouse.topItems')}</h3>
          </div>
          <a href="/reports?report=warehouse-stock-on-hand" class="text-xs text-primary hover:underline">{$isLoading ? 'Full report' : $_('warehouse.fullReport')}</a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {#each topItems as item}
            <div class="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <p class="text-xs text-slate-400 truncate">{(item as any).modelName ?? (item as any).partName ?? (item as any).partCode}</p>
              <div class="flex items-end justify-between mt-1">
                <span class="text-lg font-bold text-white">{(item.onHand ?? 0).toLocaleString('vi-VN')}</span>
                <span class="text-xs text-slate-500">{(item as any).warehouseName ?? ''}</span>
              </div>
              {#if (item as any).minLevel && item.onHand < (item as any).minLevel}
                <div class="h-1 mt-2 rounded-full bg-red-900/50">
                  <div class="h-1 rounded-full bg-red-500" style="width: {Math.min(100, (item.onHand / (item as any).minLevel) * 100)}%"></div>
                </div>
              {:else}
                <div class="h-1 mt-2 rounded-full bg-emerald-900/50">
                  <div class="h-1 rounded-full bg-emerald-500" style="width: 100%"></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Reorder alerts -->
    {#if reorderAlerts.length > 0}
      <div class="rounded-xl border border-red-900/40 bg-red-900/10 p-5">
        <h3 class="font-semibold mb-3 flex items-center gap-2 text-red-400">
          <AlertTriangle class="h-4 w-4" />
          {$isLoading ? `Low stock alerts (${reorderAlerts.length})` : $_('warehouse.reorderAlert', { values: { count: reorderAlerts.length } })}
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="border-b border-red-900/30 text-left text-xs uppercase text-slate-400">
              <tr>
                <th class="px-3 py-2">{$isLoading ? 'Part' : $_('warehouse.alertHeaders.part')}</th>
                <th class="px-3 py-2">{$isLoading ? 'Warehouse' : $_('warehouse.alertHeaders.warehouse')}</th>
                <th class="px-3 py-2 text-right">{$isLoading ? 'Stock' : $_('warehouse.alertHeaders.stock')}</th>
                <th class="px-3 py-2 text-right">{$isLoading ? 'Min level' : $_('warehouse.alertHeaders.minLevel')}</th>
                <th class="px-3 py-2 text-right">{$isLoading ? 'To order' : $_('warehouse.alertHeaders.toOrder')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-red-900/20">
              {#each reorderAlerts.slice(0, 10) as alert}
                <tr class="hover:bg-red-900/10 transition-colors">
                  <td class="px-3 py-2 font-medium text-white">{(alert as any).modelName ?? alert.partName}</td>
                  <td class="px-3 py-2 text-slate-400">{alert.warehouseName ?? '-'}</td>
                  <td class="px-3 py-2 text-right text-red-400 font-bold">{alert.onHand}</td>
                  <td class="px-3 py-2 text-right text-slate-400">{alert.minLevel}</td>
                  <td class="px-3 py-2 text-right text-orange-400 font-semibold">{alert.minLevel - alert.onHand}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if reorderAlerts.length > 10}
          <div class="mt-3 text-center">
            <a href="/reports?report=warehouse-reorder-alerts" class="text-sm text-primary hover:underline">{$isLoading ? `View all ${reorderAlerts.length} alerts` : $_('warehouse.viewAllAlerts', { values: { count: reorderAlerts.length } })}</a>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
