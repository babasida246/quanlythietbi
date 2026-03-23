<script lang="ts">
    import { onMount } from 'svelte'
    import { _, isLoading } from '$lib/i18n'
    import {
        listPolicies, createPolicy, updatePolicy, deletePolicy,
        listPolicyPermissionCatalog, getPolicyPermissions, setPolicyPermissions,
        listPolicyAssignments, addPolicyAssignment, removePolicyAssignment,
        listPolicyPrincipals, bulkAssignPolicyToOu,
        type Policy, type PolicyAssignment, type PolicyPrincipal,
    } from '$lib/api/admin'
    import type { RbacPermission } from '$lib/api/admin'
    import { effectivePermsStore } from '$lib/stores/effectivePermsStore'
    import {
        Laptop, FolderTree, Network, Package, ClipboardList, Key, Puzzle,
        FlaskConical, Cpu, ArrowLeftRight, FileText, Wrench, BarChart3,
        TrendingUp, TrendingDown, Tag, Files, Zap, Plug, Shield, Settings,
        Search, Users, CircleCheck, CircleX, Lock, LayoutDashboard,
        Plus, Trash2, X, Globe, Building2, Unlink, ShieldCheck,
        Save, RotateCcw, ChevronDown, ChevronRight, CheckSquare2,
    } from 'lucide-svelte'

    // ── Data ──────────────────────────────────────────────────────────────────
    let policies    = $state<Policy[]>([])
    let catalog     = $state<RbacPermission[]>([])
    let principals  = $state<PolicyPrincipal>({ users: [], groups: [], ous: [] })
    let granted     = $state<Map<string, Set<string>>>(new Map())
    let pending     = $state<Map<string, Set<string>>>(new Map())
    let assignments = $state<PolicyAssignment[]>([])

    let loading     = $state(true)
    let saving      = $state<Set<string>>(new Set())
    let error       = $state('')
    let successMsg  = $state('')

    // ── Policy CRUD form ──────────────────────────────────────────────────────
    let showNewForm  = $state(false)
    let newSlug      = $state('')
    let newName      = $state('')
    let newDesc      = $state('')
    let creating     = $state(false)
    let deletingId   = $state('')
    let editingId    = $state('')
    let editName     = $state('')
    let editDesc     = $state('')
    let editSaving   = $state(false)

    // ── UI state ──────────────────────────────────────────────────────────────
    let selectedId   = $state('')
    let rightTab     = $state<'permissions' | 'assignments'>('permissions')
    let searchQuery  = $state('')
    let searchPolicy = $state('')

    // ── Assignment form ───────────────────────────────────────────────────────
    let assignLoading        = $state(false)
    let removingAssignId     = $state('')
    let newAssignType        = $state<'USER' | 'GROUP' | 'OU'>('USER')
    let newAssignId          = $state('')
    let newAssignScope       = $state<'GLOBAL' | 'OU' | 'RESOURCE'>('GLOBAL')
    let newAssignOuId        = $state('')
    let newAssignEffect      = $state<'ALLOW' | 'DENY'>('ALLOW')
    let newAssignInherit     = $state(true)
    let bulkOuId             = $state('')
    let bulkEffect           = $state<'ALLOW' | 'DENY'>('ALLOW')
    let bulkSubOUs           = $state(true)
    let bulkLoading          = $state(false)

    // ── Derived ───────────────────────────────────────────────────────────────
    const selectedPolicy = $derived(policies.find(p => p.id === selectedId) ?? null)

    const effectiveSet = $derived.by<Set<string>>(() =>
        pending.get(selectedId) ?? granted.get(selectedId) ?? new Set()
    )
    const isDirty = $derived(pending.has(selectedId))

    // Resources excluded from the policy chip picker
    // (site:show:* removed by migration 062; tool:* are dangerous system-only perms)
    const EXCLUDED_RESOURCES = new Set(['site', 'tool'])

    const groupedPerms = $derived.by(() => {
        const map = new Map<string, RbacPermission[]>()
        for (const p of catalog) {
            if (EXCLUDED_RESOURCES.has(p.resource)) continue
            const list = map.get(p.resource) ?? []
            list.push(p)
            map.set(p.resource, list)
        }
        return Array.from(map.entries())
            .map(([resource, perms]) => ({
                resource,
                perms: perms.sort((a, b) => actionOrder(a.action) - actionOrder(b.action)),
            }))
            .filter(g => !searchQuery || g.resource.includes(searchQuery.toLowerCase()) ||
                g.perms.some(p => p.action.includes(searchQuery.toLowerCase())))
            .sort((a, b) => a.resource.localeCompare(b.resource))
    })

    const filteredPolicies = $derived.by(() => {
        const q = searchPolicy.trim().toLowerCase()
        if (!q) return policies
        return policies.filter(p =>
            p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
        )
    })

    const assignablePrincipals = $derived.by(() => {
        if (newAssignType === 'USER') return principals.users.map(u => ({ id: u.id, label: `${u.name} (${u.email})` }))
        if (newAssignType === 'GROUP') return principals.groups.map(g => ({ id: g.id, label: g.name }))
        return principals.ous.map(o => ({ id: o.id, label: o.path }))
    })

    // ── Helpers ───────────────────────────────────────────────────────────────
    function actionOrder(a: string): number {
        const o: Record<string, number> = { read:0,create:1,update:2,delete:3,manage:4,approve:5,export:6,import:7,assign:8,upload:9,users:10,roles:11,settings:12 }
        return o[a] ?? 99
    }

    function grantedInGroup(resource: string) {
        return catalog.filter(p => p.resource === resource && effectiveSet.has(p.id)).length
    }
    function totalInGroup(resource: string) {
        return catalog.filter(p => p.resource === resource).length
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
        const ids = catalog.filter(p => p.resource === resource).map(p => p.id)
        const ws = getWS(selectedId)
        const g = grantedInGroup(resource), t = totalInGroup(resource)
        if (g === t) { for (const id of ids) ws.delete(id) }
        else         { for (const id of ids) ws.add(id) }
        commitPending(selectedId, ws)
    }
    function toggleAll(grant: boolean) {
        if (!selectedId) return
        commitPending(selectedId, grant ? new Set(catalog.map(p => p.id)) : new Set())
    }
    function revert(id: string) {
        const m = new Map(pending); m.delete(id); pending = m
    }
    function setSuccess(msg: string) {
        successMsg = msg
        setTimeout(() => { if (successMsg === msg) successMsg = '' }, 3500)
    }
    function ouLabel(ouId: string | null): string {
        if (!ouId) return 'OU'
        return principals.ous.find(o => o.id === ouId)?.path ?? ouId
    }

    // ── Resource / action meta ────────────────────────────────────────────────
    const resourceMeta: Record<string, { Icon: any; color: string }> = {
        assets:       { Icon: Laptop,          color: 'text-blue-400'    },
        categories:   { Icon: FolderTree,      color: 'text-violet-400'  },
        cmdb:         { Icon: Network,         color: 'text-cyan-400'    },
        warehouse:    { Icon: Package,         color: 'text-amber-400'   },
        inventory:    { Icon: ClipboardList,   color: 'text-emerald-400' },
        licenses:     { Icon: Key,             color: 'text-yellow-400'  },
        accessories:  { Icon: Puzzle,          color: 'text-pink-400'    },
        consumables:  { Icon: FlaskConical,    color: 'text-orange-400'  },
        components:   { Icon: Cpu,             color: 'text-teal-400'    },
        checkout:     { Icon: ArrowLeftRight,  color: 'text-indigo-400'  },
        requests:     { Icon: FileText,        color: 'text-sky-400'     },
        maintenance:  { Icon: Wrench,          color: 'text-red-400'     },
        reports:      { Icon: BarChart3,       color: 'text-lime-400'    },
        analytics:    { Icon: TrendingUp,      color: 'text-green-400'   },
        depreciation: { Icon: TrendingDown,    color: 'text-slate-400'   },
        labels:       { Icon: Tag,             color: 'text-rose-400'    },
        documents:    { Icon: Files,           color: 'text-zinc-400'    },
        automation:   { Icon: Zap,             color: 'text-yellow-300'  },
        integrations: { Icon: Plug,            color: 'text-purple-400'  },
        security:     { Icon: Shield,          color: 'text-red-500'     },
        admin:        { Icon: Settings,        color: 'text-rose-400'    },
        rbac:         { Icon: Lock,            color: 'text-indigo-400'  },
        tool:         { Icon: Settings,        color: 'text-gray-400'    },
        site:         { Icon: LayoutDashboard, color: 'text-sky-300'     },
    }

    const actionCls: Record<string, string> = {
        read:     'bg-sky-900/70 text-sky-300 border-sky-700/60',
        create:   'bg-emerald-900/70 text-emerald-300 border-emerald-700/60',
        update:   'bg-amber-900/70 text-amber-300 border-amber-700/60',
        delete:   'bg-red-900/70 text-red-300 border-red-700/60',
        manage:   'bg-orange-900/70 text-orange-300 border-orange-700/60',
        approve:  'bg-violet-900/70 text-violet-300 border-violet-700/60',
        export:   'bg-cyan-900/70 text-cyan-300 border-cyan-700/60',
        import:   'bg-teal-900/70 text-teal-300 border-teal-700/60',
        assign:   'bg-blue-900/70 text-blue-300 border-blue-700/60',
        upload:   'bg-teal-900/70 text-teal-300 border-teal-700/60',
        users:    'bg-indigo-900/70 text-indigo-300 border-indigo-700/60',
        roles:    'bg-purple-900/70 text-purple-300 border-purple-700/60',
        settings: 'bg-rose-900/70 text-rose-300 border-rose-700/60',
    }

    // ── Load / Save ───────────────────────────────────────────────────────────
    async function loadAll() {
        loading = true; error = ''; pending = new Map()
        try {
            const [polRes, permsRes, principalsRes] = await Promise.all([
                listPolicies(),
                listPolicyPermissionCatalog(),
                listPolicyPrincipals().catch(() => ({ data: { users: [], groups: [], ous: [] } })),
            ])
            policies   = polRes.data
            catalog    = permsRes.data
            principals = principalsRes.data
        } catch (e: any) {
            error = e?.message ?? 'Failed to load'
        } finally {
            loading = false
        }
    }

    async function selectPolicy(id: string) {
        selectedId = id; rightTab = 'permissions'
        if (!granted.has(id)) {
            try {
                const [permsRes, assignRes] = await Promise.all([
                    getPolicyPermissions(id),
                    listPolicyAssignments(id),
                ])
                const m = new Map(granted)
                m.set(id, new Set(permsRes.data.map((p: any) => p.permission_id)))
                granted = m
                assignments = assignRes.data
            } catch { /* ignore */ }
        } else {
            assignments = (await listPolicyAssignments(id)).data
        }
    }

    async function savePolicy(id: string) {
        const ws = pending.get(id); if (!ws) return
        const s = new Set(saving); s.add(id); saving = s
        try {
            await setPolicyPermissions(id, [...ws])
            const m = new Map(granted); m.set(id, ws); granted = m
            const pm = new Map(pending); pm.delete(id); pending = pm
            // Update permission count in list
            policies = policies.map(p => p.id === id ? { ...p, permissionCount: ws.size } : p)
            // Invalidate frontend capability cache so changes take effect immediately
            effectivePermsStore.invalidate()
            setSuccess('Đã lưu thành công')
        } catch (e: any) {
            error = e?.message ?? 'Failed to save'
        } finally {
            const s = new Set(saving); s.delete(id); saving = s
        }
    }

    async function handleCreate() {
        creating = true; error = ''
        try {
            const res = await createPolicy({ slug: newSlug.trim(), name: newName.trim(), description: newDesc.trim() || undefined })
            policies = [...policies, res.data]
            showNewForm = false; newSlug = ''; newName = ''; newDesc = ''
            await selectPolicy(res.data.id)
            setSuccess(`Policy "${res.data.name}" đã được tạo`)
        } catch (e: any) { error = e?.message ?? 'Failed to create' }
        finally { creating = false }
    }

    async function handleDelete(id: string) {
        deletingId = id
        try {
            await deletePolicy(id)
            policies = policies.filter(p => p.id !== id)
            if (selectedId === id) { selectedId = ''; assignments = [] }
            setSuccess('Policy đã được xóa')
        } catch (e: any) { error = e?.message ?? 'Failed to delete' }
        finally { deletingId = '' }
    }

    async function handleSaveEdit(id: string) {
        editSaving = true
        try {
            await updatePolicy(id, { name: editName.trim(), description: editDesc.trim() || undefined })
            policies = policies.map(p => p.id === id ? { ...p, name: editName.trim(), description: editDesc.trim() || null } : p)
            editingId = ''
            setSuccess('Policy đã được cập nhật')
        } catch (e: any) { error = e?.message ?? 'Failed to update' }
        finally { editSaving = false }
    }

    async function handleAddAssignment() {
        if (!selectedId || !newAssignId) return
        assignLoading = true; error = ''
        try {
            const res = await addPolicyAssignment(selectedId, {
                principalType: newAssignType, principalId: newAssignId,
                scopeType: newAssignScope, scopeOuId: newAssignScope === 'OU' ? newAssignOuId : undefined,
                effect: newAssignEffect, inherit: newAssignInherit,
            })
            assignments = (await listPolicyAssignments(selectedId)).data
            newAssignId = ''; effectivePermsStore.invalidate(); setSuccess('Assignment đã được thêm')
        } catch (e: any) { error = e?.message ?? 'Failed to add assignment' }
        finally { assignLoading = false }
    }

    async function handleRemoveAssignment(assignmentId: string) {
        if (!selectedId) return
        removingAssignId = assignmentId
        try {
            await removePolicyAssignment(selectedId, assignmentId)
            assignments = assignments.filter(a => a.id !== assignmentId)
            effectivePermsStore.invalidate()
            setSuccess('Assignment đã được gỡ')
        } catch (e: any) { error = e?.message ?? 'Failed to remove' }
        finally { removingAssignId = '' }
    }

    async function handleBulkOu() {
        if (!selectedId || !bulkOuId) return
        bulkLoading = true
        try {
            const res = await bulkAssignPolicyToOu(selectedId, { ouId: bulkOuId, includeSubOUs: bulkSubOUs, effect: bulkEffect })
            assignments = (await listPolicyAssignments(selectedId)).data
            effectivePermsStore.invalidate()
            setSuccess(`Đã gán cho ${res.data.inserted} user(s)`)
            bulkOuId = ''
        } catch (e: any) { error = e?.message ?? 'Failed' }
        finally { bulkLoading = false }
    }

    function principalLabel(a: PolicyAssignment): string {
        if (a.principalType === 'USER') return principals.users.find(u => u.id === a.principalId)?.name ?? a.principalId
        if (a.principalType === 'GROUP') return principals.groups.find(g => g.id === a.principalId)?.name ?? a.principalId
        return ouLabel(a.principalId)
    }

    const principalIcon: Record<string, any> = { USER: Users, GROUP: Users, OU: Building2 }

    onMount(loadAll)
