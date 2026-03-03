<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { listAuditLogs, type AuditLogEntry } from '$lib/api/admin'
    import { formatAdminError } from '$lib/admin/errors'

    const pageSize = 20

    let logs = $state<AuditLogEntry[]>([])
    let loading = $state(false)
    let error = $state('')
    let page = $state(1)

    let filters = $state({
        search: '',
        actor: '',
        action: '',
        resource: '',
        startDate: '',
        endDate: ''
    })

    const filteredLogs = $derived.by(() => {
        return logs.filter((log) => {
            const search = filters.search.trim().toLowerCase()
            const actor = filters.actor.trim().toLowerCase()
            const action = filters.action.trim().toLowerCase()
            const resource = filters.resource.trim().toLowerCase()
            const logDate = new Date(log.createdAt)
            const startDate = filters.startDate ? new Date(filters.startDate) : null
            const endDate = filters.endDate ? new Date(filters.endDate) : null

            if (search) {
                const target = `${log.action} ${log.resource} ${log.resourceId ?? ''} ${log.userId ?? ''}`.toLowerCase()
                if (!target.includes(search)) return false
            }
            if (actor && !(log.userId ?? '').toLowerCase().includes(actor)) return false
            if (action && !log.action.toLowerCase().includes(action)) return false
            if (resource && !log.resource.toLowerCase().includes(resource)) return false
            if (startDate && logDate < startDate) return false
            if (endDate) {
                const endOfDay = new Date(endDate)
                endOfDay.setHours(23, 59, 59, 999)
                if (logDate > endOfDay) return false
            }
            return true
        })
    })

    const totalPages = $derived.by(() => Math.max(1, Math.ceil(filteredLogs.length / pageSize)))

    const pageItems = $derived.by(() => {
        const start = (page - 1) * pageSize
        return filteredLogs.slice(start, start + pageSize)
    })

    $effect(() => {
        filters.search
        filters.actor
        filters.action
        filters.resource
        filters.startDate
        filters.endDate
        page = 1
    })

    async function loadLogs() {
        if (loading) return
        loading = true
        error = ''
        try {
            const res = await listAuditLogs({ limit: 200 })
            logs = res.data ?? []
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    function exportCsv() {
        const rows = [
            ['Time', 'Action', 'Resource', 'Resource ID', 'Actor', 'IP', 'User Agent']
        ]
        for (const log of filteredLogs) {
            rows.push([
                new Date(log.createdAt).toISOString(),
                log.action,
                log.resource,
                log.resourceId ?? '',
                log.userId ?? 'system',
                log.ipAddress ?? '',
                log.userAgent ?? ''
            ])
        }
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    onMount(() => {
        void loadLogs()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
            <h3 class="text-lg font-semibold text-white">Audit Logs</h3>
            <p class="text-sm text-slate-500">Search, filter, and export admin activity.</p>
        </div>
        <div class="flex items-center gap-2">
            <Button size="sm" variant="secondary" onclick={loadLogs} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button size="sm" variant="secondary" onclick={exportCsv} disabled={filteredLogs.length === 0}>
                Export CSV
            </Button>
        </div>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="mt-4 grid gap-2 md:grid-cols-3">
        <input class="input-base" placeholder="Search keyword" bind:value={filters.search}  />
        <input class="input-base" placeholder="Actor" bind:value={filters.actor}  />
        <input class="input-base" placeholder="Action" bind:value={filters.action}  />
        <input class="input-base" placeholder="Resource" bind:value={filters.resource}  />
        <input class="input-base" type="date" bind:value={filters.startDate}  />
        <input class="input-base" type="date" bind:value={filters.endDate}  />
    </div>

    <div class="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span class="badge-primary">Total {filteredLogs.length}</span>
        <span>Page {page} of {totalPages}</span>
    </div>

    <div class="mt-4 overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full text-sm text-left text-slate-400">
            <thead class="text-xs uppercase bg-surface-2 text-slate-400">
                <tr>
                    <th class="px-4 py-3">Time</th>
                    <th class="px-4 py-3">Action</th>
                    <th class="px-4 py-3">Resource</th>
                    <th class="px-4 py-3">Actor</th>
                    <th class="px-4 py-3">IP</th>
                </tr>
            </thead>
            <tbody>
                {#if pageItems.length === 0}
                    <tr><td colspan="5" class="px-4 py-4 text-center text-slate-500">No audit entries found.</td></tr>
                {:else}
                    {#each pageItems as log}
                        <tr class="bg-surface-2 border-b border-slate-700">
                            <td class="px-4 py-3 font-medium text-white">
                                {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td class="px-4 py-3">{log.action}</td>
                            <td class="px-4 py-3">{log.resource} {log.resourceId ? `(${log.resourceId})` : ''}</td>
                            <td class="px-4 py-3">{log.userId ?? 'system'}</td>
                            <td class="px-4 py-3">{log.ipAddress ?? '-'}</td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
        <Button size="sm" variant="secondary" onclick={() => page = Math.max(1, page - 1)} disabled={page <= 1}>
            Previous
        </Button>
        <Button size="sm" variant="secondary" onclick={() => page = Math.min(totalPages, page + 1)} disabled={page >= totalPages}>
            Next
        </Button>
    </div>
</div>
