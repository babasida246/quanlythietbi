<script lang="ts">
  import Alert from 'flowbite-svelte/Alert.svelte';
  import Badge from 'flowbite-svelte/Badge.svelte';
  import Button from 'flowbite-svelte/Button.svelte';
  import Card from 'flowbite-svelte/Card.svelte';
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
  import { Plus, Trash2, Link, Settings, Zap } from 'lucide-svelte';
  import {
    listConnectors, createConnector, updateConnector, deleteConnector, testConnection,
    listWebhooks, createWebhook, deleteWebhook,
    type IntegrationConnector, type Webhook
  } from '$lib/api/integrations';

  let loading = $state(true);
  let error = $state('');
  let connectors = $state<IntegrationConnector[]>([]);
  let webhooks = $state<Webhook[]>([]);

  // Connector form
  let showConnectorModal = $state(false);
  let connName = $state('');
  let connProvider = $state<string>('api_generic');
  let connConfig = $state('{}');
  let connActive = $state(false);
  let saving = $state(false);
  let testResult = $state<{ healthy: boolean; message: string } | null>(null);

  // Webhook form
  let showWebhookModal = $state(false);
  let whName = $state('');
  let whUrl = $state('');
  let whEvents = $state('');
  let whActive = $state(true);

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [connRes, whRes] = await Promise.all([
        listConnectors().catch(() => ({ data: [] })),
        listWebhooks().catch(() => ({ data: [] }))
      ]);
      connectors = connRes.data ?? [];
      webhooks = whRes.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  function openNewConnector() {
    connName = '';
    connProvider = 'api_generic';
    connConfig = '{}';
    connActive = false;
    showConnectorModal = true;
  }

  async function handleSaveConnector() {
    if (!connName) return;
    try {
      saving = true;
      let config: Record<string, unknown>;
      try { config = JSON.parse(connConfig); } catch { error = 'Invalid JSON'; return; }
      await createConnector({ name: connName, provider: connProvider, config, isActive: connActive });
      showConnectorModal = false;
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteConnector(id: string) {
    if (!confirm('Delete this connector?')) return;
    try {
      await deleteConnector(id);
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  async function handleTestConnection(id: string) {
    try {
      testResult = null;
      const res = await testConnection(id);
      testResult = res.data;
    } catch (err) {
      testResult = { healthy: false, message: err instanceof Error ? err.message : 'Test failed' };
    }
  }

  function openNewWebhook() {
    whName = '';
    whUrl = '';
    whEvents = '';
    whActive = true;
    showWebhookModal = true;
  }

  async function handleSaveWebhook() {
    if (!whName || !whUrl) return;
    try {
      saving = true;
      const events = whEvents.split(',').map(e => e.trim()).filter(Boolean);
      await createWebhook({ name: whName, url: whUrl, events, isActive: whActive });
      showWebhookModal = false;
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm('Delete?')) return;
    try {
      await deleteWebhook(id);
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  $effect(() => { void loadData(); });
</script>

<div class="page-shell page-content">
  <div class="mb-6">
    <h1 class="text-2xl font-semibold flex items-center gap-2">
      <Link class="w-6 h-6 text-purple-500" /> Integration Hub
    </h1>
    <p class="text-sm text-gray-500 mt-1">Manage external integrations, connectors, and webhooks</p>
  </div>

  {#if error}
    <Alert color="red" class="mb-4" dismissable>{error}</Alert>
  {/if}

  {#if testResult}
    <Alert color={testResult.healthy ? 'green' : 'red'} class="mb-4" dismissable>
      Connection Test: {testResult.healthy ? 'Success' : 'Failed'} — {testResult.message}
    </Alert>
  {/if}

  <Tabs style="underline">
    <TabItem open title="Connectors">
      <div class="flex justify-end mb-4 mt-4">
        <Button data-testid="btn-new-connector" onclick={openNewConnector}>
          <Plus class="w-4 h-4 mr-2" /> New Connector
        </Button>
      </div>
      {#if loading}
        <div class="flex justify-center py-10"><Spinner size="8" /></div>
      {:else}
        <Table>
          <TableHead>
            <TableHeadCell>Name</TableHeadCell>
            <TableHeadCell>Provider</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell>Health</TableHeadCell>
            <TableHeadCell>Last Sync</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each connectors as conn}
              <TableBodyRow data-testid="connector-row">
                <TableBodyCell class="font-semibold">{conn.name}</TableBodyCell>
                <TableBodyCell><Badge color="purple">{conn.provider}</Badge></TableBodyCell>
                <TableBodyCell>
                  <Badge color={conn.isActive ? 'green' : 'dark'}>{conn.isActive ? 'Active' : 'Inactive'}</Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <Badge color={conn.healthStatus === 'healthy' ? 'green' : conn.healthStatus === 'error' ? 'red' : 'yellow'}>
                    {conn.healthStatus}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell>{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}</TableBodyCell>
                <TableBodyCell>
                  <div class="flex gap-2">
                    <Button size="xs" color="blue" data-testid="btn-test-conn" onclick={() => handleTestConnection(conn.id)}>
                      <Zap class="w-3 h-3" />
                    </Button>
                    <Button size="xs" color="red" data-testid="btn-delete-conn" onclick={() => handleDeleteConnector(conn.id)}>
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </TableBodyCell>
              </TableBodyRow>
            {:else}
              <TableBodyRow><TableBodyCell colspan={6} class="text-center text-gray-500">No connectors configured</TableBodyCell></TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </TabItem>

    <TabItem title="Webhooks">
      <div class="flex justify-end mb-4 mt-4">
        <Button data-testid="btn-new-webhook" onclick={openNewWebhook}>
          <Plus class="w-4 h-4 mr-2" /> New Webhook
        </Button>
      </div>
      <Table>
        <TableHead>
          <TableHeadCell>Name</TableHeadCell>
          <TableHeadCell>URL</TableHeadCell>
          <TableHeadCell>Events</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
          <TableHeadCell>Actions</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each webhooks as wh}
            <TableBodyRow data-testid="webhook-row">
              <TableBodyCell class="font-semibold">{wh.name}</TableBodyCell>
              <TableBodyCell class="text-xs truncate max-w-[200px]">{wh.url}</TableBodyCell>
              <TableBodyCell>
                {#each wh.events.slice(0, 3) as ev}
                  <Badge color="indigo" class="mr-1 text-xs">{ev}</Badge>
                {/each}
                {#if wh.events.length > 3}
                  <Badge color="dark">+{wh.events.length - 3}</Badge>
                {/if}
              </TableBodyCell>
              <TableBodyCell>
                <Badge color={wh.isActive ? 'green' : 'dark'}>{wh.isActive ? 'Active' : 'Inactive'}</Badge>
              </TableBodyCell>
              <TableBodyCell>
                <Button size="xs" color="red" data-testid="btn-delete-wh" onclick={() => handleDeleteWebhook(wh.id)}>
                  <Trash2 class="w-3 h-3" />
                </Button>
              </TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={5} class="text-center text-gray-500">No webhooks configured</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </TabItem>
  </Tabs>
</div>

<!-- Connector Modal -->
<Modal bind:open={showConnectorModal} size="lg">
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">New Integration Connector</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Connector Name</Label>
      <Input data-testid="input-conn-name" bind:value={connName} placeholder="e.g. ServiceNow Production" />
    </div>
    <div>
      <Label class="mb-2">Provider</Label>
      <Select data-testid="select-provider" bind:value={connProvider}>
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
    <div>
      <Label class="mb-2">Config (JSON)</Label>
      <Input data-testid="input-conn-config" bind:value={connConfig} placeholder={'{\"url\": \"...\"}'} />
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showConnectorModal = false}>Cancel</Button>
      <Button data-testid="btn-save-connector" onclick={handleSaveConnector} disabled={saving || !connName}>
        {saving ? 'Saving...' : 'Create'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<!-- Webhook Modal -->
<Modal bind:open={showWebhookModal}>
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">New Webhook</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Name</Label>
      <Input data-testid="input-wh-name" bind:value={whName} placeholder="e.g. Slack alerts" />
    </div>
    <div>
      <Label class="mb-2">URL</Label>
      <Input data-testid="input-wh-url" bind:value={whUrl} placeholder="https://hooks.slack.com/..." />
    </div>
    <div>
      <Label class="mb-2">Events (comma-separated)</Label>
      <Input data-testid="input-wh-events" bind:value={whEvents} placeholder="asset.created, asset.updated" />
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showWebhookModal = false}>Cancel</Button>
      <Button data-testid="btn-save-webhook" onclick={handleSaveWebhook} disabled={saving || !whName || !whUrl}>
        {saving ? 'Saving...' : 'Create'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
