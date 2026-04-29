<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { RefreshCw, CheckCircle, XCircle, Inbox } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import {
    listInboxApprovals,
    approveWfApproval,
    rejectWfApproval,
    claimWfApproval,
    type InboxApproval,
  } from '$lib/api/wf';
  import { toast } from '$lib/components/toast';

  let loading = $state(true);
  let error = $state('');
  let approvals = $state<InboxApproval[]>([]);
  let meta = $state({ total: 0, page: 1, limit: 20 });

  let detailOpen = $state(false);
  let selected = $state<InboxApproval | null>(null);
  let comment = $state('');
  let busy = $state(false);
  
  // Filters / search (client-side)
  let filterType = $state('');
  let filterPriority = $state('');
  let filterFrom = $state('');
  let filterTo = $state('');
  let search = $state('');
  
  const PRIORITY_BADGE: Record<string, string> = {
    low: 'badge-gray',
    normal: 'badge-blue',
    high: 'badge-yellow',
    urgent: 'badge-red',
  };
  
  const TYPE_BADGE: Record<string, string> = {
    request: 'badge-blue',
    change: 'badge-yellow',
    policy: 'badge-gray',
  };
  
  const filteredApprovals = $derived(() => {
    return approvals
      .filter(a => !filterType || a.request.requestType === filterType)
      .filter(a => !filterPriority || a.request.priority === filterPriority)
      .filter(a => {
        if (!filterFrom && !filterTo) return true;
        const d = new Date(a.createdAt).toISOString().slice(0, 10);
        if (filterFrom && d < filterFrom) return false;
        if (filterTo && d > filterTo) return false;
        return true;
      })
      .filter(a => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (a.request.code || '').toLowerCase().includes(s)
          || (a.request.title || '').toLowerCase().includes(s);
      });
  });

  async function load(p = 1) {
    try {
      loading = true;
      error = '';
      const res = await listInboxApprovals({ page: p, limit: meta.limit });
      approvals = res.data ?? [];
      meta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load inbox';
    } finally {
      loading = false;
    }
  }

  function openDetail(item: InboxApproval) {
    selected = item;
    comment = '';
    detailOpen = true;
  }

  async function handleApprove() {
    if (!selected) return;
    try {
      busy = true;
      await approveWfApproval(selected.id, comment.trim() || undefined);
      toast.success($isLoading ? 'Approved' : $_('inbox.approvedSuccess'));
      detailOpen = false;
      await load(meta.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      busy = false;
    }
  }

  async function handleReject() {
    if (!selected) return;
    try {
      busy = true;
      await rejectWfApproval(selected.id, comment.trim() || undefined);
      toast.success($isLoading ? 'Rejected' : $_('inbox.rejectedSuccess'));
      detailOpen = false;
      await load(meta.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      busy = false;
    }
  }

  onMount(() => { void load(1); });
</script>

<div class="page-shell page-content">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">
        {$isLoading ? 'Inbox' : $_('nav.inbox')}
      </h1>
      <p class="text-sm text-slate-300">
        {$isLoading ? 'Pending approvals waiting for your action' : $_('inbox.subtitle', { default: 'Pending approvals waiting for your action' })}
      </p>
    </div>
    <Button variant="secondary" onclick={() => load(meta.page)} disabled={loading}>
      {#snippet leftIcon()}<RefreshCw class="h-4 w-4" />{/snippet}
      {$isLoading ? 'Refresh' : $_('common.refresh')}
    </Button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="space-y-2">
      {#each [1,2,3] as _}
        <div class="h-12 rounded bg-slate-700/40 animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="alert alert-error">{error}</div>
  {:else if approvals.length === 0}
    <div class="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <Inbox class="h-12 w-12 opacity-40" />
      <p class="text-sm">{$isLoading ? 'Không có dữ liệu' : $_('common.noData', { default: 'Không có dữ liệu' })}</p>
    </div>
  {:else}
    <div class="card overflow-hidden">
      <table class="data-table w-full">
        <thead>
          <tr>
            <th>{$isLoading ? 'Code' : $_('common.code')}</th>
            <th>{$isLoading ? 'Title' : $_('common.title')}</th>
            <th>{$isLoading ? 'Type' : $_('common.type')}</th>
            <th>{$isLoading ? 'Priority' : $_('common.priority')}</th>
            <th>{$isLoading ? 'Date' : $_('common.date')}</th>
            <th>{$isLoading ? 'Actions' : $_('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each approvals as item}
            <tr>
              <td><code class="text-xs">{item.request.code}</code></td>
              <td class="max-w-xs truncate">{item.request.title}</td>
              <td>{item.request.requestType}</td>
              <td>{item.request.priority}</td>
              <td class="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="row-edit-{item.id}"
                  onclick={() => openDetail(item)}
                >
                  {$isLoading ? 'Review' : $_('common.review', { default: 'Review' })}
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Approval Detail Modal -->
{#if selected}
  <Modal
    title={$isLoading ? `Approval: ${selected.request.code}` : $_('inbox.approvalTitle', { values: { code: selected.request.code }, default: `Approval: ${selected.request.code}` })}
    bind:open={detailOpen}
  >
    <div data-testid="modal-approval-detail" class="space-y-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-slate-400">{$isLoading ? 'Title' : $_('inbox.detail.title', { default: 'Title' })}</div>
          <div class="font-medium text-slate-100">{selected.request.title}</div>
        </div>
        <div>
          <div class="text-slate-400">{$isLoading ? 'Type' : $_('common.type')}</div>
          <div class="text-slate-100">{selected.request.requestType}</div>
        </div>
      </div>

      <div>
        <label class="block text-sm text-slate-400 mb-1" for="approval-comment">
          {$isLoading ? 'Comment' : $_('inbox.comment', { default: 'Comment' })}
        </label>
        <textarea
          id="approval-comment"
          class="input-base w-full"
          rows="3"
          bind:value={comment}
          placeholder={$isLoading ? 'Optional comment...' : $_('inbox.commentPlaceholder', { default: 'Optional comment...' })}
        ></textarea>
      </div>

      <div class="flex gap-2 justify-end">
        <Button variant="ghost" data-testid="btn-cancel" onclick={() => { detailOpen = false; }}>
          {$isLoading ? 'Cancel' : $_('common.cancel')}
        </Button>
        <Button variant="danger" onclick={handleReject} disabled={busy}>
          {#snippet leftIcon()}<XCircle class="h-4 w-4" />{/snippet}
          {$isLoading ? 'Reject' : $_('inbox.reject', { default: 'Reject' })}
        </Button>
        <Button variant="primary" onclick={handleApprove} disabled={busy}>
          {#snippet leftIcon()}<CheckCircle class="h-4 w-4" />{/snippet}
          {$isLoading ? 'Approve' : $_('inbox.approve', { default: 'Approve' })}
        </Button>
      </div>
    </div>
  </Modal>
{/if}
