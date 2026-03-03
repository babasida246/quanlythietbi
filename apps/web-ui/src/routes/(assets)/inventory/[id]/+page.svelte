<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui';
  import { Scan, ArrowLeft, Play, Lock, RotateCcw, MapPin, CheckCircle2, AlertTriangle, HelpCircle, AlertCircle } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import {
    getInventorySessionDetail,
    scanInventoryAsset,
    closeInventorySession,
    startInventorySession,
    undoInventoryScan,
    type InventorySession,
    type InventoryItem
  } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';

  let session = $state<InventorySession | null>(null);
  let items = $state<InventoryItem[]>([]);
  let locations = $state<Location[]>([]);
  let loading = $state(true);
  let error = $state('');
  let scanCode = $state('');
  let scanLocationId = $state('');
  let scanNote = $state('');
  let scanning = $state(false);
  let scanError = $state('');
  let scanSuccess = $state('');
  let actionLoading = $state(false);

  const sessionId = $derived(page.params.id ?? '');

  const locationMap = $derived(new Map(locations.map(l => [l.id, l.name])));

  const duplicateWarning = $derived(
    scanCode.trim() && items.some(i => {
      // We don't directly store assetCode on items, but scannedAt being set means it was found
      return false; // Will be improved once assetCode is on InventoryItem
    })
  );

  const kpi = $derived({
    total: items.length,
    found: items.filter(i => i.status === 'found').length,
    moved: items.filter(i => i.status === 'moved').length,
    unknown: items.filter(i => i.status === 'unknown').length,
    missing: items.filter(i => i.status === 'missing').length
  });

  const canScan = $derived(session?.status === 'draft' || session?.status === 'in_progress');

  const statusLabels = $derived<Record<string, string>>({
    draft: $_('inventory.status.created'),
    in_progress: $_('inventory.status.inProgress'),
    closed: $_('inventory.status.closed'),
    canceled: $_('inventory.status.canceled')
  });

  const statusClass: Record<string, string> = {
    draft: 'badge-primary',
    in_progress: 'badge-info',
    closed: 'badge-success',
    canceled: 'badge-error'
  };

  const itemStatusLabels = $derived<Record<string, string>>({
    found: $_('inventory.itemStatus.matched'),
    moved: $_('inventory.itemStatus.moved'),
    unknown: $_('inventory.itemStatus.unknown'),
    missing: $_('inventory.itemStatus.missing')
  });

  const itemStatusClass: Record<string, string> = {
    found: 'text-green-600 dark:text-green-400 bg-green-900/30',
    moved: 'text-yellow-500 dark:text-yellow-400 bg-yellow-900/30',
    unknown: 'text-slate-400 bg-slate-700/30',
    missing: 'text-red-500 dark:text-red-400 bg-red-900/30'
  };

  async function loadSession() {
    if (!sessionId) {
      loading = false;
      error = $_('inventory.sessionNotFound');
      return;
    }
    try {
      loading = true;
      error = '';
      const [detailResult, catResult] = await Promise.all([
        getInventorySessionDetail(sessionId),
        getAssetCatalogs()
      ]);
      session = detailResult.data.session;
      items = detailResult.data.items || [];
      locations = catResult.data.locations || [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('inventory.loadFailed');
    } finally {
      loading = false;
    }
  }

  async function handleScan(event: Event) {
    event.preventDefault();
    if (!scanCode.trim()) return;
    try {
      scanning = true;
      scanError = '';
      scanSuccess = '';
      await scanInventoryAsset(sessionId, {
        assetCode: scanCode.trim(),
        scannedLocationId: scanLocationId || undefined,
        note: scanNote.trim() || undefined
      });
      scanSuccess = $_('inventory.scanSuccess');
      scanCode = '';
      scanNote = '';
      await loadSession();
      // Refocus input
      setTimeout(() => {
        const input = document.getElementById('scanCode') as HTMLInputElement | null;
        input?.focus();
      }, 50);
    } catch (err) {
      scanError = err instanceof Error ? err.message : $_('inventory.scanFailed');
    } finally {
      scanning = false;
    }
  }

  async function handleStart() {
    if (!confirm($_('inventory.confirmStart'))) return;
    try {
      actionLoading = true;
      error = '';
      await startInventorySession(sessionId);
      await loadSession();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('inventory.startFailed');
    } finally {
      actionLoading = false;
    }
  }

  async function handleClose() {
    if (!confirm($_('inventory.confirmClose'))) return;
    try {
      actionLoading = true;
      error = '';
      await closeInventorySession(sessionId);
      await loadSession();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('inventory.closeFailed');
    } finally {
      actionLoading = false;
    }
  }

  async function handleUndo(itemId: string) {
    if (!confirm($_('inventory.confirmUndoScan'))) return;
    try {
      await undoInventoryScan(sessionId, itemId);
      scanSuccess = $_('inventory.undoSuccess');
      await loadSession();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('inventory.undoFailed');
    }
  }

  $effect(() => {
    void loadSession();
  });
</script>

<div class="page-shell page-content">
  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if session}
    <!-- Header bar -->
    <div class="mb-5">
      <div class="flex items-center gap-3 mb-3">
        <button onclick={() => goto('/inventory')} class="btn-sm btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
          <ArrowLeft class="w-3.5 h-3.5" /> {$isLoading ? 'Inventory Sessions' : $_('inventory.sessionList')}
        </button>
      </div>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-xl font-semibold">{session.name}</h1>
            <span class="badge {statusClass[session.status] ?? 'badge-primary'}">
              {statusLabels[session.status] ?? session.status}
            </span>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {#if session.locationId}
              <span class="inline-flex items-center gap-1"><MapPin class="w-3 h-3" />{locationMap.get(session.locationId) ?? session.locationId}</span>
              •
            {/if}
            {$isLoading ? 'Created' : $_('inventory.createdAt')} {new Date(session.createdAt).toLocaleString('vi-VN')}
            {#if session.startedAt}• {$isLoading ? 'Started At' : $_('inventory.startedAt')}: {new Date(session.startedAt).toLocaleString('vi-VN')}{/if}
            {#if session.closedAt}• {$isLoading ? 'Closed At' : $_('inventory.closedAt')}: {new Date(session.closedAt).toLocaleString('vi-VN')}{/if}
          </p>
        </div>
        <div class="flex gap-2">
          {#if session.status === 'draft'}
            <Button onclick={handleStart} disabled={actionLoading}>
              <Play class="w-4 h-4 mr-1.5" /> {$isLoading ? 'Start Inventory' : $_('inventory.startInventory')}
            </Button>
          {:else if session.status === 'in_progress'}
            <Button variant="secondary" onclick={handleClose} disabled={actionLoading}>
              <Lock class="w-4 h-4 mr-1.5" /> {$isLoading ? 'Close Session' : $_('inventory.closeSession')}
            </Button>
          {/if}
        </div>
      </div>
    </div>

    {#if error}
      <div class="alert alert-error mb-4">{error}</div>
    {/if}

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="card py-3 px-4 text-center">
        <div class="text-2xl font-bold">{kpi.total}</div>
        <div class="text-xs text-gray-500 mt-1">{$isLoading ? 'Scanned' : $_('inventory.kpi.scanned')}</div>
      </div>
      <div class="card py-3 px-4 text-center">
        <div class="text-2xl font-bold text-green-500">{kpi.found}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 class="w-3 h-3" />{$isLoading ? 'Matched' : $_('inventory.kpi.matched')}</div>
      </div>
      <div class="card py-3 px-4 text-center">
        <div class="text-2xl font-bold text-yellow-500">{kpi.moved}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><AlertTriangle class="w-3 h-3" />{$isLoading ? 'Discrepancy' : $_('inventory.kpi.discrepancy')}</div>
      </div>
      <div class="card py-3 px-4 text-center">
        <div class="text-2xl font-bold text-slate-400">{kpi.unknown}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><HelpCircle class="w-3 h-3" />{$isLoading ? 'Unknown' : $_('inventory.kpi.unknown')}</div>
      </div>
    </div>

    <!-- Scan Panel -->
    {#if canScan}
      <div class="card mb-6">
        <h2 class="text-base font-semibold mb-4 flex items-center gap-2"><Scan class="w-4 h-4" />{$isLoading ? 'Scan Device' : $_('inventory.scanDevice')}</h2>
        <form onsubmit={handleScan}>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div class="md:col-span-1">
              <label for="scanCode" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Device Code' : $_('inventory.deviceCode')} <span class="text-red-500">*</span></label>
              <input
                id="scanCode"
                class="input-base font-mono"
                bind:value={scanCode}
                placeholder={$isLoading ? 'Scan or enter code...' : $_('inventory.scanPlaceholder')}
                disabled={scanning}
                autocomplete="off"
              />
            </div>
            <div>
              <label for="scanLocationId" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Scanned Location' : $_('inventory.scannedLocation')}</label>
              <select id="scanLocationId" class="input-base" bind:value={scanLocationId} disabled={scanning}>
                <option value="">{$isLoading ? '-- Not selected --' : $_('inventory.noSelection')}</option>
                {#each locations as loc}
                  <option value={loc.id}>{loc.name}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="scanNote" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Notes' : $_('inventory.header.notes')}</label>
              <input id="scanNote" class="input-base" bind:value={scanNote} placeholder={$isLoading ? 'Note (optional)' : $_('inventory.noteOptional')} disabled={scanning} />
            </div>
          </div>
          {#if scanError}
            <div class="alert alert-error mb-2 text-sm flex items-center gap-2"><AlertCircle class="w-4 h-4 shrink-0" />{scanError}</div>
          {/if}
          {#if scanSuccess}
            <div class="alert alert-success mb-2 text-sm">{scanSuccess}</div>
          {/if}
          <Button type="submit" disabled={scanning || !scanCode.trim()}>
            <Scan class="w-4 h-4 mr-1.5" />
            {scanning ? ($isLoading ? 'Scanning...' : $_('inventory.scanning')) : ($isLoading ? 'Scan' : $_('inventory.scan'))}
          </Button>
        </form>
      </div>
    {/if}

    <!-- Items Table -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold">
          {$isLoading ? 'Scanned Items' : $_('inventory.scannedList')}
          {#if items.length > 0}<span class="text-gray-400 font-normal ml-1">({items.length})</span>{/if}
        </h2>
      </div>
      {#if items.length === 0}
        <div class="text-center py-10 text-gray-500 text-sm">
          {$isLoading ? 'No scan data yet' : $_('inventory.emptyState')}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-base-300 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th class="pb-2 pr-4">{$isLoading ? 'Asset Code' : $_('inventory.header.assetCode')}</th>
                <th class="pb-2 pr-4">{$isLoading ? 'Status' : $_('inventory.header.status')}</th>
                <th class="pb-2 pr-4">{$isLoading ? 'Expected Location' : $_('inventory.header.expectedLocation')}</th>
                <th class="pb-2 pr-4">{$isLoading ? 'Scanned Location' : $_('inventory.header.scannedLocation')}</th>
                <th class="pb-2 pr-4">{$isLoading ? 'Scanned At' : $_('inventory.header.scannedAt')}</th>
                <th class="pb-2">{$isLoading ? 'Notes' : $_('inventory.header.notes')}</th>
                {#if canScan}<th class="pb-2"></th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each items as item}
                <tr class="border-b border-base-300/50 hover:bg-base-200/30 transition-colors">
                  <td class="py-2 pr-4 font-mono text-xs">{item.assetId ?? '—'}</td>
                  <td class="py-2 pr-4">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium {itemStatusClass[item.status] ?? ''}">
                      {itemStatusLabels[item.status] ?? item.status}
                    </span>
                  </td>
                  <td class="py-2 pr-4 text-gray-400 text-xs">
                    {item.expectedLocationId ? (locationMap.get(item.expectedLocationId) ?? item.expectedLocationId) : '—'}
                  </td>
                  <td class="py-2 pr-4 text-xs">
                    {item.scannedLocationId ? (locationMap.get(item.scannedLocationId) ?? item.scannedLocationId) : '—'}
                  </td>
                  <td class="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap">
                    {item.scannedAt ? new Date(item.scannedAt).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td class="py-2 pr-4 text-gray-400 text-xs">{item.note ?? ''}</td>
                  {#if canScan}
                    <td class="py-2 text-right">
                      <button
                        onclick={() => handleUndo(item.id)}
                        class="p-1 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors"
                        title={$isLoading ? 'Undo' : $_('inventory.undoScanTitle')}
                      >
                        <RotateCcw class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <div class="alert alert-error">{$isLoading ? 'Inventory session not found' : $_('inventory.sessionNotFoundError')}</div>
  {/if}
</div>
