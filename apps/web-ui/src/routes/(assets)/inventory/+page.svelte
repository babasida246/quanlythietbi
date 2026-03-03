<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw, Calendar, MapPin, X } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading as i18nLoading } from '$lib/i18n';
  import { listInventorySessions, createInventorySession, type InventorySession } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';

  let sessions = $state<InventorySession[]>([]);
  let locations = $state<Location[]>([]);
  let loading = $state(true);
  let error = $state('');
  let filterStatus = $state<string>('');

  // Create form
  let showCreate = $state(false);
  let creating = $state(false);
  let newName = $state('');
  let newLocationId = $state('');
  let createError = $state('');

  const statusLabels: Record<string, string> = $derived({
    draft: $i18nLoading ? 'Draft' : $_('inventory.status.draft'),
    in_progress: $i18nLoading ? 'In progress' : $_('inventory.status.in_progress'),
    closed: $i18nLoading ? 'Closed' : $_('inventory.status.closed'),
    canceled: $i18nLoading ? 'Canceled' : $_('inventory.status.canceled')
  });

  const statusClass: Record<string, string> = {
    draft: 'badge-primary',
    in_progress: 'badge-info',
    closed: 'badge-success',
    canceled: 'badge-error'
  };

  const locationMap = $derived(new Map(locations.map(l => [l.id, l.name])));

  const filteredSessions = $derived(
    filterStatus ? sessions.filter(s => s.status === filterStatus) : sessions
  );

  const counts = $derived({
    all: sessions.length,
    draft: sessions.filter(s => s.status === 'draft').length,
    in_progress: sessions.filter(s => s.status === 'in_progress').length,
    closed: sessions.filter(s => s.status === 'closed').length
  });

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [sessResult, catResult] = await Promise.all([
        listInventorySessions({ limit: 100 }),
        getAssetCatalogs()
      ]);
      sessions = sessResult.data || [];
      locations = catResult.data.locations || [];
    } catch (err) {
      error = err instanceof Error ? err.message : ($i18nLoading ? 'Failed to load data' : $_('inventory.errors.loadFailed'));
    } finally {
      loading = false;
    }
  }

  async function handleCreate(event: Event) {
    event.preventDefault();
    if (!newName.trim()) return;
    try {
      creating = true;
      createError = '';
      const result = await createInventorySession({
        name: newName.trim(),
        locationId: newLocationId || undefined
      });
      if (result.data?.id) {
        goto(`/inventory/${result.data.id}`);
      }
    } catch (err) {
      createError = err instanceof Error ? err.message : ($i18nLoading ? 'Failed to create session' : $_('inventory.errors.createFailed'));
    } finally {
      creating = false;
    }
  }

  function openCreate() {
    newName = ($i18nLoading ? 'Inventory' : $_('inventory.sessionNamePrefix')) + ` ${new Date().toLocaleDateString('vi-VN')}`;
    newLocationId = '';
    createError = '';
    showCreate = true;
  }

  $effect(() => {
    void loadData();
  });
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{$i18nLoading ? 'Equipment Inventory' : $_('inventory.pageTitle')}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">{$i18nLoading ? 'Manage physical asset inventory sessions' : $_('inventory.pageSubtitle')}</p>
    </div>
    <div class="flex gap-2">
      <Button onclick={openCreate}>
        <Plus class="w-4 h-4 mr-2" /> {$i18nLoading ? 'Create session' : $_('inventory.createSession')}
      </Button>
      <Button variant="secondary" onclick={loadData} disabled={loading}>
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
      </Button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  <!-- Create Form Modal -->
  {#if showCreate}
    <div class="card mb-6 border border-primary/30">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">{$i18nLoading ? 'Create inventory session' : $_('inventory.createTitle')}</h2>
        <button onclick={() => showCreate = false} class="btn-ghost btn-sm p-1"><X class="w-4 h-4" /></button>
      </div>
      {#if createError}
        <div class="alert alert-error mb-3 text-sm">{createError}</div>
      {/if}
      <form onsubmit={handleCreate} class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label for="newName" class="mb-1 block text-xs font-medium text-slate-400">{$i18nLoading ? 'Session name' : $_('inventory.sessionName')} <span class="text-red-500">*</span></label>
          <input id="newName" class="input-base" bind:value={newName} placeholder={$i18nLoading ? 'E.g.: Inventory Q1/2025 — Server room' : $_('inventory.sessionNamePlaceholder')} required />
        </div>
        <div>
          <label for="newLocationId" class="mb-1 block text-xs font-medium text-slate-400">{$i18nLoading ? 'Area / Location' : $_('inventory.locationLabel')}</label>
          <select id="newLocationId" class="input-base" bind:value={newLocationId}>
            <option value="">{$i18nLoading ? '— All areas —' : $_('inventory.allLocations')}</option>
            {#each locations as loc}
              <option value={loc.id}>{loc.name}</option>
            {/each}
          </select>
        </div>
        <div class="flex items-end gap-2">
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? ($i18nLoading ? 'Creating...' : $_('inventory.creating')) : ($i18nLoading ? 'Create session' : $_('inventory.create'))}
          </Button>
          <Button type="button" variant="secondary" onclick={() => showCreate = false}>{$i18nLoading ? 'Cancel' : $_('inventory.cancel')}</Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Status filter tabs -->
  <div class="flex gap-2 mb-4 flex-wrap">
    {#each [
      { key: '', label: $i18nLoading ? `All (${counts.all})` : $_('inventory.filterAll', { values: { count: counts.all } }) },
      { key: 'draft', label: $i18nLoading ? `Draft (${counts.draft})` : $_('inventory.filterDraft', { values: { count: counts.draft } }) },
      { key: 'in_progress', label: $i18nLoading ? `In progress (${counts.in_progress})` : $_('inventory.filterInProgress', { values: { count: counts.in_progress } }) },
      { key: 'closed', label: $i18nLoading ? `Closed (${counts.closed})` : $_('inventory.filterClosed', { values: { count: counts.closed } }) }
    ] as tab}
      <button
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors {filterStatus === tab.key
          ? 'bg-primary text-primary-content border-primary'
          : 'border-base-300 hover:border-primary/50 text-base-content'}"
        onclick={() => (filterStatus = tab.key)}
      >{tab.label}</button>
    {/each}
  </div>

  {#if loading}
    <div class="flex items-center justify-center p-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if filteredSessions.length === 0}
    <div class="card text-center py-12">
      <p class="text-gray-500 mb-4">
        {filterStatus ? ($i18nLoading ? 'No sessions in this status' : $_('inventory.noSessionsInStatus')) : ($i18nLoading ? 'No inventory sessions yet' : $_('inventory.noSessions'))}
      </p>
      {#if !filterStatus}
        <Button onclick={openCreate}>{$i18nLoading ? 'Create first session' : $_('inventory.createFirst')}</Button>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredSessions as session}
        <a href="/inventory/{session.id}" class="card block hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
          <div class="flex items-start justify-between mb-3">
            <h3 class="font-semibold text-base leading-tight flex-1 mr-2">{session.name}</h3>
            <span class="badge shrink-0 {statusClass[session.status] ?? 'badge-primary'}">
              {statusLabels[session.status] ?? session.status}
            </span>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
            {#if session.locationId}
              <div class="flex items-center gap-2">
                <MapPin class="w-3.5 h-3.5 shrink-0" />
                <span>{locationMap.get(session.locationId) ?? session.locationId}</span>
              </div>
            {:else}
              <div class="flex items-center gap-2 text-gray-400">
                <MapPin class="w-3.5 h-3.5 shrink-0" />
                <span>{$i18nLoading ? 'All areas' : $_('inventory.allAreas')}</span>
              </div>
            {/if}
            <div class="flex items-center gap-2">
              <Calendar class="w-3.5 h-3.5 shrink-0" />
              <span>{$i18nLoading ? `Created ${new Date(session.createdAt).toLocaleDateString('vi-VN')}` : $_('inventory.createdAtDate', { values: { date: new Date(session.createdAt).toLocaleDateString('vi-VN') } })}</span>
            </div>
            {#if session.startedAt}
              <div class="text-xs text-blue-500 dark:text-blue-400">
                {$i18nLoading ? `Started: ${new Date(session.startedAt).toLocaleString('vi-VN')}` : $_('inventory.startedAt', { values: { date: new Date(session.startedAt).toLocaleString('vi-VN') } })}
              </div>
            {/if}
            {#if session.closedAt}
              <div class="text-xs text-green-600 dark:text-green-400">
                {$i18nLoading ? `Closed: ${new Date(session.closedAt).toLocaleString('vi-VN')}` : $_('inventory.closedAtDate', { values: { date: new Date(session.closedAt).toLocaleString('vi-VN') } })}
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
