<script lang="ts">
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import { ArrowRight, Search, X } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { listAssets, type Asset, type AssetStatus } from '$lib/api/assets';

  let query = $state('');
  let status = $state<AssetStatus | ''>('');

  let loading = $state(false);
  let error = $state('');
  let assets = $state<Asset[]>([]);
  let meta = $state({ total: 0, page: 1, limit: 20 });

  const hasSearch = $derived.by(() => query.trim().length > 0 || status !== '');

  async function search(page = 1) {
    if (!hasSearch) {
      assets = [];
      meta = { ...meta, total: 0, page: 1 };
      return;
    }

    try {
      loading = true;
      error = '';
      const response = await listAssets({
        query: query.trim() || undefined,
        status: status || undefined,
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

  function clearSearch() {
    query = '';
    status = '';
    assets = [];
    meta = { ...meta, total: 0, page: 1 };
  }
</script>

<div class="page-shell page-content">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">
        {$isLoading ? 'My Assets' : $_('me.assets.title')}
      </h1>
      <p class="text-sm text-slate-300">
        {$isLoading ? 'Search assets by code, hostname, serial, or management IP.' : $_('me.assets.subtitle')}
      </p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={clearSearch} disabled={!hasSearch || loading}>
        <X class="h-4 w-4 mr-2" />
        {$isLoading ? 'Clear' : $_('common.clear')}
      </Button>
      <Button onclick={() => search(1)} disabled={!hasSearch || loading}>
        <Search class="h-4 w-4 mr-2" />
        {$isLoading ? 'Search' : $_('common.search')}
      </Button>
    </div>
  </div>

  <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
    <div class="space-y-1">
      <label for="my-assets-query" class="text-sm font-semibold text-slate-200">
        {$isLoading ? 'Search' : $_('me.assets.searchLabel')}
      </label>
      <input
        id="my-assets-query"
        class="input-base"
        bind:value={query}
        placeholder={$isLoading ? 'Asset code, hostname, serial…' : $_('me.assets.searchPlaceholder')}
        onkeydown={(e) => e.key === 'Enter' && search(1)}
      />
      <p class="text-xs text-slate-400">{$_('me.assets.searchHelp')}</p>
    </div>

    <div class="space-y-1">
      <label for="my-assets-status" class="text-sm font-semibold text-slate-200">
        {$isLoading ? 'Status' : $_('me.assets.statusLabel')}
      </label>
      <select id="my-assets-status" class="select-base" bind:value={status} onchange={() => search(1)}>
        <option value="">{$isLoading ? 'All statuses' : $_('me.assets.allStatuses')}</option>
        <option value="in_stock">{$_('assets.filters.inStock')}</option>
        <option value="in_use">{$_('assets.filters.inUse')}</option>
        <option value="in_repair">{$_('assets.filters.inRepair')}</option>
        <option value="retired">{$_('assets.filters.retired')}</option>
        <option value="disposed">{$_('assets.filters.disposed')}</option>
        <option value="lost">{$_('assets.filters.lost')}</option>
      </select>
      <p class="text-xs text-slate-400">{$_('me.assets.statusHelp')}</p>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if !hasSearch}
    <div class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
      <div class="text-sm font-semibold text-slate-200">
        {$isLoading ? 'Start with a search' : $_('me.assets.emptyTitle')}
      </div>
      <div class="text-sm mt-1">
        {$isLoading ? 'Enter an asset code or hostname to find what you need.' : $_('me.assets.emptySubtitle')}
      </div>
    </div>
  {:else if assets.length === 0}
    <div class="rounded-xl border border-slate-800 bg-surface-2 p-6">
      <div class="text-sm text-slate-500">{$isLoading ? 'No matches' : $_('me.assets.noMatches')}</div>
    </div>
  {:else}
    <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
      <Table>
        <TableHeader>
          <tr>
            <TableHeaderCell>{$isLoading ? 'Asset' : $_('assets.asset')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Model' : $_('assets.model')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Location' : $_('assets.location')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Action' : $_('common.actions')}</TableHeaderCell>
          </tr>
        </TableHeader>
        <tbody>
          {#each assets as item}
            <TableRow>
              <TableCell>
                <div class="font-semibold text-white">{item.assetCode}</div>
                <div class="text-xs text-slate-500">{item.hostname || item.mgmtIp || '-'}</div>
              </TableCell>
              <TableCell>
                <span class="badge-primary">{$_(`assets.statusByCode.${item.status}`)}</span>
              </TableCell>
              <TableCell>{item.modelName || '-'}</TableCell>
              <TableCell>{item.locationName || '-'}</TableCell>
              <TableCell>
                <a
                  class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
                  href={`/assets/${item.id}`}
                >
                  {$isLoading ? 'View' : $_('common.view')} <ArrowRight class="h-4 w-4" />
                </a>
              </TableCell>
            </TableRow>
          {/each}
        </tbody>
      </Table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{$isLoading ? 'Page' : $_('table.page')} {meta.page}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onclick={() => search(meta.page - 1)}>
          {$isLoading ? 'Previous' : $_('common.previous')}
        </Button>
        <Button size="sm" variant="secondary" disabled={(meta.page * meta.limit) >= meta.total} onclick={() => search(meta.page + 1)}>
          {$isLoading ? 'Next' : $_('common.next')}
        </Button>
      </div>
    </div>
  {/if}
</div>
