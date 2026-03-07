<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw, Calendar, MapPin, X, Clipboard, CheckSquare, Search } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { _, isLoading as i18nLoading } from '$lib/i18n';
  import { listInventorySessions, createInventorySession, type InventorySession } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';

  let sessions = $state<InventorySession[]>([]);
  let locations = $state<Location[]>([]);
  let loading = $state(true);
  let error = $state('');
  let filterStatus = $state<string>('');
  let searchQuery = $state('');

  // Create form
  let showCreate = $state(false);
  let creating = $state(false);
  let newName = $state('');
  let newLocationId = $state('');
  let newAuditType = $state<'full' | 'partial' | 'spot_check'>('partial');
  let newScheduledDate = $state('');
  let newNote = $state('');
  let createError = $state('');

  const auditTypeLabels: Record<string, string> = {
    full: 'Kiểm kê toàn bộ',
    partial: 'Kiểm kê theo khu vực',
    spot_check: 'Kiểm tra đột xuất'
  };

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
    sessions.filter(s => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
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
      // Build session name with audit type prefix if not already included
      const sessionName = newName.trim();
      const result = await createInventorySession({
        name: sessionName,
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
    const today = new Date().toLocaleDateString('vi-VN');
    newName = `Kiểm kê ${today}`;
    newLocationId = '';
    newAuditType = 'partial';
    newScheduledDate = new Date().toISOString().slice(0, 10);
    newNote = '';
    createError = '';
    showCreate = true;
  }

  function handleAuditTypeChange() {
    const today = new Date().toLocaleDateString('vi-VN');
    newName = `${auditTypeLabels[newAuditType]} — ${today}`;
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
        <Plus class="w-4 h-4 mr-2" /> Tạo phiên kiểm kê
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
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <Clipboard class="w-5 h-5 text-primary" />
          <h2 class="text-lg font-semibold">Tạo phiên kiểm kê mới</h2>
        </div>
        <button onclick={() => showCreate = false} class="btn-ghost btn-sm p-1 rounded"><X class="w-4 h-4" /></button>
      </div>
      {#if createError}
        <div class="alert alert-error mb-3 text-sm">{createError}</div>
      {/if}
      <form onsubmit={handleCreate} class="space-y-4">
        <!-- Audit type -->
        <div>
          <p class="mb-1.5 text-xs font-medium text-slate-400">Loại kiểm kê <span class="text-red-500">*</span></p>
          <div class="grid grid-cols-3 gap-2">
            {#each (['full', 'partial', 'spot_check'] as const) as type}
              <button
                type="button"
                class="rounded-lg border px-3 py-2.5 text-sm font-medium transition-all {newAuditType === type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-base-300 hover:border-primary/40 text-base-content'}"
                onclick={() => { newAuditType = type; handleAuditTypeChange(); }}
              >
                {type === 'full' ? '🗂 Toàn bộ' : type === 'partial' ? '📍 Theo khu vực' : '🔎 Đột xuất'}
              </button>
            {/each}
          </div>
          <p class="mt-1 text-xs text-slate-500">{auditTypeLabels[newAuditType]}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Session name -->
          <div class="md:col-span-2">
            <label for="newName" class="mb-1 block text-xs font-medium text-slate-400">Tên phiên kiểm kê <span class="text-red-500">*</span></label>
            <input id="newName" class="input-base" bind:value={newName} placeholder="VD: Kiểm kê Q1/2026 — Phòng Server" required />
          </div>

          <!-- Location -->
          <div>
            <label for="newLocationId" class="mb-1 block text-xs font-medium text-slate-400">Khu vực / Vị trí</label>
            <select id="newLocationId" class="input-base" bind:value={newLocationId}>
              <option value="">— Tất cả khu vực —</option>
              {#each locations as loc}
                <option value={loc.id}>{loc.name}</option>
              {/each}
            </select>
          </div>

          <!-- Scheduled date -->
          <div>
            <label for="newScheduledDate" class="mb-1 block text-xs font-medium text-slate-400">Ngày dự kiến</label>
            <input id="newScheduledDate" type="date" class="input-base" bind:value={newScheduledDate} />
          </div>

          <!-- Note -->
          <div class="md:col-span-2">
            <label for="newNote" class="mb-1 block text-xs font-medium text-slate-400">Ghi chú / Phạm vi</label>
            <textarea id="newNote" class="input-base resize-none" rows="2" bind:value={newNote} placeholder="Mô tả phạm vi, mục tiêu kiểm kê..."></textarea>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Đang tạo...' : 'Tạo phiên kiểm kê'}
          </Button>
          <Button type="button" variant="secondary" onclick={() => showCreate = false}>Hủy</Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Filter + Search bar -->
  <div class="flex flex-col sm:flex-row gap-3 mb-4">
    <!-- Status tabs -->
    <div class="flex gap-2 flex-wrap">
      {#each [
        { key: '', label: `Tất cả (${counts.all})` },
        { key: 'draft', label: `Nháp (${counts.draft})` },
        { key: 'in_progress', label: `Đang kiểm (${counts.in_progress})` },
        { key: 'closed', label: `Đã đóng (${counts.closed})` }
      ] as tab}
        <button
          class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors {filterStatus === tab.key
            ? 'bg-primary text-primary-content border-primary'
            : 'border-base-300 hover:border-primary/50 text-base-content'}"
          onclick={() => (filterStatus = tab.key)}
        >{tab.label}</button>
      {/each}
    </div>
    <!-- Search -->
    <div class="relative ml-auto">
      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="search"
        class="input-base pl-8 w-56 text-sm"
        placeholder="Tìm kiếm phiên..."
        bind:value={searchQuery}
      />
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center p-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if filteredSessions.length === 0}
    <div class="card text-center py-12">
      <Clipboard class="w-10 h-10 text-slate-500 mx-auto mb-3" />
      <p class="text-gray-500 mb-4">
        {filterStatus || searchQuery ? 'Không tìm thấy phiên kiểm kê' : 'Chưa có phiên kiểm kê nào'}
      </p>
      {#if !filterStatus && !searchQuery}
        <Button onclick={openCreate}>Tạo phiên đầu tiên</Button>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredSessions as session}
        <a href="/inventory/{session.id}" class="card block hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group">
          <div class="flex items-start justify-between mb-3">
            <h3 class="font-semibold text-base leading-snug flex-1 mr-2 group-hover:text-primary transition-colors">{session.name}</h3>
            <span class="badge shrink-0 {statusClass[session.status] ?? 'badge-primary'}">
              {statusLabels[session.status] ?? session.status}
            </span>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
            {#if session.locationId}
              <div class="flex items-center gap-2">
                <MapPin class="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span>{locationMap.get(session.locationId) ?? session.locationId}</span>
              </div>
            {:else}
              <div class="flex items-center gap-2 text-gray-400">
                <MapPin class="w-3.5 h-3.5 shrink-0" />
                <span>Tất cả khu vực</span>
              </div>
            {/if}
            <div class="flex items-center gap-2">
              <Calendar class="w-3.5 h-3.5 shrink-0" />
              <span>Tạo: {new Date(session.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
            {#if session.startedAt}
              <div class="flex items-center gap-2 text-blue-500 dark:text-blue-400">
                <CheckSquare class="w-3.5 h-3.5 shrink-0" />
                <span>Bắt đầu: {new Date(session.startedAt).toLocaleString('vi-VN')}</span>
              </div>
            {/if}
            {#if session.closedAt}
              <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckSquare class="w-3.5 h-3.5 shrink-0" />
                <span>Đóng: {new Date(session.closedAt).toLocaleString('vi-VN')}</span>
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
