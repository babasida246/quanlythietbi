<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { KeyRound, Plus, RefreshCw, Users, X, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { toast } from '$lib/components/toast';
  import {
    listLicenses, createLicense, activateLicense, retireLicense,
    deleteLicense, getSeats, revokeSeat,
    type LicenseWithUsage, type LicenseSeatWithDetails, type CreateLicenseInput, type LicenseStatus
  } from '$lib/api/licenses';
  import { getCapabilities } from '$lib/auth/capabilities';

  const userRole = typeof localStorage !== 'undefined' ? (localStorage.getItem('userRole') ?? 'viewer') : 'viewer';
  const caps = getCapabilities(userRole);

  // ── List state ──────────────────────────────────────────────────────────────
  let items = $state<LicenseWithUsage[]>([]);
  let total = $state(0);
  let page = $state(1);
  const PAGE_SIZE = 20;
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let filterStatus = $state<LicenseStatus | ''>('');
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Create modal ────────────────────────────────────────────────────────────
  let showCreate = $state(false);
  let saving = $state(false);
  let form = $state<CreateLicenseInput>({
    softwareName: '',
    licenseCode: '',
    licenseType: 'per_seat',
    seatCount: 1,
    unitPrice: 0,
    purchaseDate: '',
    expiryDate: '',
    notes: ''
  });

  // ── Seats modal ─────────────────────────────────────────────────────────────
  let seatsLicense = $state<LicenseWithUsage | null>(null);
  let seats = $state<LicenseSeatWithDetails[]>([]);
  let seatsLoading = $state(false);
  let assignAssetId = $state('');
  let assigning = $state(false);

  // ── Computed ─────────────────────────────────────────────────────────────────
  let totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

  const STATUS_FILTERS: Array<{ value: LicenseStatus | ''; label: string }> = [
    { value: '', label: 'filterAll' },
    { value: 'active', label: 'active' },
    { value: 'draft', label: 'draft' },
    { value: 'expired', label: 'expired' },
    { value: 'retired', label: 'retired' }
  ];

  onMount(() => { void load(); });

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await listLicenses({ page, limit: PAGE_SIZE, status: filterStatus || undefined, search: search || undefined });
      items = res.data ?? [];
      total = res.pagination?.total ?? res.total ?? 0;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 1; void load(); }, 300);
  }

  function handleFilterStatus(val: LicenseStatus | '') {
    filterStatus = val;
    page = 1;
    void load();
  }

  async function handleCreate() {
    if (!form.softwareName.trim()) return;
    saving = true;
    try {
      const input: CreateLicenseInput = {
        softwareName: form.softwareName.trim(),
        licenseCode: form.licenseCode?.trim() || undefined,
        licenseType: form.licenseType,
        seatCount: form.seatCount || 1,
        unitPrice: form.unitPrice || 0,
        purchaseDate: form.purchaseDate || undefined,
        expiryDate: form.expiryDate || undefined,
        notes: form.notes?.trim() || undefined
      };
      await createLicense(input);
      toast.success('Thêm giấy phép thành công');
      showCreate = false;
      form = { softwareName: '', licenseCode: '', licenseType: 'per_seat', seatCount: 1, unitPrice: 0, purchaseDate: '', expiryDate: '', notes: '' };
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi khi tạo giấy phép');
    } finally {
      saving = false;
    }
  }

  async function handleActivate(item: LicenseWithUsage) {
    try {
      await activateLicense(item.id);
      toast.success('Đã kích hoạt');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    }
  }

  async function handleRetire(item: LicenseWithUsage) {
    if (!confirm($_('assets.licenses.confirmRetire'))) return;
    try {
      await retireLicense(item.id);
      toast.success('Đã ngừng sử dụng');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    }
  }

  async function handleDelete(item: LicenseWithUsage) {
    if (!confirm($_('assets.licenses.confirmDelete'))) return;
    try {
      await deleteLicense(item.id);
      toast.success('Đã xóa giấy phép');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    }
  }

  async function openSeats(item: LicenseWithUsage) {
    seatsLicense = item;
    seats = [];
    seatsLoading = true;
    assignAssetId = '';
    try {
      const res = await getSeats(item.id);
      seats = res.data ?? [];
    } catch { seats = []; }
    finally { seatsLoading = false; }
  }

  async function handleAssignAsset() {
    if (!assignAssetId.trim() || !seatsLicense) return;
    assigning = true;
    try {
      const { assignSeat } = await import('$lib/api/licenses');
      await assignSeat(seatsLicense.id, { assignmentType: 'asset', assignedAssetId: assignAssetId.trim() });
      toast.success('Đã gán thiết bị');
      assignAssetId = '';
      await openSeats(seatsLicense);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      assigning = false;
    }
  }

  async function handleRevokeSeat(seatId: string) {
    if (!confirm($_('assets.licenses.confirmRevoke')) || !seatsLicense) return;
    try {
      await revokeSeat(seatsLicense.id, seatId);
      toast.success('Đã thu hồi');
      await openSeats(seatsLicense);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    }
  }

  function statusBadgeClass(status: LicenseStatus): string {
    if (status === 'active') return 'badge-success';
    if (status === 'expired') return 'badge-error';
    if (status === 'draft') return 'badge-warning';
    return 'badge-secondary';
  }

  function formatDate(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN');
  }

  function expiryClass(d?: string | null): string {
    if (!d) return '';
    const diff = (new Date(d).getTime() - Date.now()) / 86400000;
    if (diff < 0) return 'text-error';
    if (diff < 30) return 'text-warning';
    return '';
  }
