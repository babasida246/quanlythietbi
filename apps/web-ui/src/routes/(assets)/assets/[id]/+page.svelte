<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell,
    Tabs, TabsList, TabsTrigger
  } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { ArrowLeft, Download, Wrench, UserPlus, Undo2 } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { getCapabilities } from '$lib/auth/capabilities';
  import AssetTimeline from '$lib/assets/components/AssetTimeline.svelte';
  import AssignModal from '$lib/assets/components/AssignModal.svelte';
  import MaintenanceModal from '$lib/assets/components/MaintenanceModal.svelte';
  import AttachmentList from '$lib/assets/components/AttachmentList.svelte';
  import AttachmentUploader from '$lib/assets/components/AttachmentUploader.svelte';
  import InventoryScanPanel from '$lib/assets/components/InventoryScanPanel.svelte';
  import AssetComponentsPanel from '$lib/assets/components/AssetComponentsPanel.svelte';
  import { downloadDriverFile, recommendDrivers, type DriverRecommendation } from '$lib/api/drivers';
  import { downloadDocumentFile, listDocuments, type Document as KnowledgeDocument } from '$lib/api/docs';
  import {
    assignAsset,
    getAssetDetail,
    getAssetTimeline,
    openMaintenanceTicket,
    returnAsset,
    type Asset,
    type AssetAssignment,
    type AssigneeType,
    type MaintenanceTicket,
    type MaintenanceSeverity,
    type AssetEvent
  } from '$lib/api/assets';
  import {
    closeInventorySession,
    createInventorySession,
    getInventorySessionDetail,
    listAttachments,
    listInventorySessions,
    listReminders,
    runWarrantyReminders,
    type Attachment,
    type InventoryItem,
    type InventorySession,
    type Reminder
  } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, type Catalogs } from '$lib/api/assetCatalogs';
  import { getAssetComponents, type ComponentAssignmentWithDetails } from '$lib/api/components';
  let asset = $state<Asset | null>(null);
  let assignments = $state<AssetAssignment[]>([]);
  let maintenance = $state<MaintenanceTicket[]>([]);
  let timeline = $state<AssetEvent[]>([]);
  let attachments = $state<Attachment[]>([]);
  let reminders = $state<Reminder[]>([]);
  let inventorySessions = $state<InventorySession[]>([]);
  let inventoryItems = $state<InventoryItem[]>([]);
  let catalogs = $state<Catalogs | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab = $state('overview');
  let showAssignModal = $state(false);
  let showMaintenanceModal = $state(false);
  let showReturnModal = $state(false);
  let returning = $state(false);
  let returnNote = $state('');
  let remindersLoading = $state(false);
  let inventoryLoading = $state(false);
  let creatingSession = $state(false);
  let activeInventorySessionId = $state('');
  let newSessionName = $state('');
  let newSessionLocationId = $state('');
  let purchaseCost = $state('');
  let usefulLifeYears = $state('3');

  let assetComponents = $state<ComponentAssignmentWithDetails[]>([]);
  let driverRecommendations = $state<DriverRecommendation[]>([]);
  let relatedDocuments = $state<KnowledgeDocument[]>([]);
  let knowledgeLoading = $state(false);
  let knowledgeError = $state('');

  let userRole = $state('');
  let ready = $state(false);
  const caps = $derived.by(() => getCapabilities(userRole));
  const backHref = $derived.by(() => (caps.canManageAssets ? '/assets' : '/me/assets'));

  const assetId = $derived(page.params.id);
  const locations = $derived(catalogs?.locations ?? []);

  onMount(() => {
    if (typeof window === 'undefined') return;
    userRole = localStorage.getItem('userRole') || '';
    ready = true;
  });
  const warrantyDaysLeft = $derived.by(() => {
    if (!asset?.warrantyEnd) return null;
    const end = new Date(asset.warrantyEnd).getTime();
    const diff = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) ? diff : null;
  });
  const inventoryCounts = $derived.by(() => {
    return inventoryItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  });
  const openMaintenanceCount = $derived.by(() => maintenance.filter((ticket) => ticket.status !== 'closed').length);
  const healthScore = $derived.by(() => {
    let score = 100;
    if (asset?.status === 'retired' || asset?.status === 'disposed') {
      score -= 40;
    }
    if (openMaintenanceCount > 0) {
      score -= Math.min(30, openMaintenanceCount * 10);
    }
    if (warrantyDaysLeft !== null) {
      if (warrantyDaysLeft < 0) score -= 25;
      else if (warrantyDaysLeft < 30) score -= 15;
      else if (warrantyDaysLeft < 90) score -= 8;
    }
    return Math.max(20, score);
  });
  const depreciation = $derived.by(() => {
    const cost = Number(purchaseCost);
    const years = Number(usefulLifeYears);
    if (!cost || cost <= 0 || years <= 0) {
      return { annual: 0, monthly: 0 };
    }
    return {
      annual: cost / years,
      monthly: cost / years / 12
    };
  });
  async function loadDetail() {
    if (!assetId) return;
    try {
      loading = true;
      error = '';
      const detail = await getAssetDetail(assetId);
      asset = detail.data?.asset ?? null;
      assignments = detail.data?.assignments ?? [];
      maintenance = detail.data?.maintenance ?? [];
      const timelineResp = await getAssetTimeline(assetId);
      timeline = timelineResp.data ?? [];

      const attachmentResp = await listAttachments(assetId);
      attachments = attachmentResp.data ?? [];

      const reminderResp = await listReminders({ status: 'pending', page: 1, limit: 100 });
      reminders = (reminderResp.data ?? []).filter((item) => item.assetId === assetId);

      if (caps.canManageAssets) {
        const [sessionResp, catalogResp] = await Promise.all([
          listInventorySessions({ page: 1, limit: 100 }),
          getAssetCatalogs()
        ]);
        inventorySessions = sessionResp.data ?? [];
        catalogs = catalogResp.data ?? null;
      } else {
        inventorySessions = [];
        inventoryItems = [];
        catalogs = null;
        activeInventorySessionId = '';
      }

      const compResp = await getAssetComponents(assetId);
      assetComponents = compResp?.components ?? [];

      void loadKnowledge();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.loadFailed');
    } finally {
      loading = false;
    }
  }

  async function loadKnowledge() {
    if (!assetId) return;
    knowledgeLoading = true;
    knowledgeError = '';
    try {
      const [drivers, docs] = await Promise.all([
        recommendDrivers({ assetId }),
        listDocuments({ relatedAssetId: assetId, page: 1, pageSize: 10, sort: 'updatedAt' })
      ]);
      driverRecommendations = drivers ?? [];
      relatedDocuments = docs.data ?? [];
    } catch (err) {
      knowledgeError = err instanceof Error ? err.message : $_('assets.knowledge.loadFailed');
      driverRecommendations = [];
      relatedDocuments = [];
    } finally {
      knowledgeLoading = false;
    }
  }
  async function handleAssign(data: { assigneeType: AssigneeType; assigneeName: string; assigneeId: string; note?: string }) {
    if (!asset) return;
    try {
      await assignAsset(asset.id, data);
      showAssignModal = false;
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.assignFailed');
    }
  }
  async function handleReturn() {
    if (!asset) return;
    try {
      returning = true;
      await returnAsset(asset.id, returnNote || undefined);
      showReturnModal = false;
      returnNote = '';
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.returnFailed');
    } finally {
      returning = false;
    }
  }
  async function handleMaintenance(data: { title: string; severity: MaintenanceSeverity; diagnosis?: string; resolution?: string }) {
    if (!asset) return;
    try {
      await openMaintenanceTicket({ assetId: asset.id, ...data });
      showMaintenanceModal = false;
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.openMaintenanceFailed');
    }
  }

  async function handleRunWarrantyReminders() {
    try {
      remindersLoading = true;
      await runWarrantyReminders([30, 60, 90]);
      const reminderResp = await listReminders({ status: 'pending' });
      reminders = (reminderResp.data ?? []).filter((item) => item.assetId === assetId);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.reminderFailed');
    } finally {
      remindersLoading = false;
    }
  }

  async function loadInventorySessionDetail(sessionId: string) {
    if (!sessionId) return;
    try {
      inventoryLoading = true;
      const response = await getInventorySessionDetail(sessionId);
      inventoryItems = response.data?.items ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryLoadFailed');
    } finally {
      inventoryLoading = false;
    }
  }

  async function handleCreateSession() {
    if (!newSessionName) return;
    try {
      creatingSession = true;
      const response = await createInventorySession({
        name: newSessionName,
        locationId: newSessionLocationId || undefined
      });
      const session = response.data;
      inventorySessions = [session, ...inventorySessions];
      activeInventorySessionId = session.id;
      newSessionName = '';
      newSessionLocationId = '';
      await loadInventorySessionDetail(session.id);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryCreateFailed');
    } finally {
      creatingSession = false;
    }
  }

  async function handleCloseSession() {
    if (!activeInventorySessionId) return;
    try {
      await closeInventorySession(activeInventorySessionId);
      const response = await listInventorySessions({ page: 1, limit: 50 });
      inventorySessions = response.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryCloseFailed');
    }
  }

  function downloadEvidencePack() {
    if (!asset) return;
    const payload = {
      asset,
      assignments,
      maintenance,
      timeline,
      attachments,
      reminders
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset-${asset.assetCode}-evidence.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  $effect(() => {
    if (!ready) return;
    assetId;
    void loadDetail();
  });

  $effect(() => {
    if (caps.canManageAssets) return;
    if (activeTab === 'inventory') {
      activeTab = 'overview';
    }
  });

  $effect(() => {
    if (activeInventorySessionId) {
      void loadInventorySessionDetail(activeInventorySessionId);
    }
  });
</script>
<div class="page-shell page-content">
  <div class="mb-4 flex items-center gap-3">
    <a href={backHref} class="btn-sm btn-secondary inline-flex items-center">
      <ArrowLeft class="w-4 h-4 mr-2" /> {$isLoading ? 'Back' : $_('common.back')}
    </a>
    <div>
      <h1 class="text-2xl font-semibold">{asset?.assetCode || ($isLoading ? 'Asset' : $_('assets.asset'))}</h1>
      <p class="text-sm text-slate-500">{asset?.status}</p>
    </div>
  </div>
  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if asset}
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="badge-primary">{$_(`assets.statusByCode.${asset.status}`)}</span>
        {#if asset.locationName}
          <span class="text-sm text-slate-500">{asset.locationName}</span>
        {/if}
      </div>
      {#if caps.canManageAssets}
        <div class="flex flex-wrap gap-2">
          <Button size="sm" onclick={() => showAssignModal = true}>
            <UserPlus class="w-4 h-4 mr-1" /> {$isLoading ? 'Assign' : $_('assets.assign')}
          </Button>
          <Button size="sm" variant="secondary" onclick={() => showReturnModal = true}>
            <Undo2 class="w-4 h-4 mr-1" /> {$isLoading ? 'Return' : $_('assets.return')}
          </Button>
          <Button size="sm" variant="secondary" onclick={() => showMaintenanceModal = true}>
            <Wrench class="w-4 h-4 mr-1" /> {$isLoading ? 'Maintenance' : $_('maintenance.title')}
          </Button>
        </div>
      {/if}
    </div>

    <Tabs>
      <TabsList>
        <TabsTrigger active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>{$isLoading ? 'Overview' : $_('assets.tabs.overview')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'lifecycle'} onclick={() => activeTab = 'lifecycle'}>{$isLoading ? 'Lifecycle' : $_('assets.tabs.lifecycle')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'maintenance'} onclick={() => activeTab = 'maintenance'}>{$isLoading ? 'Maintenance' : $_('assets.tabs.maintenance')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'warranty'} onclick={() => activeTab = 'warranty'}>{$isLoading ? 'Warranty' : $_('assets.tabs.warranty')}</TabsTrigger>
        {#if caps.canManageAssets}
          <TabsTrigger active={activeTab === 'inventory'} onclick={() => activeTab = 'inventory'}>{$isLoading ? 'Inventory' : $_('assets.tabs.inventory')}</TabsTrigger>
        {/if}
        <TabsTrigger active={activeTab === 'components'} onclick={() => activeTab = 'components'}>{$isLoading ? 'Components' : $_('assets.tabs.components')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'attachments'} onclick={() => activeTab = 'attachments'}>{$isLoading ? 'Attachments' : $_('assets.tabs.attachments')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'compliance'} onclick={() => activeTab = 'compliance'}>{$isLoading ? 'Compliance' : $_('assets.tabs.compliance')}</TabsTrigger>
      </TabsList>
    </Tabs>

    {#if activeTab === 'overview'}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="card lg:col-span-2">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Overview' : $_('assets.overview')}</h2>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-slate-500">{$isLoading ? 'Model' : $_('assets.model')}</p>
                <p class="font-medium">{asset.modelName || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Vendor' : $_('assets.vendor')}</p>
                <p class="font-medium">{asset.vendorName || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Location' : $_('assets.location')}</p>
                <p class="font-medium">{asset.locationName || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Serial' : $_('assets.serialNumber')}</p>
                <p class="font-medium">{asset.serialNo || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Mgmt IP' : $_('assets.mgmtIp')}</p>
                <p class="font-medium">{asset.mgmtIp || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Hostname' : $_('assets.hostname')}</p>
                <p class="font-medium">{asset.hostname || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Purchase date' : $_('assets.purchaseDate')}</p>
                <p class="font-medium">{asset.purchaseDate || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">{$isLoading ? 'Warranty End' : $_('assets.warrantyEnd')}</p>
                <p class="font-medium">{asset.warrantyEnd || '-'}</p>
              </div>
              <div class="col-span-2">
                <p class="text-slate-500">{$isLoading ? 'Notes' : $_('assets.notes')}</p>
                <p class="font-medium">{asset.notes || '-'}</p>
              </div>
            </div>
          </div>
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Asset health' : $_('assets.health.title')}</h2>
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-slate-500">{$_('assets.health.score')}</span>
              <span class={healthScore > 80 ? 'badge-success' : healthScore > 60 ? 'badge-warning' : 'badge-error'}>{healthScore}</span>
            </div>
            <div class="space-y-2 text-sm text-slate-400">
              <div class="flex items-center justify-between">
                <span>{$_('assets.health.maintenanceOpen')}</span>
                <span class="font-medium">{openMaintenanceCount}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.health.warrantyDays')}</span>
                <span class="font-medium">{warrantyDaysLeft ?? '-'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.health.assignments')}</span>
                <span class="font-medium">{assignments.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-lg font-semibold">{$isLoading ? 'Recommended drivers' : $_('assets.knowledge.recommendedDrivers')}</h2>
              {#if driverRecommendations.length > 0}
                <span class="badge-primary">{driverRecommendations.length}</span>
              {/if}
            </div>

            {#if knowledgeLoading}
              <div class="flex items-center justify-center py-6">
                <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            {:else if knowledgeError}
              <div class="alert alert-error">{knowledgeError}</div>
            {:else if driverRecommendations.length === 0}
              <p class="text-sm text-slate-500">{$isLoading ? 'No recommendations.' : $_('assets.knowledge.emptyDrivers')}</p>
            {:else}
              <div class="divide-y divide-slate-700">
                {#each driverRecommendations as rec (rec.driver.id)}
                  <div class="py-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-semibold text-white truncate">
                        {rec.driver.vendor} · {rec.driver.model}
                      </div>
                      <div class="text-xs text-slate-500">
                        {rec.driver.component} · {rec.driver.os}/{rec.driver.arch} · <span class="font-mono">{rec.driver.version}</span>
                      </div>
                      {#if rec.explain?.length}
                        <div class="text-[11px] text-slate-400 mt-1 truncate">{rec.explain.join(' · ')}</div>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class={(rec.driver.riskLevel === 'high' || rec.driver.riskLevel === 'critical') ? 'badge-error capitalize' : rec.driver.riskLevel === 'medium' ? 'badge-warning capitalize' : 'badge-success capitalize'}>
                        {rec.driver.riskLevel}
                      </span>
                      {#if rec.driver.file?.storageKey && rec.driver.approval.status === 'approved' && rec.driver.supportStatus !== 'blocked'}
                        <Button size="sm" variant="secondary" onclick={() => void downloadDriverFile(rec.driver.id)} aria-label="Download driver">
                          <Download class="w-4 h-4" />
                        </Button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="card">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-lg font-semibold">{$isLoading ? 'Related documents' : $_('assets.knowledge.relatedDocs')}</h2>
              {#if relatedDocuments.length > 0}
                <span class="badge-primary">{relatedDocuments.length}</span>
              {/if}
            </div>

            {#if knowledgeLoading}
              <div class="flex items-center justify-center py-6">
                <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            {:else if knowledgeError}
              <div class="alert alert-error">{knowledgeError}</div>
            {:else if relatedDocuments.length === 0}
              <p class="text-sm text-slate-500">{$isLoading ? 'No related docs.' : $_('assets.knowledge.emptyDocs')}</p>
            {:else}
              <div class="divide-y divide-slate-700">
                {#each relatedDocuments as doc (doc.id)}
                  <div class="py-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-semibold text-white truncate">{doc.title}</div>
                      <div class="text-xs text-slate-500 flex flex-wrap gap-2 items-center">
                        <span class="badge-primary capitalize">{doc.type}</span>
                        <span class="badge-info capitalize">{doc.visibility}</span>
                      </div>
                      {#if doc.summary}
                        <div class="text-[11px] text-slate-400 mt-1 truncate">{doc.summary}</div>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      {#if doc.contentType === 'link' && doc.externalUrl}
                        <a
                          class="text-xs font-semibold text-blue-600 hover:underline"
                          href={doc.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {$_('docs.openLink')}
                        </a>
                      {:else if doc.contentType === 'file' && doc.files?.length}
                        <Button
                          size="sm"
                          variant="secondary"
                          onclick={() => void downloadDocumentFile(doc.id, doc.files[0].id)}
                          aria-label="Download document"
                        >
                          <Download class="w-4 h-4" />
                        </Button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
    {:else if activeTab === 'lifecycle'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Assignments' : $_('assets.assignments')}</h2>
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>{$isLoading ? 'Assignee' : $_('assets.assignee')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Type' : $_('assets.assigneeType')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Assigned' : $_('assets.assignedAt')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Returned' : $_('assets.returnedAt')}</TableHeaderCell>
                </tr>
              </TableHeader>
              <tbody>
                {#each assignments as item}
                  <TableRow>
                    <TableCell>{item.assigneeName}</TableCell>
                    <TableCell>{item.assigneeType}</TableCell>
                    <TableCell>{new Date(item.assignedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{item.returnedAt ? new Date(item.returnedAt).toLocaleDateString() : '-'}</TableCell>
                  </TableRow>
                {/each}
              </tbody>
            </Table>
          </div>
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Timeline' : $_('assets.timeline')}</h2>
            <AssetTimeline events={timeline} />
          </div>
        </div>
    {:else if activeTab === 'maintenance'}
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Maintenance' : $_('maintenance.title')}</h2>
          {#if maintenance.length === 0}
            <div class="alert alert-info">{$isLoading ? 'No maintenance records yet.' : $_('assets.maintenanceEmpty')}</div>
          {:else}
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>{$isLoading ? 'Title' : $_('maintenance.titleLabel')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Severity' : $_('maintenance.severity')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Opened' : $_('maintenance.openedAt')}</TableHeaderCell>
                </tr>
              </TableHeader>
              <tbody>
                {#each maintenance as item}
                  <TableRow>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.severity}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{new Date(item.openedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                {/each}
              </tbody>
            </Table>
          {/if}
        </div>
    {:else if activeTab === 'warranty'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Warranty' : $_('assets.warranty')}</h2>
            <div class="space-y-2 text-sm text-slate-400">
              <div class="flex items-center justify-between">
                <span>{$_('assets.purchaseDate')}</span>
                <span class="font-medium">{asset.purchaseDate || '-'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.warrantyEnd')}</span>
                <span class="font-medium">{asset.warrantyEnd || '-'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.warrantyRemaining')}</span>
                <span class="font-medium">{warrantyDaysLeft ?? '-'}</span>
              </div>
            </div>
            {#if caps.isAdmin}
              <div class="mt-4 flex items-center gap-2">
                <Button size="sm" onclick={handleRunWarrantyReminders} disabled={remindersLoading}>
                  {remindersLoading ? $_('common.loading') : $_('assets.runWarrantyReminders')}
                </Button>
              </div>
            {/if}
            <div class="mt-4 space-y-2">
              {#if reminders.length === 0}
                <p class="text-sm text-slate-500">{$_('assets.remindersEmpty')}</p>
              {:else}
                {#each reminders as reminder}
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-slate-400">{reminder.reminderType}</span>
                    <span class="font-medium">{new Date(reminder.dueAt).toLocaleDateString()}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Depreciation' : $_('assets.depreciation.title')}</h2>
            <div class="grid grid-cols-1 gap-3 text-sm">
              <div>
                <label class="label-base mb-2" for="depr-cost">{$_('assets.depreciation.cost')}</label>
                <input id="depr-cost" class="input-base" bind:value={purchaseCost} placeholder="12000000" />
              </div>
              <div>
                <label class="label-base mb-2" for="depr-years">{$_('assets.depreciation.years')}</label>
                <select id="depr-years" class="select-base" bind:value={usefulLifeYears}>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.depreciation.annual')}</span>
                <span class="font-medium">{depreciation.annual.toFixed(0)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.depreciation.monthly')}</span>
                <span class="font-medium">{depreciation.monthly.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

    {:else if activeTab === 'inventory' && caps.canManageAssets}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Sessions' : $_('assets.inventory.sessions')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="md:col-span-2">
                <label class="label-base mb-2" for="inv-session-name">{$_('assets.inventory.sessionName')}</label>
                <input id="inv-session-name" class="input-base" bind:value={newSessionName} placeholder={$_('assets.inventory.sessionNamePlaceholder')} />
              </div>
              <div>
                <label class="label-base mb-2" for="inv-session-location">{$_('assets.inventory.sessionLocation')}</label>
                <select id="inv-session-location" class="select-base" bind:value={newSessionLocationId}>
                  <option value="">{$_('assets.placeholders.selectLocation')}</option>
                  {#each locations as location}
                    <option value={location.id}>{location.name}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <Button size="sm" onclick={handleCreateSession} disabled={!newSessionName || creatingSession}>
                {creatingSession ? $_('common.loading') : $_('assets.inventory.createSession')}
              </Button>
              <Button size="sm" variant="secondary" onclick={handleCloseSession} disabled={!activeInventorySessionId}>
                {$_('assets.inventory.closeSession')}
              </Button>
            </div>
            <div class="mt-4">
              <label class="label-base mb-2" for="inv-session-select">{$_('assets.inventory.sessionSelect')}</label>
              <select id="inv-session-select" class="select-base" bind:value={activeInventorySessionId}>
                <option value="">{$_('assets.inventory.selectSession')}</option>
                {#each inventorySessions as session}
                  <option value={session.id}>{session.name} - {session.status}</option>
                {/each}
              </select>
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
              {#each Object.entries(inventoryCounts) as [status, count]}
                <span class="badge-primary">{status}: {count}</span>
              {/each}
            </div>
          </div>
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Quick scan' : $_('assets.inventory.quickScan')}</h2>
            <InventoryScanPanel
              sessionId={activeInventorySessionId}
              {locations}
              onscanned={() => loadInventorySessionDetail(activeInventorySessionId)}
            />
          </div>
        </div>
        <div class="mt-6">
          <div class="card">
            <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Inventory items' : $_('assets.inventory.items')}</h2>
            {#if inventoryLoading}
              <div class="flex items-center justify-center p-8"><div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
            {:else if inventoryItems.length === 0}
              <p class="text-sm text-slate-500">{$_('assets.inventory.empty')}</p>
            {:else}
              <Table>
                <TableHeader>
                  <tr>
                    <TableHeaderCell>{$isLoading ? 'Asset ID' : $_('assets.assetId')}</TableHeaderCell>
                    <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
                    <TableHeaderCell>{$isLoading ? 'Scanned At' : $_('assets.inventory.scannedAt')}</TableHeaderCell>
                  </tr>
                </TableHeader>
                <tbody>
                  {#each inventoryItems as item}
                    <TableRow>
                      <TableCell>{item.assetId || '-'}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.scannedAt ? new Date(item.scannedAt).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  {/each}
                </tbody>
              </Table>
            {/if}
          </div>
        </div>
    {:else if activeTab === 'components'}
        <AssetComponentsPanel
          assetId={asset.id}
          bind:components={assetComponents}
          canManage={caps.canManageAssets}
        />
    {:else if activeTab === 'attachments'}
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Attachments' : $_('assets.attachments')}</h2>
          {#if caps.canManageAssets}
            <AttachmentUploader assetId={asset.id} onuploaded={loadDetail} />
          {/if}
          <div class="mt-4">
            <AttachmentList assetId={asset.id} attachments={attachments} />
          </div>
        </div>
    {:else if activeTab === 'compliance'}
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">{$isLoading ? 'Evidence pack' : $_('assets.compliance.title')}</h2>
          <p class="text-sm text-slate-500 mb-4">{$isLoading ? 'Download audit evidence for this asset.' : $_('assets.compliance.subtitle')}</p>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>{$_('assets.compliance.attachments')}: {attachments.length}</span>
            <span>{$_('assets.compliance.timeline')}: {timeline.length}</span>
            <span>{$_('assets.compliance.maintenance')}: {maintenance.length}</span>
          </div>
          <Button class="mt-4" onclick={downloadEvidencePack}>
            <Download class="w-4 h-4 mr-2" /> {$isLoading ? 'Download' : $_('assets.compliance.download')}
          </Button>
        </div>
    {/if}
  {/if}
</div>
{#if caps.canManageAssets}
  <AssignModal bind:open={showAssignModal} assetCode={asset?.assetCode || ''} onassign={handleAssign} />
  <MaintenanceModal bind:open={showMaintenanceModal} assetCode={asset?.assetCode || ''} onsubmit={handleMaintenance} />
  <Modal bind:open={showReturnModal} title={$isLoading ? 'Return Asset' : $_('assets.returnAsset')}>
    <div class="space-y-4">
      <div>
        <label class="label-base mb-2" for="return-note">{$isLoading ? 'Return Note' : $_('assets.returnNote')}</label>
        <input id="return-note" class="input-base" bind:value={returnNote} placeholder={$isLoading ? 'Optional note' : $_('assets.placeholders.returnNote')} />
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <Button variant="secondary" onclick={() => showReturnModal = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button onclick={handleReturn} disabled={returning}>
        {returning ? ($isLoading ? 'Returning...' : $_('assets.returning')) : ($isLoading ? 'Return' : $_('assets.return'))}
      </Button>
    </div>
  </Modal>
{/if}

