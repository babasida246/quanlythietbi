<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listUsers, updateUser, deleteUser, resetPassword, getUnifiedEffectivePerms,
    type AdminUser, type UnifiedEffectivePerms
  } from '$lib/api/admin'
  import {
    Pencil, Trash2, KeyRound, Check, X,
    RefreshCw, Search, User, Eye, EyeOff, ShieldCheck, ChevronDown
  } from 'lucide-svelte'

  const ROLES = [
    { value: 'admin',            label: 'Admin' },
    { value: 'super_admin',      label: 'Super Admin' },
    { value: 'it_asset_manager', label: 'IT Asset Manager' },
    { value: 'warehouse_keeper', label: 'Warehouse Keeper' },
    { value: 'technician',       label: 'Technician' },
    { value: 'requester',        label: 'Requester' },
    { value: 'viewer',           label: 'Viewer' },
  ]

  const ROLE_COLOR: Record<string, string> = {
    admin: 'text-rose-400 bg-rose-900/20 border-rose-700/30',
    super_admin: 'text-rose-300 bg-rose-900/30 border-rose-600/40',
    it_asset_manager: 'text-sky-400 bg-sky-900/20 border-sky-700/30',
    warehouse_keeper: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
    technician: 'text-violet-400 bg-violet-900/20 border-violet-700/30',
    requester: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
    viewer: 'text-slate-400 bg-slate-800/40 border-slate-600/30',
  }

  // ── State ────────────────────────────────────────────────────────────────────
  let users = $state<AdminUser[]>([])
  let loading = $state(false)
  let error = $state('')
  let search = $state('')

  let editingId = $state<string | null>(null)
  let editName = $state('')
  let editEmail = $state('')
  let editRole = $state('viewer')
  let editActive = $state(true)
  let editSaving = $state(false)

  let pwdUserId = $state<string | null>(null)
  let pwdNew = $state('')
  let pwdConfirm = $state('')
  let pwdSaving = $state(false)
  let pwdError = $state('')
  let showPwdNew = $state(false)
  let showPwdConfirm = $state(false)

  // ── Effective perms inline viewer ────────────────────────────────────────────
  let permsUserId = $state<string | null>(null)
  let permsData = $state<UnifiedEffectivePerms | null>(null)
  let permsLoading = $state(false)
  let permsError = $state('')

  const filtered = $derived(
    search.trim()
      ? users.filter(u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.role.toLowerCase().includes(search.toLowerCase())
        )
      : users
  )

  onMount(load)

  async function load() {
    loading = true; error = ''
    try {
      const res = await listUsers()
      users = res.data ?? []
    } catch (e: any) {
      error = e?.message ?? 'Không thể tải danh sách tài khoản'
    } finally {
      loading = false
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function startEdit(u: AdminUser) {
    editingId = u.id; editName = u.name; editEmail = u.email
    editRole = u.role; editActive = u.isActive
    pwdUserId = null; permsUserId = null
  }

  async function doUpdate() {
    if (!editingId) return
    editSaving = true
    try {
      await updateUser(editingId, { name: editName.trim(), email: editEmail.trim(), role: editRole, isActive: editActive })
      await load()
      editingId = null
    } catch (e: any) {
      error = e?.message ?? 'Cập nhật thất bại'
    } finally {
      editSaving = false
    }
  }

  // ── Deactivate ───────────────────────────────────────────────────────────────
  async function doDeactivate(id: string, name: string) {
    if (!confirm(`Vô hiệu hoá tài khoản "${name}"?`)) return
    try {
      await deleteUser(id)
      await load()
    } catch (e: any) {
      error = e?.message ?? 'Thao tác thất bại'
    }
  }

  // ── Reset password ───────────────────────────────────────────────────────────
  function startResetPwd(u: AdminUser) {
    pwdUserId = u.id; pwdNew = ''; pwdConfirm = ''; pwdError = ''
    editingId = null; permsUserId = null
  }

  async function doResetPwd() {
    if (pwdNew.length < 12) { pwdError = 'Mật khẩu phải có ít nhất 12 ký tự.'; return }
    if (pwdNew !== pwdConfirm) { pwdError = 'Mật khẩu xác nhận không khớp.'; return }
    pwdSaving = true; pwdError = ''
    try {
      await resetPassword(pwdUserId!, pwdNew)
      pwdUserId = null; pwdNew = ''; pwdConfirm = ''
    } catch (e: any) {
      pwdError = e?.message ?? 'Đổi mật khẩu thất bại'
    } finally {
      pwdSaving = false
    }
  }

  // ── Effective perms ──────────────────────────────────────────────────────────
  async function togglePerms(u: AdminUser) {
    if (permsUserId === u.id) { permsUserId = null; permsData = null; return }
    editingId = null; pwdUserId = null
    permsUserId = u.id; permsData = null; permsLoading = true; permsError = ''
    try {
      const res = await getUnifiedEffectivePerms(u.id)
      permsData = res.data
    } catch (e: any) {
      permsError = e?.message ?? 'Không thể tải quyền thực tế'
    } finally {
      permsLoading = false
    }
  }

  function roleLabel(role: string) {
    return ROLES.find(r => r.value === role)?.label ?? role
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-1.5 bg-surface-2 border border-surface-3 rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
      <Search class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <input
        class="bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none flex-1"
        placeholder="Tìm theo tên, email, vai trò..."
        bind:value={search}
      />
    </div>
    <button
      class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-slate-300 transition-colors"
      title="Làm mới" onclick={load}
    >
      <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
    </button>
  </div>

  {#if error}
    <div class="alert alert-error text-sm flex items-start gap-2">
      <span class="flex-1">{error}</span>
      <button onclick={() => error = ''}><X class="w-3.5 h-3.5" /></button>
    </div>
  {/if}

  <!-- User list -->
  {#if loading && users.length === 0}
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm">Đang tải...</div>
  {:else if filtered.length === 0}
    <div class="flex flex-col items-center py-16 text-slate-600 gap-2">
      <User class="w-10 h-10 opacity-30" />
      <p class="text-sm">{search ? 'Không tìm thấy kết quả.' : 'Chưa có tài khoản nào.'}</p>
    </div>
  {:else}
    <div class="rounded-xl border border-surface-3 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-surface-3 bg-surface-2/50">
            <th class="text-left px-4 py-2.5 text-xs text-slate-400 font-medium">Người dùng</th>
            <th class="text-left px-4 py-2.5 text-xs text-slate-400 font-medium">Vai trò</th>
            <th class="text-left px-4 py-2.5 text-xs text-slate-400 font-medium">Trạng thái</th>
            <th class="text-left px-4 py-2.5 text-xs text-slate-400 font-medium">Đăng nhập cuối</th>
            <th class="px-4 py-2.5 w-28"></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as u (u.id)}
            <tr class="border-b border-surface-3/50 last:border-0 transition-colors
              {!u.isActive ? 'opacity-50' : 'hover:bg-surface-2/30'}
              {permsUserId === u.id ? 'bg-violet-900/10' : ''}">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <User class="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p class="font-medium text-slate-200">{u.name}</p>
                    <p class="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded border text-xs font-medium {ROLE_COLOR[u.role] ?? 'text-slate-400 bg-surface-3 border-surface-3'}">
                  {roleLabel(u.role)}
                </span>
              </td>
              <td class="px-4 py-3">
                {#if u.isActive}
                  <span class="text-xs text-emerald-400">● Hoạt động</span>
                {:else}
                  <span class="text-xs text-slate-500">○ Vô hiệu</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-xs text-slate-500">
                {u.lastLogin ? new Date(u.lastLogin).toLocaleString('vi-VN') : '—'}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-0.5 justify-end">
                  <!-- View effective permissions -->
                  <button
                    class="p-1.5 rounded hover:bg-surface-3 transition-colors
                      {permsUserId === u.id ? 'text-violet-400 bg-violet-900/20' : 'text-slate-500 hover:text-violet-400'}"
                    title="Quyền thực tế"
                    onclick={() => togglePerms(u)}
                  >
                    <ShieldCheck class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-sky-400 transition-colors"
                    title="Đổi mật khẩu"
                    onclick={() => startResetPwd(u)}
                  ><KeyRound class="w-3.5 h-3.5" /></button>
                  <button
                    class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-amber-400 transition-colors"
                    title="Chỉnh sửa"
                    onclick={() => startEdit(u)}
                  ><Pencil class="w-3.5 h-3.5" /></button>
                  {#if u.isActive}
                    <button
                      class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Vô hiệu hoá"
                      onclick={() => doDeactivate(u.id, u.name)}
                    ><Trash2 class="w-3.5 h-3.5" /></button>
                  {/if}
                </div>
              </td>
            </tr>

            <!-- Effective permissions row -->
            {#if permsUserId === u.id}
              <tr class="border-b border-surface-3/50 bg-violet-900/5">
                <td colspan="5" class="px-4 py-4">
                  <div class="flex items-center gap-2 mb-3">
                    <ShieldCheck class="w-3.5 h-3.5 text-violet-400" />
                    <p class="text-xs font-semibold text-violet-300">Quyền thực tế — {u.name}</p>
                    <button class="ml-auto p-1 rounded hover:bg-surface-3 text-slate-500" onclick={() => { permsUserId = null; permsData = null }}>
                      <X class="w-3 h-3" />
                    </button>
                  </div>

                  {#if permsLoading}
                    <div class="text-xs text-slate-500 py-2">Đang tải...</div>
                  {:else if permsError}
                    <p class="text-xs text-rose-400">{permsError}</p>
                  {:else if permsData}
                    <!-- Source breakdown -->
                    <div class="mb-3 p-2.5 rounded-lg border border-surface-3 bg-surface-2/40 text-xs text-slate-400 space-y-1">
                      <p>
                        <span class="font-semibold text-slate-300">L1 — Role defaults:</span>
                        {permsData.sources?.classic?.length ?? 0} quyền từ role
                        <code class="bg-surface-3 px-1 rounded ml-1">{permsData.roleSlug ?? 'none'}</code>
                      </p>
                      <p>
                        <span class="font-semibold text-emerald-400">L2 ALLOW:</span>
                        {permsData.sources?.policyAllowed?.length ?? 0} quyền cộng thêm qua User/Group/OU
                      </p>
                      <p>
                        <span class="font-semibold text-rose-400">L2 DENY:</span>
                        {permsData.sources?.policyDenied?.length ?? 0} quyền bị thu hồi (luôn thắng ALLOW)
                      </p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <!-- ALLOWED -->
                      <div>
                        <p class="text-xs font-bold text-emerald-400 mb-2">
                          ✓ ALLOWED ({permsData.allowed.length})
                        </p>
                        {#if permsData.allowed.length === 0}
                          <p class="text-xs text-slate-500">Không có quyền nào.</p>
                        {:else}
                          <div class="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                            {#each [...permsData.allowed].sort() as key}
                              <code class="text-xs px-2 py-0.5 rounded bg-emerald-900/20 border border-emerald-700/30 text-emerald-300">{key}</code>
                            {/each}
                          </div>
                        {/if}
                      </div>

                      <!-- DENIED -->
                      <div>
                        <p class="text-xs font-bold text-rose-400 mb-2">
                          ✕ DENIED ({permsData.denied.length})
                        </p>
                        {#if permsData.denied.length === 0}
                          <p class="text-xs text-slate-500">Không có quyền nào bị từ chối.</p>
                        {:else}
                          <div class="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                            {#each [...permsData.denied].sort() as key}
                              <code class="text-xs px-2 py-0.5 rounded bg-rose-900/20 border border-rose-700/30 text-rose-300">{key}</code>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/if}

            <!-- Edit row -->
            {#if editingId === u.id}
              <tr class="border-b border-surface-3/50 bg-surface-2/50">
                <td colspan="5" class="px-4 py-3">
                  <div class="grid grid-cols-4 gap-3 items-end">
                    <label>
                      <span class="text-xs text-slate-500 block mb-1">Họ tên</span>
                      <input class="input-base w-full text-xs h-8" bind:value={editName} />
                    </label>
                    <label>
                      <span class="text-xs text-slate-500 block mb-1">Email</span>
                      <input class="input-base w-full text-xs h-8" type="email" bind:value={editEmail} />
                    </label>
                    <label>
                      <span class="text-xs text-slate-500 block mb-1">Vai trò</span>
                      <select class="select-base w-full text-xs h-8" bind:value={editRole}>
                        {#each ROLES as r}
                          <option value={r.value}>{r.label}</option>
                        {/each}
                      </select>
                    </label>
                    <label class="flex items-center gap-2 pb-1">
                      <input type="checkbox" bind:checked={editActive} class="accent-primary" />
                      <span class="text-xs text-slate-400">Hoạt động</span>
                    </label>
                  </div>
                  <div class="flex gap-2 mt-3">
                    <button class="btn btn-primary px-3 h-7 text-xs" onclick={doUpdate} disabled={editSaving}>
                      <Check class="w-3 h-3 mr-1" />{editSaving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => editingId = null}>Hủy</button>
                  </div>
                </td>
              </tr>
            {/if}

            <!-- Reset password row -->
            {#if pwdUserId === u.id}
              <tr class="border-b border-surface-3/50 bg-sky-900/10">
                <td colspan="5" class="px-4 py-3">
                  <p class="text-xs font-semibold text-sky-300 flex items-center gap-1.5 mb-2">
                    <KeyRound class="w-3.5 h-3.5" />
                    Đổi mật khẩu — {u.name}
                  </p>
                  <div class="grid grid-cols-2 gap-3 max-w-md">
                    <label>
                      <span class="text-xs text-slate-500 block mb-1">Mật khẩu mới</span>
                      <div class="relative">
                        <input
                          class="input-base w-full text-xs h-8 pr-7"
                          type={showPwdNew ? 'text' : 'password'}
                          bind:value={pwdNew}
                          placeholder="≥12 ký tự"
                          autocomplete="new-password"
                        />
                        <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          onclick={() => showPwdNew = !showPwdNew}>
                          {#if showPwdNew}<EyeOff class="w-3 h-3" />{:else}<Eye class="w-3 h-3" />{/if}
                        </button>
                      </div>
                    </label>
                    <label>
                      <span class="text-xs text-slate-500 block mb-1">Xác nhận</span>
                      <div class="relative">
                        <input
                          class="input-base w-full text-xs h-8 pr-7"
                          type={showPwdConfirm ? 'text' : 'password'}
                          bind:value={pwdConfirm}
                          placeholder="Nhập lại"
                          autocomplete="new-password"
                        />
                        <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          onclick={() => showPwdConfirm = !showPwdConfirm}>
                          {#if showPwdConfirm}<EyeOff class="w-3 h-3" />{:else}<Eye class="w-3 h-3" />{/if}
                        </button>
                      </div>
                    </label>
                  </div>
                  {#if pwdError}
                    <p class="text-xs text-rose-400 mt-1">{pwdError}</p>
                  {/if}
                  <div class="flex gap-2 mt-3">
                    <button
                      class="btn btn-primary px-3 h-7 text-xs"
                      onclick={doResetPwd}
                      disabled={pwdSaving || !pwdNew || !pwdConfirm}
                    >{pwdSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
                    <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => pwdUserId = null}>Hủy</button>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <p class="text-xs text-slate-600 text-right">{filtered.length} tài khoản</p>
  {/if}
</div>
