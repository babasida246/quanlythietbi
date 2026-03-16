<script lang="ts">
    import { onMount } from 'svelte'
    import { _, isLoading } from '$lib/i18n'
    import {
        FolderTree, Users, Shield, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
        UserPlus, FolderPlus, ShieldPlus, Unlink, Search, RefreshCw,
        Building2, User, UsersRound, Lock, Unlock, Ban, CheckCircle2, Info
    } from 'lucide-svelte'
    import {
        getAdOuTree, listAdUsers, listAdGroups, listAdGroupMembers,
        createAdOu, updateAdOu, deleteAdOu,
        createAdUser, updateAdUser, deleteAdUser, moveAdUser,
        createAdGroup, updateAdGroup, deleteAdGroup,
        addAdGroupMember, removeAdGroupMember,
        listAdAcl, assignAdAcl, revokeAdAcl,
        listAdRoles, listAdPermissions, getAdRolePermissions, setAdRolePermissions,
        listRbacRoles, assignOuRole,
        getUserAdEffectivePerms,
        listUsers, updateUser, resetPassword, createUser,
        type AdOrgUnit, type AdRbacUser, type AdRbacGroup,
        type AdGroupMember, type AdAclEntry, type AdRbacRoleAd, type AdPermission, type RbacRole, type AdminUser,
        type EffectivePermsResult,
    } from '$lib/api/admin'

    // ─── State ───────────────────────────────────────────────────────────
    let ous = $state<AdOrgUnit[]>([])
    let users = $state<AdRbacUser[]>([])
    let groups = $state<AdRbacGroup[]>([])
    let acl = $state<AdAclEntry[]>([])
    let roles = $state<AdRbacRoleAd[]>([])
    let permissions = $state<AdPermission[]>([])
    let classicRoles = $state<RbacRole[]>([])

    let selectedOu = $state<AdOrgUnit | null>(null)
    let expandedOus = $state<Set<string>>(new Set())
    let rightTab = $state<'users' | 'groups' | 'acl' | 'roles' | 'effective'>('users')
    let searchQuery = $state('')
    let loading = $state(false)
    let error = $state<string | null>(null)

    // Modal state
    let showModal = $state(false)
    let modalMode = $state<'create-ou' | 'edit-ou' | 'create-user' | 'edit-user' |
        'create-group' | 'edit-group' | 'add-member' | 'assign-acl' | 'edit-account' | null>(null)
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
    let formScopeResource = $state('')
    let formEffect = $state<'ALLOW' | 'DENY'>('ALLOW')
    let formInherit = $state(true)
    let formPrincipalType = $state<'USER' | 'GROUP'>('USER')
    let formPrincipalId = $state('')

    let adminUsers = $state<AdminUser[]>([])
    let selectedAccount = $state<AdminUser | null>(null)
    let accountFormName = $state('')
    let accountFormEmail = $state('')
    let accountFormRole = $state('requester')
    let accountFormActive = $state(true)
    let accountSaving = $state(false)
    let accountResetting = $state(false)

    // Group members state
    let selectedGroup = $state<AdRbacGroup | null>(null)
    let groupMembers = $state<AdGroupMember[]>([])


    // ─── Roles tab state ─────────────────────────────────────────────────
    let selectedAdRole = $state<AdRbacRoleAd | null>(null)
    let adRolePermKeys = $state<Set<string>>(new Set())
    let adRoleSaving = $state(false)
    let adRoleLoadingPerms = $state(false)

    // ─── Effective permissions tab state ─────────────────────────────────
    let effectiveUserId = $state('')
    let effectivePermsData = $state<EffectivePermsResult | null>(null)
    let effectivePermsLoading = $state(false)
    let effectivePermsError = $state('')

    // OU grant state (link classic RBAC -> AD RBAC)
    let grantOuId = $state('')
    let grantRbacRoleSlug = $state('')
    let grantEffect = $state<'ALLOW' | 'DENY'>('ALLOW')
    let grantInherit = $state(true)
    let grantIncludeDescendants = $state(true)
    let grantingOu = $state(false)
    let grantingOuGroups = $state(false)
    let registryCopyFeedback = $state('')

    // OU → classic RBAC role assignment
    let ouRoleAssignOuId = $state('')
    let ouRoleAssignSlug = $state('')
    let ouRoleAssignSubOUs = $state(true)
    let ouRoleAssigning = $state(false)
    let ouRoleAssignFeedback = $state('')

    // Inline confirm dialog
    let confirmState = $state<{ message: string; label?: string; onConfirm: () => Promise<void> } | null>(null)

    // Password reset modal
    let resetPwdTarget = $state<{ id: string; email: string } | null>(null)
    let resetPwdValue = $state('')
    let resetPwdSaving = $state(false)

    // User detail panel state
    let showUserDetail = $state(false)
    let userDetailMode = $state<'create' | 'edit'>('create')
    let detailAdUser = $state<AdRbacUser | null>(null)
    let formOuId = $state('')
    let formPassword = $state('')
    let formSystemRole = $state('requester')
    let userDetailSaving = $state(false)

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
    let resourceSuggestions = $derived(permissions.map(p => p.key).sort((a, b) => a.localeCompare(b)))

    let selectedOuIdsForGrant = $derived.by(() => {
        if (!grantOuId) return []
        if (!grantIncludeDescendants) return [grantOuId]

        const selected = ous.find((ou) => ou.id === grantOuId)
        if (!selected) return [grantOuId]
        if (selected.path === '/') {
            return ous.map((ou) => ou.id)
        }
        return ous
            .filter((ou) => ou.id === selected.id || ou.path.startsWith(`${selected.path}/`))
            .map((ou) => ou.id)
    })

    let selectedOuUsers = $derived.by(() => {
        if (!grantOuId) return []
        const ouSet = new Set(selectedOuIdsForGrant)
        return users.filter((user) => ouSet.has(user.ouId))
    })

    let selectedOuGroups = $derived.by(() => {
        if (!grantOuId) return []
        const ouSet = new Set(selectedOuIdsForGrant)
        return groups.filter((group) => ouSet.has(group.ouId))
    })

    let filteredAdminUsers = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase()
        const selectedOuId = selectedOu?.id ?? null

        return adminUsers.filter((account) => {
            const linkedAdUser = users.find((u) => u.linkedUserId === account.id)
            if (selectedOuId && linkedAdUser?.ouId !== selectedOuId) return false

            if (!query) return true
            const target = `${account.name} ${account.email} ${account.role}`.toLowerCase()
            return target.includes(query)
        })
    })


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

    function resolveAdRoleByClassicRoleSlug(roleSlug: string): AdRbacRoleAd | null {
        const direct = roles.find((role) => role.key === roleSlug)
        if (direct) return direct

        const prefixed = roles.find((role) => role.key === `role:${roleSlug}`)
        if (prefixed) return prefixed

        const nameMatch = roles.find((role) => role.name.toLowerCase().replace(/\s+/g, '_') === roleSlug)
        return nameMatch ?? null
    }

    function selectedOuName(): string {
        if (!grantOuId) return '—'
        return getOuName(grantOuId)
    }

    function getLinkedOuName(accountUserId: string): string {
        const linkedAdUser = users.find((u) => u.linkedUserId === accountUserId)
        if (!linkedAdUser) return '—'
        return getOuName(linkedAdUser.ouId)
    }

    function t(key: string, fallback: string): string {
        return $isLoading ? fallback : $_(key, { default: fallback })
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
            const [ouRes, userRes, groupRes, aclRes, roleRes, permRes, classicRoleRes, adminUserRes] = await Promise.all([
                getAdOuTree(), listAdUsers(), listAdGroups(),
                listAdAcl(), listAdRoles(), listAdPermissions(), listRbacRoles(), listUsers()
            ])
            ous = ouRes.data
            users = userRes.data
            groups = groupRes.data
            acl = aclRes.data
            roles = roleRes.data
            permissions = permRes.data
            classicRoles = classicRoleRes.data
            adminUsers = adminUserRes.data ?? []
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
        confirmState = {
            message: `Xóa OU "${ou.name}"? Hành động này không thể hoàn tác.`,
            label: 'Xóa OU',
            onConfirm: async () => {
                await deleteAdOu(ou.id)
                if (selectedOu?.id === ou.id) selectedOu = null
                await loadAll()
            }
        }
    }

    // ─── User Actions ────────────────────────────────────────────────────
    function openCreateUser() {
        formUsername = ''; formDisplayName = ''; formEmail = ''; formStatus = 'active'
        formOuId = selectedOu?.id ?? ous[0]?.id ?? ''
        formPassword = ''; formSystemRole = 'requester'
        detailAdUser = null; userDetailMode = 'create'; showUserDetail = true
    }
    function openEditUser(user: AdRbacUser) {
        formUsername = user.username
        formDisplayName = user.displayName; formEmail = user.email ?? ''; formStatus = user.status as any
        formOuId = user.ouId
        const linkedAccount = adminUsers.find(a => a.id === user.linkedUserId)
        formSystemRole = linkedAccount?.role ?? 'requester'
        formPassword = ''
        detailAdUser = user; userDetailMode = 'edit'; showUserDetail = true
    }
    async function submitUserDetail() {
        userDetailSaving = true; error = null
        try {
            if (userDetailMode === 'create') {
                if (!formEmail.trim() || !formPassword.trim()) {
                    error = 'Email and password are required to create a user.'; return
                }
                const account = await createUser({
                    email: formEmail.trim().toLowerCase(),
                    name: formDisplayName.trim(),
                    password: formPassword,
                    role: formSystemRole,
                })
                await createAdUser({
                    username: formUsername.trim(),
                    displayName: formDisplayName.trim(),
                    email: formEmail || undefined,
                    ouId: formOuId || (ous[0]?.id ?? ''),
                    linkedUserId: account.id,
                    status: formStatus,
                })
            } else if (detailAdUser) {
                await updateAdUser(detailAdUser.id, {
                    displayName: formDisplayName.trim(),
                    email: formEmail || undefined,
                    status: formStatus,
                })
                if (detailAdUser.linkedUserId) {
                    await updateUser(detailAdUser.linkedUserId, {
                        name: formDisplayName.trim(),
                        email: formEmail.trim().toLowerCase() || undefined,
                        role: formSystemRole,
                        isActive: formStatus === 'active',
                    })
                }
            }
            showUserDetail = false
            await loadAll()
        } catch (e: any) {
            error = e?.message ?? 'Failed to save user.'
        } finally {
            userDetailSaving = false
        }
    }
    async function doDeleteUser(user: AdRbacUser) {
        confirmState = {
            message: `Xóa user "${user.username}"?`,
            label: 'Xóa User',
            onConfirm: async () => { await deleteAdUser(user.id); await loadAll() }
        }
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
        confirmState = {
            message: `Xóa group "${group.name}"?`,
            label: 'Xóa Group',
            onConfirm: async () => { await deleteAdGroup(group.id); await loadAll() }
        }
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
        const grp = selectedGroup
        confirmState = {
            message: 'Xóa member này khỏi group?',
            label: 'Xóa Member',
            onConfirm: async () => {
                await removeAdGroupMember(grp.id, m.memberType, memberId)
                await loadGroupMembers(grp)
            }
        }
    }

    // ─── ACL Actions ─────────────────────────────────────────────────────
    function openAssignAcl() {
        formPrincipalType = 'USER'; formPrincipalId = ''; formRoleId = ''
        formScopeType = 'GLOBAL'; formScopeOuId = ''; formScopeResource = ''; formEffect = 'ALLOW'; formInherit = true
        modalMode = 'assign-acl'; showModal = true
    }
    async function submitAcl() {
        try {
            if (formScopeType === 'RESOURCE' && !formScopeResource.trim()) {
                error = 'Resource key is required for RESOURCE scope.'
                return
            }
            await assignAdAcl({
                principalType: formPrincipalType,
                ...(formPrincipalType === 'USER' ? { principalUserId: formPrincipalId } : { principalGroupId: formPrincipalId }),
                roleId: formRoleId,
                scopeType: formScopeType,
                ...(formScopeType === 'OU' ? { scopeOuId: formScopeOuId } : {}),
                ...(formScopeType === 'RESOURCE' ? { scopeResource: formScopeResource.trim() } : {}),
                effect: formEffect,
                inherit: formInherit,
            })
            showModal = false
            await loadAll()
        } catch (e: any) { error = e.message }
    }
    async function doRevokeAcl(entry: AdAclEntry) {
        confirmState = {
            message: 'Thu hồi ACL entry này?',
            label: 'Thu hồi ACL',
            onConfirm: async () => { await revokeAdAcl(entry.id); await loadAll() }
        }
    }

    async function grantRoleToOuUsers() {
        if (!grantOuId || !grantRbacRoleSlug) {
            error = 'Choose OU and RBAC role first.'
            return
        }

        const mappedAdRole = resolveAdRoleByClassicRoleSlug(grantRbacRoleSlug)
        if (!mappedAdRole) {
            error = `No AD role mapping found for RBAC role "${grantRbacRoleSlug}".`
            return
        }

        const targetUsers = selectedOuUsers
        if (targetUsers.length === 0) {
            error = 'Selected OU has no users to grant.'
            return
        }

        grantingOu = true
        error = null
        try {
            let createdCount = 0

            for (const user of targetUsers) {
                const alreadyGranted = acl.some((entry) =>
                    entry.principalType === 'USER' &&
                    entry.principalUserId === user.id &&
                    entry.roleId === mappedAdRole.id &&
                    entry.scopeType === 'OU' &&
                    entry.scopeOuId === grantOuId &&
                    entry.effect === grantEffect
                )
                if (alreadyGranted) continue

                await assignAdAcl({
                    principalType: 'USER',
                    principalUserId: user.id,
                    roleId: mappedAdRole.id,
                    scopeType: 'OU',
                    scopeOuId: grantOuId,
                    effect: grantEffect,
                    inherit: grantInherit
                })
                createdCount += 1
            }

            await loadAll()
            const scopeText = grantIncludeDescendants
                ? `${selectedOuName()} + descendants`
                : selectedOuName()
            registryCopyFeedback = `Granted to ${createdCount} users in ${scopeText}`
            setTimeout(() => {
                registryCopyFeedback = ''
            }, 1800)
        } catch (e: any) {
            error = e.message ?? 'Failed to grant RBAC role to OU users.'
        } finally {
            grantingOu = false
        }
    }

    async function grantRoleToOuGroups() {
        if (!grantOuId || !grantRbacRoleSlug) {
            error = t('adminRbac.registry.errors.chooseOuRole', 'Choose OU and RBAC role first.')
            return
        }

        const mappedAdRole = resolveAdRoleByClassicRoleSlug(grantRbacRoleSlug)
        if (!mappedAdRole) {
            error = t('adminRbac.registry.errors.missingMap', 'No AD role mapping found for selected RBAC role.')
            return
        }

        const targetGroups = selectedOuGroups
        if (targetGroups.length === 0) {
            error = t('adminRbac.registry.errors.emptyOuGroups', 'Selected OU has no groups to grant.')
            return
        }

        grantingOuGroups = true
        error = null
        try {
            let createdCount = 0

            for (const group of targetGroups) {
                const alreadyGranted = acl.some((entry) =>
                    entry.principalType === 'GROUP' &&
                    entry.principalGroupId === group.id &&
                    entry.roleId === mappedAdRole.id &&
                    entry.scopeType === 'OU' &&
                    entry.scopeOuId === grantOuId &&
                    entry.effect === grantEffect
                )
                if (alreadyGranted) continue

                await assignAdAcl({
                    principalType: 'GROUP',
                    principalGroupId: group.id,
                    roleId: mappedAdRole.id,
                    scopeType: 'OU',
                    scopeOuId: grantOuId,
                    effect: grantEffect,
                    inherit: grantInherit
                })
                createdCount += 1
            }

            await loadAll()
            const scopeText = grantIncludeDescendants
                ? `${selectedOuName()} + descendants`
                : selectedOuName()
            registryCopyFeedback = `${t('adminRbac.registry.messages.grantedGroups', 'Granted to groups: {count}').replace('{count}', String(createdCount))} (${scopeText})`
            setTimeout(() => {
                registryCopyFeedback = ''
            }, 1800)
        } catch (e: any) {
            error = e.message ?? t('adminRbac.registry.errors.grantFailedGroups', 'Failed to grant RBAC role to OU groups.')
        } finally {
            grantingOuGroups = false
        }
    }

    async function handleAssignOuRole() {
        if (!ouRoleAssignOuId || !ouRoleAssignSlug) {
            error = 'Choose OU and role first.'
            return
        }
        ouRoleAssigning = true; ouRoleAssignFeedback = ''; error = null
        try {
            const res = await assignOuRole(ouRoleAssignOuId, ouRoleAssignSlug, ouRoleAssignSubOUs)
            ouRoleAssignFeedback = `Assigned role to ${res.data.updatedCount} user(s)`
            setTimeout(() => { ouRoleAssignFeedback = '' }, 3000)
        } catch (e: any) {
            error = e.message ?? 'Failed to assign role to OU'
        } finally {
            ouRoleAssigning = false
        }
    }

    async function doResetPassword(user: AdRbacUser) {
        const account = adminUsers.find(a => a.id === user.linkedUserId)
        if (!account) { error = 'User này chưa có tài khoản hệ thống.'; return }
        resetPwdTarget = { id: account.id, email: account.email }
        resetPwdValue = ''
    }

    function closeModal() { showModal = false; modalMode = null; modalTarget = null }

    // ─── AD Role Permissions ─────────────────────────────────────────────
    async function selectAdRole(role: AdRbacRoleAd) {
        selectedAdRole = role
        adRoleLoadingPerms = true
        try {
            const res = await getAdRolePermissions(role.id)
            adRolePermKeys = new Set(res.data.map((p: AdPermission) => p.key))
        } catch (e: any) {
            error = e.message ?? 'Failed to load role permissions'
        } finally {
            adRoleLoadingPerms = false
        }
    }

    function toggleRolePerm(key: string) {
        const next = new Set(adRolePermKeys)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        adRolePermKeys = next
    }

    async function saveAdRolePermissions() {
        if (!selectedAdRole) return
        adRoleSaving = true; error = null
        try {
            const permIds = permissions
                .filter(p => adRolePermKeys.has(p.key))
                .map(p => p.id)
            await setAdRolePermissions(selectedAdRole.id, permIds)
            await loadAll()
        } catch (e: any) {
            error = e.message ?? 'Failed to save role permissions'
        } finally {
            adRoleSaving = false
        }
    }

    // ─── Effective Permissions ───────────────────────────────────────────
    async function loadEffectivePerms() {
        if (!effectiveUserId) return
        effectivePermsLoading = true; effectivePermsError = ''; effectivePermsData = null
        try {
            const res = await getUserAdEffectivePerms(effectiveUserId)
            effectivePermsData = res.data
        } catch (e: any) {
            effectivePermsError = e.message ?? 'Failed to load effective permissions'
        } finally {
            effectivePermsLoading = false
        }
    }
