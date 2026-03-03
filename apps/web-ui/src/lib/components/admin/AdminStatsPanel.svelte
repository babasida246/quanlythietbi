<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import { getDailySummary, getUserStats, type DailySummary, type UserTokenStats } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'

    type Period = 'today' | 'week' | 'month'

    let selectedPeriod = $state<Period>('week')
    let stats = $state<UserTokenStats[]>([])
    let summary = $state<DailySummary | null>(null)
    let loading = $state(false)
    let error = $state('')

    const periodLabel = $derived.by(() => {
        if (selectedPeriod === 'today') return 'Today'
        if (selectedPeriod === 'week') return 'Last 7 days'
        return 'Last 30 days'
    })

    const totals = $derived.by(() => ({
        tokens: stats.reduce((sum, item) => sum + item.totalTokens, 0),
        cost: stats.reduce((sum, item) => sum + item.totalCost, 0),
        messages: stats.reduce((sum, item) => sum + item.messageCount, 0),
        conversations: new Set(stats.map((item) => `${item.userId}-${item.date}`)).size
    }))

    const topModels = $derived.by(() => {
        const aggregated = stats.reduce((acc, stat) => {
            if (!acc[stat.model]) {
                acc[stat.model] = {
                    model: stat.model,
                    provider: stat.provider,
                    totalCost: 0,
                    totalTokens: 0,
                    messageCount: 0
                }
            }
            acc[stat.model].totalCost += stat.totalCost
            acc[stat.model].totalTokens += stat.totalTokens
            acc[stat.model].messageCount += stat.messageCount
            return acc
        }, {} as Record<string, { model: string; provider: string; totalCost: number; totalTokens: number; messageCount: number }>)

        return Object.values(aggregated)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5)
    })

    async function loadStats() {
        loading = true
        error = ''
        try {
            const now = new Date()
            let startDate: Date | undefined

            if (selectedPeriod === 'today') {
                startDate = new Date(now.setHours(0, 0, 0, 0))
            } else if (selectedPeriod === 'week') {
                startDate = new Date(now.setDate(now.getDate() - 7))
            } else {
                startDate = new Date(now.setDate(now.getDate() - 30))
            }

            const [statsRes, summaryRes] = await Promise.all([
                getUserStats({
                    startDate: startDate?.toISOString(),
                    endDate: new Date().toISOString()
                }),
                getDailySummary()
            ])

            stats = statsRes.data ?? []
            summary = summaryRes ?? null
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    function formatCurrency(value: number): string {
        return `$${value.toFixed(4)}`
    }

    onMount(() => {
        void loadStats()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Usage & Cost Stats</h3>
            <p class="text-sm text-slate-500">Monitor consumption, cost, and top models from the admin center.</p>
        </div>
        <div class="flex items-center gap-2">
            <span class="badge-primary">{periodLabel}</span>
            <Button size="sm" variant="secondary" onclick={loadStats} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
        </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={selectedPeriod === 'today' ? 'primary' : 'secondary'} onclick={() => { selectedPeriod = 'today'; loadStats(); }}>
            Today
        </Button>
        <Button size="sm" variant={selectedPeriod === 'week' ? 'primary' : 'secondary'} onclick={() => { selectedPeriod = 'week'; loadStats(); }}>
            Last 7 days
        </Button>
        <Button size="sm" variant={selectedPeriod === 'month' ? 'primary' : 'secondary'} onclick={() => { selectedPeriod = 'month'; loadStats(); }}>
            Last 30 days
        </Button>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    {#if loading}
        <div class="py-8 flex items-center justify-center">
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
    {:else}
        <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Tokens</p>
                <p class="text-xl font-semibold text-white">{totals.tokens.toLocaleString()}</p>
                <p class="text-xs text-slate-500 mt-1">{summary?.modelsUsed ?? 0} models used today</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Cost</p>
                <p class="text-xl font-semibold text-white">{formatCurrency(totals.cost)}</p>
                <p class="text-xs text-slate-500 mt-1">Avg {formatCurrency(totals.messages ? totals.cost / totals.messages : 0)} / msg</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Messages</p>
                <p class="text-xl font-semibold text-white">{totals.messages.toLocaleString()}</p>
                <p class="text-xs text-slate-500 mt-1">{totals.conversations} conversations</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Daily cost</p>
                <p class="text-xl font-semibold text-white">
                    {summary ? formatCurrency(summary.totalCost) : '$0.0000'}
                </p>
                <p class="text-xs text-slate-500 mt-1">{summary?.totalMessages ?? 0} messages today</p>
            </div>
        </div>

        <div class="mt-6">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-white">Top Models by Spend</h4>
                <span class="badge-primary">Top {topModels.length}</span>
            </div>
            <div class="overflow-x-auto rounded-xl border border-slate-700">
                <table class="w-full text-sm text-left text-slate-400">
                    <thead class="text-xs uppercase bg-surface-2 text-slate-400">
                        <tr>
                            <th class="px-4 py-3">Model</th>
                            <th class="px-4 py-3">Provider</th>
                            <th class="px-4 py-3">Tokens</th>
                            <th class="px-4 py-3">Messages</th>
                            <th class="px-4 py-3">Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if topModels.length === 0}
                            <tr><td colspan="5" class="px-4 py-4 text-center text-slate-500">No usage data available.</td></tr>
                        {:else}
                            {#each topModels as model}
                                <tr class="bg-surface-2 border-b border-slate-700">
                                    <td class="px-4 py-3 font-medium text-white">{model.model}</td>
                                    <td class="px-4 py-3">{model.provider}</td>
                                    <td class="px-4 py-3">{model.totalTokens.toLocaleString()}</td>
                                    <td class="px-4 py-3">{model.messageCount.toLocaleString()}</td>
                                    <td class="px-4 py-3 font-medium">{formatCurrency(model.totalCost)}</td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>
