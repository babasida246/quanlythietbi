<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { sessionStore } from '$lib/stores/sessionStore';
  import {
    ArrowRight,
    RefreshCw,
    Search,
    Wrench,
    HardDrive,
    CheckCircle2,
    AlertTriangle,
    X,
    ShieldAlert
  } from 'lucide-svelte';
  import {
    listAssets,
    openMaintenanceTicket,
    getAssetStatusCounts,
    type Asset,
    type AssetStatus
  } from '$lib/api/assets';
  import MaintenanceModal from '$lib/assets/components/MaintenanceModal.svelte';
  import StatusBadge from '$lib/assets/components/StatusBadge.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { toast } from '$lib/components/toast';
  import { Button } from '$lib/components/ui';

  // ─── Reactive user from session ──────────────────────────────────────────────
  const user = $derived($sessionStore.user);

  // ─── Filter / Pagination ─────────────────────────────────────────────────────
  type Tab = 'all' | AssetStatus;
  let activeTab = $state<Tab>('all');
  let query = $state('');
  let sortBy = $state<'asset_code_asc' | 'newest' | 'warranty_end_asc'>('asset_code_asc');

  let loading = $state(false);
  let error = $state('');
  let assets = $state<Asset[]>([]);
  let meta = $state({ total: 0, page: 1, limit: 20 });

  // ─── Stats ────────────────────────────────────────────────────────────────────
  let statsLoading = $state(true);
  let stats = $state({ total: 0, in_use: 0, in_repair: 0, in_stock: 0 });

  // ─── Maintenance modal ────────────────────────────────────────────────────────
  let maintenanceOpen = $state(false);
  let maintenanceAsset = $state<Asset | null>(null);

  // ─── Warranty helpers ─────────────────────────────────────────────────────────
  function warrantyDaysLeft(asset: Asset): number | null {
    if (!asset.warrantyEnd) return null;
    return Math.ceil((new Date(asset.warrantyEnd).getTime() - Date.now()) / 86_400_000);
  }

  function warrantyClass(asset: Asset): string {
    const d = warrantyDaysLeft(asset);
    if (d === null) return 'text-slate-500';
    if (d < 0) return 'text-red-400 font-semibold';
    if (d <= 30) return 'text-amber-400 font-semibold';
    return 'text-emerald-400';
  }

  function warrantyLabel(asset: Asset): string {
    const d = warrantyDaysLeft(asset);
    if (d === null) return '—';
    if (d < 0) return $_('me.assets.warrantyExpired');
    if (d <= 30) return `${d}d ⚠`;
    const date = new Date(asset.warrantyEnd!);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const warrantyExpiringCount = $derived(
    assets.filter((a) => {
      const d = warrantyDaysLeft(a);
      return d !== null && d >= 0 && d <= 30;
    }).length
  );

  // ─── Load data ────────────────────────────────────────────────────────────────
  async function load(page = 1) {
    try {
      loading = true;
      error = '';
      const response = await listAssets({
        query: query.trim() || undefined,
        status: activeTab !== 'all' ? (activeTab as AssetStatus) : undefined,
        sort: sortBy,
        page,
        limit: meta.limit
      });
      assets = response.data ?? [];
      meta = {
        total: response.meta?.total ?? assets.length,
        page: response.meta?.page ?? page,
        limit: response.meta?.limit ?? meta.limit
      };
    } catch (err) {
      error = err instanceof Error ? err.message : $_('me.assets.errors.loadFailed');
    } finally {
      loading = false;
    }
  }

  async function loadStats() {
    try {
      statsLoading = true;
      const result = await getAssetStatusCounts();
      if (result?.data) {
        const d = result.data;
        stats = {
          total: (Object.values(d) as number[]).reduce((a: number, b: number) => a + b, 0),
          in_use: d.in_use ?? 0,
          in_repair: d.in_repair ?? 0,
          in_stock: d.in_stock ?? 0
        };
      }
    } catch {
      // stats are non-critical
    } finally {
      statsLoading = false;
    }
  }

  function setTab(tab: Tab) {
    activeTab = tab;
    meta = { ...meta, page: 1 };
    load(1);
  }

  function handleSearch() {
    meta = { ...meta, page: 1 };
    load(1);
  }

  function clearSearch() {
    query = '';
    meta = { ...meta, page: 1 };
    load(1);
  }

  function openMaintenance(asset: Asset) {
    maintenanceAsset = asset;
    maintenanceOpen = true;
  }

  async function handleMaintenanceSubmit(data: {
    title: string;
    severity: import('$lib/api/assets').MaintenanceSeverity;
    diagnosis?: string;
  }) {
    if (!maintenanceAsset) return;
    try {
      await openMaintenanceTicket({ assetId: maintenanceAsset.id, ...data });
      toast.success($_('me.assets.issueReported'));
      maintenanceOpen = false;
    } catch {
      toast.error($_('me.assets.errors.reportFailed'));
    }
  }

  onMount(() => {
    load(1);
    loadStats();
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'me.assets.tabAll' },
    { key: 'in_use', label: 'me.assets.tabInUse' },
    { key: 'in_repair', label: 'me.assets.tabInRepair' },
    { key: 'in_stock', label: 'me.assets.tabInStock' },
    { key: 'retired', label: 'me.assets.tabRetired' }
  ];
</script>

<div class="page-shell page-content space-y-6">

  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-white">
        {$isLoading ? 'My Assets' : $_('me.assets.title')}
      </h1>
      <p class="text-sm text-slate-400 mt-0.5">
        {#if user?.displayName || user?.username}
          {$_('me.assets.greeting', { values: { name: user.displayName || user.username } })} —
        {/if}
        {$isLoading ? 'View and track assets in the system.' : $_('me.assets.subtitle')}
      </p>
    </div>
    <Button variant="secondary" onclick={() => { load(meta.page); loadStats(); }} disabled={loading}>
      <RefreshCw class="h-4 w-4 mr-2 {loading ? 'animate-spin' : ''}" />
      {$isLoading ? 'Refresh' : $_('common.refresh')}
    </Button>
  </div>

  <!-- Stat Cards -->
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <button
      class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-left transition hover:border-slate-600 hover:bg-surface-3"
      onclick={() => setTab('all')}
    >
      {#if statsLoading}
        <Skeleton rows={1} />
      {:else}
        <div class="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
          <HardDrive class="h-4 w-4" />
          {$isLoading ? 'Total' : $_('me.assets.statsTotal')}
        </div>
        <div class="text-2xl font-bold text-white">{stats.total}</div>
      {/if}
    </button>

    <button
      class="rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-4 text-left transition hover:border-emerald-700 hover:bg-emerald-900/30"
      onclick={() => setTab('in_use')}
    >
      {#if statsLoading}
        <Skeleton rows={1} />
      {:else}
        <div class="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
          <CheckCircle2 class="h-4 w-4" />
          {$isLoading ? 'In Use' : $_('me.assets.statsInUse')}
        </div>
        <div class="text-2xl font-bold text-emerald-300">{stats.in_use}</div>
      {/if}
    </button>

    <button
      class="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4 text-left transition hover:border-amber-700 hover:bg-amber-900/30"
      onclick={() => setTab('in_repair')}
    >
      {#if statsLoading}
        <Skeleton rows={1} />
      {:else}
        <div class="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
          <Wrench class="h-4 w-4" />
          {$isLoading ? 'In Repair' : $_('me.assets.statsInRepair')}
        </div>
        <div class="text-2xl font-bold text-amber-300">{stats.in_repair}</div>
      {/if}
    </button>

    <button
      class="rounded-xl border border-red-800/50 bg-red-900/20 p-4 text-left transition hover:border-red-700 hover:bg-red-900/30"
      onclick={() => setTab('all')}
    >
      {#if statsLoading}
        <Skeleton rows={1} />
      {:else}
        <div class="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
          <ShieldAlert class="h-4 w-4" />
          {$isLoading ? 'Warranty Expiring' : $_('me.assets.statsWarrantyExpiring')}
        </div>
        <div class="text-2xl font-bold text-red-300">{warrantyExpiringCount}</div>
        <div class="text-xs text-red-500 mt-0.5">{$isLoading ? 'current page' : $_('me.assets.statsCurrentPage')}</div>
      {/if}
    </button>
  </div>

  <!-- Tab Bar -->
  <div class="flex overflow-x-auto gap-1 border-b border-slate-800 pb-0">
    {#each TABS as tab}
      <button
        class="shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
          {activeTab === tab.key
            ? 'border-primary text-primary bg-primary/10'
            : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'}"
        onclick={() => setTab(tab.key)}
      >
        {$isLoading ? tab.key : $_(tab.label)}
        {#if tab.key === 'in_repair' && stats.in_repair > 0}
          <span class="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {stats.in_repair}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Search / Sort Row -->
  <div class="flex flex-wrap items-end gap-3">
    <div class="relative flex-1 min-w-48">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
      <input
        class="input-base pl-9 pr-8"
        bind:value={query}
        placeholder={$isLoading ? 'Asset code, hostname, serial…' : $_('me.assets.searchPlaceholder')}
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      {#if query}
        <button
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
          onclick={clearSearch}
        >
          <X class="h-4 w-4" />
        </button>
      {/if}
    </div>

    <div class="w-44">
      <select id="my-assets-status" class="select-base" bind:value={activeTab} onchange={() => load(1)}>
        <option value="all">{$isLoading ? 'All' : $_('common.all')}</option>
        <option value="in_stock">{$isLoading ? 'In Stock' : $_('assets.status.inStock')}</option>
        <option value="in_use">{$isLoading ? 'In Use' : $_('assets.status.inUse')}</option>
        <option value="in_repair">{$isLoading ? 'In Repair' : $_('assets.status.inRepair')}</option>
        <option value="retired">{$isLoading ? 'Retired' : $_('assets.status.retired')}</option>
      </select>
    </div>
    <div class="w-44">
      <select class="select-base" bind:value={sortBy} onchange={() => load(1)}>
        <option value="asset_code_asc">{$isLoading ? 'Code A→Z' : $_('me.assets.sortCode')}</option>
        <option value="newest">{$isLoading ? 'Newest' : $_('me.assets.sortNewest')}</option>
        <option value="warranty_end_asc">{$isLoading ? 'Warranty ↑' : $_('me.assets.sortWarranty')}</option>
      </select>
    </div>

    <Button onclick={handleSearch} disabled={loading}>
      <Search class="h-4 w-4 mr-2" />
      {$isLoading ? 'Search' : $_('common.search')}
    </Button>
  </div>

  <!-- Error banner -->
  {#if error}
    <div class="alert alert-error flex items-center gap-2">
      <AlertTriangle class="h-4 w-4 shrink-0" />
      {error}
    </div>
  {/if}

  <!-- Table / Skeleton / Empty -->
  <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
    {#if loading}
      <div class="p-4">
        <Skeleton rows={8} />
      </div>
    {:else if assets.length === 0}
      <div class="p-10 text-center">
        <HardDrive class="mx-auto h-10 w-10 text-slate-600 mb-3" />
        <div class="text-sm font-semibold text-slate-300">
          {$isLoading ? 'No assets' : $_('me.assets.noData')}
        </div>
        <div class="text-xs text-slate-500 mt-1">
          {$isLoading ? 'No items match the current filter.' : $_('me.assets.noDataSub')}
        </div>
        {#if query || activeTab !== 'all'}
          <Button variant="secondary" class="mt-4" onclick={() => { query = ''; setTab('all'); }}>
            <X class="h-4 w-4 mr-2" />
            {$isLoading ? 'Clear filters' : $_('common.clearFilters')}
          </Button>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-800">
            <tr class="text-xs text-slate-400 uppercase tracking-wide">
              <th class="px-4 py-3 text-left">{$isLoading ? 'Asset' : $_('assets.asset')}</th>
              <th class="px-4 py-3 text-left">{$isLoading ? 'Status' : $_('assets.status')}</th>
              <th class="px-4 py-3 text-left hidden md:table-cell">{$isLoading ? 'Model' : $_('assets.model')}</th>
              <th class="px-4 py-3 text-left hidden lg:table-cell">{$isLoading ? 'Location' : $_('assets.location')}</th>
              <th class="px-4 py-3 text-left hidden xl:table-cell">{$isLoading ? 'Warranty' : $_('assets.warranty')}</th>
              <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('common.actions')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            {#each assets as asset (asset.id)}
              <tr class="hover:bg-slate-800/40 transition-colors group">
                <td class="px-4 py-3">
                  <div class="font-semibold text-white">{asset.assetCode}</div>
                  <div class="text-xs text-slate-500 truncate max-w-40">
                    {asset.hostname || asset.mgmtIp || asset.serialNo || '—'}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge status={asset.status} />
                </td>
                <td class="px-4 py-3 hidden md:table-cell text-slate-300">
                  <div>{asset.modelName || '—'}</div>
                  {#if asset.modelBrand}
                    <div class="text-xs text-slate-500">{asset.modelBrand}</div>
                  {/if}
                </td>
                <td class="px-4 py-3 hidden lg:table-cell text-slate-400">
                  {asset.locationName || asset.warehouseName || '—'}
                </td>
                <td class="px-4 py-3 hidden xl:table-cell">
                  <span class={warrantyClass(asset)}>{warrantyLabel(asset)}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100">
                    {#if asset.status === 'in_use' || asset.status === 'in_repair'}
                      <button
                        class="inline-flex items-center gap-1 rounded-md border border-amber-700/50 bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-900/40 transition-colors"
                        onclick={() => openMaintenance(asset)}
                      >
                        <Wrench class="h-3.5 w-3.5" />
                        <span class="hidden sm:inline">{$isLoading ? 'Report' : $_('me.assets.reportIssue')}</span>
                      </button>
                    {/if}
                    <a
                      class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      href={`/assets/${asset.id}`}
                    >
                      {$isLoading ? 'View' : $_('common.view')}
                      <ArrowRight class="h-3 w-3" />
                    </a>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Pagination -->
  {#if !loading && assets.length > 0}
    <div class="flex items-center justify-between text-xs text-slate-500">
      <span>
        {$isLoading ? 'Showing' : $_('table.showing')}
        {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)}
        {$isLoading ? 'of' : $_('table.of')} {meta.total}
      </span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onclick={() => load(meta.page - 1)}>
          {$isLoading ? 'Previous' : $_('common.previous')}
        </Button>
        <Button size="sm" variant="secondary" disabled={meta.page * meta.limit >= meta.total} onclick={() => load(meta.page + 1)}>
          {$isLoading ? 'Next' : $_('common.next')}
        </Button>
      </div>
    </div>
  {/if}

</div>

<!-- Maintenance Modal -->
<MaintenanceModal
  bind:open={maintenanceOpen}
  assetCode={maintenanceAsset?.assetCode ?? ''}
  onsubmit={handleMaintenanceSubmit}
/>
