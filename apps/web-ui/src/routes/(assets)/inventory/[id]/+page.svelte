<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui';
  import {
    Scan, ArrowLeft, Play, Lock, RotateCcw, MapPin, CheckCircle2, AlertTriangle,
    HelpCircle, AlertCircle, Download, Camera
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import {
    getInventorySessionDetail,
    scanInventoryAsset,
    closeInventorySession,
    startInventorySession,
    undoInventoryScan,
    getMissingInventoryAssets,
    type InventorySession,
    type InventoryItem,
    type MissingAsset
  } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';
  import QrCameraScanner from '$lib/assets/components/QrCameraScanner.svelte';
  import type { ResolvedScanPayload } from '$lib/assets/components/QrCameraScanner.utils';

  let session = $state<InventorySession | null>(null);
  let items = $state<InventoryItem[]>([]);
  let missingAssets = $state<MissingAsset[]>([]);
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
  let missingLoading = $state(false);
  let activeTab = $state<'scanned' | 'missing'>('scanned');
  let itemFilter = $state<'all' | 'found' | 'moved' | 'unknown'>('all');

  const sessionId = $derived(page.params.id ?? '');
  const locationMap = $derived(new Map(locations.map(l => [l.id, l.name])));

  const kpi = $derived({
    total: items.length,
    found: items.filter(i => i.status === 'found').length,
    moved: items.filter(i => i.status === 'moved').length,
    unknown: items.filter(i => i.status === 'unknown').length,
    missing: missingAssets.length
  });

  const canScan = $derived(session?.status === 'draft' || session?.status === 'in_progress');

  const filteredItems = $derived(
    itemFilter === 'all' ? items : items.filter(i => i.status === itemFilter)
  );

  const isDuplicate = $derived(
    scanCode.trim().length > 0 &&
    items.some(i => i.assetCode?.toLowerCase() === scanCode.trim().toLowerCase())
  );

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

  async function loadMissingAssets() {
    if (!sessionId || missingLoading) return;
    try {
      missingLoading = true;
      const result = await getMissingInventoryAssets(sessionId);
      missingAssets = result.data || [];
    } catch {
      missingAssets = [];
    } finally {
      missingLoading = false;
    }
  }

  async function handleQrDetected(scan: ResolvedScanPayload) {
    const scannedCode = (scan.assetCode ?? scan.resolved ?? '').trim();
    const scannedAssetId = (scan.assetId ?? '').trim();
    if ((!scannedCode && !scannedAssetId) || scanning || !canScan) return;
    try {
      scanning = true;
      scanError = '';
      scanSuccess = '';
      await scanInventoryAsset(sessionId, {
        assetId: scannedAssetId || undefined,
        assetCode: scannedCode || undefined,
        scannedLocationId: scanLocationId || undefined,
        note: scanNote.trim() || undefined
      });
      scanSuccess = `✓ ${$_('inventory.scanSuccess')}: ${scannedCode || scannedAssetId}`;
      scanNote = '';
      await Promise.all([loadSession(), loadMissingAssets()]);
      setTimeout(() => { scanSuccess = ''; }, 3000);
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
      await Promise.all([loadSession(), loadMissingAssets()]);
      activeTab = 'missing';
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

  function exportCsv() {
    const headers = ['Mã tài sản', 'Tên', 'Trạng thái', 'Vị trí dự kiến', 'Vị trí thực tế', 'Thời gian quét', 'Ghi chú'];
    const rows = items.map(item => [
      item.assetCode ?? item.assetId ?? '',
      item.assetName ?? '',
      item.status,
      item.expectedLocationId ? (locationMap.get(item.expectedLocationId) ?? item.expectedLocationId) : '',
      item.scannedLocationId ? (locationMap.get(item.scannedLocationId) ?? item.scannedLocationId) : '',
      item.scannedAt ? new Date(item.scannedAt).toLocaleString('vi-VN') : '',
      item.note ?? ''
    ]);
    const csvContent = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiemdoi-${session?.name ?? sessionId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  $effect(() => {
    void loadSession();
  });

  $effect(() => {
    if (session && (session.status === 'in_progress' || session.status === 'closed')) {
      void loadMissingAssets();
    }
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
        <div class="flex gap-2 flex-wrap">
          {#if items.length > 0}
            <Button variant="secondary" onclick={exportCsv} title="Xuất báo cáo CSV">
              <Download class="w-4 h-4 mr-1.5" /> Xuất CSV
            </Button>
          {/if}
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
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <button
        class="card py-3 px-4 text-center cursor-pointer hover:ring-1 ring-primary/40 transition-all {itemFilter === 'all' && activeTab === 'scanned' ? 'ring-1 ring-primary' : ''}"
        onclick={() => { activeTab = 'scanned'; itemFilter = 'all'; }}
      >
        <div class="text-2xl font-bold">{kpi.total}</div>
        <div class="text-xs text-gray-500 mt-1">{$isLoading ? 'Scanned' : $_('inventory.kpi.scanned')}</div>
      </button>
      <button
        class="card py-3 px-4 text-center cursor-pointer hover:ring-1 ring-green-500/40 transition-all {itemFilter === 'found' ? 'ring-1 ring-green-500' : ''}"
        onclick={() => { activeTab = 'scanned'; itemFilter = 'found'; }}
      >
        <div class="text-2xl font-bold text-green-500">{kpi.found}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 class="w-3 h-3" />{$isLoading ? 'Matched' : $_('inventory.kpi.matched')}</div>
      </button>
      <button
        class="card py-3 px-4 text-center cursor-pointer hover:ring-1 ring-yellow-500/40 transition-all {itemFilter === 'moved' ? 'ring-1 ring-yellow-500' : ''}"
        onclick={() => { activeTab = 'scanned'; itemFilter = 'moved'; }}
      >
        <div class="text-2xl font-bold text-yellow-500">{kpi.moved}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><AlertTriangle class="w-3 h-3" />{$isLoading ? 'Discrepancy' : $_('inventory.kpi.discrepancy')}</div>
      </button>
      <button
        class="card py-3 px-4 text-center cursor-pointer hover:ring-1 ring-slate-400/40 transition-all {itemFilter === 'unknown' ? 'ring-1 ring-slate-400' : ''}"
        onclick={() => { activeTab = 'scanned'; itemFilter = 'unknown'; }}
      >
        <div class="text-2xl font-bold text-slate-400">{kpi.unknown}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><HelpCircle class="w-3 h-3" />{$isLoading ? 'Unknown' : $_('inventory.kpi.unknown')}</div>
      </button>
      <button
        class="card py-3 px-4 text-center cursor-pointer hover:ring-1 ring-red-500/40 transition-all {activeTab === 'missing' ? 'ring-1 ring-red-500' : ''}"
        onclick={() => { activeTab = 'missing'; void loadMissingAssets(); }}
      >
        <div class="text-2xl font-bold text-red-400">{kpi.missing}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><AlertCircle class="w-3 h-3" />Chưa quét</div>
      </button>
    </div>

    <!-- Scan Panel -->
    {#if canScan}
      <div class="card mb-6">
        <h2 class="text-base font-semibold mb-4 flex items-center gap-2">
          <Scan class="w-4 h-4 text-primary" />
          {$isLoading ? 'Scan Device' : $_('inventory.scanDevice')}
          <span class="ml-auto text-xs font-normal text-slate-400 flex items-center gap-1">
            <Camera class="w-3.5 h-3.5" /> Hỗ trợ camera
          </span>
        </h2>

        <!-- Location selector -->
        <div class="mb-3">
          <label for="scanLocationId" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Scanned Location' : $_('inventory.scannedLocation')}</label>
          <select id="scanLocationId" class="input-base max-w-xs" bind:value={scanLocationId} disabled={scanning}>
            <option value="">{$isLoading ? '-- Not selected --' : $_('inventory.noSelection')}</option>
            {#each locations as loc}
              <option value={loc.id}>{loc.name}</option>
            {/each}
          </select>
        </div>

        <!-- QR Camera Scanner -->
        <QrCameraScanner
          onscanned={handleQrDetected}
          disabled={scanning}
          placeholder={$isLoading ? 'Scan or enter device code...' : $_('inventory.scanPlaceholder')}
        />

        <!-- Note field -->
        <div class="mt-2">
          <input class="input-base text-sm" bind:value={scanNote} placeholder={$isLoading ? 'Note (optional)' : $_('inventory.noteOptional')} disabled={scanning} />
        </div>

        {#if isDuplicate}
          <div class="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded px-3 py-1.5 flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5 shrink-0" />
            Mã này đã được quét trong phiên. Quét lại sẽ ghi đè kết quả cũ.
          </div>
        {/if}
        {#if scanError}
          <div class="alert alert-error mt-2 text-sm flex items-center gap-2"><AlertCircle class="w-4 h-4 shrink-0" />{scanError}</div>
        {/if}
        {#if scanSuccess}
          <div class="alert alert-success mt-2 text-sm">{scanSuccess}</div>
        {/if}
      </div>
    {/if}

    <!-- Tab navigation -->
    <div class="flex gap-1 mb-4 border-b border-base-300">
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'scanned'
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-base-content'}"
        onclick={() => activeTab = 'scanned'}
      >
        Đã quét ({items.length})
      </button>
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'missing'
          ? 'border-red-500 text-red-400'
          : 'border-transparent text-gray-500 hover:text-base-content'}"
        onclick={() => { activeTab = 'missing'; void loadMissingAssets(); }}
      >
        Chưa quét
        {#if missingLoading}
          <span class="inline-block w-3 h-3 ml-1 border border-current border-t-transparent rounded-full animate-spin"></span>
        {:else if missingAssets.length > 0}
          <span class="ml-1 text-red-400">({missingAssets.length})</span>
        {/if}
      </button>
    </div>

    <!-- Scanned items tab -->
    {#if activeTab === 'scanned'}
      <!-- Filter pills -->
      {#if items.length > 0}
        <div class="flex gap-2 mb-3 flex-wrap">
          {#each ([
            { key: 'all' as const, label: `Tất cả (${items.length})` },
            { key: 'found' as const, label: `Đúng (${kpi.found})` },
            { key: 'moved' as const, label: `Sai vị trí (${kpi.moved})` },
            { key: 'unknown' as const, label: `Không xác định (${kpi.unknown})` }
          ]) as f}
            <button
              class="text-xs px-2.5 py-1 rounded-full border transition-colors {itemFilter === f.key
                ? 'bg-primary/20 border-primary text-primary'
                : 'border-base-300 text-slate-400 hover:border-primary/40'}"
              onclick={() => (itemFilter = f.key)}
            >{f.label}</button>
          {/each}
        </div>
      {/if}

      <div class="card">
        {#if filteredItems.length === 0}
          <div class="text-center py-10 text-gray-500 text-sm">
            {items.length === 0 ? ($isLoading ? 'No scan data yet' : $_('inventory.emptyState')) : 'Không có mục nào khớp bộ lọc'}
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-base-300 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th class="pb-2 pr-4">{$isLoading ? 'Asset Code' : $_('inventory.header.assetCode')}</th>
                  <th class="pb-2 pr-4">Tên / Model</th>
                  <th class="pb-2 pr-4">{$isLoading ? 'Status' : $_('inventory.header.status')}</th>
                  <th class="pb-2 pr-4 hidden md:table-cell">{$isLoading ? 'Expected Location' : $_('inventory.header.expectedLocation')}</th>
                  <th class="pb-2 pr-4 hidden md:table-cell">{$isLoading ? 'Scanned Location' : $_('inventory.header.scannedLocation')}</th>
                  <th class="pb-2 pr-4 hidden lg:table-cell">{$isLoading ? 'Scanned At' : $_('inventory.header.scannedAt')}</th>
                  <th class="pb-2 hidden lg:table-cell">{$isLoading ? 'Notes' : $_('inventory.header.notes')}</th>
                  {#if canScan}<th class="pb-2 w-8"></th>{/if}
                </tr>
              </thead>
              <tbody>
                {#each filteredItems as item}
                  <tr class="border-b border-base-300/50 hover:bg-base-200/30 transition-colors">
                    <td class="py-2 pr-4 font-mono text-xs text-primary">{item.assetCode ?? item.assetId ?? '—'}</td>
                    <td class="py-2 pr-4 text-xs text-slate-300">{item.assetName ?? '—'}</td>
                    <td class="py-2 pr-4">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium {itemStatusClass[item.status] ?? ''}">
                        {itemStatusLabels[item.status] ?? item.status}
                      </span>
                    </td>
                    <td class="py-2 pr-4 text-gray-400 text-xs hidden md:table-cell">
                      {item.expectedLocationId ? (locationMap.get(item.expectedLocationId) ?? '—') : '—'}
                    </td>
                    <td class="py-2 pr-4 text-xs hidden md:table-cell {item.scannedLocationId && item.expectedLocationId && item.scannedLocationId !== item.expectedLocationId ? 'text-yellow-400' : 'text-slate-300'}">
                      {item.scannedLocationId ? (locationMap.get(item.scannedLocationId) ?? '—') : '—'}
                    </td>
                    <td class="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap hidden lg:table-cell">
                      {item.scannedAt ? new Date(item.scannedAt).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td class="py-2 pr-4 text-gray-400 text-xs hidden lg:table-cell max-w-[120px] truncate">{item.note ?? ''}</td>
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
    {/if}

    <!-- Missing assets tab -->
    {#if activeTab === 'missing'}
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertCircle class="w-4 h-4" />
            Tài sản chưa được quét
            {#if missingAssets.length > 0}<span class="text-slate-400 font-normal">({missingAssets.length})</span>{/if}
          </h3>
          <button
            class="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
            onclick={() => void loadMissingAssets()}
            disabled={missingLoading}
          >
            <RotateCcw class="w-3.5 h-3.5" /> Làm mới
          </button>
        </div>
        {#if missingLoading}
          <div class="text-center py-6">
            <div class="h-6 w-6 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if missingAssets.length === 0}
          <div class="text-center py-8 text-green-400">
            <CheckCircle2 class="w-8 h-8 mx-auto mb-2" />
            <p class="text-sm">Tất cả tài sản trong phạm vi đã được quét!</p>
          </div>
        {:else}
          {#if session.locationId}
            <p class="text-xs text-slate-500 mb-3">
              Các tài sản tại "{locationMap.get(session.locationId) ?? 'khu vực đã chọn'}" chưa được quét:
            </p>
          {/if}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-base-300 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th class="pb-2 pr-4">Mã tài sản</th>
                  <th class="pb-2 pr-4">Tên / Model</th>
                  <th class="pb-2 pr-4">Vị trí hệ thống</th>
                  <th class="pb-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {#each missingAssets as asset}
                  <tr class="border-b border-base-300/50 hover:bg-base-200/30 transition-colors">
                    <td class="py-2 pr-4 font-mono text-xs text-red-400">{asset.assetCode}</td>
                    <td class="py-2 pr-4 text-xs text-slate-300">{asset.name ?? '—'}</td>
                    <td class="py-2 pr-4 text-xs text-gray-400">{asset.locationName ?? '—'}</td>
                    <td class="py-2">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{asset.status}</span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="alert alert-error">{$isLoading ? 'Inventory session not found' : $_('inventory.sessionNotFoundError')}</div>
  {/if}
</div>
