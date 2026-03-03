<script lang="ts">
    import { onMount } from 'svelte'
    import {
        FolderTree, Users, Shield, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
        UserPlus, FolderPlus, ShieldPlus, Link, Unlink, Search, RefreshCw,
        Building2, User, UsersRound, Lock, Unlock, Eye, Ban, CheckCircle2
    } from 'lucide-svelte'
    import {
        getAdOuTree, listAdUsers, listAdGroups, listAdGroupMembers,
        createAdOu, updateAdOu, deleteAdOu,
        createAdUser, updateAdUser, deleteAdUser, moveAdUser,
        createAdGroup, updateAdGroup, deleteAdGroup,
        addAdGroupMember, removeAdGroupMember,
        listAdAcl, assignAdAcl, revokeAdAcl,
        listAdRoles, listAdPermissions, getUserAdEffectivePerms,
        type AdOrgUnit, type AdRbacUser, type AdRbacGroup,
        type AdGroupMember, type AdAclEntry, type AdRbacRoleAd, type AdPermission,
    } from '$lib/api/admin'

    // ─── State ───────────────────────────────────────────────────────────
    let ous = $state<AdOrgUnit[]>([])
    let users = $state<AdRbacUser[]>([])
    let groups = $state<AdRbacGroup[]>([])
    let acl = $state<AdAclEntry[]>([])
    let roles = $state<AdRbacRoleAd[]>([])
    let permissions = $state<AdPermission[]>([])

    let selectedOu = $state<AdOrgUnit | null>(null)
    let expandedOus = $state<Set<string>>(new Set())
    let rightTab = $state<'users' | 'groups' | 'acl' | 'effective'>('users')
    let searchQuery = $state('')
    let loading = $state(false)
    let error = $state<string | null>(null)

    // Modal state
    let showModal = $state(false)
    let modalMode = $state<'create-ou' | 'edit-ou' | 'create-user' | 'edit-user' |
        'create-group' | 'edit-group' | 'add-member' | 'assign-acl' | null>(null)
    let modalTarget = $state<any>(null)

    // Form state
    let formName = $state('')
    let formDescription = $state('')
    let formUsername = $state('')
    let formDisplayName = $state('')
    let formEmail = $state('')
    let formStatus = $state<'active' | 'disabled' | 'locked'>('active')
    let formMemberType = $state<'USER' | 'GROUP'>('USER')
    let formMemberId = $state('')
    let formRoleId = $state('')
    let formScopeType = $state<'GLOBAL' | 'OU' | 'RESOURCE'>('GLOBAL')
    let formScopeOuId = $state('')
    let formEffect = $state<'ALLOW' | 'DENY'>('ALLOW')
    let formInherit = $state(true)
    let formPrincipalType = $state<'USER' | 'GROUP'>('USER')
    let formPrincipalId = $state('')

    // Group members state
    let selectedGroup = $state<AdRbacGroup | null>(null)
    let groupMembers = $state<AdGroupMember[]>([])

    // Effective permissions state
    let selectedUserId = $state('')
    let effectivePerms = $state<any>(null)

    // ─── Derived ─────────────────────────────────────────────────────────
    let ouTree = $derived.by(() => buildOuTree(ous))
    let filteredUsers = $derived(users.filter(u =>
        (!selectedOu || u.ouId === selectedOu.id) &&
        (!searchQuery || u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    ))
    let filteredGroups = $derived(groups.filter(g =>
        (!selectedOu || g.ouId === selectedOu.id) &&
        (!searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ))
    let filteredAcl = $derived(acl.filter(a =>
        !searchQuery || getRoleName(a.roleId).toLowerCase().includes(searchQuery.toLowerCase())
    ))

    // ─── Tree helpers ────────────────────────────────────────────────────
    interface OuNode { ou: AdOrgUnit; children: OuNode[] }

    function buildOuTree(flat: AdOrgUnit[]): OuNode[] {
        const map = new Map<string, OuNode>()
        const roots: OuNode[] = []
        for (const ou of flat) {
            map.set(ou.id, { ou, children: [] })
        }
        for (const ou of flat) {
            const node = map.get(ou.id)!
            if (ou.parentId && map.has(ou.parentId)) {
                map.get(ou.parentId)!.children.push(node)
            } else {
                roots.push(node)
            }
        }
        return roots
    }

    function getOuName(ouId: string): string {
        return ous.find(o => o.id === ouId)?.name ?? '—'
    }
    function getRoleName(roleId: string): string {
        return roles.find(r => r.id === roleId)?.name ?? roleId
    }
    function getUserName(userId: string): string {
        return users.find(u => u.id === userId)?.displayName ?? userId
    }
    function getGroupName(groupId: string): string {
        return groups.find(g => g.id === groupId)?.name ?? groupId
    }

    function toggleExpand(ouId: string) {
        if (expandedOus.has(ouId)) {
            expandedOus.delete(ouId)
        } else {
            expandedOus.add(ouId)
        }
        expandedOus = new Set(expandedOus)
    }

    // ─── Data loading ────────────────────────────────────────────────────
    async function loadAll() {
        loading = true
        error = null
        try {
            const [ouRes, userRes, groupRes, aclRes, roleRes, permRes] = await Promise.all([
                getAdOuTree(), listAdUsers(), listAdGroups(),
                listAdAcl(), listAdRoles(), listAdPermissions()
            ])
            ous = ouRes.data
            users = userRes.data
            groups = groupRes.data
            acl = aclRes.data
            roles = roleRes.data
            permissions = permRes.data
            // Auto-expand root + depth-1
            for (const ou of ous) {
                if (ou.depth <= 1) expandedOus.add(ou.id)
            }
            expandedOus = new Set(expandedOus)
        } catch (e: any) {
            error = e.message ?? 'Failed to load RBAC data'
        } finally {
            loading = false
        }
    }

    onMount(() => { loadAll() })

    // ─── OU Actions ──────────────────────────────────────────────────────
    function openCreateOu() {
        formName = ''; formDescription = ''
        modalMode = 'create-ou'; showModal = true
    }
    function openEditOu(ou: AdOrgUnit) {
        formName = ou.name; formDescription = ou.description ?? ''
        modalTarget = ou; modalMode = 'edit-ou'; showModal = true
    }
    async function submitOu() {
        try {
            if (modalMode === 'create-ou') {
                await createAdOu({ name: formName, parentId: selectedOu?.id ?? null, description: formDescription || undefined })
            } else if (modalMode === 'edit-ou' && modalTarget) {
                await updateAdOu(modalTarget.id, { name: formName, description: formDescription || undefined })
            }
            showModal = false
            await loadAll()
        } catch (e: any) { error = e.message }
    }
    async function doDeleteOu(ou: AdOrgUnit) {
        if (!confirm(`Delete OU "${ou.name}"? This cannot be undone.`)) return
        try {
            await deleteAdOu(ou.id)
            if (selectedOu?.id === ou.id) selectedOu = null
            await loadAll()
        } catch (e: any) { error = e.message }
    }

    // ─── User Actions ────────────────────────────────────────────────────
    function openCreateUser() {
        formUsername = ''; formDisplayName = ''; formEmail = ''; formStatus = 'active'
        modalMode = 'create-user'; showModal = true
    }
    function openEditUser(user: AdRbacUser) {
        formDisplayName = user.displayName; formEmail = user.email ?? ''; formStatus = user.status as any
        modalTarget = user; modalMode = 'edit-user'; showModal = true
    }
    async function submitUser() {
        try {
            if (modalMode === 'create-user') {
                await createAdUser({
                    username: formUsername, displayName: formDisplayName,
                    email: formEmail || undefined, ouId: selectedOu?.id ?? ous[0]?.id ?? '',
                    status: formStatus,
                })
            } else if (modalMode === 'edit-user' && modalTarget) {
                await updateAdUser(modalTarget.id, {
                    displayName: formDisplayName, email: formEmail || undefined, status: formStatus,
                })
            }
            showModal = false
            await loadAll()
        } catch (e: any) { error = e.message }
    }
    async function doDeleteUser(user: AdRbacUser) {
        if (!confirm(`Delete user "${user.username}"?`)) return
        try { await deleteAdUser(user.id); await loadAll() } catch (e: any) { error = e.message }
    }

    // ─── Group Actions ───────────────────────────────────────────────────
    function openCreateGroup() {
        formName = ''; formDescription = ''
        modalMode = 'create-group'; showModal = true
    }
    function openEditGroup(group: AdRbacGroup) {
        formName = group.name; formDescription = group.description ?? ''
        modalTarget = group; modalMode = 'edit-group'; showModal = true
    }
    async function submitGroup() {
        try {
            if (modalMode === 'create-group') {
                await createAdGroup({
                    name: formName, description: formDescription || undefined,
                    ouId: selectedOu?.id ?? ous[0]?.id ?? '',
                })
            } else if (modalMode === 'edit-group' && modalTarget) {
                await updateAdGroup(modalTarget.id, { name: formName, description: formDescription || undefined })
            }
            showModal = false
            await loadAll()
        } catch (e: any) { error = e.message }
    }
    async function doDeleteGroup(group: AdRbacGroup) {
        if (!confirm(`Delete group "${group.name}"?`)) return
        try { await deleteAdGroup(group.id); await loadAll() } catch (e: any) { error = e.message }
    }

    // ─── Member Actions ──────────────────────────────────────────────────
    async function loadGroupMembers(group: AdRbacGroup) {
        selectedGroup = group
        try {
            const res = await listAdGroupMembers(group.id)
            groupMembers = res.data
        } catch (e: any) { error = e.message }
    }
    function openAddMember() {
        formMemberType = 'USER'; formMemberId = ''
        modalMode = 'add-member'; showModal = true
    }
    async function submitAddMember() {
        if (!selectedGroup) return
        try {
            await addAdGroupMember(selectedGroup.id, {
                memberType: formMemberType,
                ...(formMemberType === 'USER' ? { memberUserId: formMemberId } : { memberGroupId: formMemberId }),
            })
            showModal = false
            await loadGroupMembers(selectedGroup)
        } catch (e: any) { error = e.message }
    }
    async function doRemoveMember(m: AdGroupMember) {
        if (!selectedGroup) return
        const memberId = m.memberUserId ?? m.memberGroupId ?? ''
        if (!confirm('Remove this member?')) return
        try {
            await removeAdGroupMember(selectedGroup.id, m.memberType, memberId)
            await loadGroupMembers(selectedGroup)
        } catch (e: any) { error = e.message }
    }

    // ─── ACL Actions ─────────────────────────────────────────────────────
    function openAssignAcl() {
        formPrincipalType = 'USER'; formPrincipalId = ''; formRoleId = ''
        formScopeType = 'GLOBAL'; formScopeOuId = ''; formEffect = 'ALLOW'; formInherit = true
        modalMode = 'assign-acl'; showModal = true
    }
    async function submitAcl() {
        try {
            await assignAdAcl({
                principalType: formPrincipalType,
                ...(formPrincipalType === 'USER' ? { principalUserId: formPrincipalId } : { principalGroupId: formPrincipalId }),
                roleId: formRoleId,
                scopeType: formScopeType,
                ...(formScopeType === 'OU' ? { scopeOuId: formScopeOuId } : {}),
                effect: formEffect,
                inherit: formInherit,
            })
            showModal = false
            await loadAll()
        } catch (e: any) { error = e.message }
    }
    async function doRevokeAcl(entry: AdAclEntry) {
        if (!confirm('Revoke this ACL entry?')) return
        try { await revokeAdAcl(entry.id); await loadAll() } catch (e: any) { error = e.message }
    }

    // ─── Effective Permissions ────────────────────────────────────────────
    async function loadEffective() {
        if (!selectedUserId) return
        try {
            const res = await getUserAdEffectivePerms(selectedUserId)
            effectivePerms = res.data
        } catch (e: any) { error = e.message }
    }

    function closeModal() { showModal = false; modalMode = null; modalTarget = null }
</script>

<!-- ╔═══════════════════════════════════════════════════════════════════════════
     ║  ADUC-style RBAC Panel — Split layout: OU tree (left) + Content (right)
     ╚═══════════════════════════════════════════════════════════════════════════ -->
<div class="rbac-container">
    <!-- ═══ Left Panel: OU Tree ═══ -->
    <aside class="ou-tree-panel">
        <div class="panel-header">
            <FolderTree size={16} />
            <span>Organizational Units</span>
            <button class="icon-btn" title="Add OU" onclick={openCreateOu}>
                <FolderPlus size={14} />
            </button>
            <button class="icon-btn" title="Refresh" onclick={loadAll}>
                <RefreshCw size={14} />
            </button>
        </div>

        <!-- Show all OUs / deselect -->
        <button
            class="ou-item" class:selected={selectedOu === null}
            onclick={() => { selectedOu = null }}
        >
            <Building2 size={14} />
            <span>All OUs</span>
            <span class="badge">{ous.length}</span>
        </button>

        <!-- OU tree -->
        <div class="ou-tree">
            {#each ouTree as node}
                {@render ouNode(node, 0)}
            {/each}
        </div>
    </aside>

    <!-- ═══ Right Panel: Content ═══ -->
    <main class="content-panel">
        <!-- Header with selected OU info + tabs -->
        <div class="content-header">
            <div class="ou-info">
                {#if selectedOu}
                    <Building2 size={18} />
                    <div>
                        <h2>{selectedOu.name}</h2>
                        <span class="ou-path">{selectedOu.path}</span>
                    </div>
                    <button class="icon-btn" title="Edit OU" onclick={() => openEditOu(selectedOu!)}>
                        <Pencil size={14} />
                    </button>
                    {#if selectedOu.path !== '/'}
                        <button class="icon-btn danger" title="Delete OU" onclick={() => doDeleteOu(selectedOu!)}>
                            <Trash2 size={14} />
                        </button>
                    {/if}
                {:else}
                    <Building2 size={18} />
                    <h2>All Organizational Units</h2>
                {/if}
            </div>

            <!-- Tabs -->
            <div class="tab-bar">
                <button class="tab" class:active={rightTab === 'users'} onclick={() => { rightTab = 'users' }}>
                    <Users size={14} /> Users ({filteredUsers.length})
                </button>
                <button class="tab" class:active={rightTab === 'groups'} onclick={() => { rightTab = 'groups' }}>
                    <UsersRound size={14} /> Groups ({filteredGroups.length})
                </button>
                <button class="tab" class:active={rightTab === 'acl'} onclick={() => { rightTab = 'acl' }}>
                    <Shield size={14} /> ACL ({filteredAcl.length})
                </button>
                <button class="tab" class:active={rightTab === 'effective'} onclick={() => { rightTab = 'effective' }}>
                    <Eye size={14} /> Effective
                </button>
            </div>

            <!-- Search + action buttons -->
            <div class="toolbar">
                <div class="search-box">
                    <Search size={14} />
                    <input type="text" placeholder="Search..." bind:value={searchQuery} />
                </div>
                {#if rightTab === 'users'}
                    <button class="btn primary" onclick={openCreateUser}><UserPlus size={14} /> New User</button>
                {:else if rightTab === 'groups'}
                    <button class="btn primary" onclick={openCreateGroup}><Plus size={14} /> New Group</button>
                {:else if rightTab === 'acl'}
                    <button class="btn primary" onclick={openAssignAcl}><ShieldPlus size={14} /> Assign ACL</button>
                {/if}
            </div>
        </div>

        <!-- Error banner -->
        {#if error}
            <div class="error-banner">
                <span>{error}</span>
                <button onclick={() => { error = null }}>✕</button>
            </div>
        {/if}

        <!-- Loading -->
        {#if loading}
            <div class="loading">Loading RBAC data...</div>
        {:else}
            <!-- TAB: Users -->
            {#if rightTab === 'users'}
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th><th>Display Name</th><th>Email</th>
                                <th>OU</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredUsers as user (user.id)}
                                <tr>
                                    <td class="mono">{user.username}</td>
                                    <td>{user.displayName}</td>
                                    <td>{user.email ?? '—'}</td>
                                    <td><span class="badge ou">{getOuName(user.ouId)}</span></td>
                                    <td>
                                        <span class="status-badge" class:active={user.status === 'active'}
                                            class:disabled={user.status === 'disabled'}
                                            class:locked={user.status === 'locked'}>
                                            {#if user.status === 'active'}<CheckCircle2 size={12} />{:else if user.status === 'locked'}<Lock size={12} />{:else}<Ban size={12} />{/if}
                                            {user.status}
                                        </span>
                                    </td>
                                    <td class="actions">
                                        <button class="icon-btn" title="Edit" onclick={() => openEditUser(user)}><Pencil size={13} /></button>
                                        <button class="icon-btn danger" title="Delete" onclick={() => doDeleteUser(user)}><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="6" class="empty">No users in this OU</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

            <!-- TAB: Groups -->
            {:else if rightTab === 'groups'}
                <div class="groups-split">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Name</th><th>OU</th><th>Description</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {#each filteredGroups as group (group.id)}
                                    <tr class:selected={selectedGroup?.id === group.id}
                                        onclick={() => loadGroupMembers(group)}>
                                        <td><UsersRound size={14} class="inline-icon" /> {group.name}</td>
                                        <td><span class="badge ou">{getOuName(group.ouId)}</span></td>
                                        <td class="desc">{group.description ?? '—'}</td>
                                        <td class="actions">
                                            <button class="icon-btn" title="Edit" onclick={(e) => { e.stopPropagation(); openEditGroup(group) }}><Pencil size={13} /></button>
                                            <button class="icon-btn danger" title="Delete" onclick={(e) => { e.stopPropagation(); doDeleteGroup(group) }}><Trash2 size={13} /></button>
                                        </td>
                                    </tr>
                                {:else}
                                    <tr><td colspan="4" class="empty">No groups in this OU</td></tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <!-- Group members panel -->
                    {#if selectedGroup}
                        <div class="members-panel">
                            <div class="members-header">
                                <UsersRound size={16} />
                                <strong>{selectedGroup.name}</strong> — Members
                                <button class="btn sm primary" onclick={openAddMember}><UserPlus size={13} /> Add</button>
                            </div>
                            <div class="members-list">
                                {#each groupMembers as m (m.id)}
                                    <div class="member-row">
                                        {#if m.memberType === 'USER'}
                                            <User size={14} /> <span>{getUserName(m.memberUserId ?? '')}</span>
                                        {:else}
                                            <UsersRound size={14} /> <span>{getGroupName(m.memberGroupId ?? '')}</span>
                                        {/if}
                                        <span class="badge type">{m.memberType}</span>
                                        <button class="icon-btn danger" title="Remove" onclick={() => doRemoveMember(m)}>
                                            <Unlink size={13} />
                                        </button>
                                    </div>
                                {:else}
                                    <div class="empty-small">No members</div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>

            <!-- TAB: ACL -->
            {:else if rightTab === 'acl'}
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Principal</th><th>Role</th><th>Scope</th>
                                <th>Effect</th><th>Inherit</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredAcl as entry (entry.id)}
                                <tr>
                                    <td>
                                        {#if entry.principalType === 'USER'}
                                            <User size={14} class="inline-icon" /> {getUserName(entry.principalUserId ?? '')}
                                        {:else}
                                            <UsersRound size={14} class="inline-icon" /> {getGroupName(entry.principalGroupId ?? '')}
                                        {/if}
                                        <span class="badge type">{entry.principalType}</span>
                                    </td>
                                    <td><Shield size={14} class="inline-icon" /> {getRoleName(entry.roleId)}</td>
                                    <td>
                                        <span class="badge scope">{entry.scopeType}</span>
                                        {#if entry.scopeType === 'OU' && entry.scopeOuId}
                                            <span class="badge ou">{getOuName(entry.scopeOuId)}</span>
                                        {:else if entry.scopeType === 'RESOURCE' && entry.scopeResource}
                                            <span class="mono text-xs">{entry.scopeResource}</span>
                                        {/if}
                                    </td>
                                    <td>
                                        <span class="effect-badge" class:allow={entry.effect === 'ALLOW'} class:deny={entry.effect === 'DENY'}>
                                            {entry.effect}
                                        </span>
                                    </td>
                                    <td>{entry.inherit ? '✓' : '—'}</td>
                                    <td class="actions">
                                        <button class="icon-btn danger" title="Revoke" onclick={() => doRevokeAcl(entry)}>
                                            <Trash2 size={13} />
                                        </button>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="6" class="empty">No ACL entries</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

            <!-- TAB: Effective Permissions -->
            {:else if rightTab === 'effective'}
                <div class="effective-panel">
                    <div class="effective-header">
                        <label>
                            Select User:
                            <select bind:value={selectedUserId} onchange={loadEffective}>
                                <option value="">— Choose —</option>
                                {#each users as u (u.id)}
                                    <option value={u.id}>{u.displayName} ({u.username})</option>
                                {/each}
                            </select>
                        </label>
                    </div>
                    {#if effectivePerms}
                        <div class="effective-results">
                            <div class="perms-section">
                                <h4><CheckCircle2 size={14} /> Allowed ({effectivePerms.allowed?.length ?? 0})</h4>
                                <div class="perm-tags">
                                    {#each effectivePerms.allowed ?? [] as p}
                                        <span class="perm-tag allow">{p}</span>
                                    {/each}
                                </div>
                            </div>
                            <div class="perms-section">
                                <h4><Ban size={14} /> Denied ({effectivePerms.denied?.length ?? 0})</h4>
                                <div class="perm-tags">
                                    {#each effectivePerms.denied ?? [] as p}
                                        <span class="perm-tag deny">{p}</span>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="empty-small">Select a user to see effective permissions</div>
                    {/if}
                </div>
            {/if}
        {/if}
    </main>
</div>

<!-- ═══ Modal Dialog ═══ -->
{#if showModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={closeModal} onkeydown={(e) => { if (e.key === 'Escape') closeModal() }} role="presentation">
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-header">
                <h3>
                    {#if modalMode === 'create-ou'}New Organizational Unit
                    {:else if modalMode === 'edit-ou'}Edit OU
                    {:else if modalMode === 'create-user'}New RBAC User
                    {:else if modalMode === 'edit-user'}Edit User
                    {:else if modalMode === 'create-group'}New Group
                    {:else if modalMode === 'edit-group'}Edit Group
                    {:else if modalMode === 'add-member'}Add Member
                    {:else if modalMode === 'assign-acl'}Assign ACL
                    {/if}
                </h3>
                <button class="icon-btn" onclick={closeModal}>✕</button>
            </div>
            <div class="modal-body">
                <!-- OU form -->
                {#if modalMode === 'create-ou' || modalMode === 'edit-ou'}
                    <label>Name <input type="text" bind:value={formName} placeholder="OU name" /></label>
                    <label>Description <input type="text" bind:value={formDescription} placeholder="(optional)" /></label>
                    {#if modalMode === 'create-ou'}
                        <p class="hint">Parent: {selectedOu?.name ?? 'Root'}</p>
                    {/if}

                <!-- User form -->
                {:else if modalMode === 'create-user' || modalMode === 'edit-user'}
                    {#if modalMode === 'create-user'}
                        <label>Username <input type="text" bind:value={formUsername} placeholder="e.g. john.doe" /></label>
                    {/if}
                    <label>Display Name <input type="text" bind:value={formDisplayName} /></label>
                    <label>Email <input type="email" bind:value={formEmail} placeholder="(optional)" /></label>
                    <label>Status
                        <select bind:value={formStatus}>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                            <option value="locked">Locked</option>
                        </select>
                    </label>

                <!-- Group form -->
                {:else if modalMode === 'create-group' || modalMode === 'edit-group'}
                    <label>Name <input type="text" bind:value={formName} placeholder="Group name" /></label>
                    <label>Description <input type="text" bind:value={formDescription} placeholder="(optional)" /></label>

                <!-- Add member form -->
                {:else if modalMode === 'add-member'}
                    <label>Member Type
                        <select bind:value={formMemberType}>
                            <option value="USER">User</option>
                            <option value="GROUP">Group (nested)</option>
                        </select>
                    </label>
                    <label>
                        {formMemberType === 'USER' ? 'User' : 'Group'}
                        <select bind:value={formMemberId}>
                            <option value="">— Choose —</option>
                            {#if formMemberType === 'USER'}
                                {#each users as u (u.id)}
                                    <option value={u.id}>{u.displayName} ({u.username})</option>
                                {/each}
                            {:else}
                                {#each groups.filter(g => g.id !== selectedGroup?.id) as g (g.id)}
                                    <option value={g.id}>{g.name}</option>
                                {/each}
                            {/if}
                        </select>
                    </label>

                <!-- ACL assign form -->
                {:else if modalMode === 'assign-acl'}
                    <label>Principal Type
                        <select bind:value={formPrincipalType}>
                            <option value="USER">User</option>
                            <option value="GROUP">Group</option>
                        </select>
                    </label>
                    <label>
                        {formPrincipalType === 'USER' ? 'User' : 'Group'}
                        <select bind:value={formPrincipalId}>
                            <option value="">— Choose —</option>
                            {#if formPrincipalType === 'USER'}
                                {#each users as u (u.id)}
                                    <option value={u.id}>{u.displayName}</option>
                                {/each}
                            {:else}
                                {#each groups as g (g.id)}
                                    <option value={g.id}>{g.name}</option>
                                {/each}
                            {/if}
                        </select>
                    </label>
                    <label>Role
                        <select bind:value={formRoleId}>
                            <option value="">— Choose —</option>
                            {#each roles as r (r.id)}
                                <option value={r.id}>{r.name} ({r.key})</option>
                            {/each}
                        </select>
                    </label>
                    <label>Scope Type
                        <select bind:value={formScopeType}>
                            <option value="GLOBAL">Global</option>
                            <option value="OU">OU-scoped</option>
                            <option value="RESOURCE">Resource</option>
                        </select>
                    </label>
                    {#if formScopeType === 'OU'}
                        <label>Scope OU
                            <select bind:value={formScopeOuId}>
                                <option value="">— Choose —</option>
                                {#each ous as ou (ou.id)}
                                    <option value={ou.id}>{'  '.repeat(ou.depth)}{ou.name}</option>
                                {/each}
                            </select>
                        </label>
                    {/if}
                    <label>Effect
                        <select bind:value={formEffect}>
                            <option value="ALLOW">ALLOW</option>
                            <option value="DENY">DENY</option>
                        </select>
                    </label>
                    <label class="checkbox-row">
                        <input type="checkbox" bind:checked={formInherit} /> Inherit to child OUs
                    </label>
                {/if}
            </div>
            <div class="modal-footer">
                <button class="btn" onclick={closeModal}>Cancel</button>
                <button class="btn primary" onclick={() => {
                    if (modalMode?.startsWith('create-ou') || modalMode?.startsWith('edit-ou')) submitOu()
                    else if (modalMode?.startsWith('create-user') || modalMode?.startsWith('edit-user')) submitUser()
                    else if (modalMode?.startsWith('create-group') || modalMode?.startsWith('edit-group')) submitGroup()
                    else if (modalMode === 'add-member') submitAddMember()
                    else if (modalMode === 'assign-acl') submitAcl()
                }}>
                    {modalMode?.startsWith('create') || modalMode === 'add-member' || modalMode === 'assign-acl' ? 'Create' : 'Save'}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ═══ OU Tree Node Snippet ═══ -->
{#snippet ouNode(node: OuNode, depth: number)}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_role_has_required_aria_props -->
    <div class="ou-item" style="padding-left: {12 + depth * 16}px"
        class:selected={selectedOu?.id === node.ou.id}
        onclick={() => { selectedOu = node.ou }}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectedOu = node.ou } }}
        role="treeitem"
        aria-selected={selectedOu?.id === node.ou.id}
        tabindex="0">
        {#if node.children.length > 0}
            <button class="chevron" onclick={(e) => { e.stopPropagation(); toggleExpand(node.ou.id) }}>
                {#if expandedOus.has(node.ou.id)}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
            </button>
        {:else}
            <span class="chevron-spacer"></span>
        {/if}
        <Building2 size={14} />
        <span class="ou-name">{node.ou.name}</span>
        <span class="badge sm">{users.filter(u => u.ouId === node.ou.id).length}</span>
    </div>
    {#if expandedOus.has(node.ou.id)}
        {#each node.children as child}
            {@render ouNode(child, depth + 1)}
        {/each}
    {/if}
{/snippet}



<style>
    .rbac-container {
        display: flex; height: 100%; min-height: 600px;
        background: var(--surface-1, #1a1a2e); color: var(--text-1, #e0e0f0);
        border: 1px solid var(--border-1, #2a2a4a); border-radius: 8px; overflow: hidden;
    }

    /* ── Left Panel ── */
    .ou-tree-panel {
        width: 260px; min-width: 240px; border-right: 1px solid var(--border-1, #2a2a4a);
        display: flex; flex-direction: column; background: var(--surface-2, #16162a);
    }
    .panel-header {
        display: flex; align-items: center; gap: 6px; padding: 10px 12px;
        font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-1, #2a2a4a);
        background: var(--surface-3, #12122a);
    }
    .panel-header .icon-btn { margin-left: auto; }
    .panel-header .icon-btn + .icon-btn { margin-left: 0; }
    .ou-tree { flex: 1; overflow-y: auto; padding: 4px 0; }
    .ou-item {
        display: flex; align-items: center; gap: 6px; padding: 6px 12px;
        cursor: pointer; font-size: 13px; transition: background 0.15s;
        border: none; background: none; color: inherit; width: 100%; text-align: left;
    }
    .ou-item:hover { background: var(--surface-hover, rgba(255,255,255,0.05)); }
    .ou-item.selected { background: var(--primary-bg, rgba(59,130,246,0.15)); color: var(--primary, #60a5fa); }
    .chevron { background: none; border: none; color: inherit; cursor: pointer; padding: 0; display: flex; }
    .chevron-spacer { width: 14px; }
    .ou-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── Right Panel ── */
    .content-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .content-header { padding: 12px 16px; border-bottom: 1px solid var(--border-1, #2a2a4a); }
    .ou-info { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .ou-info h2 { font-size: 16px; font-weight: 600; margin: 0; }
    .ou-path { font-size: 11px; color: var(--text-3, #888); font-family: monospace; }

    /* ── Tabs ── */
    .tab-bar { display: flex; gap: 2px; margin-bottom: 10px; }
    .tab {
        display: flex; align-items: center; gap: 4px; padding: 6px 12px;
        font-size: 12px; font-weight: 500; border: none; cursor: pointer;
        background: var(--surface-2, #1e1e3a); color: var(--text-2, #aaa);
        border-radius: 4px; transition: all 0.15s;
    }
    .tab:hover { background: var(--surface-hover, rgba(255,255,255,0.08)); }
    .tab.active { background: var(--primary-bg, rgba(59,130,246,0.2)); color: var(--primary, #60a5fa); }

    /* ── Toolbar ── */
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .search-box {
        display: flex; align-items: center; gap: 6px; padding: 4px 8px;
        background: var(--surface-2, #1e1e3a); border: 1px solid var(--border-1, #2a2a4a);
        border-radius: 4px; flex: 1; max-width: 300px;
    }
    .search-box input {
        background: none; border: none; outline: none; color: inherit; font-size: 12px; flex: 1;
    }

    /* ── Buttons ── */
    .btn {
        display: flex; align-items: center; gap: 4px; padding: 6px 12px;
        font-size: 12px; border: 1px solid var(--border-1, #2a2a4a); border-radius: 4px;
        cursor: pointer; background: var(--surface-2, #1e1e3a); color: var(--text-1, #e0e0f0);
    }
    .btn.primary { background: var(--primary, #3b82f6); color: white; border-color: transparent; }
    .btn.sm { padding: 4px 8px; font-size: 11px; }
    .icon-btn {
        background: none; border: none; color: var(--text-2, #999); cursor: pointer;
        padding: 4px; border-radius: 4px; display: flex; align-items: center;
    }
    .icon-btn:hover { color: var(--text-1, #fff); background: var(--surface-hover, rgba(255,255,255,0.08)); }
    .icon-btn.danger:hover { color: #f87171; }

    /* ── Table ── */
    .table-wrap { flex: 1; overflow: auto; padding: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
        text-align: left; padding: 8px 12px; font-weight: 600; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.5px;
        background: var(--surface-3, #12122a); color: var(--text-3, #888);
        border-bottom: 1px solid var(--border-1, #2a2a4a); position: sticky; top: 0; z-index: 1;
    }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border-1, rgba(42,42,74,0.5)); }
    tr:hover td { background: var(--surface-hover, rgba(255,255,255,0.02)); }
    tr.selected td { background: var(--primary-bg, rgba(59,130,246,0.1)); }
    .mono { font-family: monospace; font-size: 12px; }
    .desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-3, #888); }
    .empty { text-align: center; color: var(--text-3, #666); padding: 24px; }
    .empty-small { text-align: center; color: var(--text-3, #666); padding: 16px; font-size: 12px; }
    .actions { display: flex; gap: 4px; }

    /* ── Badges ── */
    .badge {
        display: inline-flex; align-items: center; padding: 2px 6px;
        font-size: 10px; border-radius: 4px; font-weight: 600;
        background: var(--surface-3, #2a2a4a); color: var(--text-2, #aaa);
    }
    .badge.sm { font-size: 9px; padding: 1px 4px; }
    .badge.ou { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge.type { background: rgba(168,85,247,0.15); color: #c084fc; }
    .badge.scope { background: rgba(34,197,94,0.15); color: #4ade80; }

    .status-badge {
        display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
        font-size: 11px; border-radius: 4px; font-weight: 500;
    }
    .status-badge.active { background: rgba(34,197,94,0.15); color: #4ade80; }
    .status-badge.disabled { background: rgba(234,179,8,0.15); color: #facc15; }
    .status-badge.locked { background: rgba(239,68,68,0.15); color: #f87171; }

    .effect-badge {
        padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 4px;
    }
    .effect-badge.allow { background: rgba(34,197,94,0.2); color: #4ade80; }
    .effect-badge.deny { background: rgba(239,68,68,0.2); color: #f87171; }

    /* ── Groups split ── */
    .groups-split { display: flex; flex: 1; overflow: hidden; }
    .groups-split .table-wrap { flex: 1; }
    .members-panel {
        width: 280px; border-left: 1px solid var(--border-1, #2a2a4a);
        display: flex; flex-direction: column;
    }
    .members-header {
        display: flex; align-items: center; gap: 6px; padding: 8px 12px;
        font-size: 13px; border-bottom: 1px solid var(--border-1, #2a2a4a);
        background: var(--surface-3, #12122a);
    }
    .members-header .btn { margin-left: auto; }
    .members-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    .member-row {
        display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px;
    }
    .member-row span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .member-row .icon-btn { margin-left: auto; }

    /* ── Effective tab ── */
    .effective-panel { padding: 16px; flex: 1; overflow-y: auto; }
    .effective-header { margin-bottom: 16px; }
    .effective-header select {
        margin-left: 8px; padding: 4px 8px; background: var(--surface-2, #1e1e3a);
        border: 1px solid var(--border-1, #2a2a4a); border-radius: 4px;
        color: inherit; font-size: 12px;
    }
    .effective-results { display: flex; flex-direction: column; gap: 16px; }
    .perms-section h4 { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 8px; }
    .perm-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .perm-tag {
        padding: 3px 8px; font-size: 11px; font-family: monospace;
        border-radius: 4px; font-weight: 500;
    }
    .perm-tag.allow { background: rgba(34,197,94,0.15); color: #4ade80; }
    .perm-tag.deny { background: rgba(239,68,68,0.15); color: #f87171; }

    /* ── Error ── */
    .error-banner {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 16px; background: rgba(239,68,68,0.15); color: #f87171;
        font-size: 12px; border-bottom: 1px solid rgba(239,68,68,0.3);
    }
    .error-banner button { background: none; border: none; color: inherit; cursor: pointer; }

    .loading { padding: 32px; text-align: center; color: var(--text-3, #888); }

    /* ── Modal ── */
    .modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal {
        background: var(--surface-1, #1a1a2e); border: 1px solid var(--border-1, #2a2a4a);
        border-radius: 8px; width: 420px; max-width: 90vw; max-height: 80vh;
        display: flex; flex-direction: column;
    }
    .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; border-bottom: 1px solid var(--border-1, #2a2a4a);
    }
    .modal-header h3 { font-size: 14px; margin: 0; }
    .modal-body {
        padding: 16px; display: flex; flex-direction: column; gap: 12px;
        overflow-y: auto;
    }
    .modal-body label {
        display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 500;
    }
    .modal-body input, .modal-body select {
        padding: 6px 10px; background: var(--surface-2, #1e1e3a);
        border: 1px solid var(--border-1, #2a2a4a); border-radius: 4px;
        color: inherit; font-size: 13px;
    }
    .modal-body .hint { font-size: 11px; color: var(--text-3, #888); margin: 0; }
    .checkbox-row { flex-direction: row !important; align-items: center; gap: 8px !important; }
    .modal-footer {
        display: flex; justify-content: flex-end; gap: 8px;
        padding: 12px 16px; border-top: 1px solid var(--border-1, #2a2a4a);
    }

    :global(.inline-icon) { display: inline; vertical-align: -2px; }
</style>
