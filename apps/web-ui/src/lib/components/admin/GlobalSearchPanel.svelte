<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { listUsers, listAuditLogs, type AdminUser, type AuditLogEntry } from '$lib/api/admin'
    import { listProviders, listModels, type AIProvider, type ModelConfig } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'

    type SearchResults = {
        users: AdminUser[]
        logs: AuditLogEntry[]
        providers: AIProvider[]
        models: ModelConfig[]
    }

    let query = $state('')
    let loading = $state(false)
    let error = $state('')
    let dataset = $state<SearchResults>({ users: [], logs: [], providers: [], models: [] })

    const results = $derived.by(() => {
        const q = query.trim().toLowerCase()
        if (!q) return { users: [], logs: [], providers: [], models: [] }
        return {
            users: dataset.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(q)),
            logs: dataset.logs.filter((log) => `${log.action} ${log.resource} ${log.userId ?? ''}`.toLowerCase().includes(q)),
            providers: dataset.providers.filter((provider) => `${provider.name} ${provider.id}`.toLowerCase().includes(q)),
            models: dataset.models.filter((model) => `${model.id} ${model.displayName ?? ''}`.toLowerCase().includes(q))
        }
    })

    async function loadData() {
        loading = true
        error = ''
        try {
            const [usersRes, logsRes, providersRes, modelsRes] = await Promise.all([
                listUsers(),
                listAuditLogs({ limit: 100 }),
                listProviders(),
                listModels()
            ])
            dataset = {
                users: usersRes.data ?? [],
                logs: logsRes.data ?? [],
                providers: providersRes.data ?? [],
                models: modelsRes.data ?? []
            }
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void loadData()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Global Search</h3>
            <p class="text-sm text-slate-500">Search across users, logs, providers, and models.</p>
        </div>
        <Button size="sm" variant="secondary" onclick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4">
        <input class="input-base" placeholder="Search everything..." bind:value={query}  />
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-700 p-3">
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-white">Users</h4>
                <span class="badge-primary">{results.users.length}</span>
            </div>
            <div class="mt-2 text-sm text-slate-500 space-y-1">
                {#if results.users.length === 0}
                    <p>No matches</p>
                {:else}
                    {#each results.users.slice(0, 5) as user}
                        <p>{user.name} • {user.email}</p>
                    {/each}
                {/if}
            </div>
        </div>

        <div class="rounded-lg border border-slate-700 p-3">
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-white">Audit Logs</h4>
                <span class="badge-primary">{results.logs.length}</span>
            </div>
            <div class="mt-2 text-sm text-slate-500 space-y-1">
                {#if results.logs.length === 0}
                    <p>No matches</p>
                {:else}
                    {#each results.logs.slice(0, 5) as log}
                        <p>{log.action} • {log.resource}</p>
                    {/each}
                {/if}
            </div>
        </div>

        <div class="rounded-lg border border-slate-700 p-3">
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-white">Providers</h4>
                <span class="badge-primary">{results.providers.length}</span>
            </div>
            <div class="mt-2 text-sm text-slate-500 space-y-1">
                {#if results.providers.length === 0}
                    <p>No matches</p>
                {:else}
                    {#each results.providers.slice(0, 5) as provider}
                        <p>{provider.name}</p>
                    {/each}
                {/if}
            </div>
        </div>

        <div class="rounded-lg border border-slate-700 p-3">
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-white">Models</h4>
                <span class="badge-primary">{results.models.length}</span>
            </div>
            <div class="mt-2 text-sm text-slate-500 space-y-1">
                {#if results.models.length === 0}
                    <p>No matches</p>
                {:else}
                    {#each results.models.slice(0, 5) as model}
                        <p>{model.displayName ?? model.id}</p>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
</div>
