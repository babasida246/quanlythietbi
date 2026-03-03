<script lang="ts">
  import {
    Alert, Badge, Button, Card, Input, Label, Modal, Select, Spinner,
    Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell
  } from 'flowbite-svelte';
  import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Plus, Brain } from 'lucide-svelte';
  import {
    getAnalyticsSummary, createSnapshot, getSnapshotHistory,
    addCostRecord, getCostRecords, getAnomalies,
    type AnalyticsSummary, type AnalyticsSnapshot, type CostRecord, type Anomaly
  } from '$lib/api/analytics';

  let loading = $state(true);
  let error = $state('');
  let summary = $state<AnalyticsSummary | null>(null);
  let snapshots = $state<AnalyticsSnapshot[]>([]);
  let costs = $state<CostRecord[]>([]);
  let anomalies = $state<Anomaly[]>([]);

  // Cost form
  let showCostModal = $state(false);
  let costAssetId = $state('');
  let costType = $state('purchase');
  let costAmount = $state(0);
  let costCurrency = $state('VND');
  let costDescription = $state('');
  let saving = $state(false);

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
      error = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function handleCreateSnapshot() {
    try {
      await createSnapshot();
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function handleAddCost() {
    if (!costAssetId || costAmount <= 0) return;
    try {
      saving = true;
      await addCostRecord({
        assetId: costAssetId,
        costType,
        amount: costAmount,
        currency: costCurrency,
        description: costDescription || undefined
      });
      showCostModal = false;
      costAssetId = '';
      costAmount = 0;
      costDescription = '';
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  $effect(() => { void loadData(); });
</script>

<div class="page-shell page-content">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold flex items-center gap-2">
        <BarChart3 class="w-6 h-6 text-blue-500" /> Analytics Dashboard
      </h1>
      <p class="text-sm text-gray-500 mt-1">Asset analytics, cost tracking, and AI insights</p>
    </div>
    <div class="flex gap-2">
      <Button color="light" data-testid="btn-snapshot" onclick={handleCreateSnapshot}>
        <TrendingUp class="w-4 h-4 mr-2" /> Create Snapshot
      </Button>
      <Button data-testid="btn-add-cost" onclick={() => showCostModal = true}>
        <Plus class="w-4 h-4 mr-2" /> Add Cost
      </Button>
    </div>
  </div>

  {#if error}
    <Alert color="red" class="mb-4" dismissable>{error}</Alert>
  {/if}

  {#if loading}
    <div class="flex justify-center py-10"><Spinner size="8" /></div>
  {:else}
    <!-- Summary Cards -->
    {#if summary}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card class="p-4">
          <p class="text-sm text-gray-500">Total Assets</p>
          <p class="text-2xl font-bold" data-testid="stat-total">{summary.totalAssets}</p>
        </Card>
        <Card class="p-4">
          <p class="text-sm text-gray-500">Active</p>
          <p class="text-2xl font-bold text-green-600" data-testid="stat-active">{summary.activeAssets}</p>
        </Card>
        <Card class="p-4">
          <p class="text-sm text-gray-500">In Repair</p>
          <p class="text-2xl font-bold text-yellow-600" data-testid="stat-repair">{summary.inRepairAssets}</p>
        </Card>
        <Card class="p-4">
          <p class="text-sm text-gray-500">Retired</p>
          <p class="text-2xl font-bold text-gray-600" data-testid="stat-retired">{summary.retiredAssets}</p>
        </Card>
      </div>
    {/if}

    <!-- Anomalies -->
    {#if anomalies.length > 0}
      <div class="mb-8">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle class="w-5 h-5 text-orange-500" /> Detected Anomalies
        </h2>
        <div class="space-y-2">
          {#each anomalies as anomaly}
            <Alert color={anomaly.severity === 'critical' ? 'red' : anomaly.severity === 'high' ? 'yellow' : 'blue'}>
              <span class="font-semibold">[{anomaly.type}]</span> {anomaly.description}
              <span class="text-xs ml-2">Asset: {anomaly.assetId}</span>
            </Alert>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Snapshot History -->
    <div class="mb-8">
      <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <TrendingUp class="w-5 h-5 text-blue-500" /> Snapshot History (Last 30 Days)
      </h2>
      {#if snapshots.length === 0}
        <p class="text-gray-500 text-center py-4">No snapshots yet. Click "Create Snapshot" to start tracking.</p>
      {:else}
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <Table>
            <TableHead>
              <TableHeadCell>Date</TableHeadCell>
              <TableHeadCell>Total</TableHeadCell>
              <TableHeadCell>Active</TableHeadCell>
              <TableHeadCell>In Repair</TableHeadCell>
              <TableHeadCell>Retired</TableHeadCell>
              <TableHeadCell>Total Cost</TableHeadCell>
            </TableHead>
            <TableBody>
              {#each snapshots as snap}
                <TableBodyRow>
                  <TableBodyCell>{new Date(snap.snapshotDate).toLocaleDateString()}</TableBodyCell>
                  <TableBodyCell>{snap.totalAssets}</TableBodyCell>
                  <TableBodyCell class="text-green-600">{snap.activeAssets}</TableBodyCell>
                  <TableBodyCell class="text-yellow-600">{snap.inRepairAssets}</TableBodyCell>
                  <TableBodyCell class="text-gray-600">{snap.retiredAssets}</TableBodyCell>
                  <TableBodyCell>{snap.totalCostValue?.toLocaleString()}</TableBodyCell>
                </TableBodyRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {/if}
    </div>

    <!-- Cost Records -->
    <div class="mb-8">
      <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <DollarSign class="w-5 h-5 text-green-500" /> Cost Records
      </h2>
      {#if costs.length === 0}
        <p class="text-gray-500 text-center py-4">No cost records yet.</p>
      {:else}
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <Table>
            <TableHead>
              <TableHeadCell>Asset</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Amount</TableHeadCell>
              <TableHeadCell>Currency</TableHeadCell>
              <TableHeadCell>Date</TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
            </TableHead>
            <TableBody>
              {#each costs as cost}
                <TableBodyRow>
                  <TableBodyCell>{cost.assetId}</TableBodyCell>
                  <TableBodyCell><Badge color="blue">{cost.costType}</Badge></TableBodyCell>
                  <TableBodyCell class="font-semibold">{cost.amount?.toLocaleString()}</TableBodyCell>
                  <TableBodyCell>{cost.currency}</TableBodyCell>
                  <TableBodyCell>{new Date(cost.recordDate).toLocaleDateString()}</TableBodyCell>
                  <TableBodyCell>{cost.description || '-'}</TableBodyCell>
                </TableBodyRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Cost Record Modal -->
<Modal bind:open={showCostModal}>
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">Add Cost Record</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Asset ID</Label>
      <Input data-testid="input-cost-asset-id" bind:value={costAssetId} placeholder="Asset UUID" />
    </div>
    <div>
      <Label class="mb-2">Cost Type</Label>
      <Select data-testid="select-cost-type" bind:value={costType}>
        <option value="purchase">Purchase</option>
        <option value="maintenance">Maintenance</option>
        <option value="license">License</option>
        <option value="insurance">Insurance</option>
        <option value="depreciation">Depreciation</option>
        <option value="other">Other</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">Amount</Label>
      <Input data-testid="input-cost-amount" type="number" bind:value={costAmount} placeholder="0" />
    </div>
    <div>
      <Label class="mb-2">Currency</Label>
      <Select data-testid="select-cost-currency" bind:value={costCurrency}>
        <option value="VND">VND</option>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">Description</Label>
      <Input data-testid="input-cost-desc" bind:value={costDescription} />
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showCostModal = false}>Cancel</Button>
      <Button data-testid="btn-save-cost" onclick={handleAddCost} disabled={saving || !costAssetId || costAmount <= 0}>
        {saving ? 'Saving...' : 'Add Cost'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
