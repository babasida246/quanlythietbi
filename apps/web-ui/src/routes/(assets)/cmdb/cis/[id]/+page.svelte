<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Button, Tabs, TabsList, TabsTrigger } from '$lib/components/ui';
  import { ArrowLeft, AlertTriangle, GitBranch, Clock } from 'lucide-svelte';
  import { getCiDetail, getCiImpact, listCmdbChanges, type CiDetail, type CiRecord, type CmdbChangeRecord } from '$lib/api/cmdb';
  import CiRelationshipsTab from '$lib/cmdb/CiRelationshipsTab.svelte';
  import { _, isLoading } from '$lib/i18n';

  const ciId = $derived(page.params.id ?? '');
  
  let ciDetail = $state<CiDetail | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<'overview' | 'relationships' | 'impact' | 'changes'>('overview');

  // Impact Analysis state
  let impactData = $state<{ affected: CiRecord[]; count: number; depth: number } | null>(null);
  let impactLoading = $state(false);
  let impactError = $state('');

  // Change History state
  let changes = $state<CmdbChangeRecord[]>([]);
  let changesLoading = $state(false);
  let changesError = $state('');

  $effect(() => {
    void loadCiDetail();
    // Check URL params for tab
    const tab = page.url.searchParams.get('tab') as 'overview' | 'relationships' | 'impact' | 'changes' | null;
    if (tab && ['overview', 'relationships', 'impact', 'changes'].includes(tab)) {
      activeTab = tab;
    }
  });

  async function loadCiDetail() {
    if (!ciId) {
      loading = false;
      error = 'Missing CI id';
      ciDetail = null;
      return;
    }

    try {
      loading = true;
      error = '';
      const response = await getCiDetail(ciId);
      ciDetail = response.data ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load CI details';
      console.error('Error loading CI:', err);
    } finally {
      loading = false;
    }
  }

  async function loadImpact() {
    if (!ciId || impactData) return;
    try {
      impactLoading = true;
      impactError = '';
      const res = await getCiImpact(ciId);
      impactData = res.data ?? null;
    } catch (err) {
      impactError = err instanceof Error ? err.message : $_('cmdb.impactLoadFailed');
    } finally {
      impactLoading = false;
    }
  }

  async function loadChanges() {
    if (!ciId || changes.length > 0) return;
    try {
      changesLoading = true;
      changesError = '';
      const res = await listCmdbChanges({ primaryCiId: ciId, limit: 50 });
      changes = res.data ?? [];
    } catch (err) {
      changesError = err instanceof Error ? err.message : $_('cmdb.changesLoadFailed');
    } finally {
      changesLoading = false;
    }
  }

  function setTab(tab: 'overview' | 'relationships' | 'impact' | 'changes') {
    activeTab = tab;
    const params = new URLSearchParams(page.url.searchParams);
    params.set('tab', tab);
    goto(`/cmdb/cis/${ciId}?${params.toString()}`, { replaceState: true, noScroll: true });
    // Lazy-load data on first visit
    if (tab === 'impact') void loadImpact();
    if (tab === 'changes') void loadChanges();
  }

  const statusBadges: Record<string, string> = {
    active: 'badge-success',
    inactive: 'badge-info',
    retired: 'badge-error',
    pending: 'badge-warning'
  };

  const changeRiskClass: Record<string, string> = {
    low: 'badge-success',
    medium: 'badge-warning',
    high: 'badge-error',
    critical: 'badge-error'
  };

  const changeStatusClass: Record<string, string> = {
    draft: 'badge-info',
    submitted: 'badge-warning',
    approved: 'badge-success',
    implemented: 'badge-success',
    closed: 'badge-info',
    canceled: 'badge-error'
  };
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="mb-6">
    <div class="mb-4 flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onclick={() => goto('/cmdb')}>
        <ArrowLeft class="mr-2 h-4 w-4" />
        {$isLoading ? '← Back to CMDB' : $_('cmdb.backToCmdb')}
      </Button>
      <Button size="sm" variant="secondary" onclick={() => goto(`/cmdb/changes?primaryCiId=${ciId}`)}>
        {$isLoading ? 'Change CI' : $_('cmdb.changeCi')}
      </Button>
      <Button size="sm" variant="secondary" onclick={() => goto(`/cmdb/relationships/import?fromCiId=${ciId}`)}>
        {$isLoading ? 'Import Relationship' : $_('cmdb.importRelationship')}
      </Button>
    </div>

    {#if loading}
      <div class="text-slate-500">Loading CI details...</div>
    {:else if error}
      <div class="alert alert-error">
        {error}
      </div>
    {:else if ciDetail}
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">{ciDetail.ci.name}</h1>
          <p class="text-sm text-slate-500">
            {ciDetail.ci.ciCode} • {ciDetail.version.status} version
          </p>
        </div>
        <div class="flex gap-2">
          <span class={statusBadges[ciDetail.ci.status] ?? 'badge-info'}>
            {ciDetail.ci.status}
          </span>
          {#if ciDetail.ci.environment}
            <span class="badge-primary">{ciDetail.ci.environment}</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if ciDetail}
    <!-- Tabs -->
    <Tabs>
      <TabsList>
        <TabsTrigger active={activeTab === 'overview'} onclick={() => setTab('overview')}>{$isLoading ? 'Overview' : $_('cmdb.tab.overview')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'relationships'} onclick={() => setTab('relationships')}>
          <GitBranch class="mr-1 h-3.5 w-3.5" />
          {$isLoading ? 'Relationships' : $_('cmdb.tab.relationships')}
        </TabsTrigger>
        <TabsTrigger active={activeTab === 'impact'} onclick={() => setTab('impact')}>
          <AlertTriangle class="mr-1 h-3.5 w-3.5" />
          {$isLoading ? 'Impact' : $_('cmdb.tab.impact')}
        </TabsTrigger>
        <TabsTrigger active={activeTab === 'changes'} onclick={() => setTab('changes')}>
          <Clock class="mr-1 h-3.5 w-3.5" />
          {$isLoading ? 'History' : $_('cmdb.tab.history')}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    {#if activeTab === 'overview'}
        <div class="space-y-6">
          <!-- Basic Info Card -->
          <div class="card">
            <h3 class="mb-4 text-lg font-semibold">Basic Information</h3>
            <dl class="grid grid-cols-2 gap-4">
              <div>
                <dt class="text-sm font-medium text-slate-500">CI Code</dt>
                <dd class="mt-1 text-sm text-slate-200">{ciDetail.ci.ciCode}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-slate-500">Status</dt>
                <dd class="mt-1 text-sm text-slate-200">
                  <span class={statusBadges[ciDetail.ci.status] ?? 'badge-info'}>
                    {ciDetail.ci.status}
                  </span>
                </dd>
              </div>
              {#if ciDetail.ci.environment}
                <div>
                  <dt class="text-sm font-medium text-slate-500">Environment</dt>
                  <dd class="mt-1 text-sm text-slate-200">{ciDetail.ci.environment}</dd>
                </div>
              {/if}
              {#if ciDetail.ci.ownerTeam}
                <div>
                  <dt class="text-sm font-medium text-slate-500">Owner Team</dt>
                  <dd class="mt-1 text-sm text-slate-200">{ciDetail.ci.ownerTeam}</dd>
                </div>
              {/if}
              <div>
                <dt class="text-sm font-medium text-slate-500">Created</dt>
                <dd class="mt-1 text-sm text-slate-200">
                  {ciDetail.ci.createdAt ? new Date(ciDetail.ci.createdAt).toLocaleString() : '-'}
                </dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-slate-500">Last Updated</dt>
                <dd class="mt-1 text-sm text-slate-200">
                  {ciDetail.ci.updatedAt ? new Date(ciDetail.ci.updatedAt).toLocaleString() : '-'}
                </dd>
              </div>
            </dl>

            {#if ciDetail.ci.notes}
              <div class="mt-4 border-t pt-4">
                <dt class="text-sm font-medium text-slate-500">Notes</dt>
                <dd class="mt-1 text-sm text-slate-200">{ciDetail.ci.notes}</dd>
              </div>
            {/if}
          </div>

          <!-- Attributes Card -->
          {#if ciDetail.attributes.length > 0}
            <div class="card">
              <h3 class="mb-4 text-lg font-semibold">Attributes</h3>
              <dl class="grid grid-cols-2 gap-4">
                {#each ciDetail.attributes as attr}
                  <div>
                    <dt class="text-sm font-medium text-slate-500">{ciDetail.schema.find(d => d.key === attr.key)?.label ?? attr.key}</dt>
                    <dd class="mt-1 text-sm text-slate-200">{attr.value ?? '-'}</dd>
                  </div>
                {/each}
              </dl>
            </div>
          {/if}
        </div>
    {:else if activeTab === 'relationships'}
      <CiRelationshipsTab ciId={ciDetail.ci.id} ciName={ciDetail.ci.name} />

    {:else if activeTab === 'impact'}
      <div class="mt-4">
        {#if impactLoading}
          <div class="flex items-center justify-center py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if impactError}
          <div class="alert alert-error">{impactError}</div>
        {:else if impactData}
          <div class="card mb-4">
            <div class="flex items-center gap-3 mb-4">
              <AlertTriangle class="h-5 w-5 text-amber-400" />
              <div>
                <h3 class="font-semibold">{$isLoading ? 'Impact Analysis' : $_('cmdb.impact.title')}</h3>
                <p class="text-sm text-slate-400">
                  {@html $isLoading
                    ? `${impactData.count} CIs impacted when <strong class="text-slate-200">${ciDetail.ci.name}</strong> has an incident (depth ${impactData.depth})`
                    : $_('cmdb.impact.summary', { values: { count: impactData.count, name: `<strong class="text-slate-200">${ciDetail.ci.name}</strong>`, depth: impactData.depth } })}
                </p>
              </div>
            </div>
            {#if impactData.affected.length === 0}
              <p class="text-sm text-slate-500">{$isLoading ? 'No impact data' : $_('cmdb.impact.empty')}</p>
            {:else}
              <div class="overflow-hidden rounded-lg border border-slate-700">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th class="px-3 py-2 text-left">{$isLoading ? 'CI Name' : $_('cmdb.impact.ciName')}</th>
                      <th class="px-3 py-2 text-left">{$isLoading ? 'CI Code' : $_('cmdb.impact.ciCode')}</th>
                      <th class="px-3 py-2 text-left">{$isLoading ? 'Environment' : $_('cmdb.impact.environment')}</th>
                      <th class="px-3 py-2 text-left">{$isLoading ? 'Status' : $_('cmdb.impact.status')}</th>
                      <th class="px-3 py-2 text-right">{$isLoading ? 'Actions' : $_('cmdb.impact.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each impactData.affected as affectedCi}
                      <tr class="border-t border-slate-700 hover:bg-slate-800/50">
                        <td class="px-3 py-2 font-medium">{affectedCi.name}</td>
                        <td class="px-3 py-2 font-mono text-xs text-slate-400">{affectedCi.ciCode}</td>
                        <td class="px-3 py-2">{affectedCi.environment ?? '-'}</td>
                        <td class="px-3 py-2">
                          <span class={statusBadges[affectedCi.status] ?? 'badge-info'}>{affectedCi.status}</span>
                        </td>
                        <td class="px-3 py-2 text-right">
                          <Button size="sm" variant="secondary" onclick={() => goto(`/cmdb/cis/${affectedCi.id}`)}>
                            {$isLoading ? 'View Details' : $_('common.detail')}
                          </Button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-slate-500 text-sm">{$isLoading ? 'Click to load impact analysis.' : $_('cmdb.impact.clickToLoad')}</p>
          <Button class="mt-3" onclick={() => loadImpact()}>{$isLoading ? 'Load Impact Analysis' : $_('cmdb.impact.loadButton')}</Button>
        {/if}
      </div>

    {:else if activeTab === 'changes'}
      <div class="mt-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="font-semibold">{$isLoading ? 'Change History' : $_('cmdb.changes.title')}</h3>
          <Button size="sm" variant="secondary" onclick={() => goto(`/cmdb/changes?primaryCiId=${ciId}`)}>
            {$isLoading ? 'View All Changes' : $_('cmdb.changes.viewAll')}
          </Button>
        </div>
        {#if changesLoading}
          <div class="flex items-center justify-center py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if changesError}
          <div class="alert alert-error">{changesError}</div>
        {:else if changes.length === 0}
          <div class="card text-center py-8">
            <p class="text-slate-500">{$isLoading ? 'No change history' : $_('cmdb.changes.empty')}</p>
            <Button class="mt-3" variant="secondary" onclick={() => goto(`/cmdb/changes`)}>
              {$isLoading ? 'Create New Change' : $_('cmdb.changes.createNew')}
            </Button>
          </div>
        {:else}
          <div class="overflow-hidden rounded-lg border border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th class="px-3 py-2 text-left">{$isLoading ? 'Title' : $_('cmdb.changes.changeTitle')}</th>
                  <th class="px-3 py-2 text-left">{$isLoading ? 'Risk Level' : $_('cmdb.changes.riskLevel')}</th>
                  <th class="px-3 py-2 text-left">{$isLoading ? 'Status' : $_('cmdb.changes.status')}</th>
                  <th class="px-3 py-2 text-left">{$isLoading ? 'Created At' : $_('cmdb.changes.createdAt')}</th>
                  <th class="px-3 py-2 text-right">{$isLoading ? 'Actions' : $_('cmdb.changes.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each changes as change}
                  <tr class="border-t border-slate-700 hover:bg-slate-800/50">
                    <td class="px-3 py-2 font-medium">{change.title}</td>
                    <td class="px-3 py-2">
                      <span class={changeRiskClass[change.risk] ?? 'badge-info'}>{change.risk}</span>
                    </td>
                    <td class="px-3 py-2">
                      <span class={changeStatusClass[change.status] ?? 'badge-info'}>{change.status}</span>
                    </td>
                    <td class="px-3 py-2 text-slate-400">
                      {change.createdAt ? new Date(change.createdAt).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td class="px-3 py-2 text-right">
                      <Button size="sm" variant="secondary" onclick={() => goto(`/cmdb/changes`)}>
                        {$isLoading ? 'View' : $_('common.detail')}
                      </Button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
