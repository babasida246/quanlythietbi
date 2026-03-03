<script lang="ts">
    import { Button } from '$lib/components/ui'
    import { onMount } from 'svelte'
    import {
        listOrchestrationRules,
        createOrchestrationRule,
        updateOrchestrationRule,
        deleteOrchestrationRule,
        listModels,
        type OrchestrationRule,
        type ModelConfig
    } from '$lib/api/chat'
    import { formatAdminError } from '$lib/admin/errors'

    let rules = $state<OrchestrationRule[]>([])
    let models = $state<ModelConfig[]>([])
    let loading = $state(false)
    let error = $state('')

    let newRule = $state({
        name: '',
        description: '',
        strategy: 'fallback',
        modelSequence: [] as string[],
        priority: 1
    })

    const ruleNameId = 'rule-name'
    const strategyId = 'rule-strategy'
    const modelSequenceId = 'rule-model-sequence'
    const priorityId = 'rule-priority'
    const descriptionId = 'rule-description'

    async function loadData() {
        loading = true
        error = ''
        try {
            const [rulesRes, modelsRes] = await Promise.all([listOrchestrationRules(false), listModels()])
            rules = rulesRes.data ?? []
            models = modelsRes.data ?? []
        } catch (err) {
            error = formatAdminError(err)
        } finally {
            loading = false
        }
    }

    async function createRule() {
        if (!newRule.name || newRule.modelSequence.length === 0) return
        await createOrchestrationRule({
            name: newRule.name,
            description: newRule.description || undefined,
            strategy: newRule.strategy as OrchestrationRule['strategy'],
            modelSequence: newRule.modelSequence,
            priority: newRule.priority
        })
        newRule = { name: '', description: '', strategy: 'fallback', modelSequence: [], priority: 1 }
        await loadData()
    }

    async function toggleRule(rule: OrchestrationRule) {
        await updateOrchestrationRule(rule.id, { enabled: !rule.enabled })
        await loadData()
    }

    async function updatePriority(rule: OrchestrationRule, priority: number) {
        if (Number.isNaN(priority)) return
        await updateOrchestrationRule(rule.id, { priority })
        await loadData()
    }

    async function removeRule(rule: OrchestrationRule) {
        if (!confirm(`Delete rule ${rule.name}?`)) return
        await deleteOrchestrationRule(rule.id)
        await loadData()
    }

    onMount(() => {
        void loadData()
    })
</script>

<div class="card">
    <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
            <h3 class="text-lg font-semibold text-white">Routing & Fallback Rules</h3>
            <p class="text-sm text-slate-500">Define orchestration strategies and failover order.</p>
        </div>
        <Button size="sm" variant="secondary" onclick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
    </div>

    {#if error}
        <div class="mt-3 text-sm text-rose-600 break-words">{error}</div>
    {/if}

    <div class="card mt-4">
        <div class="grid gap-3 md:grid-cols-2">
            <div>
                <label class="text-sm text-slate-500" for={ruleNameId}>Rule name</label>
                <input class="input-base" id={ruleNameId} bind:value={newRule.name} placeholder="e.g. Default fallback"  />
            </div>
            <div>
                <label class="text-sm text-slate-500" for={strategyId}>Strategy</label>
                <select class="select-base" id={strategyId} bind:value={newRule.strategy}>
                    <option value="fallback">Fallback</option>
                    <option value="load_balance">Load balance</option>
                    <option value="cost_optimize">Cost optimize</option>
                    <option value="quality_first">Quality first</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            <div class="md:col-span-2">
                <label class="text-sm text-slate-500" for={modelSequenceId}>Model sequence</label>
                <select class="select-base" id={modelSequenceId} multiple bind:value={newRule.modelSequence}>
                    {#each models as model}
                        <option value={model.id}>{model.displayName ?? model.id}</option>
                    {/each}
                </select>
                <p class="text-xs text-slate-400 mt-1">Drag order is not supported in MVP. Selected order follows click order.</p>
            </div>
            <div>
                <label class="text-sm text-slate-500" for={priorityId}>Priority</label>
                <input class="input-base" id={priorityId} type="number" bind:value={newRule.priority}  />
            </div>
            <div>
                <label class="text-sm text-slate-500" for={descriptionId}>Description</label>
                <input class="input-base" id={descriptionId} bind:value={newRule.description} placeholder="Optional description"  />
            </div>
        </div>
        <div class="mt-3">
            <Button onclick={createRule} disabled={!newRule.name || newRule.modelSequence.length === 0}>
                Create rule
            </Button>
        </div>
    </div>

    <div class="mt-4 overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full text-sm text-left text-slate-400">
            <thead class="text-xs uppercase bg-surface-2 text-slate-400">
                <tr>
                    <th class="px-4 py-3">Rule</th>
                    <th class="px-4 py-3">Strategy</th>
                    <th class="px-4 py-3">Models</th>
                    <th class="px-4 py-3">Priority</th>
                    <th class="px-4 py-3">Enabled</th>
                    <th class="px-4 py-3">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#if rules.length === 0}
                    <tr><td colspan="6" class="px-4 py-4 text-center text-slate-500">No rules configured.</td></tr>
                {:else}
                    {#each rules as rule}
                        <tr class="bg-surface-2 border-b border-slate-700">
                            <td class="px-4 py-3 font-medium text-white">
                                {rule.name}
                                {#if rule.description}
                                    <div class="text-xs text-slate-500">{rule.description}</div>
                                {/if}
                            </td>
                            <td class="px-4 py-3">{rule.strategy}</td>
                            <td class="px-4 py-3 text-xs text-slate-500">{rule.modelSequence.join(', ')}</td>
                            <td class="px-4 py-3">
                                <input class="input-base"
                                    type="number"
                                    value={rule.priority}
                                    onchange={(e) = /> updatePriority(rule, Number((e.target as HTMLInputElement).value))}
                                />
                            </td>
                            <td class="px-4 py-3">
                                <Button size="sm" variant={rule.enabled ? 'primary' : 'danger'} onclick={() => toggleRule(rule)}>
                                    {rule.enabled ? 'Enabled' : 'Disabled'}
                                </Button>
                            </td>
                            <td class="px-4 py-3">
                                <Button size="sm" variant="danger" onclick={() => removeRule(rule)}>Delete</Button>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>
