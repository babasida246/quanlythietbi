<script lang="ts">
  import AuditLogsPanel from '$lib/components/admin/AuditLogsPanel.svelte';
  import DirectoryExplorer from '$lib/components/admin/DirectoryExplorer.svelte';
  import PolicyLibrary from '$lib/components/admin/PolicyLibrary.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { _, isLoading } from '$lib/i18n';
  import { ClipboardList, FolderTree, CheckCircle2, Library } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { getUnifiedEffectivePerms, listUsers } from '$lib/api/admin';
  import type { AdminUser, UnifiedEffectivePerms } from '$lib/api/admin';

  type TabId = 'directory' | 'policies' | 'effective' | 'logs';
  let activeTab = $state<TabId>('directory');

  const tabs = $derived([
    { id: 'directory' as const, label: $isLoading ? 'Directory'     : $_('admin.tab.directory',  { default: 'Thư mục (AD)' }),   icon: FolderTree   },
    { id: 'policies'  as const, label: $isLoading ? 'Policy Library': $_('admin.tab.policies',   { default: 'Thư viện Policy' }), icon: Library      },
    { id: 'effective' as const, label: $isLoading ? 'Effective Perms': $_('admin.tab.effective', { default: 'Quyền thực tế' }),   icon: CheckCircle2 },
    { id: 'logs'      as const, label: $isLoading ? 'Audit Logs'    : $_('admin.tab.logs'),                                       icon: ClipboardList },
  ]);

  // ── Effective Perms tab state ──────────────────────────────────────────────
  let systemUsers = $state<AdminUser[]>([]);
  let selectedUserId = $state('');
  let effectiveData = $state<UnifiedEffectivePerms | null>(null);
  let effectiveLoading = $state(false);
  let effectiveError = $state('');

  onMount(async () => {
    try {
      const res = await listUsers();
      systemUsers = res.data ?? [];
    } catch { /* non-critical */ }
  });

  async function loadEffectivePerms() {
    if (!selectedUserId) return;
    effectiveLoading = true; effectiveError = ''; effectiveData = null;
    try {
      const res = await getUnifiedEffectivePerms(selectedUserId);
      effectiveData = res.data;
    } catch (e: any) {
      effectiveError = e?.message ?? 'Failed to load effective permissions';
    } finally {
      effectiveLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{$isLoading ? 'Admin' : $_('nav.admin', { default: 'Quản trị' })} - QuanLyThietBi</title>
</svelte:head>

<div class="page-shell page-content" data-testid="admin-console-page">
  <PageHeader
    title={$isLoading ? 'Admin Console' : $_('admin.title', { default: 'Bảng điều khiển Quản trị' })}
    subtitle={$isLoading ? 'Directory, policies and audit' : $_('admin.subtitle', { default: 'Quản lý thư mục OU, policy và nhật ký hoạt động' })}
  />

  <!-- Tab bar -->
  <div class="flex gap-1 border-b border-surface-3 mb-6">
    {#each tabs as tab}
      {@const TabIcon = tab.icon}
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === tab.id
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}"
        onclick={() => { activeTab = tab.id }}
      >
        <TabIcon class="w-4 h-4" />
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- ══ Directory ══════════════════════════════════════════════════════════ -->
  {#if activeTab === 'directory'}
    <DirectoryExplorer />

  <!-- ══ Policy Library ════════════════════════════════════════════════════ -->
  {:else if activeTab === 'policies'}
    <PolicyLibrary />

  <!-- ══ Unified Effective Permissions viewer ═══════════════════════════════ -->
  {:else if activeTab === 'effective'}
    <div class="rounded-xl border border-surface-3 bg-surface-1/30 p-4 sm:p-5">
      <div class="mb-4">
        <h2 class="text-base font-semibold text-slate-100">
          {$isLoading ? 'Effective Permissions' : $_('admin.tab.effective', { default: 'Quyền thực tế' })}
        </h2>
        <p class="text-xs text-slate-400">
          {$isLoading
            ? 'Merge Classic RBAC + Policy System (DENY > ALLOW) via PermissionCenterService.'
            : $_('admin.effective.subtitle', { default: 'Xem quyền thực tế sau khi hợp nhất Classic RBAC + Policy System (DENY > ALLOW).' })}
        </p>
      </div>

      <div class="flex gap-3 items-end flex-wrap mb-6">
        <label class="flex-1 min-w-[200px]">
          <span class="text-xs font-semibold text-slate-400 block mb-1">
            {$isLoading ? 'Select user' : $_('admin.effective.selectUser', { default: 'Chọn system user' })}
          </span>
          <select class="select-base w-full" bind:value={selectedUserId}>
            <option value="">— Chọn user —</option>
            {#each systemUsers as u (u.id)}
              <option value={u.id}>{u.name} ({u.email}) — {u.role}</option>
            {/each}
          </select>
        </label>
        <button class="btn btn-primary" onclick={loadEffectivePerms} disabled={!selectedUserId || effectiveLoading}>
          {effectiveLoading ? 'Đang tải...' : 'Xem quyền'}
        </button>
      </div>

      {#if effectiveError}
        <div class="alert alert-error">{effectiveError}</div>
      {:else if effectiveData}
        <!-- Source breakdown -->
        {#if effectiveData.sources}
          <div class="mb-4 p-3 rounded-lg border border-surface-3 bg-surface-2/50 text-xs text-slate-400 space-y-1">
            <p><span class="font-semibold text-slate-300">Classic RBAC:</span> {effectiveData.sources.classic.length} permissions từ role <code class="bg-surface-3 px-1 rounded">{effectiveData.roleSlug ?? 'none'}</code></p>
            <p><span class="font-semibold text-emerald-400">Policy System — Allowed:</span> {(effectiveData.sources.policyAllowed ?? []).length} permissions từ assignments</p>
            <p><span class="font-semibold text-rose-400">Policy System — Denied:</span> {(effectiveData.sources.policyDenied ?? []).length} permissions</p>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- ALLOWED -->
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-3">
              ✓ ALLOWED ({effectiveData.allowed.length})
            </p>
            {#if effectiveData.allowed.length === 0}
              <p class="text-xs text-slate-500">Không có quyền nào được cấp.</p>
            {:else}
              <div class="flex flex-col gap-1 max-h-96 overflow-y-auto pr-1">
                {#each effectiveData.allowed.sort() as key}
                  <code class="text-xs px-2 py-1 rounded bg-emerald-900/20 border border-emerald-700/30 text-emerald-300">{key}</code>
                {/each}
              </div>
            {/if}
          </div>

          <!-- DENIED -->
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-rose-400 mb-3">
              ✕ DENIED ({effectiveData.denied.length})
            </p>
            {#if effectiveData.denied.length === 0}
              <p class="text-xs text-slate-500">Không có quyền nào bị từ chối.</p>
            {:else}
              <div class="flex flex-col gap-1 max-h-96 overflow-y-auto pr-1">
                {#each effectiveData.denied.sort() as key}
                  <code class="text-xs px-2 py-1 rounded bg-rose-900/20 border border-rose-700/30 text-rose-300">{key}</code>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else if !effectiveLoading}
        <div class="text-center text-slate-500 py-12 text-sm">
          Chọn một user và nhấn "Xem quyền" để kiểm tra effective permissions hợp nhất.
        </div>
      {/if}
    </div>

  <!-- ══ Audit Logs ═════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'logs'}
    <AuditLogsPanel />
  {/if}
</div>
