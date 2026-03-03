<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { listAuditLogs, type AuditLogEntry } from '$lib/api/admin'
    import { formatAdminError } from '$lib/admin/errors'

    let logs = $state<AuditLogEntry[]>([])
    let loading = $state(false)
    let error = $state('')

    async function loadLogs() {
        loading = true
        error = ''
        try {
            const res = await listAuditLogs({ limit: 50 })
            logs = res.data ?? []
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void loadLogs()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Admin Activity Feed</h3>
            <p class="text-sm text-slate-500">Timeline of recent admin actions for traceability.</p>
        </div>
        <Button size="sm" variant="secondary" onclick={loadLogs} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4 space-y-3">
        {#if logs.length === 0}
            <p class="text-sm text-slate-500">No activity yet.</p>
        {:else}
            {#each logs as log}
                <div class="rounded-lg border border-slate-700 p-3">
                    <div class="flex items-center justify-between text-sm">
                        <span class="font-semibold text-white">{log.action}</span>
                        <span class="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">
                        Resource: {log.resource}{log.resourceId ? ` (${log.resourceId})` : ''} • Actor: {log.userId ?? 'system'}
                    </p>
                </div>
            {/each}
        {/if}
    </div>
</div>
