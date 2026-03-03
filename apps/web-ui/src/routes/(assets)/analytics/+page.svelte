<script lang="ts">
  import { onMount } from 'svelte';
  import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Plus, RefreshCw, Brain, Calendar, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Button } from '$lib/components/ui';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import { toast } from '$lib/components/toast';
  import { z } from 'zod';
  import {
    getAnalyticsSummary, createSnapshot, getSnapshotHistory,
    addCostRecord, getCostRecords, getAnomalies,
    type AnalyticsSummary, type AnalyticsSnapshot, type CostRecord, type Anomaly
  } from '$lib/api/analytics';

  // ─── Tabs ────────────────────────────────────────────────────────────────
  type TabKey = 'overview' | 'snapshots' | 'costs' | 'anomalies';
  let activeTab = $state<TabKey>('overview');

  // ─── State ───────────────────────────────────────────────────────────────
  let loading = $state(true);
  let error = $state('');
  let summary = $state<AnalyticsSummary | null>(null);
  let snapshots = $state<AnalyticsSnapshot[]>([]);
  let costs = $state<CostRecord[]>([]);
  let anomalies = $state<Anomaly[]>([]);

  // Cost form
  let showCostModal = $state(false);

  const costSchema = z.object({
    assetId: z.string().min(1, $_('analytics.validation.assetRequired')),
    costType: z.string().min(1),
    amount: z.coerce.number().positive($_('analytics.validation.amountPositive')),
    currency: z.string().min(1),
    description: z.string().optional()
  });

  // ─── Derived stats ───────────────────────────────────────────────────────
  const totalCosts = $derived(costs.reduce((acc, c) => acc + (c.amount ?? 0), 0));
  const costByType = $derived.by(() => {
    const map = new Map<string, number>();
    costs.forEach(c => {
      const current = map.get(c.costType) ?? 0;
      map.set(c.costType, current + (c.amount ?? 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  });

  const anomalyBySeverity = $derived.by(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    anomalies.forEach(a => { if (a.severity in counts) (counts as any)[a.severity]++; });
    return counts;
  });

  // ─── Data loading ─────────────────────────────────────────────────────────
  async function loadData() {
    try {
      loading = true;
      error = '';
      const [summaryRes, snapshotsRes, costsRes, anomaliesRes] = await Promise.all([
        getAnalyticsSummary().catch(() => ({ data: null })),
        getSnapshotHistory(30).catch(() => ({ data: [] })),
        getCostRecords().catch(() => ({ data: [] })),
        getAnomalies().catch(() => ({ data: [] }))
      ]);
      summary = summaryRes.data;
      snapshots = snapshotsRes.data ?? [];
      costs = costsRes.data ?? [];
      anomalies = anomaliesRes.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('common.unknownError');
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function handleCreateSnapshot() {
    try {
      await createSnapshot();
      toast.success($_('analytics.toast.snapshotCreated'));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : $_('common.unknownError'));
    }
  }

  async function handleAddCost(values: Record<string, unknown>) {
    const parsed = costSchema.parse(values);
    await addCostRecord({
      assetId: parsed.assetId,
      costType: parsed.costType,
      amount: parsed.amount,
      currency: parsed.currency,
      description: parsed.description || undefined
    });
    toast.success($_('analytics.toast.costAdded'));
    showCostModal = false;
    await loadData();
  }

  function formatCurrency(n: number) {
    return n.toLocaleString('vi-VN') + ' ₫';
  }

  function costTypeBadge(type: string) {
    const map: Record<string, string> = { purchase: 'badge-blue', maintenance: 'badge-yellow', license: 'badge-purple', insurance: 'badge-green', depreciation: 'badge-gray', other: 'badge-gray' };
    return `badge ${map[type] ?? 'badge-gray'}`;
  }

  function severityColor(sev: string) {
    if (sev === 'critical') return 'text-red-400 border-red-800/50 bg-red-900/20';
    if (sev === 'high') return 'text-amber-400 border-amber-800/50 bg-amber-900/20';
    if (sev === 'medium') return 'text-blue-400 border-blue-800/50 bg-blue-900/20';
    return 'text-slate-400 border-slate-700 bg-slate-800/30';
  }

  onMount(() => { void loadData(); });
</script>

<div class="page-shell page-content space-y-6">

  <PageHeader title={$isLoading ? 'Analytics' : $_('analytics.pageTitle')} subtitle={$isLoading ? 'Asset analytics, cost tracking, and insights' : $_('analytics.pageSubtitle')}>
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={handleCreateSnapshot}>
        {#snippet leftIcon()}<TrendingUp class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Snapshot' : $_('analytics.actions.snapshot')}
      </Button>
      <Button variant="primary" size="sm" onclick={() => (showCostModal = true)}>
        {#snippet leftIcon()}<Plus class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Add Cost' : $_('analytics.actions.addCost')}
      </Button>
      <Button variant="ghost" size="sm" onclick={loadData}>
        <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="alert alert-error flex items-center gap-2"><AlertTriangle class="h-4 w-4" />{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={8} />
  {:else}
    <!-- Summary Cards -->
    {#if summary}
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="rounded-xl border border-blue-800/50 bg-blue-900/20 p-4">
          <div class="text-xs text-blue-400 mb-1">{$isLoading ? 'Total Assets' : $_('analytics.stats.totalAssets')}</div>
          <div class="text-2xl font-bold text-white" data-testid="stat-total">{summary.totalAssets}</div>
        </div>
        <div class="rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-4">
          <div class="text-xs text-emerald-400 mb-1">{$isLoading ? 'Active' : $_('analytics.stats.active')}</div>
          <div class="text-2xl font-bold text-emerald-300" data-testid="stat-active">{summary.activeAssets}</div>
        </div>
        <div class="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4">
          <div class="text-xs text-amber-400 mb-1">{$isLoading ? 'In Repair' : $_('analytics.stats.inRepair')}</div>
          <div class="text-2xl font-bold text-amber-300" data-testid="stat-repair">{summary.inRepairAssets}</div>
        </div>
        <div class="rounded-xl border border-slate-700 bg-surface-2 p-4">
          <div class="text-xs text-slate-400 mb-1">{$isLoading ? 'Retired' : $_('analytics.stats.retired')}</div>
          <div class="text-2xl font-bold text-slate-300" data-testid="stat-retired">{summary.retiredAssets}</div>
        </div>
        <div class="rounded-xl border border-purple-800/50 bg-purple-900/20 p-4">
          <div class="text-xs text-purple-400 mb-1">{$isLoading ? 'Total Cost' : $_('analytics.stats.totalCost')}</div>
          <div class="text-xl font-bold text-purple-300">{formatCurrency(totalCosts)}</div>
        </div>
      </div>
    {/if}

    <!-- Tab bar -->
    <div class="flex gap-1 border-b border-slate-800">
      {#each [
        { key: 'overview' as TabKey, label: $isLoading ? 'Overview' : $_('analytics.tabs.overview'), icon: PieChart },
        { key: 'snapshots' as TabKey, label: $isLoading ? 'Snapshots' : $_('analytics.tabs.snapshots'), icon: Calendar, count: snapshots.length },
        { key: 'costs' as TabKey, label: $isLoading ? 'Costs' : $_('analytics.tabs.costs'), icon: DollarSign, count: costs.length },
        { key: 'anomalies' as TabKey, label: $isLoading ? 'Anomalies' : $_('analytics.tabs.anomalies'), icon: AlertTriangle, count: anomalies.length }
      ] as tab}
        <button
          class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === tab.key ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-white'}"
          onclick={() => (activeTab = tab.key)}
        >
          <tab.icon class="h-3.5 w-3.5" />
          {tab.label}
          {#if tab.count !== undefined}
            <span class="ml-1 text-xs rounded-full bg-slate-800 px-1.5 py-0.5">{tab.count}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Cost breakdown -->
        <div class="rounded-xl border border-slate-700 bg-surface-2 p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <DollarSign class="h-4 w-4 text-green-400" />
            {$isLoading ? 'Cost Breakdown' : $_('analytics.costBreakdown')}
          </h3>
          {#if costByType.length === 0}
            <p class="text-sm text-slate-500 text-center py-4">{$isLoading ? 'No cost data' : $_('analytics.noCostData')}</p>
          {:else}
            <div class="space-y-3">
              {#each costByType as [type, amount]}
                {@const pct = totalCosts > 0 ? (amount / totalCosts) * 100 : 0}
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class={costTypeBadge(type)}>{type}</span>
                    <span class="text-xs text-slate-400">{formatCurrency(amount)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div class="h-2 rounded-full bg-slate-800">
                    <div class="h-2 rounded-full bg-primary transition-all" style="width: {pct}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Anomaly summary -->
        <div class="rounded-xl border border-slate-700 bg-surface-2 p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Brain class="h-4 w-4 text-purple-400" />
            {$isLoading ? 'Anomaly Summary' : $_('analytics.anomalySummary')}
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-red-800/40 bg-red-900/20 p-3 text-center">
              <div class="text-2xl font-bold text-red-400">{anomalyBySeverity.critical}</div>
              <div class="text-xs text-red-500">{$isLoading ? 'Critical' : $_('analytics.severity.critical')}</div>
            </div>
            <div class="rounded-lg border border-amber-800/40 bg-amber-900/20 p-3 text-center">
              <div class="text-2xl font-bold text-amber-400">{anomalyBySeverity.high}</div>
              <div class="text-xs text-amber-500">{$isLoading ? 'High' : $_('analytics.severity.high')}</div>
            </div>
            <div class="rounded-lg border border-blue-800/40 bg-blue-900/20 p-3 text-center">
              <div class="text-2xl font-bold text-blue-400">{anomalyBySeverity.medium}</div>
              <div class="text-xs text-blue-500">{$isLoading ? 'Medium' : $_('analytics.severity.medium')}</div>
            </div>
            <div class="rounded-lg border border-slate-700 bg-slate-800/30 p-3 text-center">
              <div class="text-2xl font-bold text-slate-400">{anomalyBySeverity.low}</div>
              <div class="text-xs text-slate-500">{$isLoading ? 'Low' : $_('analytics.severity.low')}</div>
            </div>
          </div>
          {#if anomalies.length === 0}
            <p class="text-sm text-slate-500 text-center py-3 mt-2">{$isLoading ? 'No anomalies detected' : $_('analytics.noAnomalies')}</p>
          {/if}
        </div>

        <!-- Snapshot trend (simplified) -->
        {#if snapshots.length > 0}
          <div class="rounded-xl border border-slate-700 bg-surface-2 p-5 lg:col-span-2">
            <h3 class="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Activity class="h-4 w-4 text-blue-400" />
              {$isLoading ? 'Asset Trend (30 days)' : $_('analytics.assetTrend')}
            </h3>
            <div class="flex items-end gap-1 h-32" title="Asset count over time">
              {#each snapshots.slice(-20) as snap}
                {@const maxVal = Math.max(...snapshots.map(s => s.totalAssets || 1))}
                {@const height = ((snap.totalAssets || 0) / maxVal) * 100}
                <div class="flex-1 bg-primary/60 rounded-t hover:bg-primary transition-colors relative group" style="height: {height}%">
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 rounded bg-slate-900 px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg">
                    {new Date(snap.snapshotDate).toLocaleDateString('vi-VN')}: {snap.totalAssets}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Snapshots Tab -->
    {#if activeTab === 'snapshots'}
      {#if snapshots.length === 0}
        <div class="text-center py-12 text-slate-500">
          <TrendingUp class="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p>{$isLoading ? 'No snapshots yet' : $_('analytics.noSnapshots')}</p>
          <Button variant="primary" size="sm" class="mt-3" onclick={handleCreateSnapshot}>
            {$isLoading ? 'Create first snapshot' : $_('analytics.createFirstSnapshot')}
          </Button>
        </div>
      {:else}
        <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-800">
              <tr class="text-xs text-slate-400 uppercase">
                <th class="px-4 py-3 text-left">{$isLoading ? 'Date' : $_('analytics.snapshotCols.date')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Total' : $_('analytics.snapshotCols.total')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Active' : $_('analytics.snapshotCols.active')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'In Repair' : $_('analytics.snapshotCols.inRepair')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Retired' : $_('analytics.snapshotCols.retired')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Total Cost' : $_('analytics.snapshotCols.totalCost')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              {#each snapshots as snap}
                <tr class="hover:bg-slate-800/40 transition-colors">
                  <td class="px-4 py-3 text-white">{new Date(snap.snapshotDate).toLocaleDateString('vi-VN')}</td>
                  <td class="px-4 py-3 text-right font-semibold text-white">{snap.totalAssets}</td>
                  <td class="px-4 py-3 text-right text-emerald-400">{snap.activeAssets}</td>
                  <td class="px-4 py-3 text-right text-amber-400">{snap.inRepairAssets}</td>
                  <td class="px-4 py-3 text-right text-slate-400">{snap.retiredAssets}</td>
                  <td class="px-4 py-3 text-right text-purple-400">{snap.totalCostValue?.toLocaleString('vi-VN') ?? '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}

    <!-- Costs Tab -->
    {#if activeTab === 'costs'}
      {#if costs.length === 0}
        <div class="text-center py-12 text-slate-500">
          <DollarSign class="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p>{$isLoading ? 'No cost records' : $_('analytics.noCosts')}</p>
          <Button variant="primary" size="sm" class="mt-3" onclick={() => (showCostModal = true)}>
            {$isLoading ? 'Add first cost' : $_('analytics.addFirstCost')}
          </Button>
        </div>
      {:else}
        <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-800">
              <tr class="text-xs text-slate-400 uppercase">
                <th class="px-4 py-3 text-left">{$isLoading ? 'Asset' : $_('analytics.costCols.asset')}</th>
                <th class="px-4 py-3 text-left">{$isLoading ? 'Type' : $_('analytics.costCols.type')}</th>
                <th class="px-4 py-3 text-right">{$isLoading ? 'Amount' : $_('analytics.costCols.amount')}</th>
                <th class="px-4 py-3 text-left">{$isLoading ? 'Currency' : $_('analytics.costCols.currency')}</th>
                <th class="px-4 py-3 text-left">{$isLoading ? 'Date' : $_('analytics.costCols.date')}</th>
                <th class="px-4 py-3 text-left hidden md:table-cell">{$isLoading ? 'Description' : $_('analytics.costCols.description')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              {#each costs as cost}
                <tr class="hover:bg-slate-800/40 transition-colors">
                  <td class="px-4 py-3 font-mono text-xs text-slate-300">{cost.assetId}</td>
                  <td class="px-4 py-3"><span class={costTypeBadge(cost.costType)}>{cost.costType}</span></td>
                  <td class="px-4 py-3 text-right font-semibold text-white">{cost.amount?.toLocaleString('vi-VN')}</td>
                  <td class="px-4 py-3 text-slate-400">{cost.currency}</td>
                  <td class="px-4 py-3 text-slate-400">{new Date(cost.recordDate).toLocaleDateString('vi-VN')}</td>
                  <td class="px-4 py-3 text-slate-500 hidden md:table-cell truncate max-w-xs">{cost.description || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}

    <!-- Anomalies Tab -->
    {#if activeTab === 'anomalies'}
      {#if anomalies.length === 0}
        <div class="text-center py-12 text-slate-500">
          <Brain class="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p>{$isLoading ? 'No anomalies detected' : $_('analytics.noAnomalies')}</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each anomalies as anomaly}
            <div class="rounded-xl border p-4 {severityColor(anomaly.severity)}">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <AlertTriangle class="h-4 w-4" />
                    <span class="text-xs font-semibold uppercase">[{anomaly.type}]</span>
                    <span class="badge badge-gray text-xs">{anomaly.severity}</span>
                  </div>
                  <p class="text-sm text-white">{anomaly.description}</p>
                  <p class="text-xs text-slate-500 mt-1">Asset: <code class="code-inline">{anomaly.assetId}</code></p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<!-- Cost Record Modal -->
<CreateEditModal
  bind:open={showCostModal}
  mode="create"
  title={$isLoading ? 'Add Cost Record' : $_('analytics.modal.addCostTitle')}
  schema={costSchema}
  initialValues={{ assetId: '', costType: 'purchase', amount: 0, currency: 'VND', description: '' }}
  onSubmit={handleAddCost}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="cost-asset" label={$isLoading ? 'Asset ID' : $_('analytics.field.assetId')} required value={String(values.assetId ?? '')} error={errors.assetId} onValueChange={(v) => setValue('assetId', v)} disabled={disabled} />
    <SelectField id="cost-type" label={$isLoading ? 'Cost Type' : $_('analytics.field.costType')} required value={String(values.costType ?? 'purchase')} options={[
      { value: 'purchase', label: $_('analytics.costTypes.purchase') },
      { value: 'maintenance', label: $_('analytics.costTypes.maintenance') },
      { value: 'license', label: $_('analytics.costTypes.license') },
      { value: 'insurance', label: $_('analytics.costTypes.insurance') },
      { value: 'depreciation', label: $_('analytics.costTypes.depreciation') },
      { value: 'other', label: $_('analytics.costTypes.other') }
    ]} error={errors.costType} onValueChange={(v) => setValue('costType', v)} disabled={disabled} />
    <TextField id="cost-amount" type="number" label={$isLoading ? 'Amount' : $_('analytics.field.amount')} required value={String(values.amount ?? 0)} error={errors.amount} onValueChange={(v) => setValue('amount', Number(v))} disabled={disabled} />
    <SelectField id="cost-currency" label={$isLoading ? 'Currency' : $_('analytics.field.currency')} value={String(values.currency ?? 'VND')} options={[
      { value: 'VND', label: 'VND' },
      { value: 'USD', label: 'USD' },
      { value: 'EUR', label: 'EUR' }
    ]} onValueChange={(v) => setValue('currency', v)} disabled={disabled} />
    <TextareaField id="cost-desc" label={$isLoading ? 'Description' : $_('analytics.field.description')} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>