</script>

<svelte:head>
  <title>{$isLoading ? 'Software Licenses' : $_('assets.licenses.pageTitle')} — QLTB</title>
</svelte:head>

<div class="space-y-4 p-4 sm:p-6">
  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <KeyRound class="h-5 w-5 text-primary" />
      <h1 class="text-lg font-semibold text-slate-100">
        {$isLoading ? 'Software Licenses' : $_('assets.licenses.pageTitle')}
      </h1>
      {#if !loading}
        <span class="badge-secondary text-xs px-2 py-0.5 rounded-full">{total}</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-sm" onclick={() => load()} title="Làm mới">
        <RefreshCw class="h-3.5 w-3.5" />
      </button>
      {#if caps.licenses.manage}
        <button class="btn btn-primary btn-sm gap-1" onclick={() => showCreate = true}>
          <Plus class="h-3.5 w-3.5" />
          {$isLoading ? 'Add' : $_('assets.licenses.add')}
        </button>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-2">
    <!-- Search -->
    <input
      type="text"
      bind:value={search}
      oninput={handleSearchInput}
      placeholder={$isLoading ? 'Search...' : $_('assets.licenses.searchPlaceholder')}
      class="input-base h-8 w-64 text-sm"
    />
    <!-- Status tabs -->
    <div class="flex gap-1">
      {#each STATUS_FILTERS as f}
        <button
          class="btn btn-sm text-xs {filterStatus === f.value ? 'btn-primary' : ''}"
          onclick={() => handleFilterStatus(f.value)}
        >
          {#if f.value === ''}
            {$isLoading ? 'All' : $_('assets.licenses.filterAll')}
          {:else}
            {$isLoading ? f.value : $_(`assets.licenses.status.${f.value}`)}
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden p-0">
    {#if loading}
      <div class="flex items-center justify-center py-12 gap-2 text-sm text-slate-400">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
        Đang tải...
      </div>
    {:else if error}
      <div class="alert alert-error m-4">{error}</div>
    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
        <KeyRound class="h-8 w-8 opacity-30" />
        <p class="text-sm">{$isLoading ? 'No licenses found.' : $_('assets.licenses.empty')}</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table w-full">
          <thead>
            <tr>
              <th>{$isLoading ? 'Software' : $_('assets.licenses.col.software')}</th>
              <th>{$isLoading ? 'License Code' : $_('assets.licenses.col.code')}</th>
              <th>{$isLoading ? 'Type' : $_('assets.licenses.col.type')}</th>
              <th class="text-right">{$isLoading ? 'Seats' : $_('assets.licenses.col.seats')}</th>
              <th>{$isLoading ? 'Expiry' : $_('assets.licenses.col.expiry')}</th>
              <th>{$isLoading ? 'Status' : $_('assets.licenses.col.status')}</th>
              <th>{$isLoading ? 'Actions' : $_('assets.licenses.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.id)}
              <tr>
                <td>
                  <span class="font-medium text-slate-100">{item.softwareName}</span>
                  {#if item.supplierName}
                    <div class="text-xs text-slate-500">{item.supplierName}</div>
                  {/if}
                </td>
                <td><code class="text-xs font-mono text-slate-400">{item.licenseCode || '—'}</code></td>
                <td>
                  <span class="text-sm text-slate-300">
                    {$isLoading ? item.licenseType : $_(`assets.licenses.type.${item.licenseType}`)}
                  </span>
                </td>
                <td class="text-right">
                  {#if item.licenseType === 'unlimited'}
                    <span class="text-slate-400 text-sm">∞</span>
                  {:else}
                    <span class="text-sm {item.seatsUsed >= item.seatCount ? 'text-warning' : 'text-slate-300'}">
                      {item.seatsUsed}/{item.seatCount}
                    </span>
                  {/if}
                </td>
                <td>
                  <span class="text-sm {expiryClass(item.expiryDate)}">{formatDate(item.expiryDate)}</span>
                </td>
                <td>
                  <span class="badge {statusBadgeClass(item.status)} text-xs">
                    {$isLoading ? item.status : $_(`assets.licenses.status.${item.status}`)}
                  </span>
                </td>
                <td>
                  <div class="flex items-center gap-1">
                    <button
                      class="btn btn-sm text-xs"
                      onclick={() => openSeats(item)}
                      title="Xem ghế"
                    >
                      <Users class="h-3 w-3" />
                    </button>
                    {#if caps.licenses.manage}
                      {#if item.status === 'draft'}
                        <button class="btn btn-sm text-xs" onclick={() => handleActivate(item)}>
                          Kích hoạt
                        </button>
                      {/if}
                      {#if item.status === 'active'}
                        <button class="btn btn-sm text-xs text-warning" onclick={() => handleRetire(item)}>
                          Ngừng
                        </button>
                      {/if}
                      {#if item.status !== 'active'}
                        <button class="btn btn-sm text-xs text-error" onclick={() => handleDelete(item)}>
                          Xóa
                        </button>
                      {/if}
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
          <span class="text-slate-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div class="flex gap-1">
            <button class="btn btn-sm" disabled={page <= 1} onclick={() => { page--; void load(); }}>
              <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => { page++; void load(); }}>
              <ChevronRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- ─── Create License Modal ─────────────────────────────────────────────────── -->
{#if showCreate}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
    <div class="modal-panel w-full max-w-lg">
      <div class="flex items-center justify-between border-b border-border p-4">
        <h2 class="text-base font-semibold">
          {$isLoading ? 'Add New License' : $_('assets.licenses.form.title')}
        </h2>
        <button class="btn btn-sm" onclick={() => showCreate = false}><X class="h-4 w-4" /></button>
      </div>
      <div class="space-y-3 p-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">
            {$isLoading ? 'Software Name' : $_('assets.licenses.form.softwareName')} *
          </label>
          <input bind:value={form.softwareName} type="text" class="input-base w-full" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'License Code' : $_('assets.licenses.form.licenseCode')}
            </label>
            <input bind:value={form.licenseCode} type="text" class="input-base w-full font-mono" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'License Type' : $_('assets.licenses.form.licenseType')}
            </label>
            <select bind:value={form.licenseType} class="select-base w-full">
              {#each ['per_seat','per_device','per_user','site_license','unlimited'] as t}
                <option value={t}>{$isLoading ? t : $_(`assets.licenses.type.${t}`)}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'Seat Count' : $_('assets.licenses.form.seatCount')}
            </label>
            <input bind:value={form.seatCount} type="number" min="1" class="input-base w-full" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'Unit Price' : $_('assets.licenses.form.unitPrice')}
            </label>
            <input bind:value={form.unitPrice} type="number" min="0" class="input-base w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'Purchase Date' : $_('assets.licenses.form.purchaseDate')}
            </label>
            <input bind:value={form.purchaseDate} type="date" class="input-base w-full" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">
              {$isLoading ? 'Expiry Date' : $_('assets.licenses.form.expiryDate')}
            </label>
            <input bind:value={form.expiryDate} type="date" class="input-base w-full" />
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">
            {$isLoading ? 'Notes' : $_('assets.licenses.form.notes')}
          </label>
          <textarea bind:value={form.notes} rows={2} class="input-base w-full resize-none"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button class="btn btn-sm" onclick={() => showCreate = false} disabled={saving}>Hủy</button>
        <button class="btn btn-primary btn-sm" onclick={handleCreate} disabled={saving || !form.softwareName.trim()}>
          {saving ? 'Đang lưu...' : ($isLoading ? 'Save' : $_('assets.licenses.form.save'))}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Seats Modal ───────────────────────────────────────────────────────────── -->
{#if seatsLicense}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
    <div class="modal-panel w-full max-w-2xl">
      <div class="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 class="text-base font-semibold">
            {$isLoading ? `Seats — ${seatsLicense.softwareName}` : $_('assets.licenses.seats.title', { values: { name: seatsLicense.softwareName } })}
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            {seatsLicense.seatsUsed}/{seatsLicense.seatCount} ghế đã sử dụng
          </p>
        </div>
        <button class="btn btn-sm" onclick={() => seatsLicense = null}><X class="h-4 w-4" /></button>
      </div>

      <!-- Assign Asset -->
      {#if caps.licenses.manage && seatsLicense.status === 'active'}
        <div class="flex gap-2 border-b border-border p-4">
          <input
            bind:value={assignAssetId}
            type="text"
            placeholder={$isLoading ? 'Asset ID' : $_('assets.licenses.seats.assetIdLabel')}
            class="input-base flex-1 font-mono text-sm"
          />
          <button
            class="btn btn-primary btn-sm"
            onclick={handleAssignAsset}
            disabled={assigning || !assignAssetId.trim()}
          >
            {assigning ? '...' : ($isLoading ? 'Assign Asset' : $_('assets.licenses.seats.assignAsset'))}
          </button>
        </div>
      {/if}

      <div class="max-h-80 overflow-y-auto">
        {#if seatsLoading}
          <div class="flex items-center justify-center py-8 gap-2 text-sm text-slate-400">
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
            Đang tải...
          </div>
        {:else if seats.length === 0}
          <p class="py-8 text-center text-sm text-slate-400">
            {$isLoading ? 'No seats assigned.' : $_('assets.licenses.seats.empty')}
          </p>
        {:else}
          <table class="data-table w-full">
            <thead>
              <tr>
                <th>{$isLoading ? 'Asset' : $_('assets.licenses.seats.colAsset')}</th>
                <th>{$isLoading ? 'Assigned At' : $_('assets.licenses.seats.colAssigned')}</th>
                <th>{$isLoading ? 'Assigned By' : $_('assets.licenses.seats.colBy')}</th>
                {#if caps.licenses.manage}<th></th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each seats as seat (seat.id)}
                <tr>
                  <td>
                    {#if seat.assetCode}
                      <a href="/assets/{seat.assignedAssetId}" class="font-mono text-xs text-primary hover:underline">{seat.assetCode}</a>
                      {#if seat.assetName}<span class="text-slate-400 text-xs"> — {seat.assetName}</span>{/if}
                    {:else if seat.userName}
                      <span class="text-sm">{seat.userName}</span>
                      {#if seat.userEmail}<span class="text-slate-400 text-xs"> ({seat.userEmail})</span>{/if}
                    {:else}
                      <span class="text-slate-400 text-xs">{seat.assignedAssetId ?? seat.assignedUserId ?? '—'}</span>
                    {/if}
                  </td>
                  <td class="text-sm text-slate-400">{formatDate(seat.assignedAt)}</td>
                  <td class="text-sm text-slate-400">{seat.assignedBy}</td>
                  {#if caps.licenses.manage}
                    <td>
                      <button class="btn btn-sm text-xs text-error" onclick={() => handleRevokeSeat(seat.id)}>
                        {$isLoading ? 'Revoke' : $_('assets.licenses.seats.revoke')}
                      </button>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <div class="flex justify-end border-t border-border p-3">
        <button class="btn btn-sm" onclick={() => seatsLicense = null}>Đóng</button>
      </div>
    </div>
  </div>
{/if}
