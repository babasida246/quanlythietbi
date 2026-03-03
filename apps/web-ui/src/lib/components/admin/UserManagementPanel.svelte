<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { _, isLoading } from '$lib/i18n'
    import { listUsers, createUser, updateUser, resetPassword, deleteUser, type AdminUser } from '$lib/api/admin'
    import { formatAdminError } from '$lib/admin/errors'

    let users = $state<AdminUser[]>([])
    let loading = $state(false)
    let bulkLoading = $state(false)
    let errorMsg = $state('')
    let showCreate = $state(false)
    let newUser = $state({ email: '', name: '', password: '', role: 'requester' })

    let search = $state('')
    let roleFilter = $state('all')
    let statusFilter = $state('all')
    let selectedIds = $state<Record<string, boolean>>({})
let bulkRole = $state('requester')

    const filteredUsers = $derived.by(() => {
        return users.filter((user) => {
            const query = search.trim().toLowerCase()
            if (query) {
                const target = `${user.name} ${user.email}`.toLowerCase()
                if (!target.includes(query)) return false
            }
            if (roleFilter !== 'all' && user.role !== roleFilter) return false
            if (statusFilter === 'active' && !user.isActive) return false
            if (statusFilter === 'disabled' && user.isActive) return false
            return true
        })
    })

    const selectedUsers = $derived.by(() => filteredUsers.filter((user) => selectedIds[user.id]))

    async function loadUsers() {
        loading = true
        errorMsg = ''
        try {
            const res = await listUsers()
            users = res.data ?? []
        } catch (error) {
            errorMsg = formatAdminError(error)
        } finally {
            loading = false
        }
    }

    async function handleCreate() {
        try {
            await createUser(newUser)
            showCreate = false
            newUser = { email: '', name: '', password: '', role: 'user' }
            await loadUsers()
        } catch (error) {
            errorMsg = formatAdminError(error)
        }
    }

    async function toggleActive(user: AdminUser) {
        await updateUser(user.id, { isActive: !user.isActive })
        await loadUsers()
    }

    async function changeRole(user: AdminUser, role: string) {
        await updateUser(user.id, { role })
        await loadUsers()
    }

    async function handleResetPassword(user: AdminUser) {
        const newPass = prompt(`Reset password for ${user.email}`)
        if (!newPass) return
        await resetPassword(user.id, newPass)
    }

    async function handleDelete(user: AdminUser) {
        if (!confirm(`Delete user ${user.email}?`)) return
        await deleteUser(user.id)
        await loadUsers()
    }

    function toggleSelectAll(checked: boolean) {
        const next: Record<string, boolean> = { ...selectedIds }
        for (const user of filteredUsers) {
            next[user.id] = checked
        }
        selectedIds = next
    }

    async function bulkUpdateStatus(isActive: boolean) {
        if (selectedUsers.length === 0) return
        bulkLoading = true
        try {
            await Promise.all(selectedUsers.map((user) => updateUser(user.id, { isActive })))
            selectedIds = {}
            await loadUsers()
        } finally {
            bulkLoading = false
        }
    }

    async function bulkUpdateRole() {
        if (selectedUsers.length === 0) return
        bulkLoading = true
        try {
            await Promise.all(selectedUsers.map((user) => updateUser(user.id, { role: bulkRole })))
            selectedIds = {}
            await loadUsers()
        } finally {
            bulkLoading = false
        }
    }

    async function bulkDelete() {
        if (selectedUsers.length === 0) return
        if (!confirm(`Delete ${selectedUsers.length} selected users?`)) return
        bulkLoading = true
        try {
            await Promise.all(selectedUsers.map((user) => deleteUser(user.id)))
            selectedIds = {}
            await loadUsers()
        } finally {
            bulkLoading = false
        }
    }

    onMount(() => {
        void loadUsers()
    })
</script>