</script>

<div class="flex gap-4" style="min-height:640px">

    <!-- ══ LEFT: Policy List ════════════════════════════════════════════════ -->
    <div class="w-72 flex-shrink-0 flex flex-col gap-3">

        <!-- Search + Create -->
        <div class="flex gap-2">
            <div class="relative flex-1">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" placeholder={$isLoading ? 'Search policies...' : $_('admin.policyLib.searchPlaceholder')} class="input-base pl-8 py-1.5 text-xs w-full"
                    bind:value={searchPolicy} />
            </div>
            <button class="btn btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1"
                onclick={() => { showNewForm = !showNewForm }}>
                <Plus class="w-3.5 h-3.5" />
            </button>
        </div>

        <!-- New Policy Form -->
        {#if showNewForm}
            <div class="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p class="text-xs font-semibold text-primary">{$isLoading ? 'New Policy' : $_('admin.policyLib.createTitle')}</p>
                <input type="text" placeholder="slug (a-z, 0-9, _)" class="input-base text-xs w-full"
                    bind:value={newSlug} />
                <input type="text" placeholder={$isLoading ? 'Policy name' : $_('admin.policyLib.namePlaceholder')} class="input-base text-xs w-full"
                    bind:value={newName} />
                <input type="text" placeholder={$isLoading ? 'Description (optional)' : $_('admin.policyLib.descPlaceholder')} class="input-base text-xs w-full"
                    bind:value={newDesc} />
                <div class="flex gap-2">
                    <button class="btn btn-primary text-xs flex-1" disabled={!newSlug || !newName || creating}
                        onclick={handleCreate}>
                        {creating ? $_('admin.policyLib.creating') : $_('admin.policyLib.create')}
                    </button>
                    <button class="btn text-xs" onclick={() => { showNewForm = false }}>{$_('admin.policyLib.cancel')}</button>
                </div>
            </div>
        {/if}

        <!-- Policy list -->
        <div class="flex-1 flex flex-col gap-1 overflow-y-auto">
            {#if loading}
                {#each Array(5) as _}
                    <div class="h-14 rounded-lg skeleton-row"></div>
                {/each}
            {:else if filteredPolicies.length === 0}
                <p class="text-slate-500 text-xs text-center py-6">{$isLoading ? 'No policies' : $_('admin.policyLib.noPolicies')}</p>
            {:else}
                {#each filteredPolicies as pol (pol.id)}
                    <div class="group rounded-lg border transition-all cursor-pointer
                        {selectedId === pol.id
                            ? 'border-primary/50 bg-primary/10 shadow-sm shadow-primary/10'
                            : 'border-surface-3 bg-surface-2/40 hover:bg-surface-2/70 hover:border-surface-3'}"
                        role="button" tabindex="0"
                        onclick={() => selectPolicy(pol.id)}
                        onkeydown={(e) => e.key === 'Enter' && selectPolicy(pol.id)}>

                        {#if editingId === pol.id}
                            <!-- Inline edit form -->
                            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                            <div class="p-2 space-y-1.5" role="presentation" onclick={(e) => e.stopPropagation()}>
                                <input type="text" class="input-base text-xs w-full" bind:value={editName} />
                                <input type="text" placeholder="Mô tả" class="input-base text-xs w-full" bind:value={editDesc} />
                                <div class="flex gap-1.5">
                                    <button class="btn btn-primary text-xs flex-1" disabled={editSaving}
                                        onclick={() => handleSaveEdit(pol.id)}>
                                        {editSaving ? '...' : 'Lưu'}
                                    </button>
                                    <button class="btn text-xs" onclick={() => editingId = ''}>Huỷ</button>
                                </div>
                            </div>
                        {:else}
                            <div class="flex items-start gap-2 p-2.5">
                                <ShieldCheck class="w-4 h-4 mt-0.5 flex-shrink-0
                                    {selectedId === pol.id ? 'text-primary' : 'text-slate-500 group-hover:text-slate-400'}" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-xs font-semibold text-slate-200 truncate">{pol.name}</span>
                                        {#if pol.isSystem}
                                            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/50">sys</span>
                                        {/if}
                                    </div>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-[10px] font-mono text-slate-500">{pol.slug}</span>
                                        <span class="text-[10px] px-1.5 py-0 rounded-full bg-blue-900/40 text-blue-400 border border-blue-800/40">
                                            {pol.permissionCount} perms
                                        </span>
                                        {#if pending.has(pol.id)}
                                            <span class="text-[10px] text-amber-400">● unsaved</span>
                                        {/if}
                                    </div>
                                </div>
                                <!-- Actions (visible on hover or selection) -->
                                {#if !pol.isSystem}
                                    <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button class="p-1 text-slate-500 hover:text-slate-300"
                                            title={$_('admin.policyLib.edit')}
                                            onclick={(e) => { e.stopPropagation(); editingId = pol.id; editName = pol.name; editDesc = pol.description ?? '' }}>
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                            </svg>
                                        </button>
                                        <button class="p-1 text-slate-500 hover:text-rose-400"
                                            title={$_('admin.policyLib.delete')}
                                            disabled={deletingId === pol.id}
                                            onclick={(e) => { e.stopPropagation(); handleDelete(pol.id) }}>
                                            <Trash2 class="w-3 h-3" />
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- ══ RIGHT: Editor ════════════════════════════════════════════════════ -->
    <div class="flex-1 min-w-0 flex flex-col rounded-xl border border-surface-3 bg-surface-1/20 overflow-hidden">

        {#if !selectedPolicy}
            <div class="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 py-16">
                <ShieldCheck class="w-12 h-12 text-slate-700" />
                <p class="text-sm">{$isLoading ? 'Select a policy to edit' : $_('admin.policyLib.selectPrompt')}</p>
            </div>
        {:else}
            <!-- Header -->
            <div class="px-5 py-3 border-b border-surface-3 flex items-center gap-3 bg-surface-2/30">
                <ShieldCheck class="w-5 h-5 text-primary flex-shrink-0" />
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-white">{selectedPolicy.name}</h3>
                    <p class="text-xs text-slate-500 font-mono">{selectedPolicy.slug}</p>
                </div>
                <!-- Save / revert -->
                {#if isDirty}
                    <div class="flex items-center gap-2">
                        <button class="btn text-xs flex items-center gap-1.5 py-1" onclick={() => revert(selectedId)}>
                            <RotateCcw class="w-3 h-3" />{$_('admin.policyLib.revert')}
                        </button>
                        <button class="btn btn-primary text-xs flex items-center gap-1.5 py-1"
                            disabled={saving.has(selectedId)}
                            onclick={() => savePolicy(selectedId)}>
                            <Save class="w-3 h-3" />
                            {saving.has(selectedId) ? $_('admin.policyLib.saving') : $_('admin.policyLib.save')}
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Toast -->
            {#if successMsg}
                <div class="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CircleCheck class="w-4 h-4 flex-shrink-0" />{successMsg}
                </div>
            {/if}
            {#if error}
                <div class="mx-5 mt-3 px-3 py-2 rounded-lg bg-rose-900/30 border border-rose-700/40 text-rose-300 text-xs flex items-center gap-2">
                    <CircleX class="w-4 h-4 flex-shrink-0" />{error}
                    <button class="ml-auto" onclick={() => error = ''}><X class="w-3.5 h-3.5" /></button>
                </div>
            {/if}

            <!-- Sub-tabs -->
            <div class="flex border-b border-surface-3 px-5">
                {#each [{ id: 'permissions', labelKey: 'admin.policyLib.tabPermissions' }, { id: 'assignments', labelKey: 'admin.policyLib.tabAssignments' }] as tab}
                    <button class="px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors
                        {rightTab === tab.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-400 hover:text-slate-200'}"
                        onclick={() => { rightTab = tab.id as any }}>
                        {$isLoading ? tab.id : $_((tab as any).labelKey)}
                        {#if tab.id === 'permissions'}
                            <span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-slate-400">
                                {effectiveSet.size}/{catalog.length}
                            </span>
                        {:else}
                            <span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-slate-400">
                                {assignments.length}
                            </span>
                        {/if}
                    </button>
                {/each}

                <!-- Actions: toggle all -->
                {#if rightTab === 'permissions'}
                    <div class="ml-auto flex items-center gap-2 py-1.5">
                        <div class="relative">
                            <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                            <input type="text" placeholder={$isLoading ? 'Filter...' : $_('admin.policyLib.filterPlaceholder')} class="input-base pl-6 py-1 text-xs w-32"
                                bind:value={searchQuery} />
                        </div>
                        <button class="text-xs text-emerald-400 hover:text-emerald-300"
                            onclick={() => toggleAll(true)}>{$_('admin.policyLib.grantAll')}</button>
                        <span class="text-slate-600">|</span>
                        <button class="text-xs text-rose-400 hover:text-rose-300"
                            onclick={() => toggleAll(false)}>{$_('admin.policyLib.clearAll')}</button>
                    </div>
                {/if}
            </div>

            <!-- ── PERMISSIONS TAB — chip grid ─────────────────────────────── -->
            {#if rightTab === 'permissions'}
                <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {#each groupedPerms as { resource, perms }}
                        {@const meta = resourceMeta[resource] ?? { Icon: Shield, color: 'text-slate-400' }}
                        {@const ResourceIcon = meta.Icon}
                        {@const granted_n = grantedInGroup(resource)}
                        {@const total_n = totalInGroup(resource)}
                        {@const allGranted = granted_n === total_n}
                        {@const someGranted = granted_n > 0 && !allGranted}

                        <div class="rounded-xl border overflow-hidden transition-all
                            {allGranted ? 'border-emerald-700/40 bg-emerald-950/20'
                             : someGranted ? 'border-amber-700/30 bg-amber-950/10'
                             : 'border-surface-3 bg-surface-2/30'}">

                            <!-- Card header -->
                            <div class="flex items-center gap-2.5 px-4 py-2.5
                                {allGranted ? 'bg-emerald-900/20' : someGranted ? 'bg-amber-900/10' : 'bg-surface-3/20'}">
                                <ResourceIcon class="w-4 h-4 flex-shrink-0 {meta.color}" />
                                <span class="text-xs font-semibold text-slate-200 flex-1">{$isLoading ? resource : $_(`admin.policyLib.resources.${resource}`)}</span>

                                <!-- Count badge -->
                                <span class="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full border
                                    {allGranted ? 'bg-emerald-900/50 border-emerald-700/50 text-emerald-400'
                                     : someGranted ? 'bg-amber-900/50 border-amber-700/50 text-amber-400'
                                     : 'bg-surface-3 border-slate-700 text-slate-500'}">
                                    {granted_n}/{total_n}
                                </span>

                                <!-- Toggle all in group -->
                                <button type="button"
                                    class="text-[10px] {allGranted ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'}"
                                    onclick={() => toggleGroup(resource)}>
                                    {allGranted ? $_('admin.policyLib.clearAll') : $_('admin.policyLib.grantAll')}
                                </button>
                            </div>

                            <!-- Chip row -->
                            <div class="px-4 py-3 flex flex-wrap gap-2">
                                {#each perms as perm (perm.id)}
                                    {@const checked = effectiveSet.has(perm.id)}
                                    {@const cls = actionCls[perm.action] ?? 'bg-slate-800 text-slate-400 border-slate-700'}
                                    <button
                                        type="button"
                                        title={perm.description ?? perm.name}
                                        class="px-3 py-1 rounded-full text-xs font-medium border transition-all select-none
                                            {checked
                                                ? cls + ' shadow-sm'
                                                : 'bg-surface-2/50 text-slate-600 border-slate-700/50 hover:border-slate-500 hover:text-slate-400'}"
                                        onclick={() => togglePermission(perm.id)}>
                                        {perm.action}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}

                    {#if groupedPerms.length === 0}
                        <div class="text-center text-slate-500 text-sm py-12">
                            {$isLoading ? 'No permissions found' : $_('admin.policyLib.noPerms')}
                        </div>
                    {/if}
                </div>

            <!-- ── ASSIGNMENTS TAB ─────────────────────────────────────────── -->
            {:else}
                <div class="flex-1 overflow-y-auto p-4 space-y-5">

                    <!-- Add assignment form -->
                    <div class="rounded-xl border border-surface-3 bg-surface-2/30 p-4">
                        <p class="text-xs font-semibold text-slate-300 mb-3">{$isLoading ? 'Add Assignment' : $_('admin.policyLib.addAssignment')}</p>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <span class="text-[10px] text-slate-500 block mb-1">{$_('admin.policyLib.principalType')}</span>
                                <select class="select-base text-xs w-full" bind:value={newAssignType}
                                    onchange={() => newAssignId = ''}>
                                    <option value="USER">User</option>
                                    <option value="GROUP">Group</option>
                                    <option value="OU">OU</option>
                                </select>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-500 block mb-1">{$_('admin.policyLib.principal')}</span>
                                <select class="select-base text-xs w-full" bind:value={newAssignId}>
                                    <option value="">— {$_('admin.policyLib.selectOption')} —</option>
                                    {#each assignablePrincipals as p}
                                        <option value={p.id}>{p.label}</option>
                                    {/each}
                                </select>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-500 block mb-1">{$_('admin.policyLib.effect')}</span>
                                <select class="select-base text-xs w-full" bind:value={newAssignEffect}>
                                    <option value="ALLOW">ALLOW</option>
                                    <option value="DENY">DENY</option>
                                </select>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-500 block mb-1">{$_('admin.policyLib.scope')}</span>
                                <select class="select-base text-xs w-full" bind:value={newAssignScope}>
                                    <option value="GLOBAL">Global</option>
                                    <option value="OU">OU scope</option>
                                    <option value="RESOURCE">Resource</option>
                                </select>
                            </div>
                        </div>
                        {#if newAssignScope === 'OU'}
                            <div class="mb-2">
                                <span class="text-[10px] text-slate-500 block mb-1">Scope OU</span>
                                <select class="select-base text-xs w-full" bind:value={newAssignOuId}>
                                    <option value="">— Chọn OU —</option>
                                    {#each principals.ous as ou}
                                        <option value={ou.id}>{ou.path}</option>
                                    {/each}
                                </select>
                            </div>
                        {/if}
                        <div class="flex items-center justify-between">
                            <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input type="checkbox" bind:checked={newAssignInherit} />
                                {$_('admin.policyLib.inheritSubOUs')}
                            </label>
                            <button class="btn btn-primary text-xs"
                                disabled={!newAssignId || assignLoading}
                                onclick={handleAddAssignment}>
                                {assignLoading ? $_('admin.policyLib.adding') : $_('admin.policyLib.add')}
                            </button>
                        </div>
                    </div>

                    <!-- Bulk OU assign -->
                    <div class="rounded-xl border border-surface-3 bg-surface-2/30 p-4">
                        <p class="text-xs font-semibold text-slate-300 mb-3">{$isLoading ? 'Bulk assign by OU' : $_('admin.policyLib.bulkAssign')}</p>
                        <div class="flex gap-2 flex-wrap items-end">
                            <select class="select-base text-xs flex-1 min-w-[160px]" bind:value={bulkOuId}>
                                <option value="">— Chọn OU —</option>
                                {#each principals.ous as ou}
                                    <option value={ou.id}>{ou.path}</option>
                                {/each}
                            </select>
                            <select class="select-base text-xs w-24" bind:value={bulkEffect}>
                                <option value="ALLOW">ALLOW</option>
                                <option value="DENY">DENY</option>
                            </select>
                            <label class="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                                <input type="checkbox" bind:checked={bulkSubOUs} />
                                Sub-OUs
                            </label>
                            <button class="btn btn-primary text-xs" disabled={!bulkOuId || bulkLoading}
                                onclick={handleBulkOu}>
                                {bulkLoading ? '...' : 'Gán'}
                            </button>
                        </div>
                    </div>

                    <!-- Assignment table -->
                    {#if assignments.length === 0}
                        <p class="text-slate-500 text-xs text-center py-4">{$isLoading ? 'No assignments' : $_('admin.policyLib.noAssignments')}</p>
                    {:else}
                        <div class="rounded-xl border border-surface-3 overflow-hidden">
                            <table class="data-table w-full">
                                <thead>
                                    <tr>
                                        <th>{$_('admin.policyLib.principal')}</th>
                                        <th>{$_('admin.policyLib.effect')}</th>
                                        <th>{$_('admin.policyLib.scope')}</th>
                                        <th>{$_('admin.policyLib.inherit')}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each assignments as a (a.id)}
                                        {@const PIcon = principalIcon[a.principalType] ?? Users}
                                        <tr>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <PIcon class="w-3.5 h-3.5 text-slate-500" />
                                                    <div>
                                                        <span class="text-xs font-medium text-slate-200">{principalLabel(a)}</span>
                                                        <span class="text-[10px] text-slate-500 ml-1">{a.principalType}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span class="text-xs px-2 py-0.5 rounded-full border
                                                    {a.effect === 'ALLOW'
                                                        ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400'
                                                        : 'bg-rose-900/40 border-rose-700/50 text-rose-400'}">
                                                    {a.effect}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="text-xs text-slate-400">
                                                    {a.scopeType === 'OU' ? ouLabel(a.scopeOuId) : a.scopeType}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="text-xs text-slate-500">{a.inherit ? '✓' : '—'}</span>
                                            </td>
                                            <td>
                                                <button class="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                                    disabled={removingAssignId === a.id}
                                                    title="Xoá assignment"
                                                    onclick={() => handleRemoveAssignment(a.id)}>
                                                    <Unlink class="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
</div>
