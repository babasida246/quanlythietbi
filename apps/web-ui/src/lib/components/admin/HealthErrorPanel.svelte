<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { listUsers, listAuditLogs } from '$lib/api/admin'
    import { listProviders, listModels, getDailySummary } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'
    import { pushNotification } from '$lib/admin/notifications'

    type HealthStatus = 'healthy' | 'degraded' | 'down'

    type HealthCheck = {
        id: string
        label: string
        status: HealthStatus
        latencyMs: number | null
        error?: string
        lastChecked?: string
    }

    type HealthDefinition = {
        id: string
        label: string
        run: () => Promise<void>
    }

    const definitions: HealthDefinition[] = [
        { id: 'users', label: 'Users API', run: async () => { await listUsers() } },
        { id: 'audit', label: 'Audit Logs API', run: async () => { await listAuditLogs({ limit: 10 }) } },
        { id: 'providers', label: 'Providers API', run: async () => { await listProviders() } },
        { id: 'models', label: 'Models API', run: async () => { await listModels() } },
        { id: 'stats', label: 'Daily Stats API', run: async () => { await getDailySummary() } }
    ]

    let checks = $state<HealthCheck[]>([])
    let loading = $state(false)
    let lastUpdated = $state<string | null>(null)

    const summary = $derived.by(() => {
        const total = checks.length
        const healthy = checks.filter((check) => check.status === 'healthy').length
        const degraded = checks.filter((check) => check.status === 'degraded').length
        const down = checks.filter((check) => check.status === 'down').length
        return { total, healthy, degraded, down }
    })

    function statusBadgeColor(status: HealthStatus): string {
        if (status === 'healthy') return 'badge-success'
        if (status === 'degraded') return 'badge-warning'
        return 'badge-error'
    }

    function statusLabel(status: HealthStatus): string {
        if (status === 'healthy') return 'Healthy'
        if (status === 'degraded') return 'Degraded'
        return 'Down'
    }

    async function runCheck(definition: HealthDefinition, previousStatus?: HealthStatus): Promise<HealthCheck> {
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
        try {
            await definition.run()
            const latency = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
            const status: HealthStatus = latency > 1500 ? 'degraded' : 'healthy'
            if (previousStatus && previousStatus !== status && status !== 'healthy') {
                pushNotification({
                    title: `${definition.label} ${status === 'degraded' ? 'Degraded' : 'Down'}`,
                    message: `Health check reported ${status} (${latency} ms).`,
                    severity: status === 'degraded' ? 'warning' : 'critical',
                    source: 'Health Panel'
                })
            }
            return {
                id: definition.id,
                label: definition.label,
                status,
                latencyMs: latency,
                lastChecked: new Date().toISOString()
            }
        } catch (error) {
            const latency = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
            const message = formatAdminError(error)
            if (!previousStatus || previousStatus !== 'down') {
                pushNotification({
                    title: `${definition.label} Down`,
                    message,
                    severity: 'critical',
                    source: 'Health Panel'
                })
            }
            return {
                id: definition.id,
                label: definition.label,
                status: 'down',
                latencyMs: latency,
                error: message,
                lastChecked: new Date().toISOString()
            }
        }
    }

    async function refreshChecks() {
        if (loading) return
        loading = true
        const previous = new Map(checks.map((check) => [check.id, check.status]))
        const results = await Promise.all(definitions.map((definition) => runCheck(definition, previous.get(definition.id))))
        checks = results
        lastUpdated = new Date().toISOString()
        loading = false
    }

    onMount(() => {
        void refreshChecks()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
            <h3 class="text-lg font-semibold text-white">Health & Error Panel</h3>
            <p class="text-sm text-slate-500">
                Quick visibility into core services and API stability.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <span class="badge-success">Healthy {summary.healthy}</span>
            <span class="badge-warning">Degraded {summary.degraded}</span>
            <span class="badge-error">Down {summary.down}</span>
            <Button size="sm" variant="secondary" onclick={refreshChecks} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
        </div>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-2">
        {#each checks as check}
            <div class="rounded-lg border border-slate-700 p-3">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <p class="text-sm font-semibold text-white">{check.label}</p>
                        <p class="text-xs text-slate-500">Last checked: {check.lastChecked ? new Date(check.lastChecked).toLocaleString() : '-'}</p>
                    </div>
                    <span class={statusBadgeColor(check.status)}>{statusLabel(check.status)}</span>
                </div>
                <div class="mt-2 text-xs text-slate-500">
                    <span>Latency: {check.latencyMs !== null ? `${check.latencyMs} ms` : '-'}</span>
                    {#if check.error}
                        <p class="mt-1 text-rose-600 text-xs break-words" title={check.error}>Error: {check.error}</p>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
