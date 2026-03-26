<script lang="ts">
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Settings, TrendingUp, Zap, DollarSign, Plus, Edit, Trash2, Eye } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { get } from 'svelte/store';
  import {
    listModels,
    listProviders,
    listOrchestrationRules,
    updateModelPriority,
    createModel,
    deleteModel,
    updateModelConfig,
    createOrchestrationRule,
    updateOrchestrationRule,
    deleteOrchestrationRule,
    updateProvider,
    createProvider,
    deleteProvider,
    getModelHistory,
    getProviderHistory,
    listUsageLogs,
    checkProviderHealth,
    listOpenRouterRemoteModels,
    importOpenRouterModel,
    getOpenRouterAccountActivity,
    getOpenRouterCredits,
    type ModelConfig,
    type AIProvider,
    type OrchestrationRule,
    type UsageHistoryEntry,
    type UsageLogEntry,
    type ProviderHealth,
    type RemoteOpenRouterModel
  } from '$lib/api/chat';

  const { embedded = false } = $props<{ embedded?: boolean }>();

  const containerClass = $derived(
    embedded ? 'space-y-6' : 'page-shell page-content py-6 lg:py-8 space-y-6'
  );

  let models = $state<ModelConfig[]>([]);
  let providers = $state<AIProvider[]>([]);
  let orchestrationRules = $state<OrchestrationRule[]>([]);
  let loading = $state(false);
  let selectedTab = $state<'models' | 'providers' | 'orchestration' | 'openrouter'>('models');
  let modelSearch = $state('');
  let modelStatusFilter = $state<'all' | 'active' | 'inactive' | 'deprecated'>('all');
  let modelProviderFilter = $state('all');
  let modelGroupBy = $state<'none' | 'provider' | 'status'>('none');
  let providerSearch = $state('');
  let providerStatusFilter = $state<'all' | 'active' | 'maintenance' | 'inactive'>('all');
  const summary = $derived({
    activeModels: models.filter(m => m.enabled).length,
    providers: providers.length,
    rules: orchestrationRules.length
  });
  const sortedModels = $derived(models.slice().sort((a, b) => a.priority - b.priority));
  const filteredModels = $derived(
    sortedModels.filter(m => {
      const search = modelSearch.trim().toLowerCase();
      const searchHit =
        !search ||
        m.id.toLowerCase().includes(search) ||
        m.displayName?.toLowerCase().includes(search) ||
        m.provider.toLowerCase().includes(search);
      const statusHit = modelStatusFilter === 'all' || m.status === modelStatusFilter;
      const providerHit = modelProviderFilter === 'all' || m.provider === modelProviderFilter;
      return searchHit && statusHit && providerHit;
    })
  );
  const groupedModels = $derived(() => {
    const groups: Record<string, ModelConfig[]> = {};
    if (modelGroupBy === 'none') return groups;
    filteredModels.forEach(m => {
      const key = modelGroupBy === 'provider' ? m.provider : m.status || 'unknown';
      groups[key] = groups[key] ? [...groups[key], m] : [m];
    });
    return groups;
  });
  const sortedRules = $derived(orchestrationRules.slice().sort((a, b) => a.priority - b.priority));
  const modelSelectOptions = $derived(sortedModels.map(m => ({ id: m.id, label: m.displayName || m.id })));
  const filteredProviders = $derived(
    providers.filter(p => {
      const search = providerSearch.trim().toLowerCase();
      const searchHit = !search || p.name?.toLowerCase().includes(search) || p.id.toLowerCase().includes(search);
      const statusHit = providerStatusFilter === 'all' || p.status === providerStatusFilter;
      return searchHit && statusHit;
    })
  );
  
  // Modal states
  let showOrchestrationModal = $state(false);
  let showDiagramModal = $state(false);
  let editingRule = $state<OrchestrationRule | null>(null);
  let showCreateModel = $state(false);
  let showCreateProvider = $state(false);
  let newModel = $state({
    id: '',
    provider: '',
    displayName: '',
    description: '',
    tier: 0,
    priority: 100,
    enabled: true
  });
  let newProvider = $state({
    id: '',
    name: '',
    apiEndpoint: '',
    status: 'active'
  });
  let modelHistory = $state<Record<string, UsageHistoryEntry[]>>({});
  let providerHistory = $state<Record<string, UsageHistoryEntry[]>>({});
  let usageLogs = $state<UsageLogEntry[]>([]);
  let loadingModelHistory = $state<string | null>(null);
  let loadingProviderHistory = $state<string | null>(null);
  let providerHealth = $state<Record<string, ProviderHealth | null>>({});
  let loadingHealth = $state<string | null>(null);
  let openRouterModels = $state<RemoteOpenRouterModel[]>([]);
  let loadingOpenRouterModels = $state(false);
  let openRouterSearch = $state('');
  let openRouterAccount: any = $state(null);
  let openRouterCredits: any = $state(null);
  let importingModel = $state(false);
  let importPriority = $state(100);
  let remotePage = $state(1);
  let remoteLimit = $state(20);
  let showImportModal = $state(false);
  let selectedRemote: RemoteOpenRouterModel | null = $state(null);
  
  // Form state
  let ruleForm = $state({
    name: '',
    description: '',
    strategy: 'fallback' as OrchestrationRule['strategy'],
    modelSequence: [] as string[],
    enabled: true,
    priority: 100
  });

  let mermaidDiagram = $state('');
  let mermaidLib: any;
  let diagramContainer: HTMLElement;
  let editingModelId = $state<string | null>(null);
  let modelEdit = $state<Partial<ModelConfig>>({});
  let editingProviderId = $state<string | null>(null);
  let providerEdit = $state<Partial<AIProvider>>({});

  async function init() {
    await loadData();

    if (typeof window !== 'undefined') {
      if (!(window as any).mermaid) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load mermaid from CDN'));
          document.head.appendChild(s);
        });
      }

      (window as any).mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose'
      });
      mermaidLib = (window as any).mermaid;
    }
  }

  $effect(() => {
    void init();
  });

  async function loadData() {
    loading = true;
    try {
      const [modelsRes, providersRes, rulesRes, logsRes] = await Promise.all([
        listModels(),
        listProviders(),
        listOrchestrationRules(),
        listUsageLogs(20)
      ]);
      models = modelsRes.data;
      providers = providersRes.data;
      orchestrationRules = rulesRes.data;
      usageLogs = logsRes.data;
      if (providers.some(p => p.id === 'openrouter')) {
        await loadOpenRouterExtras();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }

  async function handleUpdatePriority(modelId: string, delta: number) {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    const newPriority = Math.max(0, model.priority + delta);
    try {
      await updateModelPriority(modelId, newPriority);
      await loadData();
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
  }

  async function handleCreateModel() {
    try {
      await createModel({
        ...newModel,
        tier: Number(newModel.tier) || 0,
        priority: Number(newModel.priority) || 100
      } as any);
      newModel = { id: '', provider: '', displayName: '', description: '', tier: 0, priority: 100, enabled: true };
      showCreateModel = false;
      await loadData();
    } catch (error) {
      console.error('Failed to create model', error);
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!confirm('Delete this model?')) return;
    await deleteModel(modelId);
    await loadData();
  }

  async function handleCreateProvider() {
    try {
      await createProvider({ ...newProvider } as any);
      newProvider = { id: '', name: '', apiEndpoint: '', status: 'active' };
      showCreateProvider = false;
      await loadData();
    } catch (error) {
      console.error('Failed to create provider', error);
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (!confirm('Delete this provider?')) return;
    await deleteProvider(providerId);
    await loadData();
  }

  async function loadModelHistoryEntries(modelId: string) {
    if (modelHistory[modelId]) return;
    loadingModelHistory = modelId;
    const res = await getModelHistory(modelId, 30);
    modelHistory = { ...modelHistory, [modelId]: res.data };
    loadingModelHistory = null;
  }

  async function loadProviderHistoryEntries(providerId: string) {
    if (providerHistory[providerId]) return;
    loadingProviderHistory = providerId;
    const res = await getProviderHistory(providerId, 30);
    providerHistory = { ...providerHistory, [providerId]: res.data };
    loadingProviderHistory = null;
  }

  async function handleHealthCheck(providerId: string) {
    loadingHealth = providerId;
    try {
      const res = await checkProviderHealth(providerId);
      providerHealth = { ...providerHealth, [providerId]: res };
    } catch (error) {
      console.error('Health check failed', error);
    } finally {
      loadingHealth = null;
    }
  }

  async function loadOpenRouterExtras() {
    const hasOpenRouter = providers.some(p => p.id === 'openrouter');
    if (!hasOpenRouter) return;
    loadingOpenRouterModels = true;
    try {
      const [modelsRes, accountRes, creditRes] = await Promise.all([
        listOpenRouterRemoteModels(openRouterSearch, remotePage, remoteLimit),
        getOpenRouterAccountActivity().catch(() => null),
        getOpenRouterCredits().catch(() => null)
      ]);
      openRouterModels = modelsRes.data;
      openRouterAccount = accountRes;
      openRouterCredits = creditRes;
    } catch (error) {
      console.warn('OpenRouter data unavailable (ignored for UI)', error);
    } finally {
      loadingOpenRouterModels = false;
    }
  }

  function openImportModal(remote: RemoteOpenRouterModel) {
    selectedRemote = remote;
    showImportModal = true;
  }

  async function handleImportRemote(modelId: string) {
    importingModel = true;
    try {
      await importOpenRouterModel(modelId, Number(importPriority) || undefined);
      await loadData();
    } catch (error) {
      console.error('Failed to import model', error);
    } finally {
      importingModel = false;
    }
  }

  async function openModelEdit(model: ModelConfig) {
    editingModelId = model.id;
    modelEdit = {
      description: model.description || '',
      tier: model.tier,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      costPer1kInput: model.costPer1kInput,
      costPer1kOutput: model.costPer1kOutput,
      enabled: model.enabled,
      supportsStreaming: model.supportsStreaming,
      supportsFunctions: model.supportsFunctions,
      supportsVision: model.supportsVision,
      priority: model.priority,
      status: model.status,
      displayName: model.displayName
    };
    showOrchestrationModal = false;
  }

  async function saveModelEdit() {
    if (!editingModelId) return;
    try {
      await updateModelConfig(editingModelId, modelEdit);
      editingModelId = null;
      modelEdit = {};
      await loadData();
    } catch (error) {
      console.error('Failed to update model', error);
    }
  }

  async function openProviderEdit(provider: AIProvider) {
    editingProviderId = provider.id;
    providerEdit = {
      name: provider.name,
      description: provider.description,
      apiEndpoint: provider.apiEndpoint,
      authType: provider.authType,
      rateLimitPerMinute: provider.rateLimitPerMinute,
      status: provider.status,
      creditsRemaining: provider.creditsRemaining,
      tokensUsed: provider.tokensUsed
    };
  }

  async function saveProviderEdit() {
    if (!editingProviderId) return;
    try {
      await updateProvider(editingProviderId, providerEdit as any);
      editingProviderId = null;
      providerEdit = {};
      await loadData();
    } catch (error) {
      console.error('Failed to update provider', error);
    }
  }

  function openOrchestrationModal(rule?: OrchestrationRule) {
    if (rule) {
      editingRule = rule;
      ruleForm = {
        name: rule.name,
        description: rule.description || '',
        strategy: rule.strategy,
        modelSequence: [...rule.modelSequence],
        enabled: rule.enabled,
        priority: rule.priority
      };
    } else {
      editingRule = null;
      ruleForm = {
        name: '',
        description: '',
        strategy: 'fallback',
        modelSequence: [],
        enabled: true,
        priority: 100
      };
    }
    showOrchestrationModal = true;
  }

  async function handleSaveRule() {
    try {
      if (editingRule) {
        await updateOrchestrationRule(editingRule.id, ruleForm);
      } else {
        await createOrchestrationRule(ruleForm);
      }
      showOrchestrationModal = false;
      await loadData();
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await deleteOrchestrationRule(ruleId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  function generateMermaidDiagram() {
    const activeRules = orchestrationRules.filter(r => r.enabled);
    
    let diagram = 'graph TD\n';
    diagram += '    Start[User Request] --> Router{Orchestrator}\n';
    
    activeRules.forEach((rule, idx) => {
      const ruleNode = `Rule${idx}`;
      diagram += `    Router --> ${ruleNode}["${rule.name}<br/>${rule.strategy}"]\n`;
      
      rule.modelSequence.forEach((model, mIdx) => {
        const modelNode = `${ruleNode}_M${mIdx}`;
        const modelName = model.split('/').pop();
        diagram += `    ${ruleNode} --> ${modelNode}["${modelName}"]\n`;
        
        if (mIdx < rule.modelSequence.length - 1 && rule.strategy === 'fallback') {
          diagram += `    ${modelNode} -->|Fails| ${ruleNode}_M${mIdx + 1}\n`;
        }
      });
    });
    
    diagram += '    style Start fill:#e3f2fd\n';
    diagram += '    style Router fill:#fff9c4\n';
    
    mermaidDiagram = diagram;
    renderDiagram();
  }

  async function renderDiagram() {
    if (!diagramContainer || !mermaidDiagram || !mermaidLib) return;
    
    try {
      const { svg } = await mermaidLib.render('mermaid-diagram', mermaidDiagram);
      diagramContainer.innerHTML = svg;
    } catch (error) {
      console.error('Failed to render diagram:', error);
      const t = get(_);
      diagramContainer.innerHTML = `<div class="text-red-500">${t('models.errors.diagramRenderFailed')}</div>`;
    }
  }

  function showDiagram() {
    generateMermaidDiagram();
    showDiagramModal = true;
  }

  $effect(() => {
    if (showDiagramModal && diagramContainer) {
      renderDiagram();
    }
  });
</script>

<div class={containerClass}>
  <div class="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 text-white rounded-3xl p-6 lg:p-8 shadow-xl">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-wide text-blue-200 font-semibold">{$isLoading ? 'Model control' : $_('models.title')}</p>
        <h1 class="text-3xl font-bold">{$isLoading ? 'AI Model Management' : $_('models.title')}</h1>
        <p class="text-sm text-blue-100/80 mt-2">{$isLoading ? 'Configure models, providers, and orchestration in one place' : $_('models.subtitle')}</p>
      </div>
      <div class="grid grid-cols-3 gap-3 w-full sm:w-auto text-left sm:text-right">
        <div class="bg-white/10 rounded-xl p-3">
          <p class="text-xs text-blue-100/80">{$isLoading ? 'Active models' : $_('models.activeModels', { values: { count: summary.activeModels } })}</p>
          <p class="text-xl font-semibold">{summary.activeModels}</p>
        </div>
        <div class="bg-white/10 rounded-xl p-3">
          <p class="text-xs text-blue-100/80">{$isLoading ? 'Providers' : $_('models.providers', { values: { count: summary.providers } })}</p>
          <p class="text-xl font-semibold">{summary.providers}</p>
        </div>
        <div class="bg-white/10 rounded-xl p-3">
          <p class="text-xs text-blue-100/80">{$isLoading ? 'Rules' : $_('models.rules', { values: { count: summary.rules } })}</p>
          <p class="text-xl font-semibold">{summary.rules}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="bg-slate-900/80 border border-slate-700 rounded-2xl shadow-sm">
    <div class="flex flex-wrap items-center gap-3 px-4 lg:px-6 py-3 border-b border-slate-700">
      <button
        onclick={() => selectedTab = 'models'}
        class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {selectedTab === 'models' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
      >
        <Settings class="w-4 h-4 inline mr-2" />
        {$isLoading ? 'Models' : $_('models.models')} ({models.length})
      </button>
      <button
        onclick={() => selectedTab = 'providers'}
        class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {selectedTab === 'providers' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
      >
        <Zap class="w-4 h-4 inline mr-2" />
        {$isLoading ? 'Providers' : $_('models.providers')} ({providers.length})
      </button>
      <button
        onclick={() => selectedTab = 'orchestration'}
        class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {selectedTab === 'orchestration' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
      >
        <TrendingUp class="w-4 h-4 inline mr-2" />
        {$isLoading ? 'Orchestration' : $_('models.orchestration')} ({orchestrationRules.length})
      </button>
      <button
        onclick={() => { selectedTab = 'openrouter'; loadOpenRouterExtras(); }}
        class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {selectedTab === 'openrouter' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
      >
        <Zap class="w-4 h-4 inline mr-2" />
        OpenRouter
      </button>
    </div>

    <div class="p-4 lg:p-6">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      {:else if selectedTab === 'models'}
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="text-sm text-slate-500">{$isLoading ? 'Active models:' : $_('models.activeModels')} {summary.activeModels}</div>
          <div class="flex gap-2">
            <Button size="sm" onclick={() => showCreateModel = !showCreateModel}>
              <Plus class="w-4 h-4 mr-1" /> {showCreateModel ? ($isLoading ? 'Close' : $_('common.close')) : ($isLoading ? 'New model' : $_('models.newModel'))}
            </Button>
          </div>
        </div>

        {#if showCreateModel}
          <div class="card p-4 border border-slate-700 mb-4">
            <div class="grid md:grid-cols-3 gap-3">
              <div>
                <label class="label-base" for="new-model-id">{$isLoading ? 'ID' : $_('common.id')}</label>
                <input id="new-model-id" class="input-base" bind:value={newModel.id} placeholder="provider/model-id" />
              </div>
              <div>
                <label class="label-base" for="new-model-provider">{$isLoading ? 'Provider' : $_('models.provider')}</label>
                <input id="new-model-provider" class="input-base" bind:value={newModel.provider} placeholder="openai" />
              </div>
              <div>
                <label class="label-base" for="new-model-display-name">{$isLoading ? 'Display name' : $_('models.displayName')}</label>
                <input id="new-model-display-name" class="input-base" bind:value={newModel.displayName} placeholder={$isLoading ? 'Friendly name' : $_('models.placeholders.displayName')} />
              </div>
              <div>
                <label class="label-base" for="new-model-tier">{$isLoading ? 'Tier' : $_('models.tier')}</label>
                <input id="new-model-tier" class="input-base" type="number" bind:value={newModel.tier} />
              </div>
              <div>
                <label class="label-base" for="new-model-priority">{$isLoading ? 'Priority' : $_('models.priority')}</label>
                <input id="new-model-priority" class="input-base" type="number" bind:value={newModel.priority} />
              </div>
              <div class="flex items-center gap-2">
                <label class="relative inline-flex cursor-pointer items-center">
                  <input id="new-model-enabled" type="checkbox" class="peer sr-only" bind:checked={newModel.enabled} />
                  <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full"></div>
                </label>
                <label class="label-base" for="new-model-enabled">{$isLoading ? 'Enabled' : $_('common.enabled')}</label>
              </div>
              <div class="md:col-span-3">
                <label class="label-base" for="new-model-description">{$isLoading ? 'Description' : $_('common.description')}</label>
                <textarea id="new-model-description" class="textarea-base" bind:value={newModel.description} rows={2}></textarea>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <Button size="sm" onclick={handleCreateModel} disabled={!newModel.id || !newModel.provider}>{$isLoading ? 'Save model' : $_('models.saveModel')}</Button>
              <Button size="sm" variant="secondary" onclick={() => showCreateModel = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
            </div>
          </div>
        {/if}

        <div class="flex flex-wrap gap-3 items-center mb-3">
          <input class="input-base w-56" placeholder={$isLoading ? 'Search model or provider' : $_('models.searchPlaceholder')} bind:value={modelSearch} />
          <select class="select-base w-40" bind:value={modelStatusFilter}>
            <option value="all">{$isLoading ? 'All statuses' : $_('models.allStatuses')}</option>
            <option value="active">{$isLoading ? 'Active' : $_('cmdb.active')}</option>
            <option value="inactive">{$isLoading ? 'Inactive' : $_('cmdb.inactive')}</option>
            <option value="deprecated">{$isLoading ? 'Deprecated' : $_('models.deprecated')}</option>
          </select>
          <select class="select-base w-48" bind:value={modelProviderFilter}>
            <option value="all">{$isLoading ? 'All providers' : $_('models.allProviders')}</option>
            {#each providers as provider}
              <option value={provider.id}>{provider.name || provider.id}</option>
            {/each}
          </select>
          <select class="select-base w-40" bind:value={modelGroupBy}>
            <option value="none">{$isLoading ? 'No grouping' : $_('models.noGrouping')}</option>
            <option value="provider">{$isLoading ? 'Group by provider' : $_('models.groupByProvider')}</option>
            <option value="status">{$isLoading ? 'Group by status' : $_('models.groupByStatus')}</option>
          </select>
        </div>

        {#if modelGroupBy === 'provider' || modelGroupBy === 'status'}
          {#if Object.keys(groupedModels).length === 0}
            <div class="text-sm text-slate-500">{$isLoading ? 'No models found for selected filters.' : $_('models.noModelsFound')}</div>
          {:else}
            {#each Object.entries(groupedModels) as [group, items]}
              <div class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <h4 class="text-sm font-semibold text-slate-200">{group}</h4>
                  <span class="badge-primary text-xs">{items.length}</span>
                </div>
                <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
                  <table class="w-full text-sm text-left text-slate-200">
                    <thead class="text-xs uppercase bg-slate-800 text-slate-400">
                      <tr>
                        <th class="px-4 py-3">{$isLoading ? 'Model' : $_('models.model')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Provider' : $_('models.provider')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Tier' : $_('models.tier')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Priority' : $_('models.priority')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Status' : $_('assets.status')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Context' : $_('models.context')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Cost $/1K' : $_('models.costPer1K')}</th>
                        <th class="px-4 py-3">{$isLoading ? 'Capabilities' : $_('models.table.capabilities')}</th>
                        <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each items as model}
                        <tr class="border-b border-slate-700">
                        <td class="px-4 py-3">
                          <div class="font-semibold text-slate-200 break-words">{model.id}</div>
                          {#if model.displayName && model.displayName !== model.id}
                            <div class="text-xs text-slate-500">{model.displayName}</div>
                          {/if}
                          {#if model.description}
                            <div class="text-xs text-slate-500 line-clamp-2">{model.description}</div>
                          {/if}
                        </td>
                        <td class="px-4 py-3"><span class="font-mono text-xs break-all">{model.provider}</span></td>
                        <td class="px-4 py-3">Tier {model.tier}</td>
                        <td class="px-4 py-3">
                          <span class="badge-primary">{model.priority}</span>
                        </td>
                        <td class="px-4 py-3">
                          <span class={model.enabled ? 'badge-success' : 'badge-error'}>{model.status}</span>
                        </td>
                        <td class="px-4 py-3">{model.contextWindow?.toLocaleString() || 'N/A'}</td>
                        <td class="px-4 py-3">
                          <div class="text-xs text-slate-200">In: {model.costPer1kInput ?? 'N/A'}</div>
                          <div class="text-xs text-slate-200">Out: {model.costPer1kOutput ?? 'N/A'}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            {#if model.supportsStreaming}<span class="badge-primary">{$isLoading ? 'Streaming' : $_('models.capabilities.streaming')}</span>{/if}
                            {#if model.supportsFunctions}<span class="badge-primary">{$isLoading ? 'Functions' : $_('models.capabilities.functions')}</span>{/if}
                            {#if model.supportsVision}<span class="badge-primary">{$isLoading ? 'Vision' : $_('models.capabilities.vision')}</span>{/if}
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" onclick={() => handleUpdatePriority(model.id, -10)}>-10</Button>
                            <Button size="sm" onclick={() => handleUpdatePriority(model.id, 10)}>+10</Button>
                            <Button size="sm" variant="secondary" onclick={() => openModelEdit(model)}>{$isLoading ? 'Edit' : $_('common.edit')}</Button>
                            <Button size="sm" onclick={() => loadModelHistoryEntries(model.id)}>
                              <TrendingUp class="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="danger" onclick={() => handleDeleteModel(model.id)}>
                              <Trash2 class="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {#if editingModelId === model.id}
                        <tr class="border-b border-slate-700 bg-slate-800/40">
                          <td colspan="9" class="px-4 py-4">
                            <div class="grid gap-3 md:grid-cols-2">
                              <div>
                                <label class="label-base" for={`model-edit-display-name-${model.id}`}>{$isLoading ? 'Display name' : $_('models.displayName')}</label>
                                <input id={`model-edit-display-name-${model.id}`} class="input-base" bind:value={modelEdit.displayName} placeholder={$isLoading ? 'Friendly name' : $_('models.placeholders.displayName')} />
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-tier-${model.id}`}>{$isLoading ? 'Tier' : $_('models.tier')}</label>
                                <input id={`model-edit-tier-${model.id}`} class="input-base" type="number" bind:value={modelEdit.tier} />
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-context-window-${model.id}`}>{$isLoading ? 'Context window' : $_('models.contextWindow')}</label>
                                <input id={`model-edit-context-window-${model.id}`} class="input-base" type="number" bind:value={modelEdit.contextWindow} />
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-max-tokens-${model.id}`}>{$isLoading ? 'Max tokens' : $_('models.maxTokens')}</label>
                                <input id={`model-edit-max-tokens-${model.id}`} class="input-base" type="number" bind:value={modelEdit.maxTokens} />
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-cost-input-${model.id}`}>{$isLoading ? 'Cost /1k input' : $_('models.costPer1kInput')}</label>
                                <input id={`model-edit-cost-input-${model.id}`} class="input-base" type="number" step="0.0001" bind:value={modelEdit.costPer1kInput} />
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-cost-output-${model.id}`}>{$isLoading ? 'Cost /1k output' : $_('models.costPer1kOutput')}</label>
                                <input id={`model-edit-cost-output-${model.id}`} class="input-base" type="number" step="0.0001" bind:value={modelEdit.costPer1kOutput} />
                              </div>
                              <div class="flex items-center gap-2">
                                <label class="relative inline-flex cursor-pointer items-center">
                                  <input id={`model-edit-enabled-${model.id}`} type="checkbox" class="peer sr-only" bind:checked={modelEdit.enabled} />
                                  <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full"></div>
                                </label>
                                <label class="label-base" for={`model-edit-enabled-${model.id}`}>{$isLoading ? 'Enabled' : $_('common.enabled')}</label>
                              </div>
                              <div>
                                <label class="label-base" for={`model-edit-status-${model.id}`}>{$isLoading ? 'Status' : $_('common.status')}</label>
                                <select id={`model-edit-status-${model.id}`} class="select-base" bind:value={modelEdit.status}>
                                  <option value="active">{$isLoading ? 'Active' : $_('cmdb.active')}</option>
                                  <option value="inactive">{$isLoading ? 'Inactive' : $_('cmdb.inactive')}</option>
                                  <option value="deprecated">{$isLoading ? 'Deprecated' : $_('models.deprecated')}</option>
                                </select>
                              </div>
                            </div>
                            <div class="flex gap-2 mt-3 justify-end">
                              <Button size="sm" onclick={saveModelEdit}>{$isLoading ? 'Save' : $_('common.save')}</Button>
                              <Button size="sm" variant="secondary" onclick={() => { editingModelId = null; modelEdit = {}; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
                            </div>
                          </td>
                        </tr>
                      {/if}
                      {#if modelHistory[model.id]}
                        <tr class="bg-slate-800/40 border-b border-slate-700">
                          <td colspan="9" class="px-4 py-3">
                            <div class="flex items-center justify-between mb-2">
                              <h4 class="text-sm font-semibold text-slate-200">{$isLoading ? 'Usage history (30d)' : $_('models.usage.usageHistory')}</h4>
                              <span class="badge-primary text-xs">{modelHistory[model.id].length}</span>
                            </div>
                            <div class="grid md:grid-cols-3 gap-2 text-xs text-slate-500">
                              {#each modelHistory[model.id] as h}
                                <div class="rounded-lg border border-slate-700 p-2 bg-slate-900">
                                  <div class="font-semibold text-slate-200">{new Date(h.date).toLocaleDateString()}</div>
                                  <div>{$isLoading ? 'Tokens' : $_('stats.tokens')}: {h.totalTokens?.toLocaleString?.() ?? h.totalTokens}</div>
                                  <div>{$isLoading ? 'Cost' : $_('stats.cost')}: ${h.totalCost?.toFixed?.(4) ?? h.totalCost}</div>
                                  <div>{($isLoading ? 'Messages' : $_('stats.messages'))}: {h.messageCount ?? '-'}</div>
                                </div>
                              {/each}
                            </div>
                          </td>
                        </tr>
                      {:else if loadingModelHistory === model.id}
                        <tr class="border-b border-slate-700">
                          <td colspan="9" class="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                            <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div> {$isLoading ? 'Loading history...' : $_('models.usage.loadingHistory')}
                          </td>
                        </tr>
                      {/if}
                    {/each}
                  </tbody>
                </table>
          </div>
        </div>
      {/each}
      {/if}
    {:else}
          <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
            <table class="w-full text-sm text-left text-slate-200">
              <thead class="text-xs uppercase bg-slate-800 text-slate-400">
                <tr>
                  <th class="px-4 py-3">{$isLoading ? 'Model' : $_('models.table.model')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Provider' : $_('models.table.provider')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Tier' : $_('models.table.tier')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Priority' : $_('models.table.priority')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Status' : $_('models.table.status')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Context' : $_('models.table.context')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Cost $/1K' : $_('models.table.costPer1k')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Capabilities' : $_('models.table.capabilities')}</th>
                  <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('models.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredModels as model}
                  <tr class="border-b border-slate-700">
                    <td class="px-4 py-3">
                      <div class="font-semibold text-slate-200 break-words">{model.id}</div>
                      {#if model.displayName && model.displayName !== model.id}
                        <div class="text-xs text-slate-500">{model.displayName}</div>
                      {/if}
                      {#if model.description}
                        <div class="text-xs text-slate-500 line-clamp-2">{model.description}</div>
                      {/if}
                    </td>
                    <td class="px-4 py-3"><span class="font-mono text-xs break-all">{model.provider}</span></td>
                    <td class="px-4 py-3">Tier {model.tier}</td>
                    <td class="px-4 py-3">
                      <span class="badge-primary">{model.priority}</span>
                    </td>
                    <td class="px-4 py-3">
                      <span class={model.enabled ? 'badge-success' : 'badge-error'}>{model.status}</span>
                    </td>
                    <td class="px-4 py-3">{model.contextWindow?.toLocaleString() || 'N/A'}</td>
                    <td class="px-4 py-3">
                      <div class="text-xs text-slate-200">In: {model.costPer1kInput ?? 'N/A'}</div>
                      <div class="text-xs text-slate-200">Out: {model.costPer1kOutput ?? 'N/A'}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        {#if model.supportsStreaming}<span class="badge-primary">{$isLoading ? 'Streaming' : $_('models.capabilities.streaming')}</span>{/if}
                        {#if model.supportsFunctions}<span class="badge-primary">{$isLoading ? 'Functions' : $_('models.capabilities.functions')}</span>{/if}
                        {#if model.supportsVision}<span class="badge-primary">{$isLoading ? 'Vision' : $_('models.capabilities.vision')}</span>{/if}
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap items-center justify-end gap-2">
                        <Button size="sm" onclick={() => handleUpdatePriority(model.id, -10)}>-10</Button>
                        <Button size="sm" onclick={() => handleUpdatePriority(model.id, 10)}>+10</Button>
                        <Button size="sm" variant="secondary" onclick={() => openModelEdit(model)}>{$isLoading ? 'Edit' : $_('common.edit')}</Button>
                        <Button size="sm" onclick={() => loadModelHistoryEntries(model.id)}>
                          <TrendingUp class="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="danger" onclick={() => handleDeleteModel(model.id)}>
                          <Trash2 class="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {#if editingModelId === model.id}
                    <tr class="border-b border-slate-700 bg-slate-800/40">
                      <td colspan="9" class="px-4 py-4">
                        <div class="grid gap-3 md:grid-cols-2">
                          <div>
                            <label class="label-base" for={`model-edit-display-name-flat-${model.id}`}>{$isLoading ? 'Display name' : $_('models.displayName')}</label>
                            <input id={`model-edit-display-name-flat-${model.id}`} class="input-base" bind:value={modelEdit.displayName} placeholder={$isLoading ? 'Friendly name' : $_('models.placeholders.displayName')} />
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-tier-flat-${model.id}`}>{$isLoading ? 'Tier' : $_('models.tier')}</label>
                            <input id={`model-edit-tier-flat-${model.id}`} class="input-base" type="number" bind:value={modelEdit.tier} />
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-context-window-flat-${model.id}`}>{$isLoading ? 'Context window' : $_('models.contextWindow')}</label>
                            <input id={`model-edit-context-window-flat-${model.id}`} class="input-base" type="number" bind:value={modelEdit.contextWindow} />
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-max-tokens-flat-${model.id}`}>{$isLoading ? 'Max tokens' : $_('models.maxTokens')}</label>
                            <input id={`model-edit-max-tokens-flat-${model.id}`} class="input-base" type="number" bind:value={modelEdit.maxTokens} />
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-cost-input-flat-${model.id}`}>{$isLoading ? 'Cost /1k input' : $_('models.costPer1kInput')}</label>
                            <input id={`model-edit-cost-input-flat-${model.id}`} class="input-base" type="number" step="0.0001" bind:value={modelEdit.costPer1kInput} />
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-cost-output-flat-${model.id}`}>{$isLoading ? 'Cost /1k output' : $_('models.costPer1kOutput')}</label>
                            <input id={`model-edit-cost-output-flat-${model.id}`} class="input-base" type="number" step="0.0001" bind:value={modelEdit.costPer1kOutput} />
                          </div>
                          <div class="flex items-center gap-2">
                            <label class="relative inline-flex cursor-pointer items-center">
                              <input id={`model-edit-enabled-flat-${model.id}`} type="checkbox" class="peer sr-only" bind:checked={modelEdit.enabled} />
                              <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full"></div>
                            </label>
                            <label class="label-base" for={`model-edit-enabled-flat-${model.id}`}>{$isLoading ? 'Enabled' : $_('common.enabled')}</label>
                          </div>
                          <div>
                            <label class="label-base" for={`model-edit-status-flat-${model.id}`}>{$isLoading ? 'Status' : $_('common.status')}</label>
                            <select id={`model-edit-status-flat-${model.id}`} class="select-base" bind:value={modelEdit.status}>
                            <option value="active">{$isLoading ? 'Active' : $_('cmdb.active')}</option>
                            <option value="inactive">{$isLoading ? 'Inactive' : $_('cmdb.inactive')}</option>
                            <option value="deprecated">{$isLoading ? 'Deprecated' : $_('models.deprecated')}</option>
                            </select>
                          </div>
                        </div>
                        <div class="flex gap-2 mt-3 justify-end">
                          <Button size="sm" onclick={saveModelEdit}>{$isLoading ? 'Save' : $_('common.save')}</Button>
                          <Button size="sm" variant="secondary" onclick={() => { editingModelId = null; modelEdit = {}; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
                        </div>
                      </td>
                    </tr>
                  {/if}
                  {#if modelHistory[model.id]}
                    <tr class="bg-slate-800/40 border-b border-slate-700">
                      <td colspan="9" class="px-4 py-3">
                        <div class="flex items-center justify-between mb-2">
                          <h4 class="text-sm font-semibold text-slate-200">{$isLoading ? 'Usage history (30d)' : $_('models.usage.usageHistory')}</h4>
                          <span class="badge-primary text-xs">{modelHistory[model.id].length}</span>
                        </div>
                        <div class="grid md:grid-cols-3 gap-2 text-xs text-slate-500">
                          {#each modelHistory[model.id] as h}
                            <div class="rounded-lg border border-slate-700 p-2 bg-slate-900">
                              <div class="font-semibold text-slate-200">{new Date(h.date).toLocaleDateString()}</div>
                              <div>{$isLoading ? 'Tokens' : $_('stats.tokens')}: {h.totalTokens?.toLocaleString?.() ?? h.totalTokens}</div>
                              <div>{$isLoading ? 'Cost' : $_('stats.cost')}: ${h.totalCost?.toFixed?.(4) ?? h.totalCost}</div>
                              <div>{($isLoading ? 'Messages' : $_('stats.messages'))}: {h.messageCount ?? '-'}</div>
                            </div>
                          {/each}
                        </div>
                      </td>
                    </tr>
                  {:else if loadingModelHistory === model.id}
                    <tr class="border-b border-slate-700">
                      <td colspan="9" class="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div> {$isLoading ? 'Loading...' : $_('models.usage.loadingHistory')}
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else if selectedTab === 'providers'}
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="text-sm text-slate-500">{$isLoading ? 'Providers' : $_('models.providers')}: {providers.length}</div>
          <Button size="sm" onclick={() => showCreateProvider = !showCreateProvider}>
            <Plus class="w-4 h-4 mr-1" /> {showCreateProvider ? ($isLoading ? 'Close' : $_('common.close')) : ($isLoading ? 'New provider' : $_('models.createProvider'))}
          </Button>
        </div>

        {#if showCreateProvider}
          <div class="card p-4 border border-slate-700 mb-4">
            <div class="grid md:grid-cols-3 gap-3">
              <div>
                <label class="label-base" for="new-provider-id">{$isLoading ? 'ID' : $_('common.id')}</label>
                <input id="new-provider-id" class="input-base" bind:value={newProvider.id} placeholder="openai" />
              </div>
              <div>
                <label class="label-base" for="new-provider-name">{$isLoading ? 'Name' : $_('common.name')}</label>
                <input id="new-provider-name" class="input-base" bind:value={newProvider.name} placeholder={$isLoading ? 'OpenAI' : $_('models.placeholders.providerName')} />
              </div>
              <div>
                <label class="label-base" for="new-provider-api-endpoint">{$isLoading ? 'API endpoint' : $_('models.apiEndpoint')}</label>
                <input id="new-provider-api-endpoint" class="input-base" bind:value={newProvider.apiEndpoint} placeholder="https://..." />
              </div>
              <div>
                <label class="label-base" for="new-provider-status">{$isLoading ? 'Status' : $_('common.status')}</label>
                <select id="new-provider-status" class="select-base" bind:value={newProvider.status}>
                  <option value="active">{$isLoading ? 'Active' : $_('cmdb.active')}</option>
                  <option value="maintenance">{$isLoading ? 'Maintenance' : $_('cmdb.maintenance')}</option>
                  <option value="inactive">{$isLoading ? 'Inactive' : $_('cmdb.inactive')}</option>
                </select>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <Button size="sm" onclick={handleCreateProvider} disabled={!newProvider.id || !newProvider.name}>{$isLoading ? 'Create provider' : $_('models.createProvider')}</Button>
              <Button size="sm" variant="secondary" onclick={() => showCreateProvider = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
            </div>
          </div>
        {/if}

        <div class="flex flex-wrap gap-3 items-center mb-3">
          <input class="input-base w-56" placeholder={$isLoading ? 'Search provider' : $_('models.searchProvider')} bind:value={providerSearch} />
          <select class="select-base w-40" bind:value={providerStatusFilter}>
            <option value="all">{$isLoading ? 'All statuses' : $_('models.allStatuses')}</option>
            <option value="active">{$isLoading ? 'Active' : $_('cmdb.active')}</option>
            <option value="maintenance">{$isLoading ? 'Maintenance' : $_('cmdb.maintenance')}</option>
            <option value="inactive">{$isLoading ? 'Inactive' : $_('cmdb.inactive')}</option>
          </select>
        </div>

        <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
          <table class="w-full text-sm text-left text-slate-200">
            <thead class="text-xs uppercase bg-slate-800 text-slate-400">
              <tr>
                <th class="px-4 py-3">{$isLoading ? 'Provider' : $_('models.table.provider')}</th>
                <th class="px-4 py-3">{$isLoading ? 'Status' : $_('models.table.status')}</th>
                <th class="px-4 py-3">{$isLoading ? 'API endpoint' : $_('models.apiEndpoint')}</th>
                <th class="px-4 py-3">{$isLoading ? 'Auth' : $_('models.auth')}</th>
                <th class="px-4 py-3">{$isLoading ? 'Rate limit' : $_('models.rateLimit')}</th>
                <th class="px-4 py-3">{$isLoading ? 'Capabilities' : $_('models.table.capabilities')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('models.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredProviders as provider}
                <tr class="border-b border-slate-700">
                  <td class="px-4 py-3">
                    <div class="font-semibold text-slate-200 break-words">{provider.name}</div>
                    <div class="text-xs text-slate-500 break-all">{provider.id}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class={provider.status === 'active' ? 'badge-success' : provider.status === 'maintenance' ? 'badge-warning' : 'badge-error'}>
                      {provider.status}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs break-all">{provider.apiEndpoint}</div>
                  </td>
                  <td class="px-4 py-3">{provider.authType}</td>
                  <td class="px-4 py-3">{provider.rateLimitPerMinute ? `${provider.rateLimitPerMinute}/min` : '-'}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-2">
                      {#if provider.capabilities.streaming}<span class="badge-primary">{$isLoading ? 'Streaming' : $_('models.capabilities.streaming')}</span>{/if}
                      {#if provider.capabilities.functions}<span class="badge-primary">{$isLoading ? 'Functions' : $_('models.capabilities.functions')}</span>{/if}
                      {#if provider.capabilities.vision}<span class="badge-primary">{$isLoading ? 'Vision' : $_('models.capabilities.vision')}</span>{/if}
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2 justify-end">
                      <Button size="sm" onclick={() => handleHealthCheck(provider.id)}>
                        {loadingHealth === provider.id ? ($isLoading ? 'Loading...' : $_('models.health.checking')) : ($isLoading ? 'Health' : $_('models.health.label'))}
                      </Button>
                      {#if providerHealth[provider.id]}
                        <span class={providerHealth[provider.id]?.status === 'healthy' ? 'badge-success' : providerHealth[provider.id]?.status === 'degraded' ? 'badge-warning' : 'badge-error'}>
                          {providerHealth[provider.id]?.status}
                        </span>
                      {/if}
                        <Button size="sm" variant="secondary" onclick={() => openProviderEdit(provider)}>{$isLoading ? 'Edit' : $_('common.edit')}</Button>
                      <Button size="sm" onclick={() => loadProviderHistoryEntries(provider.id)}>
                        <TrendingUp class="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="danger" onclick={() => handleDeleteProvider(provider.id)}>
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>

                    {#if editingProviderId === provider.id}
                      <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label class="label-base" for={`provider-edit-name-${provider.id}`}>{$isLoading ? 'Name' : $_('common.name')}</label>
                          <input id={`provider-edit-name-${provider.id}`} class="input-base" bind:value={providerEdit.name} />
                        </div>
                        <div>
                          <label class="label-base" for={`provider-edit-status-${provider.id}`}>{$isLoading ? 'Status' : $_('common.status')}</label>
                          <select id={`provider-edit-status-${provider.id}`} class="select-base" bind:value={providerEdit.status}>
                            <option value="active">{$isLoading ? 'Active' : $_('models.active')}</option>
                            <option value="maintenance">{$isLoading ? 'Maintenance' : $_('models.maintenance')}</option>
                            <option value="inactive">{$isLoading ? 'Inactive' : $_('models.inactive')}</option>
                          </select>
                        </div>
                        <div>
                          <label class="label-base" for={`provider-edit-api-endpoint-${provider.id}`}>{$isLoading ? 'API endpoint' : $_('models.apiEndpoint')}</label>
                          <input id={`provider-edit-api-endpoint-${provider.id}`} class="input-base" bind:value={providerEdit.apiEndpoint} />
                        </div>
                        <div>
                          <label class="label-base" for={`provider-edit-api-key-${provider.id}`}>{$isLoading ? 'API Key' : $_('models.apiKey')}</label>
                          <input id={`provider-edit-api-key-${provider.id}`} class="input-base" type="password" bind:value={providerEdit.apiKey} placeholder="******" />
                        </div>
                        <div>
                          <label class="label-base" for={`provider-edit-credits-${provider.id}`}>{$isLoading ? 'Credits' : $_('models.credits')}</label>
                          <input id={`provider-edit-credits-${provider.id}`} class="input-base" type="number" step="0.0001" bind:value={providerEdit.creditsRemaining} />
                        </div>
                        <div>
                          <label class="label-base" for={`provider-edit-tokens-${provider.id}`}>{$isLoading ? 'Tokens' : $_('stats.tokens')}</label>
                          <input id={`provider-edit-tokens-${provider.id}`} class="input-base" type="number" bind:value={providerEdit.tokensUsed} />
                        </div>
                      </div>
                      <div class="flex gap-2 mt-3 justify-end">
                        <Button size="sm" onclick={saveProviderEdit}>{$isLoading ? 'Save' : $_('common.save')}</Button>
                        <Button size="sm" variant="secondary" onclick={() => { editingProviderId = null; providerEdit = {}; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
                      </div>
                    {/if}

                    {#if providerHistory[provider.id]}
                      <div class="mt-3 text-xs text-slate-500 space-y-1">
                        <div class="font-semibold text-slate-200">{$isLoading ? 'Usage history (30d)' : $_('models.usage.usageHistory')}</div>
                        <div class="grid md:grid-cols-2 gap-2">
                          {#each providerHistory[provider.id] as h}
                            <div class="rounded-lg border border-slate-700 p-2 bg-slate-800/50">
                              <div class="font-semibold text-slate-200">{new Date(h.date).toLocaleDateString()}</div>
                              <div>Tokens: {h.totalTokens?.toLocaleString?.() ?? h.totalTokens}</div>
                              <div>Cost: ${h.totalCost?.toFixed?.(4) ?? h.totalCost}</div>
                              <div>Credits used: ${h.creditsUsed?.toFixed?.(4) ?? h.creditsUsed ?? 0}</div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {:else if loadingProviderHistory === provider.id}
                      <div class="mt-2 text-xs text-slate-500 flex items-center gap-2">
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div> {$isLoading ? 'Loading...' : $_('models.usage.loadingHistory')}
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if selectedTab === 'openrouter'}
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-semibold text-slate-200">{$isLoading ? 'OpenRouter Available Models' : $_('models.openrouter.browseRemoteModels')}</h2>
              <p class="text-sm text-slate-400">{$isLoading ? 'Browse remote models and import into your catalog.' : $_('models.openrouter.browseRemoteModels')}</p>
            </div>
            <div class="flex gap-2 items-center">
              <input class="input-base w-48" placeholder={$isLoading ? 'Search models' : $_('models.search')} bind:value={openRouterSearch} />
              <input class="input-base w-24" type="number" bind:value={remoteLimit} placeholder={$isLoading ? 'Limit' : $_('models.openrouter.limit')} />
              <Button size="sm" onclick={() => { remotePage = 1; loadOpenRouterExtras(); }} disabled={loadingOpenRouterModels}>
                {loadingOpenRouterModels ? ($isLoading ? 'Loading...' : $_('models.openrouter.loading')) : ($isLoading ? 'Refresh' : $_('models.openrouter.refresh'))}
              </Button>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
            <table class="w-full text-sm text-left text-slate-300">
              <thead class="text-xs uppercase bg-slate-800 text-slate-400">
                <tr>
                  <th class="px-4 py-3">{$isLoading ? 'Model' : $_('models.table.model')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Prompt $/1k' : $_('models.openrouter.promptCost')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Completion $/1k' : $_('models.openrouter.completionCost')}</th>
                  <th class="px-4 py-3">{$isLoading ? 'Context' : $_('models.table.context')}</th>
                  <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('models.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#if loadingOpenRouterModels}
                  <tr><td colspan="5" class="px-4 py-4 text-center text-slate-500">{$isLoading ? 'Loading...' : $_('models.openrouter.loading')}</td></tr>
                {:else if openRouterModels.length === 0}
                  <tr><td colspan="5" class="px-4 py-4 text-center text-slate-500">{$isLoading ? 'No models' : $_('models.openrouter.noModels')}</td></tr>
                {:else}
                  {#each openRouterModels as remote}
                    <tr class="bg-slate-900 border-b border-slate-800">
                      <td class="px-4 py-3">
                        <div class="font-semibold text-slate-200">{remote.name}</div>
                        <div class="text-xs text-slate-500">{remote.id}</div>
                        {#if remote.description}
                          <div class="text-xs text-slate-500 line-clamp-2">{remote.description}</div>
                        {/if}
                      </td>
                      <td class="px-4 py-3">{remote.pricing?.prompt ?? '—'}</td>
                      <td class="px-4 py-3">{remote.pricing?.completion ?? '—'}</td>
                      <td class="px-4 py-3">{remote.contextLength ?? '—'}</td>
                      <td class="px-4 py-3 text-right">
                        <Button size="sm" onclick={() => openImportModal(remote)} disabled={importingModel}>
                          {$isLoading ? 'Add' : $_('common.add')}
                        </Button>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          <div class="flex items-center gap-3">
            <Button size="sm" onclick={() => { if (remotePage > 1) { remotePage -= 1; loadOpenRouterExtras(); } }} disabled={remotePage === 1 || loadingOpenRouterModels}>{$isLoading ? 'Prev' : $_('pagination.prev')}</Button>
            <span class="text-sm text-slate-300">{$isLoading ? 'Page' : $_('pagination.page')} {remotePage}</span>
            <Button size="sm" onclick={() => { remotePage += 1; loadOpenRouterExtras(); }} disabled={loadingOpenRouterModels}>{$isLoading ? 'Next' : $_('pagination.next')}</Button>
          </div>
        </div>
      {:else if selectedTab === 'orchestration'}
        <div class="mb-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 class="text-xl font-semibold text-slate-200">{$isLoading ? 'Orchestration Rules' : $_('models.orchestration')}</h2>
            <p class="text-sm text-slate-400">{$isLoading ? 'Define model selection and fallback strategies' : $_('models.orchestrationDescription')}</p>
          </div>
          <div class="flex gap-2">
            <Button variant="secondary" onclick={showDiagram}>
              <Eye class="w-4 h-4 mr-2" />
              {$isLoading ? 'View Diagram' : $_('models.viewDiagram')}
            </Button>
            <Button onclick={() => openOrchestrationModal()}>
              <Plus class="w-4 h-4 mr-2" />
              {$isLoading ? 'New Rule' : $_('models.createRule')}
            </Button>
          </div>
        </div>

        <div class="grid gap-4">
          {#each sortedRules as rule}
            <div class="card p-4 border border-slate-700 bg-slate-900/80 rounded-xl shadow-sm">
              <div class="flex justify-between items-start gap-4">
                <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-3 flex-wrap">
                    <h3 class="text-lg font-semibold text-slate-200">{rule.name}</h3>
                    <span class={rule.enabled ? 'badge-success' : 'badge-error'}>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                    <span class="badge-primary">{rule.strategy}</span>
                    <span class="badge-primary">Priority {rule.priority}</span>
                  </div>

                  {#if rule.description}
                    <p class="text-sm text-slate-400">{rule.description}</p>
                  {/if}

                  <div class="mb-2">
                    <span class="text-sm text-slate-500 font-medium">Model Sequence:</span>
                    <div class="flex gap-2 mt-2 flex-wrap">
                      {#each rule.modelSequence as model, idx}
                        <div class="flex items-center">
                          <span class="badge-primary">{model}</span>
                          {#if idx < rule.modelSequence.length - 1 && rule.strategy === 'fallback'}
                            <span class="mx-2 text-slate-400">-></span>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="flex gap-2">
                  <Button size="sm" onclick={() => openOrchestrationModal(rule)}>
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="danger" onclick={() => handleDeleteRule(rule.id)}>
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          {/each}
        </div>


        <div class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-slate-200">{$isLoading ? 'Usage history (30d)' : $_('models.usage.usageHistory')}</h3>
            <span class="badge-primary text-xs">{$isLoading ? `${usageLogs.length} entries` : $_('stats.entries', { values: { count: usageLogs.length } })}</span>
          </div>
          <div class="overflow-x-auto rounded-xl border border-slate-700">
            <table class="w-full text-sm text-left text-slate-400">
              <thead class="text-xs uppercase bg-slate-800 text-slate-400">
                <tr>
                  <th class="px-6 py-3">{$isLoading ? 'Date' : $_('stats.date')}</th>
                  <th class="px-6 py-3">{$isLoading ? 'Model' : $_('models.table.model')}</th>
                  <th class="px-6 py-3">{$isLoading ? 'Provider' : $_('models.table.provider')}</th>
                  <th class="px-6 py-3">{$isLoading ? 'Tokens' : $_('stats.tokens')}</th>
                  <th class="px-6 py-3">{$isLoading ? 'Cost' : $_('stats.cost')}</th>
                  <th class="px-6 py-3">{$isLoading ? 'Messages' : $_('stats.messages')}</th>
                </tr>
              </thead>
              <tbody>
                {#if usageLogs.length === 0}
                  <tr><td colspan="6" class="px-6 py-4 text-center text-slate-500">{$isLoading ? 'No usage records' : $_('models.usage.noUsageRecords')}</td></tr>
                {:else}
                  {#each usageLogs as log}
                    <tr class="bg-slate-900 border-b border-slate-800">
                      <td class="px-6 py-4 font-medium text-slate-200">{new Date(log.date).toLocaleString()}</td>
                      <td class="px-6 py-4">{log.model}</td>
                      <td class="px-6 py-4">{log.provider}</td>
                      <td class="px-6 py-4">{log.totalTokens}</td>
                      <td class="px-6 py-4">${log.cost.toFixed(4)}</td>
                      <td class="px-6 py-4">{log.messageCount}</td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Orchestration Rule Modal -->
<Modal bind:open={showOrchestrationModal} size="lg" title={`${editingRule ? ($isLoading ? 'Edit' : $_('common.edit')) : ($isLoading ? 'Create' : $_('common.create'))} ${$isLoading ? 'Orchestration Rule' : $_('models.orchestration')}`}>

  <div class="space-y-4">
    <div>
      <label class="label-base" for="rule-name">{$isLoading ? 'Name' : $_('common.name')}</label>
      <input class="input-base" id="rule-name" bind:value={ruleForm.name} placeholder={$isLoading ? 'My Orchestration Rule' : $_('models.placeholders.ruleName')} />
    </div>

    <div>
      <label class="label-base" for="rule-description">{$isLoading ? 'Description' : $_('common.description')}</label>
      <textarea class="textarea-base" id="rule-description" bind:value={ruleForm.description} rows="2" placeholder={$isLoading ? 'Optional description' : $_('models.placeholders.optionalDescription')}></textarea>
    </div>

    <div>
      <label class="label-base" for="rule-strategy">{$isLoading ? 'Strategy' : $_('models.strategy')}</label>
      <select class="select-base" id="rule-strategy" bind:value={ruleForm.strategy}>
        <option value="fallback">{$isLoading ? 'Fallback (try models in order)' : $_('models.fallback')}</option>
        <option value="load_balance">{$isLoading ? 'Load Balance' : $_('models.loadBalancing')}</option>
        <option value="cost_optimize">{$isLoading ? 'Cost Optimize' : $_('models.costOptimized')}</option>
        <option value="quality_first">{$isLoading ? 'Quality First' : $_('models.qualityFirst')}</option>
        <option value="custom">{$isLoading ? 'Custom' : $_('models.custom')}</option>
      </select>
    </div>

    <div>
      <label class="label-base" for="rule-priority">{$isLoading ? 'Priority' : $_('models.priority')} (lower = higher priority)</label>
      <input class="input-base" id="rule-priority" type="number" bind:value={ruleForm.priority} />
    </div>

    <div>
      <p class="label-base">{$isLoading ? 'Model Sequence' : $_('models.modelSequence')}</p>
      <div class="space-y-2">
        {#each ruleForm.modelSequence as model, idx}
          <div class="flex gap-2">
            <select bind:value={ruleForm.modelSequence[idx]} class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
              {#each modelSelectOptions as opt}
                <option value={opt.id}>{opt.label}</option>
              {/each}
            </select>
            <Button size="sm" variant="danger" onclick={() => {
              ruleForm.modelSequence = ruleForm.modelSequence.filter((_, i) => i !== idx);
            }}>
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        {/each}
        <Button size="sm" onclick={() => {
          const next = modelSelectOptions[0]?.id || '';
          ruleForm.modelSequence = [...ruleForm.modelSequence, next];
        }}>
          <Plus class="w-4 h-4 mr-2" />
          {$isLoading ? 'Add' : $_('common.add')} {$isLoading ? 'Model' : $_('models.model')}
        </Button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <label class="relative inline-flex cursor-pointer items-center">
        <input id="orchestration-rule-enabled" type="checkbox" class="peer sr-only" bind:checked={ruleForm.enabled} />
        <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full"></div>
      </label>
      <label class="label-base" for="orchestration-rule-enabled">{$isLoading ? 'Enabled' : $_('common.enabled')}</label>
    </div>
  </div>

  {#snippet footer()}
    <Button onclick={handleSaveRule} disabled={!ruleForm.name || ruleForm.modelSequence.length === 0}>
      {$isLoading ? 'Save' : $_('common.save')}
    </Button>
    <Button variant="secondary" onclick={() => showOrchestrationModal = false}>
      {$isLoading ? 'Cancel' : $_('common.cancel')}
    </Button>
  {/snippet}
</Modal>

<!-- Diagram Modal -->
<Modal bind:open={showDiagramModal} size="xl" title={$isLoading ? 'Orchestration Flow Diagram' : $_('models.orchestrationDiagram')}>
  
  <div bind:this={diagramContainer} class="bg-slate-800 p-4 rounded-lg overflow-auto">
    <!-- Mermaid diagram will render here -->
  </div>

  {#snippet footer()}
    <Button variant="secondary" onclick={() => showDiagramModal = false}>Close</Button>
  {/snippet}
</Modal>

<!-- Import remote model modal -->
<Modal bind:open={showImportModal} size="md" title={selectedRemote ? `Import ${selectedRemote.name}` : ''}>
  {#if selectedRemote}
    <p class="text-sm text-slate-300 mb-3">{selectedRemote.id}</p>
    <div class="space-y-3">
      <div>
        <label class="label-base" for="import-remote-priority">{$isLoading ? 'Priority' : $_('models.priority')}</label>
        <input id="import-remote-priority" class="input-base" type="number" bind:value={importPriority} />
      </div>
      <div class="text-sm text-slate-500">
        Prompt $/1k: {selectedRemote.pricing?.prompt ?? '—'} | Completion $/1k: {selectedRemote.pricing?.completion ?? '—'}
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button onclick={() => { handleImportRemote(selectedRemote!.id); showImportModal = false; }}>
      {importingModel ? 'Importing...' : 'Import'}
    </Button>
    <Button variant="secondary" onclick={() => showImportModal = false}>Cancel</Button>
  {/snippet}
</Modal>

<style>
  :global(.mermaid) {
    display: flex;
    justify-content: center;
  }
</style>