</script>

<!-- ╔═══════════════════════════════════════════════════════════════════════════
     ║  ADUC-style RBAC Panel — Split layout: OU tree (left) + Content (right)
     ╚═══════════════════════════════════════════════════════════════════════════ -->
<div class="rbac-container bg-surface-1 text-slate-100">
    <!-- ═══ Left Panel: OU Tree ═══ -->
    <aside class="ou-tree-panel bg-surface-2">
        <div class="panel-header bg-surface-3 text-slate-200">
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
                    <Users size={14} /> {$isLoading ? 'Users' : $_('adminRbac.adPanel.tabs.users')} ({filteredUsers.length})
                </button>
                <button class="tab" class:active={rightTab === 'groups'} onclick={() => { rightTab = 'groups' }}>
                    <UsersRound size={14} /> {$isLoading ? 'Groups' : $_('adminRbac.adPanel.tabs.groups')} ({filteredGroups.length})
                </button>
                <button class="tab" class:active={rightTab === 'acl'} onclick={() => { rightTab = 'acl' }}>
                    <Shield size={14} /> {$isLoading ? 'Access Rules' : $_('adminRbac.adPanel.tabs.acl')} ({filteredAcl.length})
                </button>
                <button class="tab" class:active={rightTab === 'roles'} onclick={() => { rightTab = 'roles' }}>
                    <Lock size={14} /> {$isLoading ? 'AD Roles' : $_('adminRbac.adPanel.tabs.roles')} ({roles.length})
                </button>
                <button class="tab" class:active={rightTab === 'effective'} onclick={() => { rightTab = 'effective' }}>
                    <CheckCircle2 size={14} /> {$isLoading ? 'Effective Perms' : $_('adminRbac.adPanel.tabs.effective')}
                </button>
            </div>

            <!-- Search + action buttons — hidden when detail panel open -->
            <div class="toolbar">
                <div class="search-box">
                    <Search size={14} />
                    <input type="text" placeholder={$isLoading ? 'Search...' : $_('adminRbac.adPanel.toolbar.search')} bind:value={searchQuery} />
                </div>
                {#if rightTab === 'users'}
                    <button class="btn primary" onclick={openCreateUser}><UserPlus size={14} /> {$isLoading ? 'New User' : $_('adminRbac.adPanel.toolbar.newUser')}</button>
                {:else if rightTab === 'groups'}
                    <button class="btn primary" onclick={openCreateGroup}><Plus size={14} /> {$isLoading ? 'New Group' : $_('adminRbac.adPanel.toolbar.newGroup')}</button>
                {:else if rightTab === 'acl'}
                    <button class="btn primary" onclick={openAssignAcl}><ShieldPlus size={14} /> {$isLoading ? 'Assign ACL' : $_('adminRbac.adPanel.toolbar.assignAcl')}</button>
                {:else if rightTab === 'roles' && selectedAdRole}
                    <button class="btn primary" onclick={saveAdRolePermissions} disabled={adRoleSaving}>
                        {adRoleSaving
                            ? ($isLoading ? 'Saving...' : $_('adminRbac.adPanel.toolbar.saving'))
                            : ($isLoading ? 'Save Permissions' : $_('adminRbac.adPanel.toolbar.savePerms'))}
                    </button>
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
            <!-- TAB: Users (merged with Account info) -->
            {#if rightTab === 'users'}
                {#if showUserDetail}
                    <!-- ── User Detail Form (like Create Asset layout) ── -->
                    <div class="user-detail-panel">
                        <div class="user-detail-header">
                            <button class="btn sm" onclick={() => { showUserDetail = false; error = null }}>
                                ← {userDetailMode === 'create' ? 'New User' : 'Edit: ' + (detailAdUser?.displayName ?? '')}
                            </button>
                            <h2>{userDetailMode === 'create' ? 'Create User' : 'Edit User'}</h2>
                        </div>

                        {#if error}
                            <div class="error-banner" style="margin: 0 0 12px 0">
                                <span>{error}</span>
                                <button onclick={() => { error = null }}>✕</button>
                            </div>
                        {/if}

                        <div class="user-detail-body">
                            <!-- Left column: Identity -->
                            <div class="detail-card">
                                <h3 class="detail-card-title">Identity Information</h3>

                                <label>
                                    Username {#if userDetailMode === 'create'}<span class="required">*</span>{/if}
                                    <input
                                        type="text"
                                        bind:value={formUsername}
                                        placeholder="e.g. john.doe"
                                        readonly={userDetailMode === 'edit'}
                                        class:readonly={userDetailMode === 'edit'}
                                    />
                                    {#if userDetailMode === 'edit'}
                                        <span class="hint">Username cannot be changed after creation.</span>
                                    {/if}
                                </label>

                                <label>
                                    Display Name <span class="required">*</span>
                                    <input type="text" bind:value={formDisplayName} placeholder="e.g. John Doe" />
                                </label>

                                <label>
                                    Email <span class="required">*</span>
                                    <input type="email" bind:value={formEmail} placeholder="john.doe@company.com" />
                                </label>

                                <label>
                                    Directory Status
                                    <select bind:value={formStatus}>
                                        <option value="active">Active</option>
                                        <option value="disabled">Disabled</option>
                                        <option value="locked">Locked</option>
                                    </select>
                                </label>
                            </div>

                            <!-- Right column: Account & Access -->
                            <div class="detail-right">
                                <div class="detail-card">
                                    <h3 class="detail-card-title">Account & Access</h3>

                                    <label>
                                        Organizational Unit <span class="required">*</span>
                                        <select bind:value={formOuId}>
                                            {#each ous as ou (ou.id)}
                                                <option value={ou.id}>{'  '.repeat(ou.depth)}{ou.name}</option>
                                            {/each}
                                        </select>
                                    </label>

                                    <label>
                                        System Role <span class="required">*</span>
                                        <select bind:value={formSystemRole}>
                                            <option value="requester">Requester</option>
                                            <option value="viewer">Viewer</option>
                                            <option value="technician">Technician</option>
                                            <option value="warehouse_keeper">Warehouse Keeper</option>
                                            <option value="it_asset_manager">IT Asset Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </label>

                                    {#if userDetailMode === 'create'}
                                        <label>
                                            Password <span class="required">*</span>
                                            <input type="password" bind:value={formPassword} placeholder="Initial password" autocomplete="new-password" />
                                        </label>
                                    {:else}
                                        <p class="hint" style="margin-top:4px">
                                            To change password, use the <strong>Reset Password</strong> button on the user row.
                                        </p>
                                    {/if}
                                </div>

                                <button
                                    class="btn primary w-full"
                                    onclick={submitUserDetail}
                                    disabled={userDetailSaving}
                                >
                                    {userDetailSaving ? 'Saving...' : userDetailMode === 'create' ? 'Create User' : 'Save Changes'}
                                </button>
                                <button class="btn w-full" onclick={() => { showUserDetail = false; error = null }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                {:else}
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th><th>Display Name</th><th>Email</th>
                                <th>OU</th><th>System Role</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredUsers as user (user.id)}
                                {@const account = adminUsers.find(a => a.id === user.linkedUserId)}
                                <tr>
                                    <td class="mono">{user.username}</td>
                                    <td>
                                        <div>{user.displayName}</div>
                                        {#if !account}<div class="text-xs" style="color:var(--color-warning,#f59e0b)">No linked account</div>{/if}
                                    </td>
                                    <td>{user.email ?? account?.email ?? '—'}</td>
                                    <td><span class="badge ou">{getOuName(user.ouId)}</span></td>
                                    <td><span class="badge type">{account?.role ?? '—'}</span></td>
                                    <td>
                                        <span class="status-badge" class:active={user.status === 'active' && (account?.isActive ?? true)}
                                            class:disabled={user.status === 'disabled' || account?.isActive === false}
                                            class:locked={user.status === 'locked'}>
                                            {#if user.status === 'active' && (account?.isActive ?? true)}<CheckCircle2 size={12} />{:else if user.status === 'locked'}<Lock size={12} />{:else}<Ban size={12} />{/if}
                                            {user.status}{account && !account.isActive ? ' (inactive)' : ''}
                                        </span>
                                    </td>
                                    <td class="actions">
                                        <button class="icon-btn" title="Edit" onclick={() => openEditUser(user)}><Pencil size={13} /></button>
                                        <button class="btn sm" title="Reset Password" onclick={() => doResetPassword(user)}>
                                            <Unlock size={12} />
                                        </button>
                                        <button class="icon-btn danger" title="Delete" onclick={() => doDeleteUser(user)}><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="7" class="empty">No users in this OU</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
                {/if}

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

            <!-- TAB: ACL (Access Rules) -->
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
                                <tr><td colspan="6" class="empty">No access rules defined</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- OU → Classic RBAC Role Assignment -->
                <details class="effective-panel" style="margin-top: 12px; border-radius: 6px; border: 1px solid var(--color-border);">
                    <summary style="padding: 10px 14px; cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; display: flex; align-items: center; gap: 8px;">
                        <ShieldPlus size={14} />
                        Gán Role cho OU
                        <span class="ou-path" style="font-weight:400; margin-left:4px">— đặt role hệ thống cho tất cả user trong OU</span>
                    </summary>
                    <div class="modal-body" style="padding: 12px 14px; gap: 10px; border-top: 1px solid var(--color-border);">
                        <div class="hint" style="color: var(--color-warning, #f59e0b); margin-bottom: 4px;">
                            Thao tác này sẽ cập nhật trường <code>role</code> của user trong hệ thống (không phải AD ACL). Phù hợp để gán hàng loạt role Helpdesk, IT Manager, v.v.
                        </div>
                        <label>OU
                            <select bind:value={ouRoleAssignOuId}>
                                <option value="">— Chọn OU —</option>
                                {#each ous as ou (ou.id)}
                                    <option value={ou.id}>{'  '.repeat(ou.depth)}{ou.name}</option>
                                {/each}
                            </select>
                        </label>
                        <label>Role hệ thống
                            <select bind:value={ouRoleAssignSlug}>
                                <option value="">— Chọn role —</option>
                                {#each classicRoles as role (role.id)}
                                    <option value={role.slug}>{role.name} ({role.slug})</option>
                                {/each}
                            </select>
                        </label>
                        <label class="checkbox-row">
                            <input type="checkbox" bind:checked={ouRoleAssignSubOUs} /> Bao gồm sub-OU
                        </label>
                        <div class="modal-footer" style="padding: 0; border-top: 0; justify-content: flex-start; margin-top: 4px;">
                            <button class="btn primary" onclick={handleAssignOuRole} disabled={ouRoleAssigning || !ouRoleAssignOuId || !ouRoleAssignSlug}>
                                {ouRoleAssigning ? 'Đang gán...' : 'Gán Role cho OU'}
                            </button>
                        </div>
                        {#if ouRoleAssignFeedback}
                            <div class="hint" style="color: var(--color-success, #10b981)">{ouRoleAssignFeedback}</div>
                        {/if}
                    </div>
                </details>

                <!-- Bulk Grant to OU (collapsed by default) -->
                <details class="effective-panel" style="margin-top: 12px; border-radius: 6px; border: 1px solid var(--color-border);">
                    <summary style="padding: 10px 14px; cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; display: flex; align-items: center; gap: 8px;">
                        <ShieldPlus size={14} />
                        Bulk Grant AD Role to OU
                        <span class="ou-path" style="font-weight:400; margin-left:4px">— assign an AD RBAC ACL entry to all users or groups in a selected OU</span>
                    </summary>
                    <div class="modal-body" style="padding: 12px 14px; gap: 10px; border-top: 1px solid var(--color-border);">
                        <label>OU
                            <select bind:value={grantOuId}>
                                <option value="">— Choose OU —</option>
                                {#each ous as ou (ou.id)}
                                    <option value={ou.id}>{'  '.repeat(ou.depth)}{ou.name}</option>
                                {/each}
                            </select>
                        </label>
                        <label>RBAC Role
                            <select bind:value={grantRbacRoleSlug}>
                                <option value="">— Choose RBAC role —</option>
                                {#each classicRoles as role (role.id)}
                                    <option value={role.slug}>{role.name} ({role.slug})</option>
                                {/each}
                            </select>
                        </label>
                        <label>Effect
                            <select bind:value={grantEffect}>
                                <option value="ALLOW">ALLOW</option>
                                <option value="DENY">DENY</option>
                            </select>
                        </label>
                        <label class="checkbox-row">
                            <input type="checkbox" bind:checked={grantInherit} /> Inherit to child OUs
                        </label>
                        <label class="checkbox-row">
                            <input type="checkbox" bind:checked={grantIncludeDescendants} /> Include descendant OUs
                        </label>
                        {#if grantRbacRoleSlug}
                            <div class="hint">Mapped AD role: {resolveAdRoleByClassicRoleSlug(grantRbacRoleSlug)?.name ?? 'Not mapped — check role mapping in AD Roles'}</div>
                        {/if}
                        <div class="hint">Users in scope: {selectedOuUsers.length} · Groups in scope: {selectedOuGroups.length}</div>
                        <div class="modal-footer" style="padding: 0; border-top: 0; justify-content: flex-start; margin-top: 4px;">
                            <button class="btn primary" onclick={grantRoleToOuUsers} disabled={grantingOu}>
                                {grantingOu ? 'Granting...' : 'Grant to OU Users'}
                            </button>
                            <button class="btn" onclick={grantRoleToOuGroups} disabled={grantingOuGroups}>
                                {grantingOuGroups ? 'Granting...' : 'Grant to OU Groups'}
                            </button>
                        </div>
                        {#if registryCopyFeedback}
                            <div class="hint" style="margin-top: 6px; color: var(--color-success, #10b981)">{registryCopyFeedback}</div>
                        {/if}
                    </div>
                </details>

            {/if}

            <!-- ════════════════════════════════════════════════════════
                 TAB: AD Roles & Permissions
                 ════════════════════════════════════════════════════════ -->
            {#if rightTab === 'roles'}
                <div class="split-panel" style="display:flex; gap:0; height:100%; min-height:400px;">
                    <!-- Left: role list -->
                    <div style="width:220px; min-width:180px; border-right:1px solid var(--color-border); overflow-y:auto; flex-shrink:0;">
                        {#each roles as role (role.id)}
                            <button
                                class="ou-item"
                                class:selected={selectedAdRole?.id === role.id}
                                onclick={() => selectAdRole(role)}
                                style="display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:10px 12px;"
                            >
                                <span style="font-weight:600; font-size:13px;">{role.name}</span>
                                <span style="font-size:11px; opacity:0.55; font-family:monospace;">{role.key}</span>
                                {#if role.isSystem}
                                    <span class="badge" style="font-size:10px; margin-top:2px;">system</span>
                                {/if}
                            </button>
                        {/each}
                        {#if roles.length === 0}
                            <div class="empty-state">No AD roles found</div>
                        {/if}
                    </div>

                    <!-- Right: permissions for selected role -->
                    <div style="flex:1; overflow-y:auto; padding:16px;">
                        {#if !selectedAdRole}
                            <div class="empty-state">← Select an AD Role to manage its permissions</div>
                        {:else if adRoleLoadingPerms}
                            <div class="loading">Loading permissions...</div>
                        {:else}
                            <div style="margin-bottom:12px;">
                                <h3 style="font-size:14px; font-weight:700; margin:0 0 2px;">{selectedAdRole.name}</h3>
                                <p style="font-size:12px; color:var(--color-text-muted); margin:0;">{selectedAdRole.description ?? ''}</p>
                            </div>

                            <!-- Group permissions by prefix -->
                            {@const sitePerms = permissions.filter(p => p.key.startsWith('site:'))}
                            {@const otherPerms = permissions.filter(p => !p.key.startsWith('site:'))}

                            {#if sitePerms.length > 0}
                                <div style="margin-bottom:16px;">
                                    <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted); margin-bottom:8px;">
                                        Hiển thị trang / tab (site:show:)
                                    </p>
                                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:4px;">
                                        {#each sitePerms as perm (perm.id)}
                                            <label class="checkbox-row" style="gap:8px; padding:5px 8px; border-radius:4px; border:1px solid var(--color-border); font-size:12px; cursor:pointer;">
                                                <input type="checkbox"
                                                    checked={adRolePermKeys.has(perm.key)}
                                                    onchange={() => toggleRolePerm(perm.key)}
                                                />
                                                <span style="font-family:monospace; font-size:11px;">{perm.key}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if otherPerms.length > 0}
                                <div>
                                    <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted); margin-bottom:8px;">
                                        Permissions khác
                                    </p>
                                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:4px;">
                                        {#each otherPerms as perm (perm.id)}
                                            <label class="checkbox-row" style="gap:8px; padding:5px 8px; border-radius:4px; border:1px solid var(--color-border); font-size:12px; cursor:pointer;">
                                                <input type="checkbox"
                                                    checked={adRolePermKeys.has(perm.key)}
                                                    onchange={() => toggleRolePerm(perm.key)}
                                                />
                                                <span style="font-family:monospace; font-size:11px;">{perm.key}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if permissions.length === 0}
                                <div class="empty-state">No permissions defined yet.</div>
                            {/if}
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- ════════════════════════════════════════════════════════
                 TAB: Effective Permissions Viewer
                 ════════════════════════════════════════════════════════ -->
            {#if rightTab === 'effective'}
                <div style="padding:16px; space-y:12px;">
                    <div style="display:flex; gap:8px; align-items:flex-end; margin-bottom:16px; flex-wrap:wrap;">
                        <label style="flex:1; min-width:200px;">
                            <span style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Chọn AD User</span>
                            <select bind:value={effectiveUserId} style="width:100%;">
                                <option value="">— Chọn user —</option>
                                {#each users as u (u.id)}
                                    <option value={u.id}>{u.displayName} ({u.username})</option>
                                {/each}
                            </select>
                        </label>
                        <button class="btn primary" onclick={loadEffectivePerms} disabled={!effectiveUserId || effectivePermsLoading}>
                            {effectivePermsLoading ? 'Loading...' : 'Xem quyền'}
                        </button>
                    </div>

                    {#if effectivePermsError}
                        <div class="error-banner">{effectivePermsError}</div>
                    {:else if effectivePermsData}
                        {@const allowedList = effectivePermsData.allowed.sort()}
                        {@const deniedList = effectivePermsData.denied.sort()}
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <div>
                                <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#10b981; margin-bottom:8px;">
                                    ALLOWED ({allowedList.length})
                                </p>
                                {#if allowedList.length === 0}
                                    <p style="font-size:12px; color:var(--color-text-muted);">Không có quyền nào được cấp.</p>
                                {:else}
                                    <div style="display:flex; flex-direction:column; gap:3px;">
                                        {#each allowedList as key}
                                            <code style="font-size:11px; padding:3px 8px; background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.25); border-radius:4px; color:#6ee7b7;">{key}</code>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <div>
                                <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#f87171; margin-bottom:8px;">
                                    DENIED ({deniedList.length})
                                </p>
                                {#if deniedList.length === 0}
                                    <p style="font-size:12px; color:var(--color-text-muted);">Không có quyền bị từ chối.</p>
                                {:else}
                                    <div style="display:flex; flex-direction:column; gap:3px;">
                                        {#each deniedList as key}
                                            <code style="font-size:11px; padding:3px 8px; background:rgba(248,113,113,.12); border:1px solid rgba(248,113,113,.25); border-radius:4px; color:#fca5a5;">{key}</code>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {:else if !effectivePermsLoading}
                        <div class="empty-state">Chọn một user và nhấn "Xem quyền" để kiểm tra effective permissions.</div>
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
                    {#if modalMode === 'create-ou'}{$isLoading ? 'New Organizational Unit' : $_('adminRbac.adPanel.modal.createOu')}
                    {:else if modalMode === 'edit-ou'}{$isLoading ? 'Edit OU' : $_('adminRbac.adPanel.modal.editOu')}
                    {:else if modalMode === 'create-group'}{$isLoading ? 'New Group' : $_('adminRbac.adPanel.modal.createGroup')}
                    {:else if modalMode === 'edit-group'}{$isLoading ? 'Edit Group' : $_('adminRbac.adPanel.modal.editGroup')}
                    {:else if modalMode === 'add-member'}{$isLoading ? 'Add Member' : $_('adminRbac.adPanel.modal.addMember')}
                    {:else if modalMode === 'assign-acl'}{$isLoading ? 'Assign ACL' : $_('adminRbac.adPanel.modal.assignAcl')}
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
                    {:else if formScopeType === 'RESOURCE'}
                        <label>Resource Key
                            <input type="text" bind:value={formScopeResource} list="resource-suggestions" placeholder="route:/warehouse/stock or site:hidden:/automation/rules" />
                        </label>
                        <datalist id="resource-suggestions">
                            {#each resourceSuggestions as resource}
                                <option value={resource}></option>
                            {/each}
                        </datalist>
                        <p class="hint">Auto-detected resources include routes/sites/tabs and permission keys.</p>
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
                <button class="btn" onclick={closeModal}>{$isLoading ? 'Cancel' : $_('adminRbac.adPanel.modal.cancel')}</button>
                <button class="btn primary" onclick={() => {
                    if (modalMode?.startsWith('create-ou') || modalMode?.startsWith('edit-ou')) submitOu()
                    else if (modalMode?.startsWith('create-group') || modalMode?.startsWith('edit-group')) submitGroup()
                    else if (modalMode === 'add-member') submitAddMember()
                    else if (modalMode === 'assign-acl') submitAcl()
                }}>
                    {(modalMode?.startsWith('create') || modalMode === 'add-member' || modalMode === 'assign-acl')
                        ? ($isLoading ? 'Create' : $_('adminRbac.adPanel.modal.create'))
                        : ($isLoading ? 'Save' : $_('adminRbac.adPanel.modal.save'))}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ═══ Inline Confirm Dialog ═══ -->
{#if confirmState}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => { confirmState = null }} onkeydown={(e) => { if (e.key === 'Escape') confirmState = null }} role="presentation">
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="alertdialog" tabindex="-1" style="max-width:420px;">
            <div class="modal-header">
                <h3>Xác nhận</h3>
            </div>
            <div class="modal-body">
                <p style="margin:0; font-size:14px;">{confirmState.message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick={() => { confirmState = null }}>Hủy</button>
                <button class="btn" style="background:var(--color-error,#ef4444); color:#fff; border-color:transparent;"
                    onclick={async () => {
                        const cb = confirmState?.onConfirm
                        confirmState = null
                        try { await cb?.() } catch (e: any) { error = (e as Error).message }
                    }}
                >{confirmState.label ?? 'Xác nhận'}</button>
            </div>
        </div>
    </div>
{/if}

<!-- ═══ Password Reset Modal ═══ -->
{#if resetPwdTarget}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => { resetPwdTarget = null }} onkeydown={(e) => { if (e.key === 'Escape') resetPwdTarget = null }} role="presentation">
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-header">
                <h3>Đặt lại mật khẩu</h3>
                <button class="icon-btn" onclick={() => { resetPwdTarget = null }}>✕</button>
            </div>
            <div class="modal-body">
                <p style="font-size:13px; margin:0 0 12px; color:var(--color-text-muted);">Tài khoản: <strong>{resetPwdTarget.email}</strong></p>
                <label>Mật khẩu mới
                    <!-- svelte-ignore a11y_autofocus -->
                    <input type="password" bind:value={resetPwdValue} placeholder="Nhập mật khẩu mới" autofocus />
                </label>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick={() => { resetPwdTarget = null }}>Hủy</button>
                <button class="btn primary" disabled={!resetPwdValue.trim() || resetPwdSaving}
                    onclick={async () => {
                        if (!resetPwdTarget || !resetPwdValue.trim()) return
                        resetPwdSaving = true; error = null
                        try {
                            await resetPassword(resetPwdTarget.id, resetPwdValue)
                            registryCopyFeedback = `Đã đặt lại mật khẩu cho ${resetPwdTarget.email}`
                            setTimeout(() => { registryCopyFeedback = '' }, 2500)
                            resetPwdTarget = null
                        } catch (e: any) {
                            error = (e as Error)?.message ?? 'Không thể đặt lại mật khẩu.'
                        } finally {
                            resetPwdSaving = false
                        }
                    }}
                >{resetPwdSaving ? 'Đang lưu...' : 'Lưu mật khẩu'}</button>
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
        display: flex;
        height: 100%;
        min-height: 600px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        overflow: hidden;
        background: rgb(var(--color-surface));
        color: var(--color-text);
    }

    /* ── Left Panel ── */
    .ou-tree-panel {
        width: 260px;
        min-width: 240px;
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        background: rgb(var(--color-surface-2));
    }
    .panel-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        font-weight: 600;
        font-size: 13px;
        border-bottom: 1px solid var(--color-border);
        background: rgb(var(--color-elevated));
        color: var(--color-text-muted);
    }
    .panel-header .icon-btn { margin-left: auto; }
    .panel-header .icon-btn + .icon-btn { margin-left: 0; }
    .ou-tree { flex: 1; overflow-y: auto; padding: 4px 0; }
    .ou-item {
        display: flex; align-items: center; gap: 6px; padding: 6px 12px;
        cursor: pointer; font-size: 13px; transition: background 0.15s;
        border: none; background: none; color: inherit; width: 100%; text-align: left;
    }
    .ou-item:hover { background: rgb(var(--color-elevated) / 0.55); }
    .ou-item.selected { background: var(--color-primary-muted); color: var(--color-primary); }
    .chevron { background: none; border: none; color: inherit; cursor: pointer; padding: 0; display: flex; }
    .chevron-spacer { width: 14px; }
    .ou-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── Right Panel ── */
    .content-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .content-header { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
    .ou-info { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .ou-info h2 { font-size: 16px; font-weight: 600; margin: 0; }
    .ou-path { font-size: 11px; color: var(--color-text-muted); font-family: monospace; }

    /* ── Tabs ── */
    .tab-bar { display: flex; gap: 2px; margin-bottom: 10px; }
    .tab {
        display: flex; align-items: center; gap: 4px; padding: 6px 12px;
        font-size: 12px; font-weight: 500; border: none; cursor: pointer;
        background: rgb(var(--color-surface-2)); color: var(--color-text-muted);
        border-radius: 4px; transition: all 0.15s;
    }
    .tab:hover { background: rgb(var(--color-elevated) / 0.7); }
    .tab.active { background: var(--color-primary-muted); color: var(--color-primary); }

    /* ── Toolbar ── */
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .search-box {
        display: flex; align-items: center; gap: 6px; padding: 4px 8px;
        background: rgb(var(--color-surface-2)); border: 1px solid var(--color-border);
        border-radius: 4px; flex: 1; max-width: 300px;
    }
    .search-box input {
        background: none; border: none; outline: none; color: inherit; font-size: 12px; flex: 1;
    }

    /* ── Buttons ── */
    .btn {
        display: flex; align-items: center; gap: 4px; padding: 6px 12px;
        font-size: 12px; border: 1px solid var(--color-border); border-radius: 4px;
        cursor: pointer; background: rgb(var(--color-surface-2)); color: var(--color-text);
    }
    .btn.primary { background: var(--color-primary); color: var(--color-primary-contrast); border-color: transparent; }
    .btn.sm { padding: 4px 8px; font-size: 11px; }
    .icon-btn {
        background: none; border: none; color: var(--color-text-muted); cursor: pointer;
        padding: 4px; border-radius: 4px; display: flex; align-items: center;
    }
    .icon-btn:hover { color: var(--color-text); background: rgb(var(--color-elevated) / 0.65); }
    .icon-btn.danger:hover { color: var(--color-danger); }

    /* ── Table ── */
    .table-wrap { flex: 1; overflow: auto; padding: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
        text-align: left; padding: 8px 12px; font-weight: 600; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.5px;
        background: rgb(var(--color-elevated)); color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-border); position: sticky; top: 0; z-index: 1;
    }
    td { padding: 8px 12px; border-bottom: 1px solid var(--color-border); }
    tr:hover td { background: rgb(var(--color-elevated) / 0.35); }
    tr.selected td { background: var(--color-primary-muted); }
    .mono { font-family: monospace; font-size: 12px; }
    .desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-muted); }
    .empty { text-align: center; color: var(--color-text-muted); padding: 24px; }
    .empty-small { text-align: center; color: var(--color-text-muted); padding: 16px; font-size: 12px; }
    .actions { display: flex; gap: 4px; }

    /* ── Badges ── */
    .badge {
        display: inline-flex; align-items: center; padding: 2px 6px;
        font-size: 10px; border-radius: 4px; font-weight: 600;
        background: rgb(var(--color-elevated)); color: var(--color-text-muted);
    }
    .badge.sm { font-size: 9px; padding: 1px 4px; }
    .badge.ou { background: var(--color-primary-muted); color: var(--color-primary); }
    .badge.type { background: var(--status-purple-bg); color: var(--status-purple); }
    .badge.scope { background: var(--status-success-bg); color: var(--status-success); }

    .status-badge {
        display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
        font-size: 11px; border-radius: 4px; font-weight: 500;
    }
    .status-badge.active { background: var(--status-success-bg); color: var(--status-success); }
    .status-badge.disabled { background: var(--status-warning-bg); color: var(--status-warning); }
    .status-badge.locked { background: var(--status-danger-bg); color: var(--status-danger); }

    .effect-badge {
        padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 4px;
    }
    .effect-badge.allow { background: var(--status-success-bg); color: var(--status-success); }
    .effect-badge.deny { background: var(--status-danger-bg); color: var(--status-danger); }

    /* ── Groups split ── */
    .groups-split { display: flex; flex: 1; overflow: hidden; }
    .groups-split .table-wrap { flex: 1; }
    .members-panel {
        width: 280px; border-left: 1px solid var(--color-border);
        display: flex; flex-direction: column;
    }
    .members-header {
        display: flex; align-items: center; gap: 6px; padding: 8px 12px;
        font-size: 13px; border-bottom: 1px solid var(--color-border);
        background: rgb(var(--color-elevated));
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

    /* ── Error ── */
    .error-banner {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 16px; background: var(--color-danger-bg); color: var(--color-danger);
        font-size: 12px; border-bottom: 1px solid var(--color-danger-border);
    }
    .error-banner button { background: none; border: none; color: inherit; cursor: pointer; }

    .loading { padding: 32px; text-align: center; color: var(--color-text-muted); }

    /* ── Modal ── */
    .modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal {
        background: rgb(var(--color-surface)); border: 1px solid var(--color-border);
        border-radius: 8px; width: 420px; max-width: 90vw; max-height: 80vh;
        display: flex; flex-direction: column;
    }
    .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; border-bottom: 1px solid var(--color-border);
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
        padding: 6px 10px; background: rgb(var(--color-surface-2));
        border: 1px solid var(--color-border); border-radius: 4px;
        color: inherit; font-size: 13px;
    }
    .modal-body .hint { font-size: 11px; color: var(--color-text-muted); margin: 0; }
    .checkbox-row { flex-direction: row !important; align-items: center; gap: 8px !important; }
    .modal-footer {
        display: flex; justify-content: flex-end; gap: 8px;
        padding: 12px 16px; border-top: 1px solid var(--color-border);
    }

    :global(.inline-icon) { display: inline; vertical-align: -2px; }

    /* ── User Detail Panel ── */
    .user-detail-panel {
        flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto;
    }
    .user-detail-header {
        display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
    }
    .user-detail-header h2 { font-size: 18px; font-weight: 600; margin: 0; }
    .user-detail-body {
        display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start;
    }
    @media (max-width: 900px) {
        .user-detail-body { grid-template-columns: 1fr; }
    }
    .detail-card {
        background: rgb(var(--color-surface-2)); border: 1px solid var(--color-border);
        border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 14px;
    }
    .detail-card-title {
        font-size: 13px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.5px; color: var(--color-text-muted);
        padding-bottom: 10px; border-bottom: 1px solid var(--color-border); margin: 0;
    }
    .detail-card label {
        display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 500;
    }
    .detail-card input, .detail-card select {
        padding: 8px 10px; background: rgb(var(--color-surface));
        border: 1px solid var(--color-border); border-radius: 4px;
        color: inherit; font-size: 13px;
    }
    .detail-card input:focus, .detail-card select:focus {
        outline: none; border-color: var(--color-primary);
    }
    .detail-card input.readonly {
        opacity: 0.5; cursor: default; background: rgb(var(--color-elevated));
    }
    .detail-card .hint { font-size: 11px; color: var(--color-text-muted); margin: 0; }
    .detail-card .required { color: var(--color-danger); }
    .detail-right {
        display: flex; flex-direction: column; gap: 12px;
    }
    .detail-right .btn { justify-content: center; padding: 10px; font-size: 13px; }
    .detail-right .btn.w-full { width: 100%; }
</style>

