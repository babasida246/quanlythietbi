<script lang="ts">
  import { onMount } from 'svelte'
  import {
    FolderOpen, Folder, ChevronRight, ChevronDown, Users, UsersRound, ShieldCheck,
    Info, Plus, Pencil, Trash2, UserPlus, FolderPlus, X, Check, Move,
    RefreshCw, Search, LinkIcon, Unlink, Building2, User, Shield
  } from 'lucide-svelte'
  import {
    getAdOuTree, listAdUsers, listAdGroups,
    createAdOu, updateAdOu, deleteAdOu,
    createAdUser, updateAdUser, deleteAdUser, moveAdUser,
    createAdGroup, updateAdGroup, deleteAdGroup,
    listPoliciesByOu, listPolicies, addPolicyAssignment, removePolicyAssignment,
    type AdOrgUnit, type AdRbacUser, type AdRbacGroup, type OuPolicyLink, type Policy
  } from '$lib/api/admin'

  // ── Tree ──────────────────────────────────────────────────────────────────
  interface OuNode extends AdOrgUnit { children: OuNode[] }

  function buildTree(flat: AdOrgUnit[]): OuNode[] {
    const map = new Map<string, OuNode>()
    flat.forEach(ou => map.set(ou.id, { ...ou, children: [] }))
    const roots: OuNode[] = []
    map.forEach(node => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    })
    const sort = (nodes: OuNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name))
      nodes.forEach(n => sort(n.children))
    }
    sort(roots)
    return roots
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let allOus = $state<AdOrgUnit[]>([])
  let selectedOu = $state<AdOrgUnit | null>(null)
  let expandedOus = $state<Set<string>>(new Set())
  let rightTab = $state<'users' | 'groups' | 'policies' | 'properties'>('users')

  let users = $state<AdRbacUser[]>([])
  let groups = $state<AdRbacGroup[]>([])
  let ouPolicies = $state<OuPolicyLink[]>([])
  let allPolicies = $state<Policy[]>([])

  let loading = $state(false)
  let contentLoading = $state(false)
  let error = $state('')
  let searchOu = $state('')

  // inline form state
  let showCreateOu = $state(false)
  let showCreateUser = $state(false)
  let showCreateGroup = $state(false)
  let showLinkPolicy = $state(false)

  let formName = $state('')
  let formDesc = $state('')
  let formUsername = $state('')
  let formDisplayName = $state('')
  let formEmail = $state('')
  let formStatus = $state<'active' | 'disabled'>('active')
  let formSaving = $state(false)

  let editingUserId = $state<string | null>(null)
  let editUserName = $state('')
  let editUserEmail = $state('')
  let editUserStatus = $state<'active' | 'disabled' | 'locked'>('active')

  let editingGroupId = $state<string | null>(null)
  let editGroupName = $state('')
  let editGroupDesc = $state('')

  let editingOuId = $state<string | null>(null)
  let editOuName = $state('')
  let editOuDesc = $state('')

  let linkPolicyId = $state('')
  let linkEffect = $state<'ALLOW' | 'DENY'>('ALLOW')
  let linkInherit = $state(true)
  let linkSaving = $state(false)

  let ouTree = $derived(buildTree(allOus))
  let filteredTree = $derived(searchOu.trim()
    ? filterTree(ouTree, searchOu.toLowerCase())
    : ouTree
  )

  function filterTree(nodes: OuNode[], q: string): OuNode[] {
    return nodes.flatMap(n => {
      const match = n.name.toLowerCase().includes(q)
      const filteredChildren = filterTree(n.children, q)
      if (match || filteredChildren.length > 0) {
        return [{ ...n, children: filteredChildren }]
      }
      return []
    })
  }

  onMount(async () => {
    loading = true
    try {
      const [ouRes, policyRes] = await Promise.all([getAdOuTree(), listPolicies()])
      allOus = ouRes.data ?? []
      allPolicies = policyRes.data ?? []
      // auto-expand roots
      allOus.filter(o => !o.parentId).forEach(r => expandedOus.add(r.id))
    } catch (e: any) {
      error = e?.message ?? 'Failed to load directory'
    } finally {
      loading = false
    }
  })

  $effect(() => {
    if (selectedOu) {
      loadOuContent(selectedOu.id)
    }
  })

  async function loadOuContent(ouId: string) {
    contentLoading = true
    try {
      const [uRes, gRes, pRes] = await Promise.all([
        listAdUsers({ ouId }),
        listAdGroups({ ouId }),
        listPoliciesByOu(ouId),
      ])
      users = uRes.data ?? []
      groups = gRes.data ?? []
      ouPolicies = pRes.data ?? []
    } catch (e: any) {
      error = e?.message ?? 'Failed to load OU content'
    } finally {
      contentLoading = false
    }
  }

  function toggleExpand(id: string) {
    if (expandedOus.has(id)) {
      expandedOus.delete(id)
      expandedOus = new Set(expandedOus)
    } else {
      expandedOus.add(id)
      expandedOus = new Set(expandedOus)
    }
  }

  function selectOu(ou: AdOrgUnit) {
    selectedOu = ou
    resetForms()
  }

  function resetForms() {
    showCreateOu = false; showCreateUser = false; showCreateGroup = false; showLinkPolicy = false
    formName = ''; formDesc = ''; formUsername = ''; formDisplayName = ''; formEmail = ''
    editingUserId = null; editingGroupId = null; editingOuId = null
  }

  async function refresh() {
    loading = true
    try {
      const [ouRes, policyRes] = await Promise.all([getAdOuTree(), listPolicies()])
      allOus = ouRes.data ?? []
      allPolicies = policyRes.data ?? []
      if (selectedOu) {
        const found = allOus.find(o => o.id === selectedOu!.id)
        selectedOu = found ?? null
        if (found) await loadOuContent(found.id)
      }
    } finally { loading = false }
  }

  // ── Create OU ──────────────────────────────────────────────────────────────
  async function doCreateOu() {
    if (!formName.trim()) return
    formSaving = true
    try {
      await createAdOu({ name: formName.trim(), parentId: selectedOu?.id ?? null, description: formDesc.trim() || undefined })
      await refresh()
      showCreateOu = false; formName = ''; formDesc = ''
    } catch (e: any) { error = e?.message ?? 'Failed to create OU' }
    finally { formSaving = false }
  }

  async function doUpdateOu() {
    if (!editingOuId || !editOuName.trim()) return
    formSaving = true
    try {
      await updateAdOu(editingOuId, { name: editOuName.trim(), description: editOuDesc.trim() || undefined })
      await refresh()
      editingOuId = null
    } catch (e: any) { error = e?.message ?? 'Failed to update OU' }
    finally { formSaving = false }
  }

  async function doDeleteOu(id: string) {
    if (!confirm('Xóa OU này? Tất cả nội dung bên trong sẽ bị ảnh hưởng.')) return
    try {
      await deleteAdOu(id)
      if (selectedOu?.id === id) selectedOu = null
      await refresh()
    } catch (e: any) { error = e?.message ?? 'Failed to delete OU' }
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async function doCreateUser() {
    if (!selectedOu || !formUsername.trim() || !formDisplayName.trim()) return
    formSaving = true
    try {
      await createAdUser({ username: formUsername.trim(), displayName: formDisplayName.trim(), email: formEmail.trim() || undefined, ouId: selectedOu.id, status: formStatus })
      await loadOuContent(selectedOu.id)
      showCreateUser = false; formUsername = ''; formDisplayName = ''; formEmail = ''; formStatus = 'active'
    } catch (e: any) { error = e?.message ?? 'Failed to create user' }
    finally { formSaving = false }
  }

  async function doUpdateUser() {
    if (!editingUserId) return
    formSaving = true
    try {
      await updateAdUser(editingUserId, { displayName: editUserName.trim() || undefined, email: editUserEmail.trim() || undefined, status: editUserStatus })
      if (selectedOu) await loadOuContent(selectedOu.id)
      editingUserId = null
    } catch (e: any) { error = e?.message ?? 'Failed to update user' }
    finally { formSaving = false }
  }

  async function doDeleteUser(id: string) {
    if (!confirm('Xóa người dùng này khỏi thư mục?')) return
    try {
      await deleteAdUser(id)
      if (selectedOu) await loadOuContent(selectedOu.id)
    } catch (e: any) { error = e?.message ?? 'Failed to delete user' }
  }

  function startEditUser(u: AdRbacUser) {
    editingUserId = u.id; editUserName = u.displayName; editUserEmail = u.email ?? ''; editUserStatus = u.status as any
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  async function doCreateGroup() {
    if (!selectedOu || !formName.trim()) return
    formSaving = true
    try {
      await createAdGroup({ name: formName.trim(), description: formDesc.trim() || undefined, ouId: selectedOu.id })
      await loadOuContent(selectedOu.id)
      showCreateGroup = false; formName = ''; formDesc = ''
    } catch (e: any) { error = e?.message ?? 'Failed to create group' }
    finally { formSaving = false }
  }

  async function doUpdateGroup() {
    if (!editingGroupId || !editGroupName.trim()) return
    formSaving = true
    try {
      await updateAdGroup(editingGroupId, { name: editGroupName.trim(), description: editGroupDesc.trim() || undefined })
      if (selectedOu) await loadOuContent(selectedOu.id)
      editingGroupId = null
    } catch (e: any) { error = e?.message ?? 'Failed to update group' }
    finally { formSaving = false }
  }

  async function doDeleteGroup(id: string) {
    if (!confirm('Xóa nhóm này?')) return
    try {
      await deleteAdGroup(id)
      if (selectedOu) await loadOuContent(selectedOu.id)
    } catch (e: any) { error = e?.message ?? 'Failed to delete group' }
  }

  function startEditGroup(g: AdRbacGroup) {
    editingGroupId = g.id; editGroupName = g.name; editGroupDesc = g.description ?? ''
  }

  // ── Policy linking ─────────────────────────────────────────────────────────
  async function doLinkPolicy() {
    if (!selectedOu || !linkPolicyId) return
    linkSaving = true
    try {
      await addPolicyAssignment(linkPolicyId, {
        principalType: 'OU', principalId: selectedOu.id,
        scopeType: 'GLOBAL', effect: linkEffect, inherit: linkInherit
      })
      ouPolicies = (await listPoliciesByOu(selectedOu.id)).data ?? []
      showLinkPolicy = false; linkPolicyId = ''; linkEffect = 'ALLOW'; linkInherit = true
    } catch (e: any) { error = e?.message ?? 'Failed to link policy' }
    finally { linkSaving = false }
  }

  async function doUnlinkPolicy(policyId: string, assignmentId: string) {
    if (!confirm('Hủy liên kết policy này với OU?')) return
    try {
      await removePolicyAssignment(policyId, assignmentId)
      if (selectedOu) ouPolicies = (await listPoliciesByOu(selectedOu.id)).data ?? []
    } catch (e: any) { error = e?.message ?? 'Failed to unlink policy' }
  }

  const STATUS_COLOR: Record<string, string> = {
    active: 'text-emerald-400', disabled: 'text-slate-500', locked: 'text-rose-400'
  }
  const EFFECT_COLOR = { ALLOW: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40', DENY: 'text-rose-400 bg-rose-900/20 border-rose-700/40' }
  const REASON_LABEL = { direct: 'Trực tiếp', inherited: 'Kế thừa', via_group: 'Qua nhóm' }
  const REASON_COLOR = { direct: 'text-sky-400 bg-sky-900/20 border-sky-700/30', inherited: 'text-amber-400 bg-amber-900/20 border-amber-700/30', via_group: 'text-violet-400 bg-violet-900/20 border-violet-700/30' }
</script>

<!-- ══════════════════════════════════════════════════════════════════════════
     DirectoryExplorer — Windows Server ADUC-inspired OU & policy manager
══════════════════════════════════════════════════════════════════════════ -->

{#snippet ouTreeNode(node: OuNode, depth: number)}
  {@const expanded = expandedOus.has(node.id)}
  {@const selected = selectedOu?.id === node.id}
  {@const hasChildren = node.children.length > 0}

  <div>
    <!-- Row -->
    <div
      role="button"
      tabindex="0"
      class="group flex items-center gap-1 py-0.5 pr-2 rounded cursor-pointer select-none
        {selected ? 'bg-primary/15 text-primary' : 'hover:bg-surface-3/60 text-slate-300'}"
      style="padding-left: {0.5 + depth * 1.25}rem"
      onclick={() => { selectOu(node); if (hasChildren) toggleExpand(node.id) }}
      onkeydown={(e) => e.key === 'Enter' && (selectOu(node), hasChildren && toggleExpand(node.id))}
    >
      <!-- Expand toggle -->
      <span class="w-4 h-4 flex items-center justify-center flex-shrink-0 text-slate-500">
        {#if hasChildren}
          {#if expanded}
            <ChevronDown class="w-3 h-3" />
          {:else}
            <ChevronRight class="w-3 h-3" />
          {/if}
        {/if}
      </span>
      <!-- Folder icon -->
      {#if expanded && hasChildren}
        <FolderOpen class="w-4 h-4 flex-shrink-0 {selected ? 'text-primary' : 'text-amber-400'}" />
      {:else}
        <Folder class="w-4 h-4 flex-shrink-0 {selected ? 'text-primary' : 'text-amber-500/70'}" />
      {/if}
      <span class="text-xs truncate ml-0.5 {selected ? 'font-semibold' : ''}">{node.name}</span>
    </div>

    <!-- Inline edit form for this node -->
    {#if editingOuId === node.id}
      <div class="mx-2 my-1 p-2 rounded-lg bg-surface-2 border border-surface-3 space-y-1.5">
        <input class="input-base w-full text-xs h-7" bind:value={editOuName} placeholder="Tên OU" />
        <input class="input-base w-full text-xs h-7" bind:value={editOuDesc} placeholder="Mô tả (tuỳ chọn)" />
        <div class="flex gap-1">
          <button class="btn btn-primary px-2 py-1 text-xs" onclick={doUpdateOu} disabled={formSaving}>
            <Check class="w-3 h-3" />
          </button>
          <button class="btn px-2 py-1 text-xs bg-surface-3 text-slate-400 hover:text-slate-200" onclick={() => editingOuId = null}>
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>
    {/if}

    <!-- Children -->
    {#if expanded}
      {#each node.children as child (child.id)}
        {@render ouTreeNode(child, depth + 1)}
      {/each}
    {/if}
  </div>
{/snippet}

<!-- Layout -->
<div class="flex gap-0 h-[calc(100vh-220px)] min-h-[480px] rounded-xl overflow-hidden border border-surface-3">

  <!-- ── Left: OU Tree ─────────────────────────────────────────────────────── -->
  <div class="w-64 flex-shrink-0 flex flex-col border-r border-surface-3 bg-surface-1/60">
    <!-- Header -->
    <div class="px-3 py-2.5 border-b border-surface-3 flex items-center gap-2">
      <Building2 class="w-4 h-4 text-amber-400 flex-shrink-0" />
      <span class="text-xs font-semibold text-slate-300 flex-1">Thư mục (OU)</span>
      <button
        class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-slate-300 transition-colors"
        title="Làm mới"
        onclick={refresh}
      >
        <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>

    <!-- Search -->
    <div class="px-2 py-1.5 border-b border-surface-3/50">
      <div class="flex items-center gap-1.5 bg-surface-2 rounded-md px-2 py-1">
        <Search class="w-3 h-3 text-slate-500" />
        <input
          class="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none flex-1 min-w-0"
          placeholder="Tìm OU..."
          bind:value={searchOu}
        />
      </div>
    </div>

    <!-- Tree -->
    <div class="flex-1 overflow-y-auto py-1 px-1">
      {#if loading}
        <div class="flex items-center justify-center h-20 text-slate-500 text-xs">Đang tải...</div>
      {:else if filteredTree.length === 0}
        <div class="text-center text-slate-600 text-xs py-6">Không có OU nào</div>
      {:else}
        {#each filteredTree as node (node.id)}
          {@render ouTreeNode(node, 0)}
        {/each}
      {/if}
    </div>

    <!-- Bottom: Create OU -->
    <div class="border-t border-surface-3 p-2">
      {#if showCreateOu}
        <div class="space-y-1.5">
          <input class="input-base w-full text-xs h-7" bind:value={formName} placeholder="Tên OU mới" />
          <input class="input-base w-full text-xs h-7" bind:value={formDesc} placeholder="Mô tả (tuỳ chọn)" />
          {#if selectedOu}
            <p class="text-xs text-slate-500">Con của: <span class="text-slate-400">{selectedOu.name}</span></p>
          {/if}
          <div class="flex gap-1">
            <button class="btn btn-primary px-2 py-1 text-xs flex-1" onclick={doCreateOu} disabled={formSaving || !formName.trim()}>Tạo</button>
            <button class="btn px-2 py-1 text-xs bg-surface-3 text-slate-400" onclick={() => { showCreateOu = false; formName = ''; formDesc = '' }}>
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      {:else}
        <button class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 w-full transition-colors py-1"
          onclick={() => { showCreateOu = true }}>
          <FolderPlus class="w-3.5 h-3.5" />
          Tạo OU{selectedOu ? ' con' : ' gốc'}
        </button>
      {/if}
    </div>
  </div>

  <!-- ── Right: Content ────────────────────────────────────────────────────── -->
  <div class="flex-1 flex flex-col min-w-0 bg-surface-1/30">
    {#if !selectedOu}
      <!-- Placeholder -->
      <div class="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
        <Building2 class="w-12 h-12 opacity-30" />
        <p class="text-sm">Chọn một OU từ cây bên trái để xem nội dung</p>
      </div>
    {:else}
      <!-- OU Header -->
      <div class="px-4 py-3 border-b border-surface-3 flex items-start gap-3">
        <FolderOpen class="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-slate-100">{selectedOu.name}</h3>
          <p class="text-xs text-slate-500 font-mono">{selectedOu.path}</p>
        </div>
        <!-- OU actions -->
        <div class="flex gap-1 flex-shrink-0">
          <button
            class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-amber-400 transition-colors"
            title="Sửa OU"
            onclick={() => { editingOuId = selectedOu!.id; editOuName = selectedOu!.name; editOuDesc = selectedOu!.description ?? '' }}
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button
            class="p-1.5 rounded hover:bg-surface-3 text-slate-500 hover:text-rose-400 transition-colors"
            title="Xóa OU"
            onclick={() => doDeleteOu(selectedOu!.id)}
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- OU inline edit -->
      {#if editingOuId === selectedOu.id}
        <div class="px-4 py-2 border-b border-surface-3 bg-surface-2/50 flex gap-2 items-end">
          <label class="flex-1">
            <span class="text-xs text-slate-500 block mb-0.5">Tên OU</span>
            <input class="input-base w-full text-xs h-7" bind:value={editOuName} />
          </label>
          <label class="flex-1">
            <span class="text-xs text-slate-500 block mb-0.5">Mô tả</span>
            <input class="input-base w-full text-xs h-7" bind:value={editOuDesc} />
          </label>
          <button class="btn btn-primary px-3 h-7 text-xs" onclick={doUpdateOu} disabled={formSaving}>Lưu</button>
          <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => editingOuId = null}>Hủy</button>
        </div>
      {/if}

      <!-- Tabs -->
      <div class="flex border-b border-surface-3 px-3 gap-0.5">
        {#each ([
          { id: 'users',      label: `Người dùng (${users.length})`,  Icon: User         },
          { id: 'groups',     label: `Nhóm (${groups.length})`,       Icon: UsersRound   },
          { id: 'policies',   label: `Policy (${ouPolicies.length})`, Icon: ShieldCheck  },
          { id: 'properties', label: 'Thuộc tính',                    Icon: Info         },
        ] as { id: 'users'|'groups'|'policies'|'properties', label: string, Icon: any }[]) as tab}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors
              {rightTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'}"
            onclick={() => rightTab = tab.id}
          >
            <tab.Icon class="w-3.5 h-3.5" />
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if contentLoading}
          <div class="flex items-center justify-center h-24 text-slate-500 text-xs">Đang tải...</div>

        <!-- ══ USERS ════════════════════════════════════════════════════════════ -->
        {:else if rightTab === 'users'}
          <div class="space-y-3">
            <!-- User list -->
            {#if users.length === 0}
              <p class="text-xs text-slate-500 text-center py-6">Không có người dùng trong OU này.</p>
            {:else}
              <div class="space-y-1">
                {#each users as u (u.id)}
                  {#if editingUserId === u.id}
                    <!-- Inline edit -->
                    <div class="rounded-lg border border-primary/30 bg-surface-2/80 p-3 space-y-2">
                      <div class="grid grid-cols-2 gap-2">
                        <label>
                          <span class="text-xs text-slate-500 block mb-0.5">Tên hiển thị</span>
                          <input class="input-base w-full text-xs h-7" bind:value={editUserName} />
                        </label>
                        <label>
                          <span class="text-xs text-slate-500 block mb-0.5">Email</span>
                          <input class="input-base w-full text-xs h-7" type="email" bind:value={editUserEmail} />
                        </label>
                      </div>
                      <label class="flex items-center gap-2">
                        <span class="text-xs text-slate-500">Trạng thái:</span>
                        <select class="select-base text-xs h-7 px-2" bind:value={editUserStatus}>
                          <option value="active">Hoạt động</option>
                          <option value="disabled">Vô hiệu</option>
                          <option value="locked">Khoá</option>
                        </select>
                      </label>
                      <div class="flex gap-1">
                        <button class="btn btn-primary px-3 h-7 text-xs" onclick={doUpdateUser} disabled={formSaving}>Lưu</button>
                        <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => editingUserId = null}>Hủy</button>
                      </div>
                    </div>
                  {:else}
                    <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2/60 group border border-transparent hover:border-surface-3/60 transition-all">
                      <div class="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                        <User class="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-slate-200 truncate">{u.displayName}</p>
                        <p class="text-xs text-slate-500 truncate">{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                      </div>
                      <span class="text-xs {STATUS_COLOR[u.status] ?? 'text-slate-500'}">{u.status}</span>
                      <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-amber-400 transition-colors" onclick={() => startEditUser(u)}><Pencil class="w-3 h-3" /></button>
                        <button class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-rose-400 transition-colors" onclick={() => doDeleteUser(u.id)}><Trash2 class="w-3 h-3" /></button>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}

            <!-- Create user -->
            {#if showCreateUser}
              <div class="rounded-lg border border-surface-3 bg-surface-2/60 p-3 space-y-2">
                <p class="text-xs font-semibold text-slate-300">Tạo người dùng mới</p>
                <div class="grid grid-cols-2 gap-2">
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Tên đăng nhập *</span>
                    <input class="input-base w-full text-xs h-7" bind:value={formUsername} placeholder="john.doe" />
                  </label>
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Tên hiển thị *</span>
                    <input class="input-base w-full text-xs h-7" bind:value={formDisplayName} placeholder="John Doe" />
                  </label>
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Email</span>
                    <input class="input-base w-full text-xs h-7" type="email" bind:value={formEmail} placeholder="john@example.com" />
                  </label>
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Trạng thái</span>
                    <select class="select-base w-full text-xs h-7" bind:value={formStatus}>
                      <option value="active">Hoạt động</option>
                      <option value="disabled">Vô hiệu</option>
                    </select>
                  </label>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-primary px-3 h-7 text-xs" onclick={doCreateUser} disabled={formSaving || !formUsername.trim() || !formDisplayName.trim()}>Tạo</button>
                  <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => { showCreateUser = false; formUsername = ''; formDisplayName = ''; formEmail = '' }}>Hủy</button>
                </div>
              </div>
            {:else}
              <button class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors py-1" onclick={() => showCreateUser = true}>
                <UserPlus class="w-3.5 h-3.5" /> Thêm người dùng
              </button>
            {/if}
          </div>

        <!-- ══ GROUPS ══════════════════════════════════════════════════════════ -->
        {:else if rightTab === 'groups'}
          <div class="space-y-3">
            {#if groups.length === 0}
              <p class="text-xs text-slate-500 text-center py-6">Không có nhóm trong OU này.</p>
            {:else}
              <div class="space-y-1">
                {#each groups as g (g.id)}
                  {#if editingGroupId === g.id}
                    <div class="rounded-lg border border-primary/30 bg-surface-2/80 p-3 space-y-2">
                      <div class="grid grid-cols-2 gap-2">
                        <label>
                          <span class="text-xs text-slate-500 block mb-0.5">Tên nhóm *</span>
                          <input class="input-base w-full text-xs h-7" bind:value={editGroupName} />
                        </label>
                        <label>
                          <span class="text-xs text-slate-500 block mb-0.5">Mô tả</span>
                          <input class="input-base w-full text-xs h-7" bind:value={editGroupDesc} />
                        </label>
                      </div>
                      <div class="flex gap-1">
                        <button class="btn btn-primary px-3 h-7 text-xs" onclick={doUpdateGroup} disabled={formSaving}>Lưu</button>
                        <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => editingGroupId = null}>Hủy</button>
                      </div>
                    </div>
                  {:else}
                    <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2/60 group border border-transparent hover:border-surface-3/60 transition-all">
                      <div class="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                        <UsersRound class="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-slate-200 truncate">{g.name}</p>
                        {#if g.description}
                          <p class="text-xs text-slate-500 truncate">{g.description}</p>
                        {/if}
                      </div>
                      <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-amber-400 transition-colors" onclick={() => startEditGroup(g)}><Pencil class="w-3 h-3" /></button>
                        <button class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-rose-400 transition-colors" onclick={() => doDeleteGroup(g.id)}><Trash2 class="w-3 h-3" /></button>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}

            {#if showCreateGroup}
              <div class="rounded-lg border border-surface-3 bg-surface-2/60 p-3 space-y-2">
                <p class="text-xs font-semibold text-slate-300">Tạo nhóm mới</p>
                <div class="grid grid-cols-2 gap-2">
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Tên nhóm *</span>
                    <input class="input-base w-full text-xs h-7" bind:value={formName} placeholder="VD: IT-Admins" />
                  </label>
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Mô tả</span>
                    <input class="input-base w-full text-xs h-7" bind:value={formDesc} placeholder="Tuỳ chọn" />
                  </label>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-primary px-3 h-7 text-xs" onclick={doCreateGroup} disabled={formSaving || !formName.trim()}>Tạo</button>
                  <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => { showCreateGroup = false; formName = ''; formDesc = '' }}>Hủy</button>
                </div>
              </div>
            {:else}
              <button class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors py-1" onclick={() => showCreateGroup = true}>
                <Plus class="w-3.5 h-3.5" /> Tạo nhóm
              </button>
            {/if}
          </div>

        <!-- ══ POLICIES (GPO-style) ══════════════════════════════════════════ -->
        {:else if rightTab === 'policies'}
          <div class="space-y-3">
            <p class="text-xs text-slate-500">
              Policy được liên kết với OU này — tương tự GPO trong Windows Server AD.
              Policy <span class="text-sky-400">kế thừa</span> từ OU cha sẽ áp dụng cho tất cả user/nhóm trong OU.
            </p>

            <!-- Policy table -->
            {#if ouPolicies.length === 0}
              <p class="text-xs text-slate-500 text-center py-6">Chưa có policy nào được liên kết với OU này.</p>
            {:else}
              <div class="rounded-lg border border-surface-3 overflow-hidden">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b border-surface-3 bg-surface-2/50">
                      <th class="text-left px-3 py-2 text-slate-400 font-medium">Policy</th>
                      <th class="text-left px-3 py-2 text-slate-400 font-medium">Effect</th>
                      <th class="text-left px-3 py-2 text-slate-400 font-medium">Loại liên kết</th>
                      <th class="text-left px-3 py-2 text-slate-400 font-medium">Kế thừa</th>
                      <th class="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each ouPolicies as p (p.assignmentId)}
                      <tr class="border-b border-surface-3/50 last:border-0 hover:bg-surface-2/30 transition-colors">
                        <td class="px-3 py-2">
                          <div>
                            <p class="font-medium text-slate-200">{p.name}</p>
                            <p class="text-slate-500 font-mono">{p.slug}</p>
                          </div>
                        </td>
                        <td class="px-3 py-2">
                          <span class="px-1.5 py-0.5 rounded border text-xs font-medium {EFFECT_COLOR[p.effect]}">{p.effect}</span>
                        </td>
                        <td class="px-3 py-2">
                          <span class="px-1.5 py-0.5 rounded border text-xs {REASON_COLOR[p.linkReason]}">{REASON_LABEL[p.linkReason]}</span>
                        </td>
                        <td class="px-3 py-2 text-slate-400">{p.inherit ? 'Có' : 'Không'}</td>
                        <td class="px-3 py-2 text-right">
                          {#if p.linkReason === 'direct'}
                            <button
                              class="p-1 rounded hover:bg-surface-3 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Hủy liên kết"
                              onclick={() => doUnlinkPolicy(p.policyId, p.assignmentId)}
                            >
                              <Unlink class="w-3 h-3" />
                            </button>
                          {:else}
                            <span class="text-slate-600 text-xs italic">từ cha</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}

            <!-- Link policy form -->
            {#if showLinkPolicy}
              <div class="rounded-lg border border-surface-3 bg-surface-2/60 p-3 space-y-2">
                <p class="text-xs font-semibold text-slate-300">Liên kết policy với OU này</p>
                <div class="grid grid-cols-3 gap-2">
                  <label class="col-span-1">
                    <span class="text-xs text-slate-500 block mb-0.5">Policy *</span>
                    <select class="select-base w-full text-xs h-7" bind:value={linkPolicyId}>
                      <option value="">— Chọn policy —</option>
                      {#each allPolicies as pol (pol.id)}
                        <option value={pol.id}>{pol.name}</option>
                      {/each}
                    </select>
                  </label>
                  <label>
                    <span class="text-xs text-slate-500 block mb-0.5">Effect</span>
                    <select class="select-base w-full text-xs h-7" bind:value={linkEffect}>
                      <option value="ALLOW">ALLOW</option>
                      <option value="DENY">DENY</option>
                    </select>
                  </label>
                  <label class="flex flex-col">
                    <span class="text-xs text-slate-500 block mb-0.5">Kế thừa xuống OU con</span>
                    <label class="flex items-center gap-2 mt-1.5 cursor-pointer">
                      <input type="checkbox" bind:checked={linkInherit} class="accent-primary" />
                      <span class="text-xs text-slate-400">{linkInherit ? 'Có' : 'Không'}</span>
                    </label>
                  </label>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-primary px-3 h-7 text-xs" onclick={doLinkPolicy} disabled={linkSaving || !linkPolicyId}>
                    <LinkIcon class="w-3 h-3 mr-1" />Liên kết
                  </button>
                  <button class="btn px-3 h-7 text-xs bg-surface-3 text-slate-400" onclick={() => { showLinkPolicy = false; linkPolicyId = '' }}>Hủy</button>
                </div>
              </div>
            {:else}
              <button
                class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors py-1"
                onclick={() => showLinkPolicy = true}
              >
                <LinkIcon class="w-3.5 h-3.5" /> Liên kết policy
              </button>
            {/if}
          </div>

        <!-- ══ PROPERTIES ════════════════════════════════════════════════════ -->
        {:else if rightTab === 'properties'}
          <dl class="space-y-3 max-w-lg text-xs">
            {#each ([
              ['Tên',         selectedOu.name],
              ['Mô tả',       selectedOu.description ?? '—'],
              ['Đường dẫn',   selectedOu.path],
              ['ID',          selectedOu.id],
              ['Parent ID',   selectedOu.parentId ?? '(root)'],
              ['Độ sâu',      String(selectedOu.depth)],
              ['Tạo lúc',     new Date(selectedOu.createdAt).toLocaleString('vi-VN')],
              ['Cập nhật',    new Date(selectedOu.updatedAt).toLocaleString('vi-VN')],
            ] as [string, string][]) as [label, value]}
              <div class="flex gap-4 border-b border-surface-3/40 pb-2">
                <dt class="w-28 flex-shrink-0 text-slate-500 font-medium">{label}</dt>
                <dd class="text-slate-300 font-mono break-all">{value}</dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Global error toast -->
{#if error}
  <div class="fixed bottom-4 right-4 z-50 max-w-sm">
    <div class="alert alert-error flex items-start gap-2">
      <span class="flex-1 text-xs">{error}</span>
      <button onclick={() => error = ''} class="flex-shrink-0 text-rose-300 hover:text-white"><X class="w-3.5 h-3.5" /></button>
    </div>
  </div>
{/if}
