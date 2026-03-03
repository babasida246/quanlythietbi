<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { listUsers, type AdminUser } from '$lib/api/admin'
    import { readLocal, writeLocal } from '$lib/admin/storage'
    import { formatAdminError } from '$lib/admin/errors'

    type ImpersonationState = {
        userId: string
        email: string
        startedAt: string
    } | null

    const STORAGE_KEY = 'admin.impersonation.v1'

    let users = $state<AdminUser[]>([])
    let selectedUser = $state<string>('')
    let impersonation = $state<ImpersonationState>(readLocal<ImpersonationState>(STORAGE_KEY, null))
    let loading = $state(false)
    let error = $state('')
    const selectId = 'impersonation-user-select'

    async function loadUsers() {
        loading = true
        error = ''
        try {
            const res = await listUsers()
            users = res.data ?? []
            if (!selectedUser && users.length > 0) {
                selectedUser = users[0].id
            }
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    function startImpersonation() {
        const user = users.find((item) => item.id === selectedUser)
        if (!user) return
        impersonation = {
            userId: user.id,
            email: user.email,
            startedAt: new Date().toISOString()
        }
        writeLocal(STORAGE_KEY, impersonation)
    }

    function stopImpersonation() {
        impersonation = null
        writeLocal(STORAGE_KEY, impersonation)
    }

    onMount(() => {
        void loadUsers()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Impersonation</h3>
            <p class="text-sm text-slate-500">
                Support users by safely simulating their view. All actions must be audited.
            </p>
        </div>
        {#if impersonation}
            <span class="badge-warning">Active impersonation</span>
        {/if}
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div>
            <label class="text-sm text-slate-500" for={selectId}>Select user to impersonate</label>
            <select class="select-base" id={selectId} bind:value={selectedUser} disabled={loading || users.length === 0}>
                {#each users as user}
                    <option value={user.id}>{user.email} ({user.role})</option>
                {/each}
            </select>
        </div>
        <div class="flex gap-2">
            <Button size="sm" onclick={startImpersonation} disabled={!selectedUser || !!impersonation}>
                Start
            </Button>
            <Button size="sm" variant="secondary" onclick={stopImpersonation} disabled={!impersonation}>
                Stop
            </Button>
        </div>
    </div>

    {#if impersonation}
        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Impersonating {impersonation.email}. This is a UI preview mode; backend enforcement is required for full access control.
        </div>
    {/if}
</div>
