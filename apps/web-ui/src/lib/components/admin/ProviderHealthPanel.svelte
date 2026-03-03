<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import {
        listProviders,
        checkProviderHealth,
        getOpenRouterCredits,
        type AIProvider,
        type ProviderHealth
    } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'

    type ProviderRow = {
        provider: AIProvider
        health?: ProviderHealth
        credits?: number
        error?: string
    }

    let providers = $state<ProviderRow[]>([])
    let loading = $state(false)
    let error = $state('')

    function statusColor(status?: ProviderHealth['status']): string {
        if (status === 'healthy') return 'badge-success'
        if (status === 'degraded') return 'badge-warning'
        if (status === 'unreachable') return 'badge-error'
        return 'badge-info'
    }

    async function loadProviders() {
        loading = true
        error = ''
        try {
            const response = await listProviders()
            providers = response.data.map((provider) => ({ provider }))
            await Promise.all(
                providers.map(async (row) => {
                    try {
                        row.health = await checkProviderHealth(row.provider.id)
                        if (row.provider.id === 'openrouter') {
                            try {
                                const credits = await getOpenRouterCredits()
                                row.credits = credits?.data?.creditsRemaining ?? credits?.creditsRemaining
                            } catch {
                                row.credits = undefined
                            }
                        }
                    } catch (err) {
                        row.error = formatAdminError(err)
                    }
                })
            )
            providers = [...providers]
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void loadProviders()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
            <h3 class="text-lg font-semibold text-white">Provider Health Dashboard</h3>
            <p class="text-sm text-slate-500">Monitor provider stability, latency, and credits.</p>
        </div>
        <Button size="sm" variant="secondary" onclick={loadProviders} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4 overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full text-sm text-left text-slate-400">
            <thead class="text-xs uppercase bg-surface-2 text-slate-400">
                <tr>
                    <th class="px-4 py-3">Provider</th>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3">Latency</th>
                    <th class="px-4 py-3">Credits</th>
                    <th class="px-4 py-3">Last Usage</th>
                </tr>
            </thead>
            <tbody>
                {#if providers.length === 0}
                    <tr><td colspan="5" class="px-4 py-4 text-center text-slate-500">No providers configured.</td></tr>
                {:else}
                    {#each providers as row}
                        <tr class="bg-surface-2 border-b border-slate-700">
                            <td class="px-4 py-3 font-medium text-white">{row.provider.name}</td>
                            <td class="px-4 py-3">
                                <span class={statusColor(row.health?.status)}>
                                    {row.health?.status ?? (row.error ? 'error' : 'unknown')}
                                </span>
                            </td>
                            <td class="px-4 py-3">{row.health?.latencyMs ? `${row.health.latencyMs} ms` : '-'}</td>
                            <td class="px-4 py-3">{row.credits ?? row.provider.creditsRemaining ?? '-'}</td>
                            <td class="px-4 py-3">
                                {row.provider.lastUsageAt ? new Date(row.provider.lastUsageAt).toLocaleString() : '-'}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>
