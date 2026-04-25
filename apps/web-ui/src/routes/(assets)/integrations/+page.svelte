<script lang="ts">
  import { onMount } from 'svelte';
  import Alert from 'flowbite-svelte/Alert.svelte';
  import Badge from 'flowbite-svelte/Badge.svelte';
  import Button from 'flowbite-svelte/Button.svelte';
  import Input from 'flowbite-svelte/Input.svelte';
  import Label from 'flowbite-svelte/Label.svelte';
  import Modal from 'flowbite-svelte/Modal.svelte';
  import Select from 'flowbite-svelte/Select.svelte';
  import Spinner from 'flowbite-svelte/Spinner.svelte';
  import Table from 'flowbite-svelte/Table.svelte';
  import TableBody from 'flowbite-svelte/TableBody.svelte';
  import TableBodyCell from 'flowbite-svelte/TableBodyCell.svelte';
  import TableBodyRow from 'flowbite-svelte/TableBodyRow.svelte';
  import TableHead from 'flowbite-svelte/TableHead.svelte';
  import TableHeadCell from 'flowbite-svelte/TableHeadCell.svelte';
  import Tabs from 'flowbite-svelte/Tabs.svelte';
  import TabItem from 'flowbite-svelte/TabItem.svelte';
  import { Plus, Trash2, Zap, RefreshCw, Link, Copy } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { API_BASE } from '$lib/api/httpClient';
  import {
    listConnectors, createConnector, deleteConnector, testConnection, syncNow,
    listSyncRules, createSyncRule, deleteSyncRule, listSyncLogs,
    listWebhooks, createWebhook, deleteWebhook,
    type IntegrationConnector, type SyncRule, type SyncLog, type Webhook,
    type ConnectionTestResult, type SyncTriggerResult
  } from '$lib/api/integrations';

  // ── State ─────────────────────────────────────────────────────────────────
  let loading = $state(true);
  let error = $state('');
  let connectors = $state<IntegrationConnector[]>([]);
  let webhooks = $state<Webhook[]>([]);

  // Connector form
  let showConnectorModal = $state(false);
  let connName = $state('');
  let connProvider = $state('api_generic');
  let connActive = $state(false);
  let saving = $state(false);
  // Zabbix-specific fields
  let zbxBaseUrl = $state('');
  let zbxAuthMethod = $state<'token' | 'credentials'>('token');
  let zbxApiToken = $state('');
  let zbxUsername = $state('');
  let zbxPassword = $state('');
  let zbxHostGroups = $state('');
  let zbxDefaultModelId = $state('');
  let zbxWebhookSecret = $state('');
  // Generic JSON config (non-zabbix providers)
  let connConfigJson = $state('{}');

  // Test / sync result banners
  let testResult = $state<(ConnectionTestResult & { connectorId?: string }) | null>(null);
  let syncResult = $state<(SyncTriggerResult & { connectorId?: string }) | null>(null);
  let syncing = $state<string | null>(null); // connector id being synced

  // Sync Rules
  let selectedConnector = $state<IntegrationConnector | null>(null);
  let syncRules = $state<SyncRule[]>([]);
  let loadingRules = $state(false);
  let showSyncRuleModal = $state(false);
  let srName = $state('');
  let srDirection = $state<'inbound' | 'outbound' | 'bidirectional'>('inbound');
  let srEntityType = $state('asset');
  let srCron = $state('0 */1 * * *');
  let srActive = $state(true);
  let srDefaultModelId = $state('');
  let srHostGroups = $state('');

  // Sync Logs
  let selectedRule = $state<SyncRule | null>(null);
  let syncLogs = $state<SyncLog[]>([]);
  let loadingLogs = $state(false);
  let showLogsPanel = $state(false);

  // Webhook form
  let showWebhookModal = $state(false);
  let whName = $state('');
  let whUrl = $state('');
  let whEvents = $state('');
  let whActive = $state(true);

  // ── Data loading ──────────────────────────────────────────────────────────
  async function loadData() {
    try {
      loading = true; error = '';
      const [connRes, whRes] = await Promise.all([
        listConnectors().catch(() => ({ data: [] })),
        listWebhooks().catch(() => ({ data: [] }))
      ]);
      connectors = connRes.data ?? [];
      webhooks = whRes.data ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function loadRules(conn: IntegrationConnector) {
    selectedConnector = conn;
    showLogsPanel = false;
    try {
      loadingRules = true;
      const res = await listSyncRules(conn.id);
      syncRules = res.data ?? [];
    } catch {
      syncRules = [];
    } finally {
      loadingRules = false;
    }
  }

  async function loadLogs(rule: SyncRule) {
    selectedRule = rule;
    showLogsPanel = true;
    try {
      loadingLogs = true;
      const res = await listSyncLogs(rule.id);
      syncLogs = res.data ?? [];
    } catch {
      syncLogs = [];
    } finally {
      loadingLogs = false;
    }
  }

  onMount(() => { void loadData(); });

  // ── Connector actions ─────────────────────────────────────────────────────
  function openNewConnector() {
    connName = ''; connProvider = 'api_generic'; connActive = false;
    connConfigJson = '{}';
    zbxBaseUrl = ''; zbxAuthMethod = 'token'; zbxApiToken = '';
    zbxUsername = ''; zbxPassword = ''; zbxHostGroups = '';
    zbxDefaultModelId = ''; zbxWebhookSecret = '';
    showConnectorModal = true;
  }

  function buildZabbixConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {
      baseUrl: zbxBaseUrl,
      authMethod: zbxAuthMethod,
    };
    if (zbxAuthMethod === 'token') cfg.apiToken = zbxApiToken;
    else { cfg.username = zbxUsername; cfg.password = zbxPassword; }
    if (zbxHostGroups.trim()) {
      cfg.hostGroupFilter = zbxHostGroups.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (zbxDefaultModelId.trim()) cfg.defaultModelId = zbxDefaultModelId.trim();
    if (zbxWebhookSecret.trim()) cfg.webhookSecret = zbxWebhookSecret.trim();
    return cfg;
  }

  async function handleSaveConnector() {
    if (!connName) return;
    try {
      saving = true;
      let config: Record<string, unknown>;
      if (connProvider === 'zabbix') {
        config = buildZabbixConfig();
      } else {
        try { config = JSON.parse(connConfigJson); }
        catch { error = $isLoading ? 'Invalid JSON' : $_('integrations.form.invalidJson'); return; }
      }
      await createConnector({ name: connName, provider: connProvider, config, isActive: connActive });
      showConnectorModal = false;
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteConnector(id: string) {
    if (!confirm($isLoading ? 'Delete this connector?' : $_('integrations.connector.deleteConfirm'))) return;
    try {
      await deleteConnector(id);
      if (selectedConnector?.id === id) { selectedConnector = null; syncRules = []; }
      await loadData();
    } catch (e) { error = e instanceof Error ? e.message : 'Delete failed'; }
  }

  async function handleTestConnection(id: string) {
    try {
      testResult = null; syncResult = null;
      const res = await testConnection(id);
      testResult = { ...res.data, connectorId: id };
    } catch (e) {
      testResult = { healthy: false, message: e instanceof Error ? e.message : 'Test failed', connectorId: id };
    }
  }

  async function handleSyncNow(conn: IntegrationConnector) {
    try {
      syncing = conn.id; testResult = null; syncResult = null;
      const res = await syncNow(conn.id);
      syncResult = { ...res.data, connectorId: conn.id };
      await loadData();
      if (selectedConnector?.id === conn.id) await loadRules(conn);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Sync failed';
    } finally {
      syncing = null;
    }
  }

  function inboundUrl(connectorId: string): string {
    const base = API_BASE.replace('/api', '');
    return `${base}/api/v1/integrations/inbound/${connectorId}`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text);
  }

  // ── Sync Rule actions ─────────────────────────────────────────────────────
  function openNewSyncRule() {
    srName = ''; srDirection = 'inbound'; srEntityType = 'asset';
    srCron = '0 */1 * * *'; srActive = true;
    srDefaultModelId = (selectedConnector?.config?.defaultModelId as string) ?? '';
    srHostGroups = ((selectedConnector?.config?.hostGroupFilter as string[]) ?? []).join(', ');
    showSyncRuleModal = true;
  }

  async function handleSaveSyncRule() {
    if (!srName || !selectedConnector) return;
    try {
      saving = true;
      const filterConditions: Record<string, unknown> = {};
      if (srDefaultModelId.trim()) filterConditions.defaultModelId = srDefaultModelId.trim();
      if (srHostGroups.trim()) {
        filterConditions.hostGroupFilter = srHostGroups.split(',').map(s => s.trim()).filter(Boolean);
      }
      await createSyncRule(selectedConnector.id, {
        name: srName,
        direction: srDirection,
        entityType: srEntityType,
        scheduleCron: srCron || null,
        isActive: srActive,
        filterConditions,
      });
      showSyncRuleModal = false;
      await loadRules(selectedConnector);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteSyncRule(id: string) {
    if (!confirm($isLoading ? 'Delete this sync rule?' : $_('integrations.syncRule.deleteConfirm'))) return;
    try {
      await deleteSyncRule(id);
      if (selectedRule?.id === id) { selectedRule = null; syncLogs = []; showLogsPanel = false; }
      if (selectedConnector) await loadRules(selectedConnector);
    } catch (e) { error = e instanceof Error ? e.message : 'Delete failed'; }
  }

  // ── Webhook actions ───────────────────────────────────────────────────────
  function openNewWebhook() {
    whName = ''; whUrl = ''; whEvents = ''; whActive = true;
    showWebhookModal = true;
  }

  async function handleSaveWebhook() {
    if (!whName || !whUrl) return;
    try {
      saving = true;
      await createWebhook({ name: whName, url: whUrl, events: whEvents.split(',').map(e => e.trim()).filter(Boolean), isActive: whActive });
      showWebhookModal = false;
      await loadData();
    } catch (e) { error = e instanceof Error ? e.message : 'Failed';
    } finally { saving = false; }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm($isLoading ? 'Delete?' : $_('integrations.webhook.deleteConfirm'))) return;
    try { await deleteWebhook(id); await loadData(); }
    catch (e) { error = e instanceof Error ? e.message : 'Delete failed'; }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function healthColor(h: string) {
    return h === 'healthy' ? 'green' : h === 'error' ? 'red' : 'yellow';
  }
  function syncStatusColor(s: string) {
    return s === 'success' ? 'green' : s === 'partial' ? 'yellow' : s === 'failed' ? 'red' : 'indigo';
  }
  function logStatusColor(s: string) {
    return s === 'success' ? 'green' : s === 'partial' ? 'yellow' : s === 'failed' ? 'red' : s === 'running' ? 'blue' : 'dark';
  }
  function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleString() : ($isLoading ? 'Never' : $_('integrations.connector.never'));
  }
  function logDuration(log: SyncLog) {
    if (!log.completedAt) return '—';
    const ms = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<div class="page-shell page-content">
  <div class="mb-6">
    <h1 class="text-2xl font-semibold flex items-center gap-2">
      <Link class="w-6 h-6 text-purple-500" />
      {$isLoading ? 'Integration Hub' : $_('integrations.title')}
    </h1>
    <p class="text-sm text-slate-400 mt-1">
      {$isLoading ? 'Manage external integrations, connectors, and webhooks' : $_('integrations.subtitle')}
    </p>
  </div>

  {#if error}
    <Alert color="red" class="mb-4" dismissable>{error}</Alert>
  {/if}

  <!-- Test result banner -->
  {#if testResult}
    <Alert color={testResult.healthy ? 'green' : 'red'} class="mb-4" dismissable>
      {testResult.healthy
        ? ($isLoading ? 'Connection successful' : $_('integrations.test.success'))
        : ($isLoading ? 'Connection failed' : $_('integrations.test.failed'))}
      — {testResult.message}
      {#if testResult.version}
        &nbsp;| {$isLoading ? 'Zabbix' : $_('integrations.test.version')} {testResult.version}
        {#if testResult.hostCount != null}
          &nbsp;| {testResult.hostCount} {$isLoading ? 'host(s) monitored' : $_('integrations.test.hosts')}
        {/if}
      {/if}
    </Alert>
  {/if}

  <!-- Sync result banner -->
  {#if syncResult}
    <Alert color={syncResult.failed === 0 ? 'green' : 'yellow'} class="mb-4" dismissable>
      <strong>{$isLoading ? 'Sync Result' : $_('integrations.sync.title')}:</strong>
      {$isLoading ? 'Created' : $_('integrations.sync.created')} {syncResult.created}
      &nbsp;| {$isLoading ? 'Updated' : $_('integrations.sync.updated')} {syncResult.updated}
      &nbsp;| {$isLoading ? 'Failed' : $_('integrations.sync.failed')} {syncResult.failed}
      &nbsp;| {syncResult.durationMs}{$isLoading ? 'ms' : $_('integrations.sync.ms')}
      {#if syncResult.errors.length > 0}
        <details class="mt-1">
          <summary class="cursor-pointer text-sm">{$isLoading ? 'Error details' : $_('integrations.sync.errors')} ({syncResult.errors.length})</summary>
          <ul class="mt-1 text-xs list-disc list-inside">
            {#each syncResult.errors.slice(0, 5) as e}<li>{e}</li>{/each}
          </ul>
        </details>
      {/if}
    </Alert>
  {/if}

  <Tabs style="underline">
    <!-- ═══ TAB: CONNECTORS ═══════════════════════════════════════════════════ -->
    <TabItem open title={$isLoading ? 'Connectors' : $_('integrations.tabs.connectors')}>
      <div class="flex justify-end mb-4 mt-4">
        <Button data-testid="btn-new-connector" onclick={openNewConnector}>
          <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Connector' : $_('integrations.connector.new')}
        </Button>
      </div>

      {#if loading}
        <div class="flex justify-center py-10"><Spinner size="8" /></div>
      {:else}
        <Table>
          <TableHead>
            <TableHeadCell>{$isLoading ? 'Name' : $_('integrations.connector.name')}</TableHeadCell>
            <TableHeadCell>{$isLoading ? 'Provider' : $_('integrations.connector.provider')}</TableHeadCell>
            <TableHeadCell>{$isLoading ? 'Status' : $_('integrations.connector.status')}</TableHeadCell>
            <TableHeadCell>{$isLoading ? 'Health' : $_('integrations.connector.health')}</TableHeadCell>
            <TableHeadCell>{$isLoading ? 'Last Sync' : $_('integrations.connector.lastSync')}</TableHeadCell>
            <TableHeadCell>{$isLoading ? 'Actions' : $_('integrations.connector.actions')}</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each connectors as conn (conn.id)}
              <TableBodyRow data-testid="connector-row" class={selectedConnector?.id === conn.id ? 'bg-surface-1' : ''}>
                <TableBodyCell>
                  <button class="font-semibold text-left hover:underline text-primary"
                    onclick={() => loadRules(conn)}>{conn.name}</button>
                </TableBodyCell>
                <TableBodyCell><Badge color="purple">{conn.provider}</Badge></TableBodyCell>
                <TableBodyCell>
                  <Badge color={conn.isActive ? 'green' : 'dark'}>
                    {conn.isActive
                      ? ($isLoading ? 'Active' : $_('integrations.connector.active'))
                      : ($isLoading ? 'Inactive' : $_('integrations.connector.inactive'))}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <Badge color={healthColor(conn.healthStatus)}>{conn.healthStatus}</Badge>
                </TableBodyCell>
                <TableBodyCell class="text-sm text-slate-400">{fmtDate(conn.lastSyncAt)}</TableBodyCell>
                <TableBodyCell>
                  <div class="flex gap-1 flex-wrap">
                    <Button size="xs" color="blue" title={$isLoading ? 'Test Connection' : $_('integrations.connector.testBtn')}
                      data-testid="btn-test-conn" onclick={() => handleTestConnection(conn.id)}>
                      <Zap class="w-3 h-3" />
                    </Button>
                    {#if conn.provider === 'zabbix'}
                      <Button size="xs" color="green" title={$isLoading ? 'Sync Now' : $_('integrations.connector.syncBtn')}
                        data-testid="btn-sync-now" disabled={syncing === conn.id}
                        onclick={() => handleSyncNow(conn)}>
                        {#if syncing === conn.id}
                          <Spinner size="3" />
                        {:else}
                          <RefreshCw class="w-3 h-3" />
                        {/if}
                      </Button>
                    {/if}
                    <Button size="xs" color="red" data-testid="btn-delete-conn"
                      onclick={() => handleDeleteConnector(conn.id)}>
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </TableBodyCell>
              </TableBodyRow>
            {:else}
              <TableBodyRow>
                <TableBodyCell colspan={6} class="text-center text-slate-400">
                  {$isLoading ? 'No connectors configured' : $_('integrations.connector.noConnectors')}
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </TabItem>

    <!-- ═══ TAB: SYNC RULES ═══════════════════════════════════════════════════ -->
    <TabItem title={$isLoading ? 'Sync Rules' : $_('integrations.tabs.syncRules')}>
      <div class="mt-4">
        {#if !selectedConnector}
          <p class="text-slate-400 text-sm text-center py-8">
            {$isLoading ? 'Select a connector to view its rules' : $_('integrations.syncRule.selectConnector')}
          </p>
        {:else}
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{selectedConnector.name}</span>
              <Badge color="purple">{selectedConnector.provider}</Badge>
            </div>
            <Button onclick={openNewSyncRule}>
              <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Rule' : $_('integrations.syncRule.new')}
            </Button>
          </div>

          <!-- Inbound webhook URL for Zabbix -->
          {#if selectedConnector.provider === 'zabbix'}
            <div class="card mb-4 p-3">
              <p class="text-xs font-semibold text-slate-400 mb-1">
                {$isLoading ? 'Inbound Alert URL' : $_('integrations.form.zabbix.inboundUrl')}
              </p>
              <div class="flex items-center gap-2">
                <code class="text-xs bg-surface-1 px-2 py-1 rounded flex-1 truncate">
                  {inboundUrl(selectedConnector.id)}
                </code>
                <Button size="xs" color="alternative" onclick={() => copyToClipboard(inboundUrl(selectedConnector!.id))}>
                  <Copy class="w-3 h-3" />
                </Button>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                {$isLoading ? 'Configure this URL in Zabbix > Administration > Media Types' : $_('integrations.form.zabbix.inboundUrlHint')}
              </p>
            </div>
          {/if}

          {#if loadingRules}
            <div class="flex justify-center py-6"><Spinner size="6" /></div>
          {:else}
            <Table>
              <TableHead>
                <TableHeadCell>{$isLoading ? 'Rule Name' : $_('integrations.syncRule.name')}</TableHeadCell>
                <TableHeadCell>{$isLoading ? 'Direction' : $_('integrations.syncRule.direction')}</TableHeadCell>
                <TableHeadCell>{$isLoading ? 'Schedule' : $_('integrations.syncRule.schedule')}</TableHeadCell>
                <TableHeadCell>{$isLoading ? 'Last Sync' : $_('integrations.syncRule.lastSync')}</TableHeadCell>
                <TableHeadCell>{$isLoading ? 'Status' : $_('integrations.syncRule.lastStatus')}</TableHeadCell>
                <TableHeadCell></TableHeadCell>
              </TableHead>
              <TableBody>
                {#each syncRules as rule (rule.id)}
                  <TableBodyRow>
                    <TableBodyCell class="font-medium">{rule.name}</TableBodyCell>
                    <TableBodyCell>
                      <Badge color="indigo">
                        {$isLoading ? rule.direction : $_(`integrations.syncRule.directions.${rule.direction}`)}
                      </Badge>
                    </TableBodyCell>
                    <TableBodyCell class="text-xs text-slate-400 font-mono">{rule.scheduleCron ?? '—'}</TableBodyCell>
                    <TableBodyCell class="text-sm text-slate-400">{fmtDate(rule.lastSyncAt)}</TableBodyCell>
                    <TableBodyCell>
                      {#if rule.lastSyncStatus}
                        <Badge color={syncStatusColor(rule.lastSyncStatus)}>{rule.lastSyncStatus}</Badge>
                      {:else}
                        <span class="text-slate-400 text-sm">—</span>
                      {/if}
                    </TableBodyCell>
                    <TableBodyCell>
                      <div class="flex gap-1">
                        <Button size="xs" color="alternative" onclick={() => loadLogs(rule)}>
                          {$isLoading ? 'Logs' : $_('integrations.syncRule.viewLogs')}
                        </Button>
                        <Button size="xs" color="red" onclick={() => handleDeleteSyncRule(rule.id)}>
                          <Trash2 class="w-3 h-3" />
                        </Button>
                      </div>
                    </TableBodyCell>
                  </TableBodyRow>
                {:else}
                  <TableBodyRow>
                    <TableBodyCell colspan={6} class="text-center text-slate-400">
                      {$isLoading ? 'No sync rules configured' : $_('integrations.syncRule.noRules')}
                    </TableBodyCell>
                  </TableBodyRow>
                {/each}
              </TableBody>
            </Table>
          {/if}

          <!-- Sync Logs panel -->
          {#if showLogsPanel && selectedRule}
            <div class="mt-4 card p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-sm">
                  {$isLoading ? 'Sync History' : $_('integrations.syncLog.title')}
                  — <span class="text-slate-400">{selectedRule.name}</span>
                </h4>
                <Button size="xs" color="alternative" onclick={() => showLogsPanel = false}>✕</Button>
              </div>
              {#if loadingLogs}
                <div class="flex justify-center py-4"><Spinner size="6" /></div>
              {:else}
                <Table>
                  <TableHead>
                    <TableHeadCell>{$isLoading ? 'Status' : $_('integrations.syncLog.status')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Processed' : $_('integrations.syncLog.processed')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Created' : $_('integrations.syncLog.created')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Updated' : $_('integrations.syncLog.updated')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Failed' : $_('integrations.syncLog.failed')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Started' : $_('integrations.syncLog.startedAt')}</TableHeadCell>
                    <TableHeadCell>{$isLoading ? 'Duration' : $_('integrations.syncLog.duration')}</TableHeadCell>
                  </TableHead>
                  <TableBody>
                    {#each syncLogs as log (log.id)}
                      <TableBodyRow>
                        <TableBodyCell>
                          <Badge color={logStatusColor(log.status)}>
                            {$isLoading ? log.status : ($_(`integrations.syncLog.statuses.${log.status}`) || log.status)}
                          </Badge>
                        </TableBodyCell>
                        <TableBodyCell>{log.recordsProcessed}</TableBodyCell>
                        <TableBodyCell class="text-green-500">{log.recordsCreated}</TableBodyCell>
                        <TableBodyCell class="text-blue-500">{log.recordsUpdated}</TableBodyCell>
                        <TableBodyCell class={log.recordsFailed > 0 ? 'text-red-500' : ''}>{log.recordsFailed}</TableBodyCell>
                        <TableBodyCell class="text-sm text-slate-400">{fmtDate(log.startedAt)}</TableBodyCell>
                        <TableBodyCell class="text-sm text-slate-400">{logDuration(log)}</TableBodyCell>
                      </TableBodyRow>
                    {:else}
                      <TableBodyRow>
                        <TableBodyCell colspan={7} class="text-center text-slate-400">
                          {$isLoading ? 'No sync history yet' : $_('integrations.syncLog.noLogs')}
                        </TableBodyCell>
                      </TableBodyRow>
                    {/each}
                  </TableBody>
                </Table>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </TabItem>

    <!-- ═══ TAB: WEBHOOKS ═════════════════════════════════════════════════════ -->
    <TabItem title={$isLoading ? 'Webhooks' : $_('integrations.tabs.webhooks')}>
      <div class="flex justify-end mb-4 mt-4">
        <Button data-testid="btn-new-webhook" onclick={openNewWebhook}>
          <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Webhook' : $_('integrations.webhook.new')}
        </Button>
      </div>
      <Table>
        <TableHead>
          <TableHeadCell>{$isLoading ? 'Name' : $_('integrations.webhook.name')}</TableHeadCell>
          <TableHeadCell>{$isLoading ? 'URL' : $_('integrations.webhook.url')}</TableHeadCell>
          <TableHeadCell>{$isLoading ? 'Events' : $_('integrations.webhook.events')}</TableHeadCell>
          <TableHeadCell>{$isLoading ? 'Status' : $_('integrations.webhook.status')}</TableHeadCell>
          <TableHeadCell></TableHeadCell>
        </TableHead>
        <TableBody>
          {#each webhooks as wh (wh.id)}
            <TableBodyRow data-testid="webhook-row">
              <TableBodyCell class="font-semibold">{wh.name}</TableBodyCell>
              <TableBodyCell class="text-xs truncate max-w-[200px]">{wh.url}</TableBodyCell>
              <TableBodyCell>
                {#each wh.events.slice(0, 3) as ev}
                  <Badge color="indigo" class="mr-1 text-xs">{ev}</Badge>
                {/each}
                {#if wh.events.length > 3}<Badge color="dark">+{wh.events.length - 3}</Badge>{/if}
              </TableBodyCell>
              <TableBodyCell>
                <Badge color={wh.isActive ? 'green' : 'dark'}>
                  {wh.isActive
                    ? ($isLoading ? 'Active' : $_('integrations.webhook.active'))
                    : ($isLoading ? 'Inactive' : $_('integrations.webhook.inactive'))}
                </Badge>
              </TableBodyCell>
              <TableBodyCell>
                <Button size="xs" color="red" data-testid="btn-delete-wh" onclick={() => handleDeleteWebhook(wh.id)}>
                  <Trash2 class="w-3 h-3" />
                </Button>
              </TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow>
              <TableBodyCell colspan={5} class="text-center text-slate-400">
                {$isLoading ? 'No webhooks configured' : $_('integrations.webhook.noWebhooks')}
              </TableBodyCell>
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </TabItem>
  </Tabs>
</div>

<!-- ═══ MODAL: New Connector ══════════════════════════════════════════════════ -->
<Modal bind:open={showConnectorModal} size="lg">
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">
      {$isLoading ? 'New Integration Connector' : $_('integrations.connector.new')}
    </h3>
  </svelte:fragment>

  <div class="space-y-4">
    <div>
      <Label class="mb-2">{$isLoading ? 'Connector Name' : $_('integrations.form.connectorName')}</Label>
      <Input data-testid="input-conn-name" bind:value={connName}
        placeholder={$isLoading ? 'e.g. Zabbix Production' : $_('integrations.form.connectorNamePlaceholder')} />
    </div>

    <div>
      <Label class="mb-2">{$isLoading ? 'Provider' : $_('integrations.form.provider')}</Label>
      <Select data-testid="select-provider" bind:value={connProvider}>
        <option value="zabbix">Zabbix</option>
        <option value="servicenow">ServiceNow</option>
        <option value="jira">Jira</option>
        <option value="slack">Slack</option>
        <option value="teams">Microsoft Teams</option>
        <option value="aws">AWS</option>
        <option value="azure">Azure</option>
        <option value="email">Email</option>
        <option value="webhook">Webhook</option>
        <option value="csv_import">CSV Import</option>
        <option value="api_generic">Generic API</option>
      </Select>
    </div>

    <!-- Zabbix-specific config form -->
    {#if connProvider === 'zabbix'}
      <div class="bg-surface-1 rounded-lg p-4 space-y-3 border border-border">
        <p class="text-sm font-semibold text-primary">
          {$isLoading ? 'Zabbix Configuration' : $_('integrations.form.zabbix.title')}
        </p>

        <div>
          <Label class="mb-1 text-xs">{$isLoading ? 'Zabbix URL' : $_('integrations.form.zabbix.baseUrl')} *</Label>
          <Input bind:value={zbxBaseUrl}
            placeholder={$isLoading ? 'https://zabbix.company.com' : $_('integrations.form.zabbix.baseUrlPlaceholder')} />
        </div>

        <div>
          <Label class="mb-1 text-xs">{$isLoading ? 'Authentication Method' : $_('integrations.form.zabbix.authMethod')}</Label>
          <Select bind:value={zbxAuthMethod}>
            <option value="token">{$isLoading ? 'API Token' : $_('integrations.form.zabbix.authToken')}</option>
            <option value="credentials">{$isLoading ? 'Username / Password' : $_('integrations.form.zabbix.authCredentials')}</option>
          </Select>
        </div>

        {#if zbxAuthMethod === 'token'}
          <div>
            <Label class="mb-1 text-xs">{$isLoading ? 'API Token' : $_('integrations.form.zabbix.apiToken')} *</Label>
            <Input bind:value={zbxApiToken} type="password"
              placeholder={$isLoading ? 'Token from User profile > API tokens' : $_('integrations.form.zabbix.apiTokenPlaceholder')} />
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label class="mb-1 text-xs">{$isLoading ? 'Username' : $_('integrations.form.zabbix.username')} *</Label>
              <Input bind:value={zbxUsername} />
            </div>
            <div>
              <Label class="mb-1 text-xs">{$isLoading ? 'Password' : $_('integrations.form.zabbix.password')} *</Label>
              <Input bind:value={zbxPassword} type="password" />
            </div>
          </div>
        {/if}

        <div>
          <Label class="mb-1 text-xs">{$isLoading ? 'Host Group Filter' : $_('integrations.form.zabbix.hostGroupFilter')}</Label>
          <Input bind:value={zbxHostGroups}
            placeholder={$isLoading ? 'Linux Servers, Network Devices' : $_('integrations.form.zabbix.hostGroupFilterPlaceholder')} />
          <p class="text-xs text-slate-500 mt-1">
            {$isLoading ? 'Leave empty to sync all host groups' : $_('integrations.form.zabbix.hostGroupFilterHint')}
          </p>
        </div>

        <div>
          <Label class="mb-1 text-xs">{$isLoading ? 'Default Model UUID' : $_('integrations.form.zabbix.defaultModelId')}</Label>
          <Input bind:value={zbxDefaultModelId}
            placeholder={$isLoading ? 'UUID of the default asset model' : $_('integrations.form.zabbix.defaultModelIdPlaceholder')} />
          <p class="text-xs text-slate-500 mt-1">
            {$isLoading ? 'Required to auto-create new assets from Zabbix hosts' : $_('integrations.form.zabbix.defaultModelIdHint')}
          </p>
        </div>

        <div>
          <Label class="mb-1 text-xs">{$isLoading ? 'Webhook Secret' : $_('integrations.form.zabbix.webhookSecret')}</Label>
          <Input bind:value={zbxWebhookSecret} type="password"
            placeholder={$isLoading ? 'Optional shared secret for HMAC verification' : $_('integrations.form.zabbix.webhookSecretPlaceholder')} />
        </div>
      </div>
    {:else}
      <div>
        <Label class="mb-2">Config (JSON)</Label>
        <Input data-testid="input-conn-config" bind:value={connConfigJson} placeholder={'{"url": "..."}'} />
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <input type="checkbox" class="rounded" bind:checked={connActive} />
      <Label>{$isLoading ? 'Active' : $_('integrations.form.active')}</Label>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showConnectorModal = false}>
        {$isLoading ? 'Cancel' : $_('integrations.form.cancel')}
      </Button>
      <Button data-testid="btn-save-connector" onclick={handleSaveConnector}
        disabled={saving || !connName || (connProvider === 'zabbix' && !zbxBaseUrl)}>
        {saving
          ? ($isLoading ? 'Saving...' : $_('integrations.form.saving'))
          : ($isLoading ? 'Create Connector' : $_('integrations.form.create'))}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<!-- ═══ MODAL: New Sync Rule ══════════════════════════════════════════════════ -->
<Modal bind:open={showSyncRuleModal} size="md">
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">
      {$isLoading ? 'New Sync Rule' : $_('integrations.syncRule.new')}
    </h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">{$isLoading ? 'Rule Name' : $_('integrations.syncRule.name')}</Label>
      <Input bind:value={srName} placeholder="e.g. Sync Zabbix hosts hourly" />
    </div>
    <div>
      <Label class="mb-2">{$isLoading ? 'Direction' : $_('integrations.syncRule.direction')}</Label>
      <Select bind:value={srDirection}>
        <option value="inbound">{$isLoading ? 'Zabbix → QLTB' : $_('integrations.syncRule.directions.inbound')}</option>
        <option value="outbound">{$isLoading ? 'QLTB → External' : $_('integrations.syncRule.directions.outbound')}</option>
        <option value="bidirectional">{$isLoading ? 'Bidirectional' : $_('integrations.syncRule.directions.bidirectional')}</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">{$isLoading ? 'Schedule (cron)' : $_('integrations.syncRule.schedule')}</Label>
      <Input bind:value={srCron} placeholder="0 */1 * * *" class="font-mono" />
    </div>
    {#if selectedConnector?.provider === 'zabbix'}
      <div>
        <Label class="mb-2">{$isLoading ? 'Default Model UUID' : $_('integrations.form.zabbix.defaultModelId')}</Label>
        <Input bind:value={srDefaultModelId} placeholder={$isLoading ? 'Override connector default model' : $_('integrations.form.zabbix.defaultModelIdPlaceholder')} />
      </div>
      <div>
        <Label class="mb-2">{$isLoading ? 'Host Group Filter' : $_('integrations.form.zabbix.hostGroupFilter')}</Label>
        <Input bind:value={srHostGroups} placeholder={$isLoading ? 'Linux Servers, Network' : $_('integrations.form.zabbix.hostGroupFilterPlaceholder')} />
      </div>
    {/if}
    <div class="flex items-center gap-2">
      <input type="checkbox" class="rounded" bind:checked={srActive} />
      <Label>{$isLoading ? 'Active' : $_('integrations.syncRule.active')}</Label>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showSyncRuleModal = false}>
        {$isLoading ? 'Cancel' : $_('integrations.form.cancel')}
      </Button>
      <Button onclick={handleSaveSyncRule} disabled={saving || !srName}>
        {saving ? ($isLoading ? 'Saving...' : $_('integrations.form.saving')) : ($isLoading ? 'Create' : $_('integrations.form.create'))}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<!-- ═══ MODAL: New Webhook ════════════════════════════════════════════════════ -->
<Modal bind:open={showWebhookModal}>
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">{$isLoading ? 'New Webhook' : $_('integrations.webhook.new')}</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">{$isLoading ? 'Name' : $_('integrations.webhook.name')}</Label>
      <Input data-testid="input-wh-name" bind:value={whName} placeholder="e.g. Slack alerts" />
    </div>
    <div>
      <Label class="mb-2">{$isLoading ? 'URL' : $_('integrations.webhook.url')}</Label>
      <Input data-testid="input-wh-url" bind:value={whUrl} placeholder="https://hooks.slack.com/..." />
    </div>
    <div>
      <Label class="mb-2">{$isLoading ? 'Events (comma-separated)' : $_('integrations.webhook.events')}</Label>
      <Input data-testid="input-wh-events" bind:value={whEvents}
        placeholder={$isLoading ? 'asset.created, asset.updated' : $_('integrations.webhook.eventsPlaceholder')} />
    </div>
    <div class="flex items-center gap-2">
      <input type="checkbox" class="rounded" bind:checked={whActive} />
      <Label>{$isLoading ? 'Active' : $_('integrations.webhook.active')}</Label>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showWebhookModal = false}>
        {$isLoading ? 'Cancel' : $_('integrations.form.cancel')}
      </Button>
      <Button data-testid="btn-save-webhook" onclick={handleSaveWebhook} disabled={saving || !whName || !whUrl}>
        {saving ? ($isLoading ? 'Saving...' : $_('integrations.form.saving')) : ($isLoading ? 'Create' : $_('integrations.form.create'))}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
