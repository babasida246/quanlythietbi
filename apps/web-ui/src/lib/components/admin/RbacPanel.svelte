<script lang="ts">
    import { onMount } from 'svelte'
    import { _, isLoading } from '$lib/i18n'
    import { Button } from '$lib/components/ui'
    import {
        listRbacRoles, listRbacPermissions, getRolePermissions, setRolePermissions,
        listUsers,
        type RbacRole, type RbacPermission
    } from '$lib/api/admin'
    import {
        Laptop, FolderTree, Network, Package, ClipboardList, Key, Puzzle,
        FlaskConical, Cpu, ArrowLeftRight, FileText, Wrench, BarChart3,
        TrendingUp, TrendingDown, Tag, Files, Zap, Plug, Shield, Settings,
        Save, RefreshCw, Search, ChevronDown, ChevronRight, Users, CheckSquare,
        Square, Minus, RotateCcw, CircleCheck, CircleX, Info, Lock
    } from 'lucide-svelte'

    // === Data ================================================================
    let roles       = $state<RbacRole[]>([])
    let permissions = $state<RbacPermission[]>([])
    /** slug  Set<permId>  saved state from server */
    let granted     = $state<Map<string, Set<string>>>(new Map())
    /** slug  Set<permId>  working state (overrides granted when present) */
    let pending     = $state<Map<string, Set<string>>>(new Map())
    let userCounts  = $state<Map<string, number>>(new Map())

    let loading    = $state(true)
    let saving     = $state<Set<string>>(new Set())
    let error      = $state('')
    let successMsg = $state('')

    // === UI state ===========================================================
    let selectedSlug   = $state<string>('')
    let searchQuery    = $state('')
    let expandedGroups = $state<Set<string>>(new Set())
    let showOnlyDiff   = $state(false)

    // === Derived =============================================================
    const selectedRole = $derived.by(() => roles.find(r => r.slug === selectedSlug) ?? null)

    const effectiveSet = $derived.by<Set<string>>(() => {
        if (!selectedSlug) return new Set()
        return pending.get(selectedSlug) ?? granted.get(selectedSlug) ?? new Set()
    })
    const originalSet = $derived.by<Set<string>>(() => {
        if (!selectedSlug) return new Set()
        return granted.get(selectedSlug) ?? new Set()
    })
    const isDirty = $derived.by(() => pending.has(selectedSlug))

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
        return groupedPermissions
            .map(({ resource, perms }) => {
                let filtered = perms
                if (q) {
                    filtered = perms.filter(p =>
                        p.name.toLowerCase().includes(q) ||
                        p.resource.toLowerCase().includes(q) ||
                        p.action.toLowerCase().includes(q) ||
                        (p.description ?? '').toLowerCase().includes(q)
                    )
                }
                if (showOnlyDiff && selectedSlug) {
                    filtered = filtered.filter(p =>
                        originalSet.has(p.id) !== effectiveSet.has(p.id)
                    )
                }
                return { resource, perms: filtered }
            })
            .filter(g => g.perms.length > 0)
    })

    const dirtyRoleSlugs = $derived.by(() => [...pending.keys()])
    const grantedCount   = $derived.by(() => effectiveSet.size)
    const totalCount     = $derived.by(() => permissions.length)
    const changedCount   = $derived.by(() => {
        if (!isDirty) return 0
        const orig = originalSet; const curr = effectiveSet
        let n = 0
        for (const id of curr) { if (!orig.has(id)) n++ }
        for (const id of orig) { if (!curr.has(id)) n++ }
        return n
    })

    // === Helpers =============================================================
    function actionOrder(a: string): number {
        const o: Record<string, number> = {
            read:0,create:1,update:2,delete:3,manage:4,approve:5,
            export:6,import:7,assign:8,upload:9,users:10,roles:11,settings:12
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

    function getWS(slug: string): Set<string> {
        return new Set(pending.get(slug) ?? granted.get(slug) ?? [])
    }

    function commitPending(slug: string, next: Set<string>) {
        const orig = granted.get(slug) ?? new Set<string>()
        const same = next.size === orig.size && [...next].every(id => orig.has(id))
        const m = new Map(pending)
        if (same) m.delete(slug); else m.set(slug, next)
        pending = m
    }

    function togglePermission(permId: string) {
        if (!selectedSlug) return
        const ws = getWS(selectedSlug)
        if (ws.has(permId)) ws.delete(permId); else ws.add(permId)
        commitPending(selectedSlug, ws)
    }

    function toggleGroup(resource: string) {
        if (!selectedSlug) return
        const state = groupState(resource)
        const ids   = permissions.filter(p => p.resource === resource).map(p => p.id)
        const ws    = getWS(selectedSlug)
        if (state === 'none') { for (const id of ids) ws.add(id) }
        else                  { for (const id of ids) ws.delete(id) }
        commitPending(selectedSlug, ws)
    }

    function toggleAll(grant: boolean) {
        if (!selectedSlug) return
        commitPending(selectedSlug, grant ? new Set(permissions.map(p => p.id)) : new Set())
    }

    function revert(slug: string) {
        const m = new Map(pending); m.delete(slug); pending = m
    }

    function toggleExpand(resource: string) {
        const s = new Set(expandedGroups)
        if (s.has(resource)) s.delete(resource); else s.add(resource)
        expandedGroups = s
    }
    function expandAll()   { expandedGroups = new Set(groupedPermissions.map(g => g.resource)) }
    function collapseAll() { expandedGroups = new Set() }

    function roleGrantedCount(slug: string) {
        return (pending.get(slug) ?? granted.get(slug) ?? new Set()).size
    }

    // === Resource / action meta ==============================================
    const resourceMeta: Record<string, { Icon: any; color: string; bg: string }> = {
        assets:       { Icon: Laptop,         color: 'text-blue-400',    bg: 'bg-blue-900/20' },
        categories:   { Icon: FolderTree,     color: 'text-violet-400',  bg: 'bg-violet-900/20' },
        cmdb:         { Icon: Network,        color: 'text-cyan-400',    bg: 'bg-cyan-900/20' },
        warehouse:    { Icon: Package,        color: 'text-amber-400',   bg: 'bg-amber-900/20' },
        inventory:    { Icon: ClipboardList,  color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
        licenses:     { Icon: Key,            color: 'text-yellow-400',  bg: 'bg-yellow-900/20' },
        accessories:  { Icon: Puzzle,         color: 'text-pink-400',    bg: 'bg-pink-900/20' },
        consumables:  { Icon: FlaskConical,   color: 'text-orange-400',  bg: 'bg-orange-900/20' },
        components:   { Icon: Cpu,            color: 'text-teal-400',    bg: 'bg-teal-900/20' },
        checkout:     { Icon: ArrowLeftRight, color: 'text-indigo-400',  bg: 'bg-indigo-900/20' },
        requests:     { Icon: FileText,       color: 'text-sky-400',     bg: 'bg-sky-900/20' },
        maintenance:  { Icon: Wrench,         color: 'text-red-400',     bg: 'bg-red-900/20' },
        reports:      { Icon: BarChart3,      color: 'text-lime-400',    bg: 'bg-lime-900/20' },
        analytics:    { Icon: TrendingUp,     color: 'text-green-400',   bg: 'bg-green-900/20' },
        depreciation: { Icon: TrendingDown,   color: 'text-slate-400',   bg: 'bg-slate-800/30' },
        labels:       { Icon: Tag,            color: 'text-rose-400',    bg: 'bg-rose-900/20' },
        documents:    { Icon: Files,          color: 'text-zinc-400',    bg: 'bg-zinc-800/30' },
        automation:   { Icon: Zap,            color: 'text-yellow-300',  bg: 'bg-yellow-900/20' },
        integrations: { Icon: Plug,           color: 'text-purple-400',  bg: 'bg-purple-900/20' },
        security:     { Icon: Shield,         color: 'text-red-500',     bg: 'bg-red-900/20' },
        admin:        { Icon: Settings,       color: 'text-rose-400',    bg: 'bg-rose-900/20' },
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
    }

    // === Load / save =========================================================
    async function loadAll() {
        loading = true; error = ''; pending = new Map()
        try {
            const [rolesRes, permsRes, usersRes] = await Promise.all([
                listRbacRoles(),
                listRbacPermissions(),
                listUsers().catch(() => ({ data: [] }))
            ])
            roles       = rolesRes.data ?? []
            permissions = permsRes.data ?? []

            const counts = new Map<string, number>()
            for (const u of (usersRes.data ?? []))
                counts.set(u.role, (counts.get(u.role) ?? 0) + 1)
            userCounts = counts

            const grantedMap = new Map<string, Set<string>>()
            await Promise.all(roles.map(async role => {
                try {
                    const res = await getRolePermissions(role.slug)
                    grantedMap.set(role.slug, new Set((res.data ?? []).map((r: any) => r.permission_id)))
                } catch {
                    grantedMap.set(role.slug, new Set())
                }
            }))
            granted = grantedMap

            if (!selectedSlug && roles.length > 0) selectedSlug = roles[0].slug
        } catch (err) {
            error = err instanceof Error ? err.message : $_('adminRbac.errors.loadFailed')
        } finally {
            loading = false
        }
    }

    async function saveRole(slug: string) {
        const permIds = [...(pending.get(slug) ?? granted.get(slug) ?? [])]
        const s = new Set(saving); s.add(slug); saving = s; error = ''
        try {
            await setRolePermissions(slug, permIds)
            const ng = new Map(granted); ng.set(slug, new Set(permIds)); granted = ng
            const np = new Map(pending); np.delete(slug); pending = np
            setSuccess($_('adminRbac.savedSuccess', { values: { role: roles.find(r => r.slug === slug)?.name ?? slug } }))
        } catch (err) {
            error = err instanceof Error ? err.message : $_('adminRbac.errors.saveFailed')
        } finally {
            const s2 = new Set(saving); s2.delete(slug); saving = s2
        }
    }

    async function saveAll() {
        for (const slug of dirtyRoleSlugs) await saveRole(slug)
    }

    function setSuccess(msg: string) {
        successMsg = msg
        setTimeout(() => { if (successMsg === msg) successMsg = '' }, 4000)
    }

    onMount(() => { void loadAll() })
</script>

<div class="card" data-testid="rbac-panel">
    <!-- Panel header -->
    <div class="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-surface-3">
        <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Shield class="w-5 h-5 text-red-400" />
            </div>
            <div>
                <h3 class="text-base font-semibold text-white leading-tight">{$isLoading ? 'RBAC' : $_('adminRbac.panelTitle')}</h3>
                <p class="text-xs text-slate-500">{$isLoading ? '' : $_('adminRbac.panelSubtitle', { values: { roleCount: roles.length, permCount: permissions.length } })}</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            {#if dirtyRoleSlugs.length > 0}
                <span class="badge badge-yellow text-xs">{$isLoading ? '' : $_('adminRbac.unsavedRoles', { values: { count: dirtyRoleSlugs.length } })}</span>
                <Button onclick={saveAll} disabled={saving.size > 0}>
                    <Save class="w-4 h-4 mr-1.5" />{$isLoading ? 'Save all' : $_('adminRbac.saveAll')}
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
            <p class="text-sm">{$isLoading ? 'Loading...' : $_('adminRbac.loading')}</p>
        </div>
    {:else}
        <!--
            Split-panel: LEFT = role list (Windows AD "Groups" pane)
                         RIGHT = permission tree for selected role
        -->
        <div class="mt-4 flex gap-0 rounded-xl border border-surface-3 overflow-hidden" style="min-height:620px">

            <!--  LEFT: Role list  -->
            <div class="w-60 flex-shrink-0 bg-surface-2 border-r border-surface-3 flex flex-col">
                <!-- Pane title -->
                <div class="px-3 py-2 border-b border-surface-3 bg-surface-3/40">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Users class="w-3 h-3" /> {$isLoading ? 'Roles' : $_('adminRbac.roles')}
                    </p>
                </div>

                <!-- Role items -->
                <div class="flex-1 overflow-y-auto py-1">
                    {#each roles as role}
                        {@const sel    = selectedSlug === role.slug}
                        {@const dirty2 = pending.has(role.slug)}
                        {@const rc     = roleGrantedCount(role.slug)}
                        {@const pct    = totalCount > 0 ? Math.round(rc / totalCount * 100) : 0}
                        <button
                            type="button"
                            class="w-full text-left px-3 py-2.5 transition-colors border-r-2 group
                                {sel
                                    ? 'bg-primary/12 border-primary'
                                    : 'hover:bg-surface-3/50 border-transparent'}"
                            onclick={() => { selectedSlug = role.slug }}
                        >
                            <!-- Row: dot + name + count -->
                            <div class="flex items-center justify-between gap-1">
                                <div class="flex items-center gap-2 min-w-0">
                                    {#if dirty2}
                                        <span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title={$isLoading ? 'Unsaved' : $_('adminRbac.unsaved')}></span>
                                    {:else if sel}
                                        <span class="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                                    {:else}
                                        <span class="w-2 h-2 rounded-full border border-slate-600 flex-shrink-0"></span>
                                    {/if}
                                    <span class="text-sm font-medium truncate {sel ? 'text-white' : 'text-slate-300'}">
                                        {$isLoading ? role.name : $_('adminRbac.roleLabels.' + role.slug)}
                                    </span>
                                </div>
                                <span class="text-xs text-slate-500 flex-shrink-0">{rc}</span>
                            </div>
                            <!-- Sub info -->
                            <div class="mt-0.5 ml-4 flex items-center gap-1.5 text-xs text-slate-600">
                                <Users class="w-3 h-3" />
                                <span>{$isLoading ? '' : $_('adminRbac.userCount', { values: { count: userCounts.get(role.slug) ?? 0 } })}</span>
                                <span></span>
                                <span>{pct}%</span>
                            </div>
                            <!-- Progress bar -->
                            <div class="mt-1.5 ml-4 h-0.5 rounded-full bg-surface-3 overflow-hidden">
                                <div
                                    class="h-full rounded-full transition-all duration-300
                                        {sel ? 'bg-primary' : 'bg-slate-600'}"
                                    style="width:{pct}%"
                                ></div>
                            </div>
                        </button>
                    {/each}
                </div>

                <!-- Footer -->
                <div class="px-3 py-2 border-t border-surface-3 bg-surface-3/20">
                    <p class="text-xs text-slate-600 flex items-center gap-1">
                        <Lock class="w-3 h-3" /> {$isLoading ? 'System roles' : $_('adminRbac.systemRoles')}
                    </p>
                </div>
            </div>

            <!--  RIGHT: Permission tree  -->
            <div class="flex-1 min-w-0 flex flex-col bg-surface-2/20">
                {#if selectedRole}
                    <!-- Tree header -->
                    <div class="px-5 py-3 border-b border-surface-3 flex flex-wrap items-start gap-3">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="text-sm font-semibold text-white">
                                    {$isLoading ? selectedRole.name : $_('adminRbac.roleLabels.' + selectedRole.slug)}
                                </h4>
                                <span class="text-xs text-slate-500 font-mono bg-surface-3 px-1.5 py-0.5 rounded">
                                    {selectedRole.slug}
                                </span>
                                {#if isDirty}
                                    <span class="badge badge-yellow text-xs"> {$isLoading ? 'Unsaved' : $_('adminRbac.unsaved')}</span>
                                {:else}
                                    <span class="badge badge-blue text-xs">{$isLoading ? 'Synced' : $_('adminRbac.synced')}</span>
                                {/if}
                            </div>
                            <!-- Stats -->
                            <div class="mt-1.5 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                <span class="flex items-center gap-1">
                                    <CircleCheck class="w-3.5 h-3.5 text-emerald-400" />
                                    {$isLoading ? 'Granted:' : $_('adminRbac.granted')} <strong class="text-emerald-400 ml-0.5">{grantedCount}</strong>/{totalCount}
                                </span>
                                <span class="flex items-center gap-1">
                                    <CircleX class="w-3.5 h-3.5 text-slate-500" />
                                    {$isLoading ? 'Not granted:' : $_('adminRbac.notGranted')} {totalCount - grantedCount}
                                </span>
                                {#if changedCount > 0}
                                    <span class="flex items-center gap-1 text-amber-400">
                                        <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                                        {$isLoading ? '' : $_('adminRbac.pendingChanges', { values: { count: changedCount } })}
                                    </span>
                                {/if}
                            </div>
                            <!-- Progress bar -->
                            <div class="mt-2 h-1.5 w-full max-w-xs rounded-full bg-surface-3 overflow-hidden">
                                <div
                                    class="h-full rounded-full bg-emerald-500/70 transition-all duration-300"
                                    style="width:{totalCount > 0 ? Math.round(grantedCount / totalCount * 100) : 0}%"
                                ></div>
                            </div>
                        </div>
                        <!-- Action buttons -->
                        {#if isDirty}
                            <div class="flex items-center gap-2 flex-shrink-0">
                                <Button onclick={() => saveRole(selectedSlug)} disabled={saving.has(selectedSlug)}>
                                    <Save class="w-4 h-4 mr-1.5" />
                                    {saving.has(selectedSlug) ? ($isLoading ? 'Saving...' : $_('adminRbac.saving')) : ($isLoading ? 'Save role' : $_('adminRbac.saveRole'))}
                                </Button>
                                <Button variant="secondary" onclick={() => revert(selectedSlug)}>
                                    <RotateCcw class="w-4 h-4 mr-1.5" />{$isLoading ? 'Revert' : $_('adminRbac.revert')}
                                </Button>
                            </div>
                        {/if}
                    </div>

                    <!-- Toolbar: search + quick actions -->
                    <div class="px-5 py-2 border-b border-surface-3 flex items-center gap-2 flex-wrap bg-surface-3/10">
                        <div class="relative flex-1 min-w-40">
                            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                class="input-base pl-8 py-1.5 text-xs w-full"
                                placeholder={$isLoading ? 'Search...' : $_('adminRbac.searchPermissions')}
                                bind:value={searchQuery}
                            />
                        </div>
                        <button
                            type="button"
                            class="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 border border-emerald-800/50"
                            onclick={() => toggleAll(true)}
                        >{$isLoading ? '+ All' : '+ ' + $_('adminRbac.grantAll')}</button>
                        <button
                            type="button"
                            class="text-xs px-2 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 border border-red-800/50"
                            onclick={() => toggleAll(false)}
                        >{$isLoading ? 'Clear' : $_('adminRbac.revokeAll')}</button>
                        <button
                            type="button"
                            class="text-xs px-2 py-1 rounded bg-surface-3 text-slate-400 hover:bg-surface-3/80 border border-surface-3"
                            onclick={expandAll}
                        >{$isLoading ? 'Expand' : $_('adminRbac.expandAll')}</button>
                        <button
                            type="button"
                            class="text-xs px-2 py-1 rounded bg-surface-3 text-slate-400 hover:bg-surface-3/80 border border-surface-3"
                            onclick={collapseAll}
                        >{$isLoading ? 'Collapse' : $_('adminRbac.collapseAll')}</button>
                        <label class="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 select-none">
                            <input type="checkbox" bind:checked={showOnlyDiff} />
                            {$isLoading ? 'Only changes' : $_('adminRbac.onlyChanges')}
                        </label>
                        <span class="text-xs text-slate-600 ml-auto">
                            {$isLoading ? '' : $_('adminRbac.permCountLabel', { values: { shown: filteredGroups.reduce((a, g) => a + g.perms.length, 0), total: totalCount } })}
                        </span>
                    </div>

                    <!-- Permission tree body -->
                    <div class="flex-1 overflow-y-auto">
                        {#if filteredGroups.length === 0}
                            <div class="py-12 text-center text-slate-500 text-sm">
                                {searchQuery
                                    ? ($isLoading ? `No results for "${searchQuery}"` : $_('adminRbac.noResults', { values: { query: searchQuery } }))
                                    : showOnlyDiff
                                        ? ($isLoading ? 'No changes' : $_('adminRbac.noChanges'))
                                        : ($isLoading ? 'No permissions' : $_('adminRbac.noPermissions'))}
                            </div>
                        {/if}

                        {#each filteredGroups as { resource, perms } (resource)}
                            {@const meta = resourceMeta[resource] ?? { Icon: Settings, color: 'text-slate-400', bg: 'bg-slate-800/20' }}
                            {@const GroupIcon = meta.Icon}
                            {@const state = groupState(resource)}
                            {@const expanded  = expandedGroups.has(resource)}
                            {@const gInGroup  = permissions.filter(p => p.resource === resource && effectiveSet.has(p.id)).length}
                            {@const allInGroup = permissions.filter(p => p.resource === resource).length}

                            <!--  Group node (parent row)  -->
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
                                    <!-- Chevron -->
                                    <span class="w-5 h-5 flex items-center justify-center text-slate-500 flex-shrink-0">
                                        {#if expanded}
                                            <ChevronDown class="w-3.5 h-3.5" />
                                        {:else}
                                            <ChevronRight class="w-3.5 h-3.5" />
                                        {/if}
                                    </span>

                                    <!-- Tri-state checkbox -->
                                    <button
                                        type="button"
                                        class="w-5 h-5 mx-2 rounded flex items-center justify-center border flex-shrink-0 transition-all
                                            {state === 'all'
                                                ? 'bg-primary/25 border-primary text-primary'
                                                : state === 'partial'
                                                    ? 'bg-amber-900/50 border-amber-500 text-amber-400'
                                                    : 'bg-surface-3 border-slate-600 text-slate-600 hover:border-slate-400 hover:text-slate-400'}"
                                        title={state === 'none' ? ($isLoading ? 'Grant all in group' : $_('adminRbac.grantAllInGroup')) : ($isLoading ? 'Revoke all in group' : $_('adminRbac.revokeAllInGroup'))}
                                        onclick={(e) => { e.stopPropagation(); toggleGroup(resource) }}
                                        onkeydown={(e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.stopPropagation(); toggleGroup(resource) } }}
                                    >
                                        {#if state === 'all'}
                                            <CheckSquare class="w-3.5 h-3.5" />
                                        {:else if state === 'partial'}
                                            <Minus class="w-3.5 h-3.5" />
                                        {:else}
                                            <Square class="w-3.5 h-3.5" />
                                        {/if}
                                    </button>

                                    <!-- Icon + label -->
                                    <GroupIcon class="w-4 h-4 {meta.color} flex-shrink-0 mr-2" />
                                    <span class="text-sm font-semibold flex-1 min-w-0 truncate {expanded ? meta.color : 'text-slate-200'}">
                                        {$isLoading ? resource : $_('adminRbac.resources.' + resource)}
                                    </span>

                                    <!-- Count badge -->
                                    <span class="ml-auto flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border
                                        {state === 'all'
                                            ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400'
                                            : state === 'partial'
                                                ? 'bg-amber-900/40 border-amber-700/50 text-amber-400'
                                                : 'bg-surface-3 border-slate-700 text-slate-500'}">
                                        {gInGroup}/{allInGroup}
                                    </span>
                                </div>

                                <!--  Leaf nodes  -->
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
                                                <!-- Tree indent lines -->
                                                <div class="w-5 flex-shrink-0 flex justify-center relative">
                                                    <div class="absolute top-0 bottom-0 left-1/2 w-px bg-surface-3 -translate-x-1/2"></div>
                                                </div>
                                                <div class="w-5 flex-shrink-0 relative mt-2.5">
                                                    <div class="absolute top-0 left-0 w-full h-px bg-surface-3"></div>
                                                </div>

                                                <!-- Checkbox -->
                                                <div class="w-5 h-5 mx-2 mt-0.5 rounded flex items-center justify-center border flex-shrink-0
                                                    transition-all duration-150
                                                    {checked
                                                        ? `bg-primary/20 border-primary ${changed ? 'ring-1 ring-amber-400/70' : ''}`
                                                        : `bg-surface-3/50 border-slate-600 group-hover:border-slate-400 ${changed ? 'ring-1 ring-amber-400/70' : ''}`}">
                                                    {#if checked}
                                                        <CircleCheck class="w-3 h-3 text-primary" />
                                                    {:else}
                                                        <CircleX class="w-3 h-3 text-slate-600 group-hover:text-slate-500" />
                                                    {/if}
                                                </div>

                                                <!-- Text -->
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center gap-2 flex-wrap">
                                                        <code class="text-xs font-mono {checked ? 'text-slate-200' : 'text-slate-400'}">
                                                            {perm.name}
                                                        </code>
                                                        <span class="text-xs px-1.5 py-0.5 rounded border font-medium {am.cls}">
                                                            {$isLoading ? perm.action : $_('adminRbac.actions.' + perm.action)}
                                                        </span>
                                                        {#if changed}
                                                            <span class="text-xs text-amber-400 font-medium">
                                                                {checked ? '(+) ' + ($isLoading ? 'Just granted' : $_('adminRbac.justGranted')) : '() ' + ($isLoading ? 'Just revoked' : $_('adminRbac.justRevoked'))}
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

                    <!-- Legend footer -->
                    <div class="px-5 py-2 border-t border-surface-3 bg-surface-3/20 flex flex-wrap items-center gap-x-5 gap-y-1">
                        <div class="flex items-center gap-1.5 text-xs text-slate-500">
                            <CheckSquare class="w-3.5 h-3.5 text-primary" /> {$isLoading ? 'Full grant' : $_('adminRbac.legendFullGrant')}
                        </div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-500">
                            <Minus class="w-3.5 h-3.5 text-amber-400" /> {$isLoading ? 'Partial' : $_('adminRbac.legendPartialGrant')}
                        </div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-500">
                            <Square class="w-3.5 h-3.5 text-slate-600" /> {$isLoading ? 'None' : $_('adminRbac.legendNotGranted')}
                        </div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-500">
                            <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> {$isLoading ? 'Unsaved' : $_('adminRbac.legendUnsaved')}
                        </div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-600 ml-auto">
                            <Info class="w-3 h-3" /> {$isLoading ? '' : $_('adminRbac.helpTip')}
                        </div>
                    </div>
                {:else}
                    <div class="flex-1 flex items-center justify-center text-slate-500 text-sm">
                        {$isLoading ? 'Select a role' : $_('adminRbac.selectRoleHint')}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