<div class="card" data-testid="admin-users-panel">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">{$isLoading ? 'User Management' : $_('admin.userManagement')}</h3>
            <p class="text-sm text-slate-500">{$isLoading ? 'Manage accounts, roles, and access status.' : $_('admin.userSubtitle')}</p>
        </div>
        <Button onclick={() => showCreate = !showCreate}>
            {showCreate ? ($isLoading ? 'Close' : $_('admin.closeForm')) : ($isLoading ? 'Add user' : $_('admin.addUser'))}
        </Button>
    </div>

    {#if errorMsg}
        <div class="alert alert-error mt-3 break-words">{errorMsg}</div>
    {/if}

    {#if showCreate}
        <div class="card mt-4">
            <div class="grid gap-3 md:grid-cols-2">
                <div>
                    <label class="label-base" for="new-user-email">{$isLoading ? 'Email' : $_('admin.email')}</label>
                    <input id="new-user-email" class="input-base" bind:value={newUser.email}  />
                </div>
                <div>
                    <label class="label-base" for="new-user-name">{$isLoading ? 'Name' : $_('admin.name')}</label>
                    <input id="new-user-name" class="input-base" bind:value={newUser.name}  />
                </div>
                <div>
                    <label class="label-base" for="new-user-password">{$isLoading ? 'Password' : $_('admin.password')}</label>
                    <input id="new-user-password" class="input-base" type="password" bind:value={newUser.password}  />
                </div>
                <div>
                    <label class="label-base" for="new-user-role">{$isLoading ? 'Role' : $_('admin.role')}</label>
                    <select id="new-user-role" class="select-base" bind:value={newUser.role}>
                        <option value="requester">{$isLoading ? 'User' : $_('admin.roles.user')}</option>
                        <option value="viewer">{$isLoading ? 'Viewer' : $_('admin.roles.viewer')}</option>
                        <option value="technician">{$isLoading ? 'Technician' : $_('admin.roles.technician')}</option>
                        <option value="warehouse_keeper">{$isLoading ? 'Storekeeper' : $_('admin.roles.storekeeper')}</option>
                        <option value="it_asset_manager">{$isLoading ? 'IT Manager' : $_('admin.roles.itManager')}</option>
                        <option value="admin">{$isLoading ? 'Admin' : $_('admin.roles.admin')}</option>
                    </select>
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <Button onclick={handleCreate} disabled={!newUser.email || !newUser.password}>{$isLoading ? 'Create' : $_('admin.createUser')}</Button>
                <Button variant="secondary" onclick={() => showCreate = false}>{$isLoading ? 'Cancel' : $_('admin.cancel')}</Button>
            </div>
        </div>
    {/if}

    <div class="mt-4 grid gap-2 md:grid-cols-3">
        <input class="input-base" placeholder={$isLoading ? 'Search user' : $_('admin.searchPlaceholder')} bind:value={search}  />
        <select class="select-base" bind:value={roleFilter}>
            <option value="all">{$isLoading ? 'All roles' : $_('admin.allRoles')}</option>
            <option value="requester">{$isLoading ? 'User' : $_('admin.roles.user')}</option>
            <option value="user">{$isLoading ? 'User (legacy)' : $_('admin.userLegacy')}</option>
            <option value="viewer">{$isLoading ? 'Viewer' : $_('admin.roles.viewer')}</option>
            <option value="technician">{$isLoading ? 'Technician' : $_('admin.roles.technician')}</option>
            <option value="warehouse_keeper">{$isLoading ? 'Storekeeper' : $_('admin.roles.storekeeper')}</option>
            <option value="it_asset_manager">{$isLoading ? 'IT Manager' : $_('admin.roles.itManager')}</option>
            <option value="admin">{$isLoading ? 'Admin' : $_('admin.roles.admin')}</option>
        </select>
        <select class="select-base" bind:value={statusFilter}>
            <option value="all">{$isLoading ? 'All status' : $_('admin.allStatus')}</option>
            <option value="active">{$isLoading ? 'Active' : $_('admin.active')}</option>
            <option value="disabled">{$isLoading ? 'Disabled' : $_('admin.disabled')}</option>
        </select>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
        <input
            type="checkbox"
            class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
            checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
            onchange={(e) => toggleSelectAll((e.target as HTMLInputElement).checked)}
        />
        <span class="text-sm text-slate-500">{$isLoading ? 'Select all' : $_('admin.selectAll')}</span>
        <span class="badge badge-blue">{$isLoading ? selectedUsers.length + '' : $_('admin.selected', { values: { count: selectedUsers.length } })}</span>
        <Button size="sm" variant="secondary" onclick={() => bulkUpdateStatus(false)} disabled={bulkLoading || selectedUsers.length === 0}>
            {$isLoading ? 'Lock' : $_('admin.lock')}
        </Button>
        <Button size="sm" variant="secondary" onclick={() => bulkUpdateStatus(true)} disabled={bulkLoading || selectedUsers.length === 0}>
            {$isLoading ? 'Unlock' : $_('admin.unlock')}
        </Button>
        <select class="select-base" bind:value={bulkRole}>
            <option value="requester">{$isLoading ? 'User' : $_('admin.roles.user')}</option>
            <option value="viewer">{$isLoading ? 'Viewer' : $_('admin.roles.viewer')}</option>
            <option value="technician">{$isLoading ? 'Technician' : $_('admin.roles.technician')}</option>
            <option value="warehouse_keeper">{$isLoading ? 'Storekeeper' : $_('admin.roles.storekeeper')}</option>
            <option value="it_asset_manager">{$isLoading ? 'IT Manager' : $_('admin.roles.itManager')}</option>
            <option value="admin">{$isLoading ? 'Admin' : $_('admin.roles.admin')}</option>
        </select>
        <Button size="sm" variant="secondary" onclick={bulkUpdateRole} disabled={bulkLoading || selectedUsers.length === 0}>
            {$isLoading ? 'Apply Role' : $_('admin.applyRole')}
        </Button>
        <Button size="sm" variant="danger" onclick={bulkDelete} disabled={bulkLoading || selectedUsers.length === 0}>
            {$isLoading ? 'Delete' : $_('admin.delete')}
        </Button>
    </div>

    <div class="mt-4 grid gap-3">
        {#if loading}
            <p class="text-sm text-slate-500">{$isLoading ? 'Loading...' : $_('admin.loadingUsers')}</p>
        {:else if filteredUsers.length === 0}
            <p class="text-sm text-slate-500">{$isLoading ? 'No users found.' : $_('admin.noUsers')}</p>
        {:else}
            {#each filteredUsers as user}
                <div class="card">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div class="flex items-start gap-3">
                            <input
                                type="checkbox"
                                class="mt-1 rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
                                checked={selectedIds[user.id] || false}
                                onchange={(e) => selectedIds = { ...selectedIds, [user.id]: (e.target as HTMLInputElement).checked }}
                            />
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="text-lg font-semibold text-white">{user.name}</h3>
                                    <span class="badge-primary">{user.role}</span>
                                    <span class={user.isActive ? 'badge-success' : 'badge-error'}>
                                        {user.isActive ? ($isLoading ? 'Active' : $_('admin.active')) : ($isLoading ? 'Disabled' : $_('admin.disabled'))}
                                    </span>
                                </div>
                                <p class="text-sm text-slate-500">{user.email}</p>
                                {#if user.lastLogin}
                                    <p class="text-xs text-slate-400">{$isLoading ? 'Last login:' : $_('admin.lastLogin') + ':'} {new Date(user.lastLogin).toLocaleString()}</p>
                                {/if}
                            </div>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <select class="select-base" value={user.role} onchange={(e) => changeRole(user, (e.target as HTMLSelectElement).value)}>
                                <option value="requester">{$isLoading ? 'User' : $_('admin.roles.user')}</option>
                                <option value="user">{$isLoading ? 'User (legacy)' : $_('admin.userLegacy')}</option>
                                <option value="viewer">{$isLoading ? 'Viewer' : $_('admin.roles.viewer')}</option>
                                <option value="technician">{$isLoading ? 'Technician' : $_('admin.roles.technician')}</option>
                                <option value="warehouse_keeper">{$isLoading ? 'Storekeeper' : $_('admin.roles.storekeeper')}</option>
                                <option value="it_asset_manager">{$isLoading ? 'IT Manager' : $_('admin.roles.itManager')}</option>
                                <option value="admin">{$isLoading ? 'Admin' : $_('admin.roles.admin')}</option>
                            </select>
                            <Button size="sm" variant={user.isActive ? 'danger' : 'primary'} onclick={() => toggleActive(user)}>
                                {user.isActive ? ($isLoading ? 'Lock' : $_('admin.lock')) : ($isLoading ? 'Unlock' : $_('admin.unlock'))}
                            </Button>
                            <Button size="sm" variant="secondary" onclick={() => handleResetPassword(user)}>{$isLoading ? 'Reset password' : $_('admin.resetPassword')}</Button>
                            <Button size="sm" variant="danger" onclick={() => handleDelete(user)}>{$isLoading ? 'Delete' : $_('admin.delete')}</Button>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>
