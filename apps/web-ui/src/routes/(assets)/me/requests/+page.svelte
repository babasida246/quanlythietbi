<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus, RefreshCw, Send, X, RotateCcw } from 'lucide-svelte';
  import {
    listMyWfRequests,
    getMyWfRequest,
    submitWfRequest,
    cancelWfRequest,
    withdrawWfRequest,
    WF_STATUS_LABELS,
    WF_PRIORITY_LABELS,
    WF_TYPE_LABELS,
    wfStatusBadgeClass,
    wfPriorityBadgeClass,
    type WfRequest,
    type WfRequestDetail,
    type WfRequestType,
    type WfPriority,
    type WfRequestStatus,
  } from '$lib/api/wf';
  import WfRequestLineEditor from '$lib/assets/components/WfRequestLineEditor.svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';

  // ---- State ----
  let requests    = $state<WfRequest[]>([]);
  let loading     = $state(true);
  let error       = $state('');
  let statusFilter     = $state<WfRequestStatus | ''>('');
  let typeFilter       = $state<WfRequestType | ''>('');
  let meta        = $state({ total: 0, page: 1, limit: 20 });

  // ---- Detail / cancel modal ----
  let detailOpen    = $state(false);
  let detailLoading = $state(false);
  let selectedReq   = $state<WfRequest | null>(null);
  let selectedDetail = $state<WfRequestDetail | null>(null);
  let cancelReason  = $state('');
  let withdrawReason = $state('');
  let actionBusy    = $state(false);

  onMount(() => { void load(1); })

  async function load(page = 1) {
    try {
      loading = true;
      error = '';
      const res = await listMyWfRequests({
        status:      statusFilter || undefined,
        requestType: typeFilter || undefined,
        page,
        limit: meta.limit,
      });
      requests = res.data ?? [];
      meta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) {
      error = e instanceof Error ? e.message : $_('requests.loadFailed');
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(req: WfRequest) {
    actionBusy = true;
    try {
      await submitWfRequest(req.id);
      toast.success($_('requests.toast.submitSuccess'));
      detailOpen = false;
      await load(meta.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
    } finally {
      actionBusy = false;
    }
  }

  async function handleCancel(req: WfRequest) {
    actionBusy = true;
    try {
      await cancelWfRequest(req.id, cancelReason || undefined);
      toast.success($_('requests.toast.cancelSuccess'));
      detailOpen = false;
      cancelReason = '';
      await load(meta.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
    } finally {
      actionBusy = false;
    }
  }

  async function handleWithdraw(req: WfRequest) {
    actionBusy = true;
    try {
      await withdrawWfRequest(req.id, withdrawReason || undefined);
      toast.success($_('requests.toast.withdrawSuccess'));
      detailOpen = false;
      withdrawReason = '';
      await load(meta.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
    } finally {
      actionBusy = false;
    }
  }

  async function openDetail(req: WfRequest) {
    selectedReq    = req;
    selectedDetail = null;
    cancelReason   = '';
    detailOpen     = true;
    detailLoading  = true;
    try {
      const res = await getMyWfRequest(req.id);
      selectedDetail = res.data;
    } catch {
      // silently fall back to list data
    } finally {
      detailLoading = false;
    }
  }
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">{$isLoading ? 'My Requests' : $_('requests.myRequests')}</h1>
      <p class="text-sm text-slate-300">{$isLoading ? 'List of submitted requests' : $_('requests.myRequestsSubtitle')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="primary" onclick={() => goto('/me/requests/new')}>
        {#snippet leftIcon()}<Plus class="h-4 w-4" />{/snippet}
        {$isLoading ? 'Create Request' : $_('requests.createRequest')}
      </Button>
      <Button variant="secondary" onclick={() => load(meta.page)} disabled={loading}>
        {#snippet leftIcon()}<RefreshCw class="h-4 w-4" />{/snippet}
        {$isLoading ? 'Refresh' : $_('common.refresh')}
      </Button>
    </div>
  </div>

  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <select class="select-base" bind:value={statusFilter} onchange={() => load(1)}>
      <option value="">{$isLoading ? 'All Statuses' : $_('common.allStatuses')}</option>
      {#each Object.entries(WF_STATUS_LABELS) as [val, label]}
        <option value={val}>{label}</option>
      {/each}
    </select>
    <select class="select-base" bind:value={typeFilter} onchange={() => load(1)}>
      <option value="">{$isLoading ? 'All Types' : $_('common.allTypes')}</option>
      {#each Object.entries(WF_TYPE_LABELS) as [val, label]}
        <option value={val}>{label}</option>
      {/each}
    </select>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if requests.length === 0}
    <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
      {$isLoading ? 'No requests yet' : $_('requests.emptyState')}
    </div>
  {:else}
    <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
      <Table>
        <TableHeader>
          <tr>
            <TableHeaderCell>{$isLoading ? 'Code' : $_('requests.header.code')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Type' : $_('requests.header.type')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Priority' : $_('requests.header.priority')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Status' : $_('requests.header.status')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Created Date' : $_('requests.header.createdAt')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Actions' : $_('requests.header.actions')}</TableHeaderCell>
          </tr>
        </TableHeader>
        <tbody>
          {#each requests as item}
            <TableRow>
              <TableCell>
                <div class="font-mono text-xs text-slate-400">{item.code}</div>
                <div class="font-medium text-slate-100 truncate max-w-xs">{item.title}</div>
              </TableCell>
              <TableCell>
                <span class="badge badge-blue">{WF_TYPE_LABELS[item.requestType] ?? item.requestType}</span>
              </TableCell>
              <TableCell>
                <span class={wfPriorityBadgeClass(item.priority)}>
                  {WF_PRIORITY_LABELS[item.priority] ?? item.priority}
                </span>
              </TableCell>
              <TableCell>
                <span class={wfStatusBadgeClass(item.status)}>
                  {WF_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </TableCell>
              <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onclick={() => openDetail(item)}>{$isLoading ? 'Detail' : $_('common.detail')}</Button>
              </TableCell>
            </TableRow>
          {/each}
        </tbody>
      </Table>
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{$isLoading ? 'Total' : $_('common.total')}: {meta.total} | {$isLoading ? 'Page' : $_('common.page')} {meta.page}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onclick={() => load(meta.page - 1)}>
          {$isLoading ? 'Previous' : $_('common.previous')}
        </Button>
        <Button size="sm" variant="secondary" disabled={(meta.page * meta.limit) >= meta.total} onclick={() => load(meta.page + 1)}>
          {$isLoading ? 'Next' : $_('common.next')}
        </Button>
      </div>
    </div>
  {/if}
</div>

<!-- ============ Detail / Action Modal ============ -->
{#if detailOpen && selectedReq}
  <Modal title={$isLoading ? `Detail: ${selectedReq.code}` : `${$_('requests.detail.title')}: ${selectedReq.code}`} bind:open={detailOpen}>
    <div class="space-y-4 p-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-slate-400">{$isLoading ? 'Title' : $_('requests.field.title')}</div>
          <div class="font-medium text-slate-100">{selectedReq.title}</div>
        </div>
        <div>
          <div class="text-slate-400">{$isLoading ? 'Status' : $_('requests.detail.status')}</div>
          <span class={wfStatusBadgeClass(selectedReq.status)}>
            {WF_STATUS_LABELS[selectedReq.status] ?? selectedReq.status}
          </span>
        </div>
        <div>
          <div class="text-slate-400">{$isLoading ? 'Request Type' : $_('requests.detail.type')}</div>
          <div>{WF_TYPE_LABELS[selectedReq.requestType] ?? selectedReq.requestType}</div>
        </div>
        <div>
          <div class="text-slate-400">{$isLoading ? 'Priority' : $_('requests.field.priority')}</div>
          <span class={wfPriorityBadgeClass(selectedReq.priority)}>
            {WF_PRIORITY_LABELS[selectedReq.priority] ?? selectedReq.priority}
          </span>
        </div>
        <div>
          <div class="text-slate-400">{$isLoading ? 'Created Date' : $_('requests.detail.createdAt')}</div>
          <div>{new Date(selectedReq.createdAt).toLocaleString()}</div>
        </div>
        {#if selectedReq.submittedAt}
          <div>
            <div class="text-slate-400">{$isLoading ? 'Submitted at' : $_('requests.detail.submittedAt')}</div>
            <div>{new Date(selectedReq.submittedAt).toLocaleString()}</div>
          </div>
        {/if}
        {#if selectedReq.currentStepNo}
          <div>
            <div class="text-slate-400">{$isLoading ? 'Current step' : $_('requests.detail.currentStep')}</div>
            <div class="font-bold">{selectedReq.currentStepNo}</div>
          </div>
        {/if}
      </div>

      {#if Object.keys(selectedReq.payload).length > 0}
        <div>
          <div class="text-xs text-slate-400 mb-1">{$isLoading ? 'Request Info' : $_('requests.detail.requestInfo')}</div>
          <div class="rounded-lg bg-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
            {#each Object.entries(selectedReq.payload) as [k, v]}
              <div><span class="text-slate-500">{k}:</span> {String(v)}</div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Lines (loaded via detail API) -->
      {#if detailLoading}
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <div class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          {$isLoading ? 'Loading details...' : $_('requests.detail.loading')}
        </div>
      {:else if selectedDetail?.lines && selectedDetail.lines.length > 0}
        <div>
          <div class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{$isLoading ? 'Request Lines' : $_('requests.detail.lines')} ({selectedDetail.lines.length})</div>
          <WfRequestLineEditor
            lines={selectedDetail.lines.map(l => ({
              itemType:     l.itemType,
              partId:       l.partId ?? undefined,
              assetId:      l.assetId ?? undefined,
              requestedQty: l.requestedQty,
              note:         l.note ?? undefined,
            }))}
            parts={[]}
            assets={[]}
            readonly={true}
          />
          <!-- Fulfillment summary -->
          <div class="mt-2 flex flex-wrap gap-3 text-xs">
            {#each selectedDetail.lines as ln}
              <div class="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1">
                <span class="text-slate-400">{$isLoading ? 'Line' : $_('requests.detail.lineNo')} {ln.lineNo}:</span>
                <span class="tabular-nums text-slate-200">{ln.fulfilledQty}/{ln.requestedQty}</span>
                <span class="badge {ln.status === 'fulfilled' ? 'badge-green' : ln.status === 'partial' ? 'badge-yellow' : ln.status === 'cancelled' ? 'badge-gray' : 'badge-blue'} text-xs">
                  {ln.status === 'fulfilled' ? ($isLoading ? 'Fulfilled' : $_('requests.lineStatus.fulfilled')) : ln.status === 'partial' ? ($isLoading ? 'Partial' : $_('requests.lineStatus.partial')) : ln.status === 'cancelled' ? ($isLoading ? 'Cancelled' : $_('requests.lineStatus.cancelled')) : ($isLoading ? 'Pending' : $_('requests.lineStatus.pending'))}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      {#if selectedReq.status === 'draft'}
        <div class="border-t border-slate-700 pt-4 space-y-3">
          <div class="text-sm text-slate-400">{$isLoading ? 'Submit request' : $_('requests.submitHint')}</div>
          <Button variant="primary" onclick={() => handleSubmit(selectedReq!)} disabled={actionBusy}>
            {#snippet leftIcon()}<Send class="h-4 w-4" />{/snippet}
            {actionBusy ? ($isLoading ? 'Submitting...' : $_('requests.actionBusy.submitting')) : ($isLoading ? 'Submit' : $_('requests.submit'))}
          </Button>
        </div>
      {/if}

      {#if selectedReq.status === 'submitted' || selectedReq.status === 'in_review'}
        <div class="border-t border-slate-700 pt-4 space-y-2">
          <div class="text-sm text-slate-400">{$isLoading ? 'Withdraw request? Enter reason:' : $_('requests.withdrawHint')}</div>
          <input class="input-base" type="text" bind:value={withdrawReason} placeholder={$isLoading ? 'Enter withdrawal reason...' : $_('requests.withdrawReasonPlaceholder')} />
          <Button variant="secondary" size="sm" onclick={() => handleWithdraw(selectedReq!)} disabled={actionBusy}>
            {#snippet leftIcon()}<RotateCcw class="h-4 w-4" />{/snippet}
            {actionBusy ? ($isLoading ? 'Withdrawing...' : $_('requests.actionBusy.withdrawing')) : ($isLoading ? 'Withdraw' : $_('requests.withdraw'))}
          </Button>
        </div>
      {/if}

      {#if selectedReq.status === 'draft' || selectedReq.status === 'submitted' || selectedReq.status === 'in_review'}
        <div class="border-t border-slate-700 pt-4 space-y-2">
          <div class="text-sm text-slate-400">{$isLoading ? 'Cancel request? Enter reason:' : $_('requests.cancelHint')}</div>
          <input class="input-base" type="text" bind:value={cancelReason} placeholder={$isLoading ? 'Enter cancellation reason...' : $_('requests.cancelReasonPlaceholder')} />
          <Button variant="danger" size="sm" onclick={() => handleCancel(selectedReq!)} disabled={actionBusy}>
            {#snippet leftIcon()}<X class="h-4 w-4" />{/snippet}
            {actionBusy ? ($isLoading ? 'Canceling...' : $_('requests.actionBusy.canceling')) : ($isLoading ? 'Cancel Request' : $_('requests.cancelRequest'))}
          </Button>
        </div>
      {/if}
    </div>
  </Modal>
{/if}
