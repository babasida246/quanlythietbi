<script lang="ts">
  import { onMount } from 'svelte'
  import { _, isLoading } from '$lib/i18n'
  import {
    listLdapConfigs, createLdapConfig, updateLdapConfig, deleteLdapConfig,
    testLdapConnection, syncLdapOrgUnits, listLdapOrgUnits,
  } from '$lib/api/ldap'
  import type { LdapDirectoryConfigDto, LdapOrgUnitDto } from '@qltb/contracts'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { Server, RefreshCw, Plus, Trash2, Edit2, CheckCircle, XCircle, Network } from 'lucide-svelte'

  // ── State ──────────────────────────────────────────────────────────────────
  let configs = $state<LdapDirectoryConfigDto[]>([])
  let orgUnits = $state<LdapOrgUnitDto[]>([])
  let loading = $state(true)
  let error = $state('')

  type TabId = 'configs' | 'ou-tree'
  let activeTab = $state<TabId>('configs')

  // Form modal
  let showForm = $state(false)
  let editingId = $state<string | null>(null)
  let formLoading = $state(false)
  let formError = $state('')

  let form = $state({
    name: '',
    serverUrl: 'ldap://',
    baseDn: '',
    bindDn: '',
    bindPassword: '',
    ouSearchBase: '',
    ouFilter: '(objectClass=organizationalUnit)',
    tlsEnabled: false,
    tlsRejectUnauthorized: true,
    syncIntervalHours: 24,
  })

  // Per-config action state
  type ActionState = { testing?: boolean; syncing?: boolean; testResult?: string; testOk?: boolean; syncResult?: string }
  let actionState = $state<Record<string, ActionState>>({})

  // ── Load ───────────────────────────────────────────────────────────────────
  onMount(async () => {
    await loadAll()
  })

  async function loadAll() {
    loading = true; error = ''
    try {
      configs = await listLdapConfigs()
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  async function loadOrgUnits() {
    loading = true; error = ''
    try {
      orgUnits = await listLdapOrgUnits()
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  async function switchTab(tab: TabId) {
    activeTab = tab
    if (tab === 'ou-tree' && orgUnits.length === 0) {
      await loadOrgUnits()
    }
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openCreate() {
    editingId = null
    form = {
      name: '', serverUrl: 'ldap://', baseDn: '', bindDn: '', bindPassword: '',
      ouSearchBase: '', ouFilter: '(objectClass=organizationalUnit)',
      tlsEnabled: false, tlsRejectUnauthorized: true, syncIntervalHours: 24,
    }
    formError = ''
    showForm = true
  }

  function openEdit(cfg: LdapDirectoryConfigDto) {
    editingId = cfg.id
    form = {
      name: cfg.name,
      serverUrl: cfg.serverUrl,
      baseDn: cfg.baseDn,
      bindDn: cfg.bindDn,
      bindPassword: '',
      ouSearchBase: cfg.ouSearchBase ?? '',
      ouFilter: cfg.ouFilter,
      tlsEnabled: cfg.tlsEnabled,
      tlsRejectUnauthorized: cfg.tlsRejectUnauthorized,
      syncIntervalHours: cfg.syncIntervalHours,
    }
    formError = ''
    showForm = true
  }

  async function submitForm() {
    formLoading = true; formError = ''
    try {
      const payload = {
        name: form.name,
        serverUrl: form.serverUrl,
        baseDn: form.baseDn,
        bindDn: form.bindDn,
        bindPassword: form.bindPassword || undefined,
        ouSearchBase: form.ouSearchBase || null,
        ouFilter: form.ouFilter,
        tlsEnabled: form.tlsEnabled,
        tlsRejectUnauthorized: form.tlsRejectUnauthorized,
        syncIntervalHours: form.syncIntervalHours,
      }
      if (editingId) {
        await updateLdapConfig(editingId, payload)
      } else {
        if (!form.bindPassword) { formError = 'Vui lòng nhập mật khẩu'; return }
        await createLdapConfig({ ...payload, bindPassword: form.bindPassword })
      }
      showForm = false
      await loadAll()
    } catch (e) {
      formError = String(e)
    } finally {
      formLoading = false
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm($isLoading ? 'Xóa cấu hình này?' : $_('admin.ldap.confirmDelete'))) return
    try {
      await deleteLdapConfig(id)
      await loadAll()
    } catch (e) {
      alert(String(e))
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function testConnection(id: string) {
    actionState[id] = { ...actionState[id], testing: true, testResult: undefined }
    try {
      const r = await testLdapConnection(id)
      actionState[id] = { ...actionState[id], testing: false, testOk: r.success, testResult: r.message }
    } catch (e) {
      actionState[id] = { ...actionState[id], testing: false, testOk: false, testResult: String(e) }
    }
  }

  async function syncConfig(id: string) {
    actionState[id] = { ...actionState[id], syncing: true, syncResult: undefined }
    try {
      const r = await syncLdapOrgUnits(id)
      const msg = `Tạo: ${r.created}  Cập nhật: ${r.updated}  Lỗi: ${r.errors.length}  (${r.duration}ms)`
      actionState[id] = { ...actionState[id], syncing: false, syncResult: msg }
      await loadAll()
      if (activeTab === 'ou-tree') await loadOrgUnits()
    } catch (e) {
      actionState[id] = { ...actionState[id], syncing: false, syncResult: String(e) }
    }
  }

  // ── OU tree helpers ────────────────────────────────────────────────────────
  function ousByParent(parentId: string | null) {
    return orgUnits.filter(u => u.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))
  }
</script>

<PageHeader
  title={$isLoading ? 'LDAP / Active Directory' : $_('admin.ldap.title', { default: 'LDAP / Active Directory' })}
  subtitle={$isLoading ? 'Đồng bộ cây OU từ Domain Controller' : $_('admin.ldap.subtitle', { default: 'Đồng bộ cây OU từ Domain Controller' })}
>
  {#snippet actions()}
    {#if activeTab === 'configs'}
      <button class="btn btn-primary" onclick={openCreate}>
        <Plus size={16} />
        {$isLoading ? 'Thêm cấu hình' : $_('admin.ldap.addConfig', { default: 'Thêm cấu hình' })}
      </button>
    {/if}
  {/snippet}
</PageHeader>

<!-- Tabs -->
<div class="flex gap-1 border-b border-border mb-6">
  {#each [{ id: 'configs', label: $isLoading ? 'Cấu hình DC' : $_('admin.ldap.tabConfigs', { default: 'Cấu hình DC' }), icon: Server },
          { id: 'ou-tree', label: $isLoading ? 'Cây OU' : $_('admin.ldap.tabOuTree', { default: 'Cây OU' }), icon: Network }] as tab (tab.id)}
    <button
      class="tabs-trigger"
      class:active={activeTab === tab.id}
      onclick={() => switchTab(tab.id as TabId)}
    >
      <tab.icon size={15} />
      {tab.label}
    </button>
  {/each}
</div>

{#if error}
  <div class="alert alert-error mb-4">{error}</div>
{/if}

<!-- ── Configs tab ───────────────────────────────────────────────────────────── -->
{#if activeTab === 'configs'}
  {#if loading}
    <div class="skeleton-row" />
    <div class="skeleton-row" />
  {:else if configs.length === 0}
    <div class="card p-10 text-center text-slate-400">
      <Server size={40} class="mx-auto mb-3 opacity-40" />
      <p class="font-medium mb-1">{$isLoading ? 'Chưa có cấu hình nào' : $_('admin.ldap.noConfigs', { default: 'Chưa có cấu hình nào' })}</p>
      <p class="text-sm">{$isLoading ? 'Thêm cấu hình kết nối Domain Controller để bắt đầu đồng bộ.' : $_('admin.ldap.noConfigsHint', { default: 'Thêm cấu hình kết nối Domain Controller để bắt đầu đồng bộ.' })}</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each configs as cfg (cfg.id)}
        {@const st = actionState[cfg.id] ?? {}}
        <div class="card p-5">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-slate-200">{cfg.name}</h3>
                <span class="badge-{cfg.isActive ? 'success' : 'error'} text-xs">
                  {cfg.isActive ? ($isLoading ? 'Hoạt động' : $_('common.active')) : ($isLoading ? 'Vô hiệu' : $_('common.inactive'))}
                </span>
              </div>
              <p class="text-sm text-slate-400 mt-0.5">{cfg.serverUrl} &nbsp;·&nbsp; {cfg.baseDn}</p>
              <p class="text-xs text-slate-500 mt-0.5">Bind: {cfg.bindDn}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="btn btn-sm" onclick={() => openEdit(cfg)} title="Sửa">
                <Edit2 size={14} />
              </button>
              <button class="btn btn-sm btn-danger" onclick={() => deleteConfig(cfg.id)} title="Xóa">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <!-- Sync info -->
          {#if cfg.lastSyncAt}
            <p class="text-xs text-slate-500 mb-3">
              Sync gần nhất: {new Date(cfg.lastSyncAt).toLocaleString('vi-VN')}
              &nbsp;·&nbsp;
              {#if cfg.lastSyncStatus === 'success'}
                <span class="text-green-400">{cfg.lastSyncCount} OUs</span>
              {:else if cfg.lastSyncStatus === 'error'}
                <span class="text-red-400">{cfg.lastSyncError}</span>
              {/if}
            </p>
          {/if}

          <!-- Action buttons -->
          <div class="flex flex-wrap items-center gap-3">
            <button
              class="btn btn-sm"
              disabled={st.testing}
              onclick={() => testConnection(cfg.id)}
            >
              {#if st.testing}
                <RefreshCw size={13} class="animate-spin" />
                Đang kiểm tra...
              {:else}
                Kiểm tra kết nối
              {/if}
            </button>

            <button
              class="btn btn-sm btn-primary"
              disabled={st.syncing || !cfg.isActive}
              onclick={() => syncConfig(cfg.id)}
            >
              {#if st.syncing}
                <RefreshCw size={13} class="animate-spin" />
                Đang sync...
              {:else}
                <RefreshCw size={13} />
                Sync ngay
              {/if}
            </button>

            {#if st.testResult !== undefined}
              <span class="text-xs flex items-center gap-1 {st.testOk ? 'text-green-400' : 'text-red-400'}">
                {#if st.testOk}<CheckCircle size={12} />{:else}<XCircle size={12} />{/if}
                {st.testResult}
              </span>
            {/if}

            {#if st.syncResult !== undefined}
              <span class="text-xs text-slate-400">{st.syncResult}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- ── OU Tree tab ───────────────────────────────────────────────────────────── -->
{#if activeTab === 'ou-tree'}
  {#if loading}
    <div class="skeleton-row" />
    <div class="skeleton-row" />
    <div class="skeleton-row" />
  {:else if orgUnits.length === 0}
    <div class="card p-10 text-center text-slate-400">
      <Network size={40} class="mx-auto mb-3 opacity-40" />
      <p>{$isLoading ? 'Chưa có OU nào. Hãy sync từ DC hoặc tạo thủ công.' : $_('admin.ldap.noOus', { default: 'Chưa có OU nào. Hãy sync từ DC hoặc tạo thủ công.' })}</p>
    </div>
  {:else}
    <div class="card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>{$isLoading ? 'Tên OU' : $_('admin.ldap.col.name', { default: 'Tên OU' })}</th>
            <th>{$isLoading ? 'Đường dẫn' : $_('admin.ldap.col.path', { default: 'Đường dẫn' })}</th>
            <th>{$isLoading ? 'Nguồn' : $_('admin.ldap.col.source', { default: 'Nguồn' })}</th>
            <th>{$isLoading ? 'LDAP DN' : $_('admin.ldap.col.ldapDn', { default: 'LDAP DN' })}</th>
            <th>{$isLoading ? 'Sync lúc' : $_('admin.ldap.col.syncAt', { default: 'Sync lúc' })}</th>
          </tr>
        </thead>
        <tbody>
          {#each orgUnits as ou (ou.id)}
            <tr>
              <td>
                <span style="padding-left: {ou.depth * 16}px" class="flex items-center gap-1.5">
                  <Network size={13} class="shrink-0 text-slate-500" />
                  {ou.name}
                </span>
              </td>
              <td class="text-slate-400 text-xs font-mono">{ou.path}</td>
              <td>
                <span class="badge-{ou.source === 'ldap' ? 'info' : 'default'} text-xs">
                  {ou.source === 'ldap' ? 'AD/LDAP' : 'Thủ công'}
                </span>
              </td>
              <td class="text-slate-500 text-xs font-mono truncate max-w-60" title={ou.ldapDn ?? ''}>
                {ou.ldapDn ?? '—'}
              </td>
              <td class="text-slate-500 text-xs">
                {ou.ldapSyncAt ? new Date(ou.ldapSyncAt).toLocaleString('vi-VN') : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

<!-- ── Form Modal ────────────────────────────────────────────────────────────── -->
{#if showForm}
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="modal-panel w-full max-w-lg">
      <h2 class="text-lg font-semibold mb-4">
        {editingId
          ? ($isLoading ? 'Sửa cấu hình' : $_('admin.ldap.editConfig', { default: 'Sửa cấu hình' }))
          : ($isLoading ? 'Thêm cấu hình DC' : $_('admin.ldap.addConfig', { default: 'Thêm cấu hình DC' }))}
      </h2>

      {#if formError}
        <div class="alert alert-error mb-4 text-sm">{formError}</div>
      {/if}

      <div class="space-y-3">
        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">{$isLoading ? 'Tên' : $_('common.name')}</span>
          <input class="input-base w-full" bind:value={form.name} placeholder="Tên cấu hình, vd: Main DC" />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">Server URL</span>
          <input class="input-base w-full font-mono text-sm" bind:value={form.serverUrl}
            placeholder="ldap://dc.company.local hoặc ldaps://dc.company.local:636" />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">Base DN</span>
          <input class="input-base w-full font-mono text-sm" bind:value={form.baseDn}
            placeholder="DC=company,DC=local" />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">Bind DN (Service Account)</span>
          <input class="input-base w-full font-mono text-sm" bind:value={form.bindDn}
            placeholder="CN=svc_ldap,OU=Service Accounts,DC=company,DC=local" />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">
            {$isLoading ? 'Mật khẩu' : $_('common.password')}
            {#if editingId}<span class="text-xs text-slate-500">(để trống để giữ nguyên)</span>{/if}
          </span>
          <input class="input-base w-full" type="password" bind:value={form.bindPassword}
            placeholder={editingId ? '••••••••' : 'Mật khẩu service account'} />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400 mb-1 block">OU Search Base <span class="text-slate-500">(tùy chọn)</span></span>
          <input class="input-base w-full font-mono text-sm" bind:value={form.ouSearchBase}
            placeholder="OU=Departments,DC=company,DC=local (mặc định: Base DN)" />
        </label>

        <div class="flex gap-4">
          <label class="block flex-1">
            <span class="text-sm text-slate-400 mb-1 block">Chu kỳ sync (giờ)</span>
            <input class="input-base w-full" type="number" min="0" max="720" bind:value={form.syncIntervalHours} />
          </label>
          <label class="block flex-1">
            <span class="text-sm text-slate-400 mb-1 block">OU Filter</span>
            <input class="input-base w-full font-mono text-sm" bind:value={form.ouFilter} />
          </label>
        </div>

        <div class="flex gap-6 pt-1">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" bind:checked={form.tlsEnabled} />
            <span class="text-sm">TLS / LDAPS</span>
          </label>
          {#if form.tlsEnabled}
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" bind:checked={form.tlsRejectUnauthorized} />
              <span class="text-sm">Verify TLS cert</span>
            </label>
          {/if}
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button class="btn" onclick={() => (showForm = false)}>
          {$isLoading ? 'Hủy' : $_('common.cancel')}
        </button>
        <button class="btn btn-primary" disabled={formLoading} onclick={submitForm}>
          {formLoading
            ? ($isLoading ? 'Đang lưu...' : $_('common.saving'))
            : ($isLoading ? 'Lưu' : $_('common.save'))}
        </button>
      </div>
    </div>
  </div>
{/if}
