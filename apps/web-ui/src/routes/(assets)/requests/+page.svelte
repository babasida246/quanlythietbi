<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    Button,
    Table,
    TableHeader,
    TableHeaderCell,
    TableRow,
    TableCell,
  } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import {
    Check,
    ClipboardList,
    Inbox,
    Layers,
    Plus,
    RefreshCw,
    RotateCcw,
    Send,
    UserCheck,
    X,
  } from 'lucide-svelte';
  import {
    listMyWfRequests,
    getMyWfRequest,
    submitWfRequest,
    cancelWfRequest,
    withdrawWfRequest,
    listAllWfRequests,
    listInboxApprovals,
    getInboxSummary,
    approveWfApproval,
    rejectWfApproval,
    claimWfApproval,
    WF_STATUS_LABELS,
    WF_PRIORITY_LABELS,
    WF_TYPE_LABELS,
    wfStatusBadgeClass,
    wfPriorityBadgeClass,
    type WfRequest,
    type WfRequestDetail,
    type WfRequestType,
    type WfRequestStatus,
    type InboxApproval,
    type InboxSummary,
  } from '$lib/api/wf';
  import WfRequestLineEditor from '$lib/assets/components/WfRequestLineEditor.svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';
  import { untrack } from 'svelte';

  // Active tab driven by ?tab= query param (mine | inbox | all)
  const activeTab = $derived(
    (page.url.searchParams.get('tab') as 'mine' | 'inbox' | 'all') || 'mine'
  );

  function setTab(tab: 'mine' | 'inbox' | 'all') {
    const url = new URL(page.url);
    url.searchParams.set('tab', tab);
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  //  TAB: Của tôi 
  let myRequests = $state<WfRequest[]>([]);
  let myLoading  = $state(false);
  let myError    = $state('');
  let myStatusFilter = $state<WfRequestStatus | ''>('');
  let myTypeFilter   = $state<WfRequestType | ''>('');
  let myMeta     = $state({ total: 0, page: 1, limit: 20 });

  let myDetailOpen    = $state(false);
  let myDetailLoading = $state(false);
  let selectedReq     = $state<WfRequest | null>(null);
  let selectedDetail  = $state<WfRequestDetail | null>(null);
  let cancelReason    = $state('');
  let withdrawReason  = $state('');
  let myActionBusy    = $state(false);

  async function loadMine(p = 1) {
    try {
      myLoading = true; myError = '';
      const res = await listMyWfRequests({ status: myStatusFilter || undefined, requestType: myTypeFilter || undefined, page: p, limit: myMeta.limit });
      myRequests = res.data ?? [];
      myMeta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) { myError = e instanceof Error ? e.message : $_('requests.loadFailed'); }
    finally { myLoading = false; }
  }

  async function handleSubmit(req: WfRequest) {
    myActionBusy = true;
    try {
      await submitWfRequest(req.id);
      toast.success($_('requests.toast.submitted'));
      myDetailOpen = false;
      await loadMine(myMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('common.unknownError')); }
    finally { myActionBusy = false; }
  }

  async function handleCancel(req: WfRequest) {
    myActionBusy = true;
    try {
      await cancelWfRequest(req.id, cancelReason || undefined);
      toast.success($_('requests.toast.canceled'));
      myDetailOpen = false; cancelReason = '';
      await loadMine(myMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('common.unknownError')); }
    finally { myActionBusy = false; }
  }

  async function handleWithdraw(req: WfRequest) {
    myActionBusy = true;
    try {
      await withdrawWfRequest(req.id, withdrawReason || undefined);
      toast.success($_('requests.toast.withdrawn'));
      myDetailOpen = false; withdrawReason = '';
      await loadMine(myMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('common.unknownError')); }
    finally { myActionBusy = false; }
  }

  async function openMyDetail(req: WfRequest) {
    selectedReq = req; selectedDetail = null; cancelReason = ''; withdrawReason = '';
    myDetailOpen = true; myDetailLoading = true;
    try { const res = await getMyWfRequest(req.id); selectedDetail = res.data; } catch { /**/ }
    finally { myDetailLoading = false; }
  }

  //  TAB: Hộp duyệt 
  let inboxLoading    = $state(false);
  let inboxError      = $state('');
  let approvals       = $state<InboxApproval[]>([]);
  let inboxSummary    = $state<InboxSummary>({ pendingCount: 0, urgentCount: 0, overdueCount: 0, unassignedCount: 0 });
  let inboxMeta       = $state({ total: 0, page: 1, limit: 20 });
  let inboxDetailOpen  = $state(false);
  let selectedApproval = $state<InboxApproval | null>(null);
  let inboxComment     = $state('');
  let inboxActionBusy  = $state(false);

  async function loadInbox(p = 1) {
    try {
      inboxLoading = true; inboxError = '';
      const [listRes, summaryRes] = await Promise.all([
        listInboxApprovals({ page: p, limit: inboxMeta.limit }),
        getInboxSummary(),
      ]);
      approvals    = listRes.data ?? [];
      inboxMeta    = { total: listRes.meta.total, page: listRes.meta.page, limit: listRes.meta.limit };
      inboxSummary = summaryRes.data;
    } catch (e) { inboxError = e instanceof Error ? e.message : $_('inbox.errors.loadFailed'); toast.error(inboxError); }
    finally { inboxLoading = false; }
  }

  async function handleApprove() {
    if (!selectedApproval) return;
    inboxActionBusy = true;
    try {
      await approveWfApproval(selectedApproval.id, inboxComment.trim() || undefined);
      toast.success($_('inbox.approvedSuccess'));
      inboxDetailOpen = false; inboxComment = ''; selectedApproval = null;
      await loadInbox(inboxMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('inbox.approvedFailed')); }
    finally { inboxActionBusy = false; }
  }

  async function handleReject() {
    if (!selectedApproval) return;
    inboxActionBusy = true;
    try {
      await rejectWfApproval(selectedApproval.id, inboxComment.trim() || undefined);
      toast.success($_('inbox.rejectedSuccess'));
      inboxDetailOpen = false; inboxComment = ''; selectedApproval = null;
      await loadInbox(inboxMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('inbox.rejectedFailed')); }
    finally { inboxActionBusy = false; }
  }

  async function handleClaim(item: InboxApproval) {
    inboxActionBusy = true;
    try {
      await claimWfApproval(item.id);
      toast.success($_('inbox.claimedSuccess'));
      await loadInbox(inboxMeta.page);
    } catch (e) { toast.error(e instanceof Error ? e.message : $_('inbox.claimedFailed')); }
    finally { inboxActionBusy = false; }
  }

  //  TAB: Tất cả 
  let allRequests     = $state<WfRequest[]>([]);
  let allLoading      = $state(false);
  let allError        = $state('');
  let allStatusFilter = $state<WfRequestStatus | ''>('');
  let allTypeFilter   = $state<WfRequestType | ''>('');
  let allMeta         = $state({ total: 0, page: 1, limit: 20 });

  async function loadAll(p = 1) {
    try {
      allLoading = true; allError = '';
      const res = await listAllWfRequests({ status: allStatusFilter || undefined, requestType: allTypeFilter || undefined, page: p, limit: allMeta.limit });
      allRequests = res.data ?? [];
      allMeta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) { allError = e instanceof Error ? e.message : $_('requests.loadFailed'); toast.error(allError); }
    finally { allLoading = false; }
  }

  // Bootstrap: load active tab on tab change
  // Use untrack() to prevent myMeta/inboxMeta/allMeta writes from looping back
  // into this effect (Svelte 5: sync reads inside loadX() become tracked deps).
  $effect(() => {
    const tab = activeTab; // only track activeTab
    untrack(() => {
      if (tab === 'mine')  void loadMine(1);
      if (tab === 'inbox') void loadInbox(1);
      if (tab === 'all')   void loadAll(1);
    });
  });

  // Pre-load inbox summary for badge count regardless of active tab
  $effect(() => { void getInboxSummary().then(r => { inboxSummary = r.data; }).catch(() => {}); });
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">{$isLoading ? 'Requests' : $_('requests.pageTitle')}</h1>
      <p class="text-sm text-slate-300">{$isLoading ? 'Manage and track workflow requests' : $_('requests.pageSubtitle')}</p>
    </div>
    {#if activeTab === 'mine'}
      <div class="flex gap-2">
        <Button variant="primary" onclick={() => goto('/me/requests/new')}>
          {#snippet leftIcon()}<Plus class="h-4 w-4" />{/snippet}
          {$isLoading ? 'Create Request' : $_('requests.createRequest')}
        </Button>
        <Button variant="secondary" size="sm" onclick={() => loadMine(myMeta.page)} disabled={myLoading}>
          {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
          {$isLoading ? 'Refresh' : $_('common.refresh')}
        </Button>
      </div>
    {:else if activeTab === 'inbox'}
      <Button variant="secondary" size="sm" onclick={() => loadInbox(inboxMeta.page)} disabled={inboxLoading}>
        {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Refresh' : $_('common.refresh')}
      </Button>
    {:else}
      <Button variant="secondary" size="sm" onclick={() => loadAll(allMeta.page)} disabled={allLoading}>
        {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Refresh' : $_('common.refresh')}
      </Button>
    {/if}
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 border-b border-slate-700">
    <button
      class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-b-2
        {activeTab === 'mine' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      onclick={() => setTab('mine')}
    >
      <ClipboardList class="h-4 w-4" />
      {$isLoading ? 'My Requests' : $_('requests.tab.mine')}
    </button>
    <button
      class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-b-2
        {activeTab === 'inbox' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      onclick={() => setTab('inbox')}
    >
      <Inbox class="h-4 w-4" />
      {$isLoading ? 'Approval Inbox' : $_('requests.tab.inbox')}
      {#if inboxSummary.pendingCount > 0}
        <span class="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-2xs font-bold text-white leading-none">
          {inboxSummary.pendingCount}
        </span>
      {/if}
    </button>
    <button
      class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-b-2
        {activeTab === 'all' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      onclick={() => setTab('all')}
    >
      <Layers class="h-4 w-4" />
      {$isLoading ? 'All Requests' : $_('requests.tab.all')}
    </button>
  </div>

  <!--  TAB: Của tôi  -->
  {#if activeTab === 'mine'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <select class="select-base" bind:value={myStatusFilter} onchange={() => loadMine(1)}>
        <option value="">{$isLoading ? 'All Statuses' : $_('common.allStatuses')}</option>
        {#each Object.entries(WF_STATUS_LABELS) as [val, label]}<option value={val}>{label}</option>{/each}
      </select>
      <select class="select-base" bind:value={myTypeFilter} onchange={() => loadMine(1)}>
        <option value="">{$isLoading ? 'All Types' : $_('common.allTypes')}</option>
        {#each Object.entries(WF_TYPE_LABELS) as [val, label]}<option value={val}>{label}</option>{/each}
      </select>
    </div>
    {#if myError}<div class="alert alert-error">{myError}</div>{/if}
    {#if myLoading}
      <Skeleton rows={5} />
    {:else if myRequests.length === 0}
      <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
        {$isLoading ? 'No requests yet.' : $_('requests.emptyState')}
      </div>
    {:else}
      <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
        <Table>
          <TableHeader>
            <tr>
              <TableHeaderCell>{$isLoading ? 'Code / Title' : $_('requests.header.code')}</TableHeaderCell>
              <TableHeaderCell>{$isLoading ? 'Type' : $_('requests.header.type')}</TableHeaderCell>
              <TableHeaderCell>{$isLoading ? 'Priority' : $_('requests.header.priority')}</TableHeaderCell>
              <TableHeaderCell>{$isLoading ? 'Status' : $_('requests.header.status')}</TableHeaderCell>
              <TableHeaderCell>{$isLoading ? 'Created' : $_('requests.header.createdAt')}</TableHeaderCell>
              <TableHeaderCell>{$isLoading ? 'Actions' : $_('requests.header.actions')}</TableHeaderCell>
            </tr>
          </TableHeader>
          <tbody>
            {#each myRequests as item}
              <TableRow>
                <TableCell>
                  <div class="font-mono text-xs text-slate-400">{item.code}</div>
                  <div class="font-medium text-slate-100 truncate max-w-xs">{item.title}</div>
                </TableCell>
                <TableCell><span class="badge badge-blue">{WF_TYPE_LABELS[item.requestType] ?? item.requestType}</span></TableCell>
                <TableCell><span class={wfPriorityBadgeClass(item.priority)}>{WF_PRIORITY_LABELS[item.priority] ?? item.priority}</span></TableCell>
                <TableCell><span class={wfStatusBadgeClass(item.status)}>{WF_STATUS_LABELS[item.status] ?? item.status}</span></TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onclick={() => openMyDetail(item)}>{$isLoading ? 'Detail' : $_('common.detail')}</Button>
                </TableCell>
              </TableRow>
            {/each}
          </tbody>
        </Table>
      </div>
      <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{$isLoading ? 'Total' : $_('common.total')}: {myMeta.total}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" disabled={myMeta.page <= 1} onclick={() => loadMine(myMeta.page - 1)}>{$isLoading ? 'Prev' : $_('common.previous')}</Button>
          <Button size="sm" variant="secondary" disabled={(myMeta.page * myMeta.limit) >= myMeta.total} onclick={() => loadMine(myMeta.page + 1)}>{$isLoading ? 'Next' : $_('common.next')}</Button>
        </div>
      </div>
    {/if}
  {/if}

  <!--  TAB: Hộp duyệt  -->
  {#if activeTab === 'inbox'}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
        <div class="text-3xl font-bold text-blue-400">{inboxSummary.pendingCount}</div>
        <div class="text-xs text-slate-400 mt-1">{$isLoading ? 'Pending' : $_('inbox.pending')}</div>
      </div>
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
        <div class="text-3xl font-bold text-red-400">{inboxSummary.urgentCount}</div>
        <div class="text-xs text-slate-400 mt-1">{$isLoading ? 'Urgent' : $_('inbox.urgent')}</div>
      </div>
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
        <div class="text-3xl font-bold text-orange-400">{inboxSummary.overdueCount}</div>
        <div class="text-xs text-slate-400 mt-1">{$isLoading ? 'Overdue' : $_('inbox.overdue')}</div>
      </div>
      <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
        <div class="text-3xl font-bold text-yellow-400">{inboxSummary.unassignedCount}</div>
        <div class="text-xs text-slate-400 mt-1">{$isLoading ? 'Unassigned' : $_('inbox.unassigned')}</div>
      </div>
    </div>
    {#if inboxError}<div class="alert alert-error">{inboxError}</div>{/if}
    {#if inboxLoading}
      <Skeleton rows={5} />
    {:else if approvals.length === 0}
      <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
        {$isLoading ? 'No pending approvals.' : $_('inbox.empty')}
      </div>
    {:else}
      <div class="data-table-wrap"><div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{$isLoading ? 'Request' : $_('inbox.tableHeaders.request')}</th>
              <th>{$isLoading ? 'Type' : $_('inbox.tableHeaders.type')}</th>
              <th>{$isLoading ? 'Priority' : $_('inbox.tableHeaders.priority')}</th>
              <th>{$isLoading ? 'Status' : $_('inbox.tableHeaders.status')}</th>
              <th>{$isLoading ? 'Step' : $_('inbox.tableHeaders.step')}</th>
              <th>{$isLoading ? 'Submitted' : $_('inbox.tableHeaders.submitted')}</th>
              <th class="text-right">{$isLoading ? 'Actions' : $_('inbox.tableHeaders.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each approvals as item}
              <tr>
                <td>
                  <div class="font-mono text-xs text-slate-400">{item.request.code}</div>
                  <div class="font-medium text-slate-100 max-w-xs truncate">{item.request.title}</div>
                  {#if item.request.requesterName}<div class="text-xs text-slate-500">{item.request.requesterName}</div>{/if}
                </td>
                <td><span class="badge badge-blue">{WF_TYPE_LABELS[item.request.requestType] ?? item.request.requestType}</span></td>
                <td><span class={wfPriorityBadgeClass(item.request.priority)}>{WF_PRIORITY_LABELS[item.request.priority] ?? item.request.priority}</span></td>
                <td><span class={wfStatusBadgeClass(item.request.status)}>{WF_STATUS_LABELS[item.request.status] ?? item.request.status}</span></td>
                <td>
                  <span class="text-sm font-semibold text-slate-300">
                    {$isLoading ? `Step ${item.stepNo}` : $_('inbox.stepNo', { values: { n: item.stepNo } })}{item.stepName ? `  ${item.stepName}` : ''}
                  </span>
                  {#if item.assigneeUserId === null}<div class="text-xs text-yellow-400 mt-0.5">{$isLoading ? 'Unassigned' : $_('inbox.unassignedNote')}</div>{/if}
                  {#if item.dueAt}
                    {@const overdue = new Date(item.dueAt) < new Date()}
                    <div class="text-xs mt-0.5 {overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}">{new Date(item.dueAt).toLocaleDateString('vi-VN')}{overdue ? ' ' : ''}</div>
                  {/if}
                </td>
                <td class="text-slate-400">{new Date(item.request.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  <div class="cell-actions">
                    <Button size="sm" variant="secondary" onclick={() => { selectedApproval = item; inboxComment = ''; inboxDetailOpen = true; }}>{$isLoading ? 'Details' : $_('inbox.details')}</Button>
                    {#if item.assigneeUserId === null}
                      <Button size="sm" variant="secondary" onclick={() => handleClaim(item)} disabled={inboxActionBusy}><UserCheck class="h-3.5 w-3.5" /></Button>
                    {:else}
                      <Button size="sm" variant="primary" onclick={() => { selectedApproval = item; inboxComment = ''; void handleApprove(); }} disabled={inboxActionBusy}><Check class="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="danger" onclick={() => { selectedApproval = item; inboxComment = ''; void handleReject(); }} disabled={inboxActionBusy}><X class="h-3.5 w-3.5" /></Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div></div>
      <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{$isLoading ? 'Total' : $_('common.total')}: {inboxMeta.total}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" disabled={inboxMeta.page <= 1} onclick={() => loadInbox(inboxMeta.page - 1)}>{$isLoading ? 'Prev' : $_('inbox.prev')}</Button>
          <Button size="sm" variant="secondary" disabled={(inboxMeta.page * inboxMeta.limit) >= inboxMeta.total} onclick={() => loadInbox(inboxMeta.page + 1)}>{$isLoading ? 'Next' : $_('inbox.next')}</Button>
        </div>
      </div>
    {/if}
  {/if}

  <!--  TAB: Tất cả  -->
  {#if activeTab === 'all'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <select class="select-base" bind:value={allStatusFilter} onchange={() => loadAll(1)}>
        <option value="">{$isLoading ? 'All Statuses' : $_('requests.allStatuses')}</option>
        {#each Object.entries(WF_STATUS_LABELS) as [val, label]}<option value={val}>{label}</option>{/each}
      </select>
      <select class="select-base" bind:value={allTypeFilter} onchange={() => loadAll(1)}>
        <option value="">{$isLoading ? 'All Types' : $_('requests.allTypes')}</option>
        {#each Object.entries(WF_TYPE_LABELS) as [val, label]}<option value={val}>{label}</option>{/each}
      </select>
    </div>
    {#if allError}<div class="alert alert-error">{allError}</div>{/if}
    {#if allLoading}
      <Skeleton rows={5} />
    {:else if allRequests.length === 0}
      <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
        {$isLoading ? 'No requests.' : $_('requests.workflowEmpty')}
      </div>
    {:else}
      <div class="data-table-wrap"><div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{$isLoading ? 'Code / Title' : $_('requests.header.code')}</th>
              <th>{$isLoading ? 'Type' : $_('requests.header.type')}</th>
              <th>{$isLoading ? 'Priority' : $_('requests.header.priority')}</th>
              <th>{$isLoading ? 'Status' : $_('requests.header.status')}</th>
              <th>{$isLoading ? 'Requester' : $_('requests.header.requester')}</th>
              <th>{$isLoading ? 'Created' : $_('requests.header.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {#each allRequests as item}
              <tr>
                <td>
                  <div class="font-mono text-xs text-slate-400">{item.code}</div>
                  <div class="font-medium text-slate-100 truncate max-w-xs">{item.title}</div>
                </td>
                <td><span class="badge badge-blue">{WF_TYPE_LABELS[item.requestType] ?? item.requestType}</span></td>
                <td><span class={wfPriorityBadgeClass(item.priority)}>{WF_PRIORITY_LABELS[item.priority] ?? item.priority}</span></td>
                <td><span class={wfStatusBadgeClass(item.status)}>{WF_STATUS_LABELS[item.status] ?? item.status}</span></td>
                <td class="text-slate-400">{item.requesterName ?? item.requesterId}</td>
                <td class="text-slate-400">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div></div>
      <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{$isLoading ? 'Total' : $_('common.total')}: {allMeta.total}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" disabled={allMeta.page <= 1} onclick={() => loadAll(allMeta.page - 1)}>{$isLoading ? 'Prev' : $_('common.previous')}</Button>
          <Button size="sm" variant="secondary" disabled={(allMeta.page * allMeta.limit) >= allMeta.total} onclick={() => loadAll(allMeta.page + 1)}>{$isLoading ? 'Next' : $_('common.next')}</Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal: My request detail -->
{#if myDetailOpen && selectedReq}
  <Modal title={$isLoading ? `Detail: ${selectedReq.code}` : `${$_('requests.detail.title')}: ${selectedReq.code}`} bind:open={myDetailOpen}>
    <div class="space-y-4 p-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><div class="text-slate-400">{$isLoading ? 'Title' : $_('requests.field.title')}</div><div class="font-medium text-slate-100">{selectedReq.title}</div></div>
        <div><div class="text-slate-400">{$isLoading ? 'Status' : $_('requests.detail.status')}</div><span class={wfStatusBadgeClass(selectedReq.status)}>{WF_STATUS_LABELS[selectedReq.status] ?? selectedReq.status}</span></div>
        <div><div class="text-slate-400">{$isLoading ? 'Type' : $_('requests.detail.type')}</div><div>{WF_TYPE_LABELS[selectedReq.requestType] ?? selectedReq.requestType}</div></div>
        <div><div class="text-slate-400">{$isLoading ? 'Priority' : $_('requests.field.priority')}</div><span class={wfPriorityBadgeClass(selectedReq.priority)}>{WF_PRIORITY_LABELS[selectedReq.priority] ?? selectedReq.priority}</span></div>
        <div><div class="text-slate-400">{$isLoading ? 'Created' : $_('requests.detail.createdAt')}</div><div>{new Date(selectedReq.createdAt).toLocaleString('vi-VN')}</div></div>
        {#if selectedReq.submittedAt}<div><div class="text-slate-400">{$isLoading ? 'Submitted at' : $_('requests.detail.submittedAt')}</div><div>{new Date(selectedReq.submittedAt).toLocaleString('vi-VN')}</div></div>{/if}
        {#if selectedReq.currentStepNo}<div><div class="text-slate-400">{$isLoading ? 'Current step' : $_('requests.detail.currentStep')}</div><div class="font-bold">{selectedReq.currentStepNo}</div></div>{/if}
      </div>

      {#if Object.keys(selectedReq.payload).length > 0}
        <div>
          <div class="text-xs text-slate-400 mb-1">{$isLoading ? 'Request Info' : $_('requests.detail.requestInfo')}</div>
          <div class="rounded-lg bg-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
            {#each Object.entries(selectedReq.payload) as [k, v]}<div><span class="text-slate-500">{k}:</span> {String(v)}</div>{/each}
          </div>
        </div>
      {/if}

      {#if myDetailLoading}
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <div class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          {$isLoading ? 'Loading details...' : $_('requests.detail.loading')}
        </div>
      {:else if selectedDetail?.lines && selectedDetail.lines.length > 0}
        <div>
          <div class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{$isLoading ? 'Lines' : $_('requests.detail.lines')} ({selectedDetail.lines.length})</div>
          <WfRequestLineEditor
            lines={selectedDetail.lines.map((l) => ({ itemType: l.itemType, partId: l.partId ?? undefined, assetId: l.assetId ?? undefined, requestedQty: l.requestedQty, note: l.note ?? undefined }))}
            parts={[]} assets={[]} readonly={true}
          />
        </div>
      {/if}

      {#if selectedReq.status === 'draft'}
        <div class="border-t border-slate-700 pt-4">
          <Button variant="primary" onclick={() => handleSubmit(selectedReq!)} disabled={myActionBusy}>
            {#snippet leftIcon()}<Send class="h-4 w-4" />{/snippet}
            {myActionBusy ? $_('requests.actionBusy.submitting') : $_('requests.submit')}
          </Button>
        </div>
      {/if}
      {#if selectedReq.status === 'submitted' || selectedReq.status === 'in_review'}
        <div class="border-t border-slate-700 pt-4 space-y-2">
          <div class="text-sm text-slate-400">{$isLoading ? 'Withdraw:' : $_('requests.withdrawHint')}</div>
          <input class="input-base" type="text" bind:value={withdrawReason} placeholder={$isLoading ? 'Reason...' : $_('requests.withdrawReasonPlaceholder')} />
          <Button variant="secondary" size="sm" onclick={() => handleWithdraw(selectedReq!)} disabled={myActionBusy}>
            {#snippet leftIcon()}<RotateCcw class="h-4 w-4" />{/snippet}
            {myActionBusy ? $_('requests.actionBusy.withdrawing') : $_('requests.withdraw')}
          </Button>
        </div>
      {/if}
      {#if selectedReq.status === 'draft' || selectedReq.status === 'submitted' || selectedReq.status === 'in_review'}
        <div class="border-t border-slate-700 pt-4 space-y-2">
          <div class="text-sm text-slate-400">{$isLoading ? 'Cancel:' : $_('requests.cancelHint')}</div>
          <input class="input-base" type="text" bind:value={cancelReason} placeholder={$isLoading ? 'Reason...' : $_('requests.cancelReasonPlaceholder')} />
          <Button variant="danger" size="sm" onclick={() => handleCancel(selectedReq!)} disabled={myActionBusy}>
            {#snippet leftIcon()}<X class="h-4 w-4" />{/snippet}
            {myActionBusy ? $_('requests.actionBusy.canceling') : $_('requests.cancelRequest')}
          </Button>
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<!-- Modal: Inbox approval -->
{#if inboxDetailOpen && selectedApproval}
  <Modal title={$isLoading ? `Approval: ${selectedApproval.request.code}` : $_('inbox.approvalTitle', { values: { code: selectedApproval.request.code } })} bind:open={inboxDetailOpen}>
    <div class="space-y-4 p-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><div class="text-slate-400">{$isLoading ? 'Title' : $_('inbox.detail.title')}</div><div class="font-medium text-slate-100">{selectedApproval.request.title}</div></div>
        <div><div class="text-slate-400">{$isLoading ? 'Type' : $_('inbox.detail.type')}</div><div>{WF_TYPE_LABELS[selectedApproval.request.requestType] ?? selectedApproval.request.requestType}</div></div>
        <div><div class="text-slate-400">{$isLoading ? 'Requester' : $_('inbox.detail.requester')}</div><div>{selectedApproval.request.requesterName ?? selectedApproval.request.requesterId}</div></div>
        <div><div class="text-slate-400">{$isLoading ? 'Priority' : $_('inbox.detail.priority')}</div><span class={wfPriorityBadgeClass(selectedApproval.request.priority)}>{WF_PRIORITY_LABELS[selectedApproval.request.priority] ?? selectedApproval.request.priority}</span></div>
        <div><div class="text-slate-400">{$isLoading ? 'Step' : $_('inbox.detail.approvalStep')}</div><div class="font-semibold">{selectedApproval.stepNo}{selectedApproval.stepName ? `  ${selectedApproval.stepName}` : ''}</div></div>
        {#if selectedApproval.request.dueAt}<div><div class="text-slate-400">{$isLoading ? 'Deadline' : $_('inbox.detail.deadline')}</div><div class="text-orange-400">{new Date(selectedApproval.request.dueAt).toLocaleDateString('vi-VN')}</div></div>{/if}
      </div>

      {#if Object.keys(selectedApproval.request.payload).length > 0}
        <div>
          <div class="text-xs text-slate-400 mb-1">{$isLoading ? 'Details' : $_('inbox.detail.attachments')}</div>
          <div class="rounded-lg bg-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
            {#each Object.entries(selectedApproval.request.payload) as [k, v]}<div><span class="text-slate-500">{k}:</span> {String(v)}</div>{/each}
          </div>
        </div>
      {/if}

      <div>
        <label class="form-label" for="inbox-comment">{$isLoading ? 'Comment (optional)' : $_('inbox.detail.noteOptional')}</label>
        <textarea id="inbox-comment" class="textarea-base" rows={3} bind:value={inboxComment} placeholder={$isLoading ? 'Reason...' : $_('inbox.commentPlaceholder')}></textarea>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <Button variant="secondary" onclick={() => { inboxDetailOpen = false; selectedApproval = null; }} disabled={inboxActionBusy}>{$isLoading ? 'Close' : $_('inbox.close')}</Button>
        <Button variant="danger" onclick={handleReject} disabled={inboxActionBusy}>
          {#snippet leftIcon()}<X class="h-4 w-4" />{/snippet}
          {inboxActionBusy ? $_('inbox.processing') : $_('inbox.reject')}
        </Button>
        <Button variant="primary" onclick={handleApprove} disabled={inboxActionBusy}>
          {#snippet leftIcon()}<Check class="h-4 w-4" />{/snippet}
          {inboxActionBusy ? $_('inbox.processing') : $_('inbox.approve')}
        </Button>
      </div>
    </div>
  </Modal>
{/if}
