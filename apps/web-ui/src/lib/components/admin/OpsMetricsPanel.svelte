<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { getDailySummary, listUsageLogs, listModels, listProviders } from '$lib/api/chat'
    import { listUsers } from '$lib/api/admin'
    import { formatAdminError } from '$lib/admin/errors'

    type MetricCard = {
        label: string
        value: string
        description: string
        badge?: string
    }

    let technicalMetrics = $state<MetricCard[]>([])
    let operationalMetrics = $state<MetricCard[]>([])
    let loading = $state(false)
    let error = $state('')
    let lastUpdated = $state<string | null>(null)

    async function loadMetrics() {
        loading = true
        error = ''
        try {
            const [summary, usageLogs, modelsRes, providersRes, usersRes] = await Promise.all([
                getDailySummary(),
                listUsageLogs(200),
                listModels(),
                listProviders(),
                listUsers()
            ])

            const totalTokens = summary.totalTokens ?? 0
            const totalCost = summary.totalCost ?? 0
            const totalMessages = summary.totalMessages ?? 0

            const usageCost = usageLogs.data?.reduce((acc, entry) => acc + (entry.cost ?? 0), 0) ?? 0
            const usageTokens = usageLogs.data?.reduce((acc, entry) => acc + (entry.totalTokens ?? 0), 0) ?? 0

            operationalMetrics = [
                { label: 'Daily tokens', value: totalTokens.toLocaleString(), description: 'Tokens consumed today' },
                { label: 'Daily cost', value: `$${totalCost.toFixed(2)}`, description: 'Estimated cost today' },
                { label: 'Daily messages', value: totalMessages.toLocaleString(), description: 'Total messages today' },
                { label: 'Usage logs (sample)', value: usageTokens.toLocaleString(), description: 'Tokens from recent logs', badge: `$${usageCost.toFixed(2)}` },
                { label: 'Active models', value: String(modelsRes.data?.filter((m) => m.enabled).length ?? 0), description: 'Enabled models' },
                { label: 'Active providers', value: String(providersRes.data?.length ?? 0), description: 'Configured providers' },
                { label: 'Total users', value: String(usersRes.data?.length ?? 0), description: 'Registered accounts' }
            ]

            technicalMetrics = [
                { label: 'API checks', value: '5', description: 'Health checks enabled' },
                { label: 'Latency target', value: '< 1500 ms', description: 'Degraded threshold for checks' },
                { label: 'Refresh interval', value: 'Manual', description: 'Admin-controlled refresh' }
            ]

            lastUpdated = new Date().toISOString()
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void loadMetrics()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">System Metrics</h3>
            <p class="text-sm text-slate-500">Operational KPIs and technical service signals.</p>
        </div>
        <div class="flex items-center gap-2">
            {#if lastUpdated}
                <span class="text-xs text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
            {/if}
            <Button size="sm" variant="secondary" onclick={loadMetrics} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
        </div>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="card">
            <h4 class="text-md font-semibold text-white">Operational Metrics</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
                {#each operationalMetrics as metric}
                    <div class="rounded-lg border border-slate-700 p-3">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-semibold text-white">{metric.label}</p>
                            {#if metric.badge}
                                <span class="badge-primary">{metric.badge}</span>
                            {/if}
                        </div>
                        <p class="text-xl font-bold text-white">{metric.value}</p>
                        <p class="text-xs text-slate-500">{metric.description}</p>
                    </div>
                {/each}
            </div>
        </div>

        <div class="card">
            <h4 class="text-md font-semibold text-white">Technical Metrics</h4>
            <div class="mt-3 grid gap-3">
                {#each technicalMetrics as metric}
                    <div class="rounded-lg border border-slate-700 p-3">
                        <p class="text-sm font-semibold text-white">{metric.label}</p>
                        <p class="text-xl font-bold text-white">{metric.value}</p>
                        <p class="text-xs text-slate-500">{metric.description}</p>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>
