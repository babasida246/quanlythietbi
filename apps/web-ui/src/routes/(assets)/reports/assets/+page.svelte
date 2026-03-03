<script lang="ts">
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

  $effect(() => {
    void loadReports();
  });
</script>

  <div class="page-shell page-content">
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">{$isLoading ? 'Asset Reports' : $_('reports.assetsTitle')}</h1>
    <p class="text-sm text-gray-500">
      {$isLoading ? 'Summary by status, category, and location' : $_('reports.assetsSubtitle')}
    </p>
  </div>

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center p-8">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ReportsPanel title={$isLoading ? 'Status' : $_('assets.status')} rows={statusRows} />
      <ReportsPanel title={$isLoading ? 'Category' : $_('assets.category')} rows={categoryRows} />
      <ReportsPanel title={$isLoading ? 'Location' : $_('assets.location')} rows={locationRows} />
    </div>
  {/if}
</div>
