<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, RefreshCw, X, UserCheck } from 'lucide-svelte';
  import { _, isLoading as i18nLoading } from '$lib/i18n';
  import {
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
    type InboxApproval,
    type InboxSummary,
  } from '$lib/api/wf';
  import { toast } from '$lib/components/toast';
  import Modal from '$lib/components/Modal.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { Button } from '$lib/components/ui';

  // ---- State ----
  let loading    = $state(true);
  let error      = $state('');
  let approvals  = $state<InboxApproval[]>([]);
  let summary    = $state<InboxSummary>({ pendingCount: 0, urgentCount: 0, overdueCount: 0, unassignedCount: 0 });
  let meta       = $state({ total: 0, page: 1, limit: 20 });

  // ---- Detail / action modal ----
  let detailOpen    = $state(false);
  let selectedItem  = $state<InboxApproval | null>(null);
  let comment       = $state('');
  let actionBusy    = $state(false);

  onMount(() => {
    void loadAll();
  });

  async function loadAll() {
    await Promise.all([loadApprovals(), loadSummary()]);
  }

  async function loadApprovals(page = 1) {
    try {
      loading = true;
      error = '';
      const res = await listInboxApprovals({ page, limit: meta.limit });
      approvals = res.data ?? [];
      meta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) {
      error = e instanceof Error ? e.message : ($i18nLoading ? 'Failed to load inbox' : $_('inbox.errors.loadFailed'));
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadSummary() {
    try {
      const res = await getInboxSummary();
      summary = res.data;
    } catch {
      // non-critical
    }
  }

  function openDetail(item: InboxApproval) {
    selectedItem = item;
    comment = '';
    detailOpen = true;
  }

  async function handleApprove() {
    if (!selectedItem) return;
    actionBusy = true;
    try {
      await approveWfApproval(selectedItem.id, comment.trim() || undefined);
      toast.success($i18nLoading ? 'Approved successfully' : $_('inbox.approvedSuccess'));
      detailOpen = false;
      comment = '';
      selectedItem = null;
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ($i18nLoading ? 'Approval failed' : $_('inbox.approvedFailed')));
    } finally {
      actionBusy = false;
    }
  }

  async function handleReject() {
    if (!selectedItem) return;
    actionBusy = true;
    try {
      await rejectWfApproval(selectedItem.id, comment.trim() || undefined);
      toast.success($i18nLoading ? 'Rejected' : $_('inbox.rejectedSuccess'));
      detailOpen = false;
      comment = '';
      selectedItem = null;
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ($i18nLoading ? 'Rejection failed' : $_('inbox.rejectedFailed')));
    } finally {
      actionBusy = false;
    }
  }

  async function handleClaim(item: InboxApproval) {
    actionBusy = true;
    try {
      await claimWfApproval(item.id);
      toast.success($i18nLoading ? 'Claimed' : $_('inbox.claimedSuccess'));
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ($i18nLoading ? 'Failed to claim' : $_('inbox.claimedFailed')));
    } finally {
      actionBusy = false;
    }
  }
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">{$i18nLoading ? 'Inbox' : $_('inbox.title')}</h1>
      <p class="text-sm text-slate-300">{$i18nLoading ? 'Review and approve pending workflow requests.' : $_('inbox.subtitle')}</p>
    </div>
    <Button variant="secondary" size="sm" onclick={() => loadAll()} disabled={loading}>
      {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
      {$i18nLoading ? 'Refresh' : $_('inbox.refresh')}
    </Button>
  </div>

  <!-- Summary cards -->
  <div class="grid grid-cols-4 gap-3">
    <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
      <div class="text-3xl font-bold text-blue-400">{summary.pendingCount}</div>
      <div class="text-xs text-slate-400 mt-1">{$i18nLoading ? 'Pending' : $_('inbox.pending')}</div>
    </div>
    <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
      <div class="text-3xl font-bold text-red-400">{summary.urgentCount}</div>
      <div class="text-xs text-slate-400 mt-1">{$i18nLoading ? 'Urgent' : $_('inbox.urgent')}</div>
    </div>
    <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
      <div class="text-3xl font-bold text-orange-400">{summary.overdueCount}</div>
      <div class="text-xs text-slate-400 mt-1">{$i18nLoading ? 'Overdue' : $_('inbox.overdue')}</div>
    </div>
    <div class="rounded-xl border border-slate-700 bg-surface-2 p-4 text-center">
      <div class="text-3xl font-bold text-yellow-400">{summary.unassignedCount}</div>
      <div class="text-xs text-slate-400 mt-1">{$i18nLoading ? 'Unassigned' : $_('inbox.unassigned')}</div>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else if approvals.length === 0}
    <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
      {$i18nLoading ? 'No pending requests for your approval.' : $_('inbox.empty')}
    </div>
  {:else}
    <div class="data-table-wrap">
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{$i18nLoading ? 'Request' : $_('inbox.tableHeaders.request')}</th>
              <th>{$i18nLoading ? 'Type' : $_('inbox.tableHeaders.type')}</th>
              <th>{$i18nLoading ? 'Priority' : $_('inbox.tableHeaders.priority')}</th>
              <th>{$i18nLoading ? 'Status' : $_('inbox.tableHeaders.status')}</th>
              <th>{$i18nLoading ? 'Step' : $_('inbox.tableHeaders.step')}</th>
              <th>{$i18nLoading ? 'Submitted' : $_('inbox.tableHeaders.submitted')}</th>
              <th class="text-right">{$i18nLoading ? 'Actions' : $_('inbox.tableHeaders.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each approvals as item}
              <tr>
                <td>
                  <div class="font-mono text-xs text-slate-400">{item.request.code}</div>
                  <div class="font-medium text-slate-100 max-w-xs truncate">{item.request.title}</div>
                  {#if item.request.requesterName}
                    <div class="text-xs text-slate-500">{item.request.requesterName}</div>
                  {/if}
                </td>
                <td>
                  <span class="badge badge-blue">{WF_TYPE_LABELS[item.request.requestType] ?? item.request.requestType}</span>
                </td>
                <td>
                  <span class={wfPriorityBadgeClass(item.request.priority)}>
                    {WF_PRIORITY_LABELS[item.request.priority] ?? item.request.priority}
                  </span>
                </td>
                <td>
                  <span class={wfStatusBadgeClass(item.request.status)}>
                    {WF_STATUS_LABELS[item.request.status] ?? item.request.status}
                  </span>
                </td>
                <td>
                  <span class="text-sm font-semibold text-slate-300">
                    {$i18nLoading ? `Step ${item.stepNo}` : $_('inbox.stepNo', { values: { n: item.stepNo } })}{item.stepName ? ` · ${item.stepName}` : ''}
                  </span>
                  {#if item.assigneeUserId === null}
                    <div class="text-xs text-yellow-400 mt-0.5">{$i18nLoading ? 'No assignee yet' : $_('inbox.unassignedNote')}</div>
                  {/if}
                  {#if item.dueAt}
                    {@const overdue = new Date(item.dueAt) < new Date()}
                    <div class="text-xs mt-0.5 {overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}">
                      {$i18nLoading ? `Due: ${new Date(item.dueAt).toLocaleDateString('vi-VN')}` : $_('inbox.dueDate', { values: { date: new Date(item.dueAt).toLocaleDateString('vi-VN') } })}{overdue ? ' ⚠︎' : ''}
                    </div>
                  {/if}
                </td>
                <td class="text-slate-400">{new Date(item.request.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  <div class="cell-actions">
                    <Button size="sm" variant="secondary" onclick={() => openDetail(item)}>{$i18nLoading ? 'Details' : $_('inbox.details')}</Button>
                    {#if item.assigneeUserId === null}
                      <Button size="sm" variant="secondary" onclick={() => handleClaim(item)} disabled={actionBusy} title={$i18nLoading ? 'Claim' : $_('inbox.claim')}>
                        <UserCheck class="h-3.5 w-3.5" />
                      </Button>
                    {:else}
                      <Button size="sm" variant="primary" onclick={() => { selectedItem = item; comment = ''; void handleApprove(); }} disabled={actionBusy}>
                        <Check class="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="danger" onclick={() => { selectedItem = item; comment = ''; void handleReject(); }} disabled={actionBusy}>
                        <X class="h-3.5 w-3.5" />
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{$i18nLoading ? `Total: ${meta.total} | Page ${meta.page}` : $_('inbox.pagination', { values: { total: meta.total, page: meta.page } })}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onclick={() => loadApprovals(meta.page - 1)}>{$i18nLoading ? 'Prev' : $_('inbox.prev')}</Button>
        <Button size="sm" variant="secondary" disabled={(meta.page * meta.limit) >= meta.total} onclick={() => loadApprovals(meta.page + 1)}>{$i18nLoading ? 'Next' : $_('inbox.next')}</Button>
      </div>
    </div>
  {/if}
</div>

<!-- ============ Detail + Approve / Reject Modal ============ -->
{#if detailOpen && selectedItem}
  <Modal title={$i18nLoading ? `Approval: ${selectedItem.request.code}` : $_('inbox.approvalTitle', { values: { code: selectedItem.request.code } })} bind:open={detailOpen}>
    <div class="space-y-4 p-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-slate-400">{$i18nLoading ? 'Title' : $_('inbox.detail.title')}</div>
          <div class="font-medium text-slate-100">{selectedItem.request.title}</div>
        </div>
        <div>
          <div class="text-slate-400">{$i18nLoading ? 'Type' : $_('inbox.detail.type')}</div>
          <div>{WF_TYPE_LABELS[selectedItem.request.requestType] ?? selectedItem.request.requestType}</div>
        </div>
        <div>
          <div class="text-slate-400">{$i18nLoading ? 'Requester' : $_('inbox.detail.requester')}</div>
          <div>{selectedItem.request.requesterName ?? selectedItem.request.requesterId}</div>
        </div>
        <div>
          <div class="text-slate-400">{$i18nLoading ? 'Priority' : $_('inbox.detail.priority')}</div>
          <span class={wfPriorityBadgeClass(selectedItem.request.priority)}>
            {WF_PRIORITY_LABELS[selectedItem.request.priority] ?? selectedItem.request.priority}
          </span>
        </div>
        <div>
          <div class="text-slate-400">{$i18nLoading ? 'Approval step' : $_('inbox.detail.approvalStep')}</div>
          <div class="font-semibold">{selectedItem.stepNo}{selectedItem.stepName ? ` – ${selectedItem.stepName}` : ''}</div>
        </div>
        {#if selectedItem.request.dueAt}
          <div>
            <div class="text-slate-400">{$i18nLoading ? 'Deadline' : $_('inbox.detail.deadline')}</div>
            <div class="text-orange-400">{new Date(selectedItem.request.dueAt).toLocaleDateString('vi-VN')}</div>
          </div>
        {/if}
      </div>

      {#if Object.keys(selectedItem.request.payload).length > 0}
        <div>
          <div class="text-xs text-slate-400 mb-1">{$i18nLoading ? 'Attachments' : $_('inbox.detail.attachments')}</div>
          <div class="rounded-lg bg-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
            {#each Object.entries(selectedItem.request.payload) as [k, v]}
              <div><span class="text-slate-500">{k}:</span> {String(v)}</div>
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <label class="form-label" for="inbox-comment">{$i18nLoading ? 'Note (optional)' : $_('inbox.detail.noteOptional')}</label>
        <textarea id="inbox-comment" class="textarea-base" rows={3} bind:value={comment}
          placeholder={$i18nLoading ? 'Reason for approval or rejection...' : $_('inbox.commentPlaceholder')}></textarea>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <Button variant="secondary" onclick={() => { detailOpen = false; selectedItem = null; }} disabled={actionBusy}>{$i18nLoading ? 'Close' : $_('inbox.close')}</Button>
        <Button variant="danger" onclick={handleReject} disabled={actionBusy}>
          {#snippet leftIcon()}<X class="h-4 w-4" />{/snippet}
          {actionBusy ? ($i18nLoading ? 'Processing...' : $_('inbox.processing')) : ($i18nLoading ? 'Reject' : $_('inbox.reject'))}
        </Button>
        <Button variant="primary" onclick={handleApprove} disabled={actionBusy}>
          {#snippet leftIcon()}<Check class="h-4 w-4" />{/snippet}
          {actionBusy ? ($i18nLoading ? 'Processing...' : $_('inbox.processing')) : ($i18nLoading ? 'Approve' : $_('inbox.approve'))}
        </Button>
      </div>
    </div>
  </Modal>
{/if}

