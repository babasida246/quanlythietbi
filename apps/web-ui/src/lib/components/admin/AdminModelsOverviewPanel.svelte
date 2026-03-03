<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import {
        listModels,
        listProviders,
        listOrchestrationRules,
        type ModelConfig,
        type AIProvider,
        type OrchestrationRule
    } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'

    let models = $state<ModelConfig[]>([])
    let providers = $state<AIProvider[]>([])
    let rules = $state<OrchestrationRule[]>([])
    let loading = $state(false)
    let error = $state('')

    const summary = $derived.by(() => ({
        totalModels: models.length,
        activeModels: models.filter((model) => model.enabled).length,
        providers: providers.length,
        rules: rules.length
    }))

    const topPriority = $derived.by(() =>
        models.slice().sort((a, b) => a.priority - b.priority).slice(0, 6)
    )

    async function loadOverview() {
        loading = true
        error = ''
        try {
            const [modelsRes, providersRes, rulesRes] = await Promise.all([
                listModels(),
                listProviders(),
                listOrchestrationRules(false)
            ])
            models = modelsRes.data ?? []
            providers = providersRes.data ?? []
            rules = rulesRes.data ?? []
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void loadOverview()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h3 class="text-lg font-semibold text-white">Models Overview</h3>
            <p class="text-sm text-slate-500">Snapshot of active models, providers, and routing rules.</p>
        </div>
        <Button size="sm" variant="secondary" onclick={loadOverview} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
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
        <div class="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Total models</p>
                <p class="text-xl font-semibold text-white">{summary.totalModels}</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Active models</p>
                <p class="text-xl font-semibold text-white">{summary.activeModels}</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Providers</p>
                <p class="text-xl font-semibold text-white">{summary.providers}</p>
            </div>
            <div class="rounded-xl border border-slate-700 p-4 bg-surface-2">
                <p class="text-xs text-slate-500">Routing rules</p>
                <p class="text-xl font-semibold text-white">{summary.rules}</p>
            </div>
        </div>

        <div class="mt-6">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-white">Top Priority Models</h4>
                <span class="badge-primary">{topPriority.length}</span>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {#if topPriority.length === 0}
                    <div class="rounded-lg border border-slate-700 p-4 text-sm text-slate-500">
                        No models configured.
                    </div>
                {:else}
                    {#each topPriority as model}
                        <div class="rounded-lg border border-slate-700 p-3 bg-surface-2">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-white">{model.displayName ?? model.id}</p>
                                    <p class="text-xs text-slate-500">{model.provider}</p>
                                </div>
                                <span class={model.enabled ? 'badge-success' : 'badge-error'}>
                                    {model.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <div class="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                <span>Status: {model.status ?? 'active'}</span>
                                <span>Priority: {model.priority}</span>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>
