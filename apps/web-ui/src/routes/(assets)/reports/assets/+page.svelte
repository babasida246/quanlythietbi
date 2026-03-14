<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { _, isLoading } from '$lib/i18n';
  import ReportsPanel from '$lib/assets/components/ReportsPanel.svelte';
  import { listAssets, type AssetStatus } from '$lib/api/assets';
  import { getAssetCatalogs, type Catalogs } from '$lib/api/assetCatalogs';

  let catalogs = $state<Catalogs | null>(null);
  let statusRows = $state<Array<{ label: string; value: number }>>([]);
  let categoryRows = $state<Array<{ label: string; value: number }>>([]);
  let locationRows = $state<Array<{ label: string; value: number }>>([]);
  let loading = $state(true);
  let error = $state('');

  const totalAssets = $derived(statusRows.reduce((sum, row) => sum + row.value, 0));
  const totalCategories = $derived(categoryRows.length);
  const totalLocations = $derived(locationRows.length);

  const statusLabels = $derived.by<Array<{ key: AssetStatus; label: string }>>(() => ([
    { key: 'in_stock', label: $_('assets.statusLabels.inStock') },
    { key: 'in_use', label: $_('assets.statusLabels.inUse') },
    { key: 'in_repair', label: $_('assets.statusLabels.inRepair') },
    { key: 'retired', label: $_('assets.statusLabels.retired') },
    { key: 'disposed', label: $_('assets.statusLabels.disposed') },
    { key: 'lost', label: $_('assets.statusLabels.lost') }
  ]));

  async function fetchCount(filters: Record<string, string>): Promise<number> {
    const response = await listAssets({ ...filters, page: 1, limit: 1 });
    return response.meta?.total ?? response.data.length;
  }

  async function loadReports() {
    try {
      loading = true;
      const catalogResp = await getAssetCatalogs();
      catalogs = catalogResp.data ?? [];

      const statusCounts = await Promise.all(statusLabels.map(async status => ({
        label: status.label,
        value: await fetchCount({ status: status.key })
      })));
      statusRows = statusCounts;

      const categoryCounts = await Promise.all((catalogs?.categories ?? []).map(async category => ({
        label: category.name,
        value: await fetchCount({ categoryId: category.id })
      })));
      categoryRows = categoryCounts;

      const locationCounts = await Promise.all((catalogs?.locations ?? []).map(async location => ({
        label: location.name,
        value: await fetchCount({ locationId: location.id })
      })));
      locationRows = locationCounts;
    } catch (err) {
      error = err instanceof Error ? err.message : $_('reports.errors.loadAssetsFailed');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadReports();
  });
</script>

<div class="page-shell page-content space-y-4">
  <PageHeader
    title={$isLoading ? 'Asset Reports' : $_('reports.assetsTitle')}
    subtitle={$isLoading ? 'Summary by status, category, and location' : $_('reports.assetsSubtitle')}
  />

  <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Total assets' : $_('reports.col.total')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{totalAssets.toLocaleString('vi-VN')}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Categories' : $_('assets.category')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{totalCategories}</p>
    </div>
    <div class="card p-3">
      <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted)">{$isLoading ? 'Locations' : $_('assets.location')}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" style="color: var(--color-text)">{totalLocations}</p>
    </div>
  </section>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="card flex items-center justify-center p-8">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ReportsPanel title={$isLoading ? 'Status' : $_('assets.status')} rows={statusRows} />
      <ReportsPanel title={$isLoading ? 'Category' : $_('assets.category')} rows={categoryRows} />
      <ReportsPanel title={$isLoading ? 'Location' : $_('assets.location')} rows={locationRows} />
    </div>
  {/if}

  </div>
