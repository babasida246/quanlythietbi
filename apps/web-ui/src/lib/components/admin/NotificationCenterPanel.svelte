<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { loadNotifications, acknowledgeNotification, clearNotifications, type AdminNotification } from '$lib/admin/notifications'

    let notifications = $state<AdminNotification[]>([])
    let filter = $state<'all' | 'info' | 'warning' | 'critical'>('all')

    const filtered = $derived.by(() => {
        if (filter === 'all') return notifications
        return notifications.filter((item) => item.severity === filter)
    })

    function refresh() {
        notifications = loadNotifications()
    }

    function handleAcknowledge(id: string) {
        acknowledgeNotification(id)
        refresh()
    }

    function handleClear() {
        clearNotifications()
        refresh()
    }

    function severityColor(severity: AdminNotification['severity']): string {
        if (severity === 'critical') return 'badge-error'
        if (severity === 'warning') return 'badge-warning'
        return 'badge-primary'
    }

    onMount(() => {
        refresh()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Notification Center</h3>
            <p class="text-sm text-slate-500">Monitor incidents, quota alerts, and critical changes.</p>
        </div>
        <div class="flex items-center gap-2">
            <select class="select-base" bind:value={filter}>
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
            </select>
            <Button size="sm" variant="secondary" onclick={refresh}>Refresh</Button>
            <Button size="sm" variant="secondary" onclick={handleClear} disabled={notifications.length === 0}>Clear</Button>
        </div>
    </div>

    <div class="mt-4 grid gap-3">
        {#if filtered.length === 0}
            <p class="text-sm text-slate-500">No notifications.</p>
        {:else}
            {#each filtered as item}
                <div class="rounded-lg border border-slate-700 p-3">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class={severityColor(item.severity)}>{item.severity}</span>
                            <span class="text-sm font-semibold text-white">{item.title}</span>
                        </div>
                        <Button size="sm" variant="secondary" onclick={() => handleAcknowledge(item.id)} disabled={item.acknowledged}>
                            {item.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                        </Button>
                    </div>
                    <p class="text-sm text-slate-500 mt-2">{item.message}</p>
                    <div class="text-xs text-slate-400 mt-1">
                        {item.source ? `${item.source} • ` : ''}{new Date(item.createdAt).toLocaleString()}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>
