<script lang="ts">
    import { onMount } from 'svelte'
    import { _, isLoading } from '$lib/i18n'
    import { Button } from '$lib/components/ui'
    import {
        listPolicies, createPolicy, deletePolicy,
        listPolicyPermissionCatalog, getPolicyPermissions, setPolicyPermissions,
        listPolicyAssignments, addPolicyAssignment, removePolicyAssignment,
        listPolicyPrincipals, bulkAssignPolicyToOu,
        type Policy, type PolicyAssignment, type PolicyPrincipal,
    } from '$lib/api/admin'
    import type { RbacPermission } from '$lib/api/admin'
    import {
        Laptop, FolderTree, Network, Package, ClipboardList, Key, Puzzle,
        FlaskConical, Cpu, ArrowLeftRight, FileText, Wrench, BarChart3,
        TrendingUp, TrendingDown, Tag, Files, Zap, Plug, Shield, Settings,
        Save, RefreshCw, Search, ChevronDown, ChevronRight, Users, CheckSquare,
        Square, Minus, RotateCcw, CircleCheck, CircleX, Info, Lock, LayoutDashboard,
        Plus, Trash2, X, UserCheck, Globe, Building2, Link, Unlink,
    } from 'lucide-svelte'

    // ── Data ─────────────────────────────────────────────────────────────────
    let policies    = $state<Policy[]>([])
    let permissions = $state<RbacPermission[]>([])
    let principals  = $state<PolicyPrincipal>({ users: [], groups: [], ous: [] })
    /** policyId → Set<permId> — server state */
    let granted     = $state<Map<string, Set<string>>>(new Map())
    /** policyId → Set<permId> — pending edits */
    let pending     = $state<Map<string, Set<string>>>(new Map())
    let assignments = $state<PolicyAssignment[]>([])

    let loading      = $state(true)
    let saving       = $state<Set<string>>(new Set())
    let error        = $state('')
    let successMsg   = $state('')

    // ── Policy management ────────────────────────────────────────────────────
    let showNewPolicyForm = $state(false)
    let newPolicySlug     = $state('')
    let newPolicyName     = $state('')
    let newPolicyDesc     = $state('')
    let creatingPolicy    = $state(false)
    let deletingId        = $state('')

    // ── UI state ─────────────────────────────────────────────────────────────
    let selectedId     = $state<string>('')
    let rightTab       = $state<'permissions' | 'assignments'>('permissions')
    let searchQuery    = $state('')
    let expandedGroups = $state<Set<string>>(new Set())
    let showOnlyDiff   = $state(false)

    // ── Assignment form ──────────────────────────────────────────────────────
    let assignLoading        = $state(false)
    let removingAssignmentId = $state('')
    let newAssignPrincipalType = $state<'USER' | 'GROUP' | 'OU'>('USER')
    let newAssignPrincipalId   = $state('')
    let newAssignScopeType     = $state<'GLOBAL' | 'OU' | 'RESOURCE'>('GLOBAL')
    let newAssignScopeOuId     = $state('')
    let newAssignScopeResource = $state('')
    let newAssignEffect        = $state<'ALLOW' | 'DENY'>('ALLOW')
    let newAssignInherit       = $state(true)

    // ── Bulk OU assign form ──────────────────────────────────────────────────
    let bulkOuId      = $state('')
    let bulkEffect    = $state<'ALLOW' | 'DENY'>('ALLOW')
    let bulkSubOUs    = $state(true)
    let bulkLoading   = $state(false)

    // ── Derived ───────────────────────────────────────────────────────────────
    const selectedPolicy = $derived.by(() => policies.find(p => p.id === selectedId) ?? null)

    const effectiveSet = $derived.by<Set<string>>(() => {
        if (!selectedId) return new Set()
        return pending.get(selectedId) ?? granted.get(selectedId) ?? new Set()
    })
    const originalSet = $derived.by<Set<string>>(() => {
        if (!selectedId) return new Set()
        return granted.get(selectedId) ?? new Set()
    })
    const isDirty     = $derived.by(() => pending.has(selectedId))

    const groupedPermissions = $derived.by(() => {
        const map = new Map<string, RbacPermission[]>()
        for (const p of permissions) {
            const list = map.get(p.resource) ?? []
            list.push(p)
            map.set(p.resource, list)
        }
        return Array.from(map.entries()).map(([resource, perms]) => ({
            resource,
            perms: perms.sort((a, b) => actionOrder(a.action) - actionOrder(b.action))
        }))
    })

    const filteredGroups = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase()
        return groupedPermissions.map(({ resource, perms }) => {
            let filtered = perms
            if (q) {
                filtered = perms.filter(p =>
                    p.name.toLowerCase().includes(q) ||
                    p.resource.toLowerCase().includes(q) ||
                    p.action.toLowerCase().includes(q)
                )
            }
            if (showOnlyDiff && selectedId) {
                filtered = filtered.filter(p => originalSet.has(p.id) !== effectiveSet.has(p.id))
            }
            return { resource, perms: filtered }
        }).filter(g => g.perms.length > 0)
    })

    const dirtyPolicyIds  = $derived.by(() => [...pending.keys()])
    const grantedCount    = $derived.by(() => effectiveSet.size)
    const totalCount      = $derived.by(() => permissions.length)
    const changedCount    = $derived.by(() => {
        if (!isDirty) return 0
        const orig = originalSet; const curr = effectiveSet
        let n = 0
        for (const id of curr) if (!orig.has(id)) n++
        for (const id of orig) if (!curr.has(id)) n++
        return n
    })

    // ── Helpers ───────────────────────────────────────────────────────────────
    function actionOrder(a: string): number {
        const o: Record<string, number> = {
            read:0,create:1,update:2,delete:3,manage:4,approve:5,
            export:6,import:7,assign:8,upload:9,users:10,roles:11,settings:12,show:13
        }
        return o[a] ?? 99
    }

    type TriState = 'all' | 'none' | 'partial'
    function groupState(resource: string): TriState {
        const groupPerms = permissions.filter(p => p.resource === resource)
        const g = groupPerms.filter(p => effectiveSet.has(p.id)).length
        if (g === 0) return 'none'
        if (g === groupPerms.length) return 'all'
        return 'partial'
    }

    function isChanged(permId: string) {
        return originalSet.has(permId) !== effectiveSet.has(permId)
    }

    function getWS(id: string): Set<string> {
        return new Set(pending.get(id) ?? granted.get(id) ?? [])
    }

    function commitPending(id: string, next: Set<string>) {
        const orig = granted.get(id) ?? new Set<string>()
        const same = next.size === orig.size && [...next].every(i => orig.has(i))
        const m = new Map(pending)
        if (same) m.delete(id); else m.set(id, next)
        pending = m
    }

    function togglePermission(permId: string) {
        if (!selectedId) return
        const ws = getWS(selectedId)
        if (ws.has(permId)) ws.delete(permId); else ws.add(permId)
        commitPending(selectedId, ws)
    }

    function toggleGroup(resource: string) {
        if (!selectedId) return
        const state = groupState(resource)
        const ids   = permissions.filter(p => p.resource === resource).map(p => p.id)
        const ws    = getWS(selectedId)
        if (state === 'none') { for (const id of ids) ws.add(id) }
        else                  { for (const id of ids) ws.delete(id) }
        commitPending(selectedId, ws)
    }

    function toggleAll(grant: boolean) {
        if (!selectedId) return
        commitPending(selectedId, grant ? new Set(permissions.map(p => p.id)) : new Set())
    }

    function revert(id: string) {
        const m = new Map(pending); m.delete(id); pending = m
    }

    function toggleExpand(resource: string) {
        const s = new Set(expandedGroups)
        if (s.has(resource)) s.delete(resource); else s.add(resource)
        expandedGroups = s
    }
    function expandAll()   { expandedGroups = new Set(groupedPermissions.map(g => g.resource)) }
    function collapseAll() { expandedGroups = new Set() }

    function policyGrantedCount(id: string) {
        return (pending.get(id) ?? granted.get(id) ?? new Set()).size
    }

    function setSuccess(msg: string) {
        successMsg = msg
        setTimeout(() => { if (successMsg === msg) successMsg = '' }, 4000)
    }

    /** Resolve OU display name/path from principals cache */
    function ouLabel(ouId: string | null): string {
        if (!ouId) return 'OU'
        const ou = principals.ous.find(o => o.id === ouId)
        return ou ? ou.path : ouId
    }

    // ── Resource / action meta ────────────────────────────────────────────────
    const resourceMeta: Record<string, { Icon: any; color: string; bg: string }> = {
        assets:       { Icon: Laptop,          color: 'text-blue-400',    bg: 'bg-blue-900/20' },
        categories:   { Icon: FolderTree,      color: 'text-violet-400',  bg: 'bg-violet-900/20' },
        cmdb:         { Icon: Network,         color: 'text-cyan-400',    bg: 'bg-cyan-900/20' },
        warehouse:    { Icon: Package,         color: 'text-amber-400',   bg: 'bg-amber-900/20' },
        inventory:    { Icon: ClipboardList,   color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
        licenses:     { Icon: Key,             color: 'text-yellow-400',  bg: 'bg-yellow-900/20' },
        accessories:  { Icon: Puzzle,          color: 'text-pink-400',    bg: 'bg-pink-900/20' },
        consumables:  { Icon: FlaskConical,    color: 'text-orange-400',  bg: 'bg-orange-900/20' },
        components:   { Icon: Cpu,             color: 'text-teal-400',    bg: 'bg-teal-900/20' },
        checkout:     { Icon: ArrowLeftRight,  color: 'text-indigo-400',  bg: 'bg-indigo-900/20' },
        requests:     { Icon: FileText,        color: 'text-sky-400',     bg: 'bg-sky-900/20' },
        maintenance:  { Icon: Wrench,          color: 'text-red-400',     bg: 'bg-red-900/20' },
        reports:      { Icon: BarChart3,       color: 'text-lime-400',    bg: 'bg-lime-900/20' },
        analytics:    { Icon: TrendingUp,      color: 'text-green-400',   bg: 'bg-green-900/20' },
        depreciation: { Icon: TrendingDown,    color: 'text-slate-400',   bg: 'bg-slate-800/30' },
        labels:       { Icon: Tag,             color: 'text-rose-400',    bg: 'bg-rose-900/20' },
        documents:    { Icon: Files,           color: 'text-zinc-400',    bg: 'bg-zinc-800/30' },
        automation:   { Icon: Zap,             color: 'text-yellow-300',  bg: 'bg-yellow-900/20' },
        integrations: { Icon: Plug,            color: 'text-purple-400',  bg: 'bg-purple-900/20' },
        security:     { Icon: Shield,          color: 'text-red-500',     bg: 'bg-red-900/20' },
        admin:        { Icon: Settings,        color: 'text-rose-400',    bg: 'bg-rose-900/20' },
        site:         { Icon: LayoutDashboard, color: 'text-sky-300',     bg: 'bg-sky-900/20' },
    }

    const actionMeta: Record<string, { cls: string }> = {
        read:     { cls: 'bg-sky-900/60 text-sky-300 border-sky-700/50' },
        create:   { cls: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50' },
        update:   { cls: 'bg-amber-900/60 text-amber-300 border-amber-700/50' },
        delete:   { cls: 'bg-red-900/60 text-red-300 border-red-700/50' },
        manage:   { cls: 'bg-orange-900/60 text-orange-300 border-orange-700/50' },
        approve:  { cls: 'bg-violet-900/60 text-violet-300 border-violet-700/50' },
        export:   { cls: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/50' },
        import:   { cls: 'bg-teal-900/60 text-teal-300 border-teal-700/50' },
        assign:   { cls: 'bg-blue-900/60 text-blue-300 border-blue-700/50' },
        upload:   { cls: 'bg-teal-900/60 text-teal-300 border-teal-700/50' },
        users:    { cls: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/50' },
        roles:    { cls: 'bg-purple-900/60 text-purple-300 border-purple-700/50' },
        settings: { cls: 'bg-rose-900/60 text-rose-300 border-rose-700/50' },
        show:     { cls: 'bg-sky-900/60 text-sky-200 border-sky-700/50' },
    }

    // ── Load / Save ───────────────────────────────────────────────────────────
    async function loadAll() {
        loading = true; error = ''; pending = new Map()
        try {
            const [policiesRes, permsRes, principalsRes] = await Promise.all([
                listPolicies(),
                listPolicyPermissionCatalog(),
                listPolicyPrincipals().catch(() => ({ data: { users: [], groups: [], ous: [] } })),
            ])
            policies    = policiesRes.data ?? []
            permissions = permsRes.data ?? []
            principals  = principalsRes.data

            const grantedMap = new Map<string, Set<string>>()
            await Promise.all(policies.map(async pol => {
                try {
                    const res = await getPolicyPermissions(pol.id)
                    grantedMap.set(pol.id, new Set((res.data ?? []).map((r: any) => r.permission_id)))
                } catch {
                    grantedMap.set(pol.id, new Set())
                }
            }))
            granted = grantedMap

            if (!selectedId && policies.length > 0) selectedId = policies[0].id
            if (selectedId) await loadAssignments()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load policies'
        } finally {
            loading = false
        }
    }

    async function loadAssignments() {
        if (!selectedId) return
        try {
            const res = await listPolicyAssignments(selectedId)
            assignments = res.data ?? []
        } catch {
            assignments = []
        }
    }

    async function selectPolicy(id: string) {
        selectedId = id
        assignments = []
        await loadAssignments()
    }

    async function savePolicy(id: string) {
        const permIds = [...(pending.get(id) ?? granted.get(id) ?? [])]
        const s = new Set(saving); s.add(id); saving = s; error = ''
        try {
            await setPolicyPermissions(id, permIds)
            const ng = new Map(granted); ng.set(id, new Set(permIds)); granted = ng
            const np = new Map(pending); np.delete(id); pending = np
            setSuccess(`Policy "${policies.find(p => p.id === id)?.name ?? id}" permissions saved`)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save permissions'
        } finally {
            const s2 = new Set(saving); s2.delete(id); saving = s2
        }
    }

    async function saveAll() {
        for (const id of dirtyPolicyIds) await savePolicy(id)
    }

    async function handleCreatePolicy() {
        if (!newPolicySlug.trim() || !newPolicyName.trim()) return
        creatingPolicy = true; error = ''
        try {
            const res = await createPolicy({ slug: newPolicySlug.trim(), name: newPolicyName.trim(), description: newPolicyDesc.trim() || undefined })
            policies = [...policies, res.data]
            granted = new Map([...granted, [res.data.id, new Set()]])
            await selectPolicy(res.data.id)
            showNewPolicyForm = false; newPolicySlug = ''; newPolicyName = ''; newPolicyDesc = ''
            setSuccess(`Policy "${res.data.name}" created`)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create policy'
        } finally {
            creatingPolicy = false
        }
    }

    async function handleDeletePolicy(id: string) {
        const pol = policies.find(p => p.id === id)
        if (!pol || pol.isSystem) return
        if (!confirm(`Delete policy "${pol.name}"? All assignments will be removed.`)) return
        deletingId = id; error = ''
        try {
            await deletePolicy(id)
            policies = policies.filter(p => p.id !== id)
            if (selectedId === id) {
                selectedId = policies[0]?.id ?? ''
                assignments = []
                if (selectedId) await loadAssignments()
            }
            const ng = new Map(granted); ng.delete(id); granted = ng
            const np = new Map(pending); np.delete(id); pending = np
            setSuccess(`Policy "${pol.name}" deleted`)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete policy'
        } finally {
            deletingId = ''
        }
    }

    async function handleAddAssignment() {
        if (!selectedId || !newAssignPrincipalId) return
        assignLoading = true; error = ''
        try {
            await addPolicyAssignment(selectedId, {
                principalType: newAssignPrincipalType,
                principalId:   newAssignPrincipalId,
                scopeType:     newAssignScopeType,
                scopeOuId:     newAssignScopeType === 'OU' && newAssignScopeOuId ? newAssignScopeOuId : undefined,
                scopeResource: newAssignScopeType === 'RESOURCE' && newAssignScopeResource ? newAssignScopeResource : undefined,
                effect:        newAssignEffect,
                inherit:       newAssignInherit,
            })
            await loadAssignments()
            newAssignPrincipalId = ''; newAssignScopeOuId = ''; newAssignScopeResource = ''
            setSuccess('Assignment added')
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add assignment'
        } finally {
            assignLoading = false
        }
    }

    async function handleRemoveAssignment(assignmentId: string) {
        if (!selectedId) return
        removingAssignmentId = assignmentId; error = ''
        try {
            await removePolicyAssignment(selectedId, assignmentId)
            assignments = assignments.filter(a => a.id !== assignmentId)
            setSuccess('Assignment removed')
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to remove assignment'
        } finally {
            removingAssignmentId = ''
        }
    }

    async function handleBulkOuAssign() {
        if (!selectedId || !bulkOuId) return
        bulkLoading = true; error = ''
        try {
            const res = await bulkAssignPolicyToOu(selectedId, { ouId: bulkOuId, includeSubOUs: bulkSubOUs, effect: bulkEffect })
            await loadAssignments()
            bulkOuId = ''
            setSuccess(`Bulk assigned to ${res.data.inserted} users`)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to bulk assign'
        } finally {
            bulkLoading = false
        }
    }

    onMount(() => { void loadAll() })
</script>

<div class="card" data-testid="policy-panel">
    <!-- Panel header -->
    <div class="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-surface-3">
        <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <UserCheck class="w-5 h-5 text-violet-400" />
            </div>
            <div>
                <h3 class="text-base font-semibold text-white leading-tight">Unified Policy System</h3>
                <p class="text-xs text-slate-500">{policies.length} policies · {permissions.length} permissions — replaces Classic Roles + AD ACL</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            {#if dirtyPolicyIds.length > 0}
                <span class="badge badge-yellow text-xs">{dirtyPolicyIds.length} unsaved</span>
                <Button onclick={saveAll} disabled={saving.size > 0}>
                    <Save class="w-4 h-4 mr-1.5" />Save all
                </Button>
            {/if}
            <Button variant="secondary" onclick={loadAll} disabled={loading}>
                <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
            </Button>
        </div>
    </div>

    {#if error}<div class="alert alert-error mt-3 text-sm">{error}</div>{/if}
    {#if successMsg}<div class="alert alert-success mt-3 text-sm">{successMsg}</div>{/if}

    {#if loading}
        <div class="mt-12 flex flex-col items-center gap-3 text-slate-500">
            <RefreshCw class="w-8 h-8 animate-spin" />
            <p class="text-sm">Loading policies...</p>
        </div>
    {:else}
        <div class="mt-4 flex gap-0 rounded-xl border border-surface-3 overflow-hidden" style="min-height:640px">

            <!-- ── LEFT: Policy list ─────────────────────────────────── -->
            <div class="w-60 flex-shrink-0 bg-surface-2 border-r border-surface-3 flex flex-col">
                <!-- Pane title + New button -->
                <div class="px-3 py-2 border-b border-surface-3 bg-surface-3/40 flex items-center justify-between">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield class="w-3 h-3" /> Policies
                    </p>
                    <button
                        type="button"
                        class="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/15 transition-colors"
                        title="Create new policy"
                        onclick={() => { showNewPolicyForm = !showNewPolicyForm }}
                    >
                        {#if showNewPolicyForm}<X class="w-3 h-3" />{:else}<Plus class="w-3 h-3" />{/if}
                    </button>
                </div>

                <!-- New Policy inline form -->
                {#if showNewPolicyForm}
                    <div class="px-3 py-2 border-b border-surface-3 bg-primary/5 space-y-1.5">
                        <input class="input-base py-1 text-xs w-full font-mono" placeholder="slug (e.g. helpdesk)" bind:value={newPolicySlug} />
                        <input class="input-base py-1 text-xs w-full" placeholder="Display name" bind:value={newPolicyName} />
                        <input class="input-base py-1 text-xs w-full" placeholder="Description (optional)" bind:value={newPolicyDesc} />
                        <button
                            type="button"
                            class="w-full text-xs py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 disabled:opacity-50"
                            disabled={!newPolicySlug.trim() || !newPolicyName.trim() || creatingPolicy}
                            onclick={handleCreatePolicy}
                        >
                            {creatingPolicy ? 'Creating...' : 'Create Policy'}
                        </button>
                    </div>
                {/if}

                <!-- Policy list items -->
                <div class="flex-1 overflow-y-auto py-1">
                    {#each policies as pol}
                        {@const sel   = selectedId === pol.id}
                        {@const dirty = pending.has(pol.id)}
                        {@const rc    = policyGrantedCount(pol.id)}
                        {@const pct   = totalCount > 0 ? Math.round(rc / totalCount * 100) : 0}
                        <div
                            role="button"
                            tabindex="0"
                            class="w-full text-left px-3 py-2.5 transition-colors border-r-2 group cursor-pointer
                                {sel ? 'bg-primary/12 border-primary' : 'hover:bg-surface-3/50 border-transparent'}"
                            onclick={() => { void selectPolicy(pol.id) }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') void selectPolicy(pol.id) }}
                        >
                            <div class="flex items-center justify-between gap-1">
                                <div class="flex items-center gap-2 min-w-0">
                                    {#if dirty}
                                        <span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
                                    {:else if sel}
                                        <span class="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                                    {:else}
                                        <span class="w-2 h-2 rounded-full border border-slate-600 flex-shrink-0"></span>
                                    {/if}
                                    <span class="text-sm font-medium truncate {sel ? 'text-white' : 'text-slate-300'}">
                                        {pol.name}
                                    </span>
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                    <span class="text-xs text-slate-500">{rc}</span>
                                    {#if !pol.isSystem}
                                        <button
                                            type="button"
                                            class="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                            title="Delete policy"
                                            disabled={deletingId === pol.id}
                                            onclick={(e) => { e.stopPropagation(); void handleDeletePolicy(pol.id) }}
                                        >
                                            <Trash2 class="w-3 h-3" />
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            <div class="mt-0.5 ml-4 flex items-center gap-1.5 text-xs text-slate-600">
                                <span class="font-mono">{pol.slug}</span>
                                {#if pol.isSystem}<span class="text-slate-700">· sys</span>{/if}
                            </div>
                            <div class="mt-1.5 ml-4 h-0.5 rounded-full bg-surface-3 overflow-hidden">
                                <div
                                    class="h-full rounded-full transition-all duration-300 {sel ? 'bg-primary' : 'bg-slate-600'}"
                                    style="width:{pct}%"
                                ></div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Footer -->
                <div class="px-3 py-2 border-t border-surface-3 bg-surface-3/20">
                    <p class="text-xs text-slate-600 flex items-center gap-1">
                        <Lock class="w-3 h-3" /> {policies.filter(p => p.isSystem).length} system · {policies.filter(p => !p.isSystem).length} custom
                    </p>
                </div>
            </div>

            <!-- ── RIGHT: Policy detail ──────────────────────────────── -->
            <div class="flex-1 min-w-0 flex flex-col bg-surface-2/20">
                {#if selectedPolicy}
                    <!-- Right sub-tab bar -->
                    <div class="px-5 pt-3 border-b border-surface-3 flex items-end gap-0">
                        <div class="flex-1 min-w-0 mb-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="text-sm font-semibold text-white">{selectedPolicy.name}</h4>
                                <span class="text-xs text-slate-500 font-mono bg-surface-3 px-1.5 py-0.5 rounded">{selectedPolicy.slug}</span>
                                {#if isDirty}
                                    <span class="badge badge-yellow text-xs">Unsaved</span>
                                {:else}
                                    <span class="badge badge-blue text-xs">Synced</span>
                                {/if}
                            </div>
                        </div>
                        <div class="flex gap-0 ml-4">
                            <button
                                type="button"
                                class="px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors
                                    {rightTab === 'permissions'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'}"
                                onclick={() => { rightTab = 'permissions' }}
                            >
                                <Shield class="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Permissions ({grantedCount}/{totalCount})
                            </button>
                            <button
                                type="button"
                                class="px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors
                                    {rightTab === 'assignments'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'}"
                                onclick={() => { rightTab = 'assignments' }}
                            >
                                <Users class="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Assignments ({assignments.length})
                            </button>
                        </div>
                    </div>

                    <!-- ── PERMISSIONS tab ─────────────────────────────── -->
                    {#if rightTab === 'permissions'}
                        <!-- Toolbar -->
                        <div class="px-5 py-2.5 border-b border-surface-3 flex items-center gap-2 flex-wrap bg-surface-3/10">
                            <div class="relative flex-1 min-w-40">
                                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input class="input-base pl-8 py-1.5 text-xs w-full" placeholder="Search permissions..." bind:value={searchQuery} />
                            </div>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 border border-emerald-800/50" onclick={() => toggleAll(true)}>+ All</button>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 border border-red-800/50" onclick={() => toggleAll(false)}>Clear</button>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-surface-3 text-slate-400 hover:bg-surface-3/80 border border-surface-3" onclick={expandAll}>Expand</button>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-surface-3 text-slate-400 hover:bg-surface-3/80 border border-surface-3" onclick={collapseAll}>Collapse</button>
                            <label class="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 select-none">
                                <input type="checkbox" bind:checked={showOnlyDiff} />Only changes
                            </label>
                            {#if isDirty}
                                <div class="flex items-center gap-2 ml-auto">
                                    <Button onclick={() => savePolicy(selectedId)} disabled={saving.has(selectedId)}>
                                        <Save class="w-4 h-4 mr-1.5" />{saving.has(selectedId) ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button variant="secondary" onclick={() => revert(selectedId)}>
                                        <RotateCcw class="w-4 h-4" />
                                    </Button>
                                </div>
                            {/if}
                        </div>

                        <!-- Progress bar -->
                        <div class="px-5 py-1.5 border-b border-surface-3/40 flex items-center gap-3">
                            <span class="text-xs text-slate-500">
                                <CircleCheck class="w-3.5 h-3.5 text-emerald-400 inline mr-0.5" />{grantedCount}/{totalCount}
                            </span>
                            {#if changedCount > 0}
                                <span class="text-xs text-amber-400">{changedCount} pending changes</span>
                            {/if}
                            <div class="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                                <div class="h-full rounded-full bg-emerald-500/70 transition-all duration-300"
                                    style="width:{totalCount > 0 ? Math.round(grantedCount / totalCount * 100) : 0}%"></div>
                            </div>
                        </div>

                        <!-- Permission tree -->
                        <div class="flex-1 overflow-y-auto">
                            {#if filteredGroups.length === 0}
                                <div class="py-12 text-center text-slate-500 text-sm">
                                    {searchQuery ? `No results for "${searchQuery}"` : showOnlyDiff ? 'No changes' : 'No permissions'}
                                </div>
                            {/if}

                            {#each filteredGroups as { resource, perms } (resource)}
                                {@const meta = resourceMeta[resource] ?? { Icon: Settings, color: 'text-slate-400', bg: 'bg-slate-800/20' }}
                                {@const GroupIcon = meta.Icon}
                                {@const state = groupState(resource)}
                                {@const expanded  = expandedGroups.has(resource)}
                                {@const gInGroup  = permissions.filter(p => p.resource === resource && effectiveSet.has(p.id)).length}
                                {@const allInGroup = permissions.filter(p => p.resource === resource).length}

                                <div class="border-b border-surface-3/40 last:border-0">
                                    <div
                                        class="flex items-center gap-0 px-3 py-2 cursor-pointer group transition-colors
                                            {expanded ? meta.bg : 'hover:bg-surface-3/30'}"
                                        role="button"
                                        tabindex="0"
                                        onclick={() => toggleExpand(resource)}
                                        onkeydown={(e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggleExpand(resource) } }}
                                        aria-expanded={expanded}
                                    >
                                        <span class="w-5 h-5 flex items-center justify-center text-slate-500 flex-shrink-0">
                                            {#if expanded}<ChevronDown class="w-3.5 h-3.5" />{:else}<ChevronRight class="w-3.5 h-3.5" />{/if}
                                        </span>
                                        <button
                                            type="button"
                                            class="w-5 h-5 mx-2 rounded flex items-center justify-center border flex-shrink-0 transition-all
                                                {state === 'all'
                                                    ? 'bg-primary/25 border-primary text-primary'
                                                    : state === 'partial'
                                                        ? 'bg-amber-900/50 border-amber-500 text-amber-400'
                                                        : 'bg-surface-3 border-slate-600 text-slate-600 hover:border-slate-400 hover:text-slate-400'}"
                                            onclick={(e) => { e.stopPropagation(); toggleGroup(resource) }}
                                            onkeydown={(e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.stopPropagation(); toggleGroup(resource) } }}
                                        >
                                            {#if state === 'all'}<CheckSquare class="w-3.5 h-3.5" />{:else if state === 'partial'}<Minus class="w-3.5 h-3.5" />{:else}<Square class="w-3.5 h-3.5" />{/if}
                                        </button>
                                        <GroupIcon class="w-4 h-4 {meta.color} flex-shrink-0 mr-2" />
                                        <span class="text-sm font-semibold flex-1 min-w-0 truncate {expanded ? meta.color : 'text-slate-200'}">
                                            {$isLoading ? resource : $_('adminRbac.resources.' + resource, { default: resource })}
                                        </span>
                                        <span class="ml-auto flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border
                                            {state === 'all'
                                                ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400'
                                                : state === 'partial'
                                                    ? 'bg-amber-900/40 border-amber-700/50 text-amber-400'
                                                    : 'bg-surface-3 border-slate-700 text-slate-500'}">
                                            {gInGroup}/{allInGroup}
                                        </span>
                                    </div>

                                    {#if expanded}
                                        <div class="border-t border-surface-3/25">
                                            {#each perms as perm (perm.id)}
                                                {@const checked  = effectiveSet.has(perm.id)}
                                                {@const changed  = isChanged(perm.id)}
                                                {@const am = actionMeta[perm.action] ?? { cls: 'bg-slate-800 text-slate-400 border-slate-700' }}
                                                <div
                                                    class="flex items-start gap-0 px-3 py-2 border-b border-surface-3/15 last:border-0
                                                        cursor-pointer transition-colors group
                                                        {changed ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'hover:bg-surface-3/25'}"
                                                    role="checkbox"
                                                    aria-checked={checked}
                                                    tabindex="0"
                                                    onclick={() => togglePermission(perm.id)}
                                                    onkeydown={(e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); togglePermission(perm.id) } }}
                                                >
                                                    <div class="w-5 flex-shrink-0 flex justify-center relative">
                                                        <div class="absolute top-0 bottom-0 left-1/2 w-px bg-surface-3 -translate-x-1/2"></div>
                                                    </div>
                                                    <div class="w-5 flex-shrink-0 relative mt-2.5">
                                                        <div class="absolute top-0 left-0 w-full h-px bg-surface-3"></div>
                                                    </div>
                                                    <div class="w-5 h-5 mx-2 mt-0.5 rounded flex items-center justify-center border flex-shrink-0 transition-all duration-150
                                                        {checked
                                                            ? `bg-primary/20 border-primary ${changed ? 'ring-1 ring-amber-400/70' : ''}`
                                                            : `bg-surface-3/50 border-slate-600 group-hover:border-slate-400 ${changed ? 'ring-1 ring-amber-400/70' : ''}`}">
                                                        {#if checked}
                                                            <CircleCheck class="w-3 h-3 text-primary" />
                                                        {:else}
                                                            <CircleX class="w-3 h-3 text-slate-600 group-hover:text-slate-500" />
                                                        {/if}
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="flex items-center gap-2 flex-wrap">
                                                            <code class="text-xs font-mono {checked ? 'text-slate-200' : 'text-slate-400'}">{perm.name}</code>
                                                            <span class="text-xs px-1.5 py-0.5 rounded border font-medium {am.cls}">
                                                                {$isLoading ? perm.action : $_('adminRbac.actions.' + perm.action, { default: perm.action })}
                                                            </span>
                                                            {#if changed}
                                                                <span class="text-xs text-amber-400 font-medium">
                                                                    {checked ? '(+) Just granted' : '(−) Just revoked'}
                                                                </span>
                                                            {/if}
                                                        </div>
                                                        {#if perm.description}
                                                            <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">{perm.description}</p>
                                                        {/if}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <!-- Legend -->
                        <div class="px-5 py-2 border-t border-surface-3 bg-surface-3/20 flex flex-wrap items-center gap-x-5 gap-y-1">
                            <div class="flex items-center gap-1.5 text-xs text-slate-500"><CheckSquare class="w-3.5 h-3.5 text-primary" /> Full grant</div>
                            <div class="flex items-center gap-1.5 text-xs text-slate-500"><Minus class="w-3.5 h-3.5 text-amber-400" /> Partial</div>
                            <div class="flex items-center gap-1.5 text-xs text-slate-500"><Square class="w-3.5 h-3.5 text-slate-600" /> None</div>
                            <div class="flex items-center gap-1.5 text-xs text-slate-500"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Unsaved</div>
                            <div class="flex items-center gap-1.5 text-xs text-slate-600 ml-auto"><Info class="w-3 h-3" /> Click to toggle · Ctrl+click group</div>
                        </div>

                    <!-- ── ASSIGNMENTS tab ───────────────────────────── -->
                    {:else}
                        <div class="flex-1 overflow-y-auto flex flex-col">
                            <!-- Add assignment form -->
                            <div class="px-5 py-4 border-b border-surface-3 bg-surface-3/10">
                                <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Link class="w-3 h-3" /> Add assignment
                                </p>
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <!-- Principal type -->
                                    <label class="space-y-1">
                                        <span class="text-xs text-slate-500">Principal type</span>
                                        <select class="select-base text-xs w-full" bind:value={newAssignPrincipalType}>
                                            <option value="USER">User</option>
                                            <option value="GROUP">Group</option>
                                            <option value="OU">Org Unit (OU)</option>
                                        </select>
                                    </label>

                                    <!-- Principal selector -->
                                    <label class="space-y-1">
                                        <span class="text-xs text-slate-500">
                                            {newAssignPrincipalType === 'USER' ? 'Select user' : newAssignPrincipalType === 'GROUP' ? 'Select group' : 'Select OU'}
                                        </span>
                                        <select class="select-base text-xs w-full" bind:value={newAssignPrincipalId}>
                                            <option value="">— Select —</option>
                                            {#if newAssignPrincipalType === 'USER'}
                                                {#each principals.users as u}
                                                    <option value={u.id}>{u.name} ({u.email})</option>
                                                {/each}
                                            {:else if newAssignPrincipalType === 'GROUP'}
                                                {#each principals.groups as g}
                                                    <option value={g.id}>{g.name}</option>
                                                {/each}
                                            {:else}
                                                {#each principals.ous as ou}
                                                    <option value={ou.id}>{ou.path}</option>
                                                {/each}
                                            {/if}
                                        </select>
                                    </label>

                                    <!-- Scope -->
                                    <label class="space-y-1">
                                        <span class="text-xs text-slate-500">Scope</span>
                                        <select class="select-base text-xs w-full" bind:value={newAssignScopeType}>
                                            <option value="GLOBAL">Global (everywhere)</option>
                                            <option value="OU">OU subtree</option>
                                            <option value="RESOURCE">Specific resource</option>
                                        </select>
                                    </label>

                                    <!-- Scope OU (conditional) -->
                                    {#if newAssignScopeType === 'OU'}
                                        <label class="space-y-1">
                                            <span class="text-xs text-slate-500">Scope OU</span>
                                            <select class="select-base text-xs w-full" bind:value={newAssignScopeOuId}>
                                                <option value="">— Select OU —</option>
                                                {#each principals.ous as ou}
                                                    <option value={ou.id}>{ou.path}</option>
                                                {/each}
                                            </select>
                                        </label>
                                    {/if}

                                    <!-- Scope Resource (conditional) -->
                                    {#if newAssignScopeType === 'RESOURCE'}
                                        <label class="space-y-1">
                                            <span class="text-xs text-slate-500">Resource key</span>
                                            <input class="input-base text-xs w-full" placeholder="e.g. assets:123" bind:value={newAssignScopeResource} />
                                        </label>
                                    {/if}

                                    <!-- Effect -->
                                    <label class="space-y-1">
                                        <span class="text-xs text-slate-500">Effect</span>
                                        <select class="select-base text-xs w-full" bind:value={newAssignEffect}>
                                            <option value="ALLOW">ALLOW</option>
                                            <option value="DENY">DENY (overrides ALLOW)</option>
                                        </select>
                                    </label>
                                </div>

                                <div class="mt-3 flex items-center gap-3">
                                    <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                                        <input type="checkbox" bind:checked={newAssignInherit} />
                                        Inherit to sub-OUs
                                    </label>
                                    <button
                                        type="button"
                                        class="btn btn-primary text-xs py-1.5"
                                        disabled={!newAssignPrincipalId || assignLoading}
                                        onclick={handleAddAssignment}
                                    >
                                        {assignLoading ? 'Adding...' : 'Add Assignment'}
                                    </button>
                                </div>
                            </div>

                            <!-- Assignments table -->
                            <div class="flex-1 overflow-auto">
                                {#if assignments.length === 0}
                                    <div class="py-12 text-center text-slate-500 text-sm">
                                        No assignments yet. Use the form above to grant or deny this policy to users, groups, or OUs.
                                    </div>
                                {:else}
                                    <table class="data-table w-full text-xs">
                                        <thead>
                                            <tr>
                                                <th>Principal</th>
                                                <th>Scope</th>
                                                <th>Effect</th>
                                                <th>Inherit</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each assignments as a}
                                                <tr>
                                                    <td>
                                                        <div class="flex items-center gap-1.5">
                                                            {#if a.principalType === 'USER'}
                                                                <Users class="w-3.5 h-3.5 text-blue-400" />
                                                            {:else if a.principalType === 'GROUP'}
                                                                <Users class="w-3.5 h-3.5 text-violet-400" />
                                                            {:else}
                                                                <Building2 class="w-3.5 h-3.5 text-amber-400" />
                                                            {/if}
                                                            <span class="text-slate-200">{a.principalName ?? a.principalId}</span>
                                                            <span class="badge text-xs px-1 py-0 bg-surface-3 text-slate-500">{a.principalType}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="flex items-center gap-1.5">
                                                            {#if a.scopeType === 'GLOBAL'}
                                                                <Globe class="w-3.5 h-3.5 text-slate-400" />
                                                                <span class="text-slate-400">Global</span>
                                                            {:else if a.scopeType === 'OU'}
                                                                <Building2 class="w-3.5 h-3.5 text-amber-400" />
                                                                <span class="text-slate-300" title={a.scopeOuId ?? ''}>{ouLabel(a.scopeOuId)}</span>
                                                            {:else}
                                                                <FileText class="w-3.5 h-3.5 text-sky-400" />
                                                                <span class="font-mono text-sky-300">{a.scopeResource}</span>
                                                            {/if}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {#if a.effect === 'ALLOW'}
                                                            <span class="badge badge-green text-xs">ALLOW</span>
                                                        {:else}
                                                            <span class="badge badge-red text-xs">DENY</span>
                                                        {/if}
                                                    </td>
                                                    <td>
                                                        <span class="text-slate-500">{a.inherit ? 'Yes' : 'No'}</span>
                                                    </td>
                                                    <td class="text-right">
                                                        <button
                                                            type="button"
                                                            class="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors ml-auto"
                                                            title="Remove assignment"
                                                            disabled={removingAssignmentId === a.id}
                                                            onclick={() => { void handleRemoveAssignment(a.id) }}
                                                        >
                                                            <Unlink class="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                {/if}
                            </div>

                            <!-- Bulk OU assign -->
                            <div class="px-5 py-3 border-t border-surface-3 bg-amber-950/10">
                                <p class="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Building2 class="w-3 h-3" /> Bulk assign to OU
                                </p>
                                <div class="flex gap-3 flex-wrap items-end">
                                    <label class="space-y-1 flex-1 min-w-40">
                                        <span class="text-xs text-slate-500">Org Unit</span>
                                        <select class="select-base text-xs w-full" bind:value={bulkOuId}>
                                            <option value="">— Chọn OU —</option>
                                            {#each principals.ous as ou}
                                                <option value={ou.id}>{ou.path}</option>
                                            {/each}
                                        </select>
                                    </label>
                                    <label class="space-y-1">
                                        <span class="text-xs text-slate-500">Effect</span>
                                        <select class="select-base text-xs" bind:value={bulkEffect}>
                                            <option value="ALLOW">ALLOW</option>
                                            <option value="DENY">DENY</option>
                                        </select>
                                    </label>
                                    <label class="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none pb-1.5">
                                        <input type="checkbox" bind:checked={bulkSubOUs} />Include sub-OUs
                                    </label>
                                    <button
                                        type="button"
                                        class="btn btn-primary text-xs py-1.5"
                                        disabled={!bulkOuId || bulkLoading}
                                        onclick={handleBulkOuAssign}
                                    >
                                        {bulkLoading ? 'Assigning...' : 'Bulk Assign'}
                                    </button>
                                </div>
                            </div>

                            <!-- Info banner -->
                            <div class="px-5 py-2 border-t border-surface-3 bg-surface-3/20 text-xs text-slate-500 flex items-start gap-2">
                                <Info class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <p>DENY always overrides ALLOW. Principal types: USER = system user, GROUP = AD directory group, OU = all users in that org unit. Scope: GLOBAL applies everywhere; OU applies within a subtree; RESOURCE limits to a specific resource key.</p>
                            </div>
                        </div>
                    {/if}

                {:else}
                    <div class="flex-1 flex items-center justify-center text-slate-500 text-sm">
                        Select a policy from the left panel
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
