<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Send, RotateCcw, X, Loader2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import {
    getMyWfRequest,
    submitWfRequest,
    cancelWfRequest,
    withdrawWfRequest,
    WF_STATUS_LABELS,
    WF_PRIORITY_LABELS,
    WF_TYPE_LABELS,
    wfStatusBadgeClass,
    wfPriorityBadgeClass,
    type WfRequestDetail,
  } from '$lib/api/wf';
  import WfRequestLineEditor from '$lib/assets/components/WfRequestLineEditor.svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';

  const id = $derived(page.params.id);

  let detail      = $state<WfRequestDetail | null>(null);
  let loading     = $state(true);
  let error       = $state('');
  let actionBusy  = $state(false);

  // Inline confirmation state
  let confirmAction = $state<'cancel' | 'withdraw' | null>(null);
  let actionReason  = $state('');

  onMount(() => { void load(); });

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await getMyWfRequest(id);
      detail = res.data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Không tải được yêu cầu';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit() {
    if (!detail) return;
    actionBusy = true;
    try {
      await submitWfRequest(detail.id);
      toast.success($_('requests.toast.submitSuccess'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
    } finally {
      actionBusy = false;
    }
  }

  async function handleWithdraw() {
    if (!detail) return;
    actionBusy = true;
    confirmAction = null;
    try {
      await withdrawWfRequest(detail.id, actionReason || undefined);
      toast.success($_('requests.toast.withdrawSuccess'));
      actionReason = '';
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
    } finally {
      actionBusy = false;
    }
  }

  async function handleCancel() {
    if (!detail) return;
    actionBusy = true;
    confirmAction = null;
    try {
      await cancelWfRequest(detail.id, actionReason || undefined);
      toast.success($_('requests.toast.cancelSuccess'));
      goto('/me/requests');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $_('common.unknownError'));
      actionBusy = false;
    }
  }

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN');
  }

  const LINE_STATUS_CLASS: Record<string, string> = {
    fulfilled: 'badge-success',
    partial:   'badge-warning',
    cancelled: 'badge-secondary',
    pending:   'badge-info',
  };
  const LINE_STATUS_LABELS: Record<string, string> = {
    fulfilled: 'Hoàn thành',
    partial:   'Một phần',
    cancelled: 'Đã hủy',
    pending:   'Chờ xử lý',
  };
</script>

<div class="page-shell page-content space-y-4">

  <!-- Back -->
  <div class="flex items-center gap-2">
    <button class="btn btn-ghost flex items-center gap-1.5 text-sm" onclick={() => goto('/me/requests')}>
      <ArrowLeft class="h-4 w-4" />
      {$isLoading ? 'My Requests' : $_('requests.myRequests')}
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
    </div>

  {:else if error && !detail}
    <div class="alert alert-error">{error}</div>

  {:else if detail}
    <!-- ── Top action bar ─────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm font-bold text-primary">{detail.code}</span>
          <span class="badge {wfStatusBadgeClass(detail.status)} text-xs">
            {WF_STATUS_LABELS[detail.status] ?? detail.status}
          </span>
        </div>
        <h1 class="text-lg font-semibold text-slate-100 mt-0.5">{detail.title}</h1>
      </div>

      <div class="flex gap-2 shrink-0">
        {#if detail.status === 'draft'}
          <Button variant="primary" onclick={handleSubmit} disabled={actionBusy}>
            {#snippet leftIcon()}<Send class="h-3.5 w-3.5" />{/snippet}
            {$isLoading ? 'Submit' : $_('requests.submit')}
          </Button>
          <Button variant="danger" onclick={() => { confirmAction = 'cancel'; actionReason = ''; }} disabled={actionBusy}>
            {$isLoading ? 'Cancel Request' : $_('requests.cancelRequest')}
          </Button>
        {/if}

        {#if detail.status === 'submitted' || detail.status === 'in_review'}
          <Button variant="secondary" onclick={() => { confirmAction = 'withdraw'; actionReason = ''; }} disabled={actionBusy}>
            {#snippet leftIcon()}<RotateCcw class="h-3.5 w-3.5" />{/snippet}
            {$isLoading ? 'Withdraw' : $_('requests.withdraw')}
          </Button>
          <Button variant="danger" onclick={() => { confirmAction = 'cancel'; actionReason = ''; }} disabled={actionBusy}>
            {#snippet leftIcon()}<X class="h-3.5 w-3.5" />{/snippet}
            {$isLoading ? 'Cancel Request' : $_('requests.cancelRequest')}
          </Button>
        {/if}
      </div>
    </div>

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <!-- ── Inline confirmation banner ────────────────────────────────────── -->
    {#if confirmAction}
      {@const isCancel = confirmAction === 'cancel'}
      <div class="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
        <p class="flex-1 text-sm text-red-300">
          {isCancel
            ? `Xác nhận hủy yêu cầu ${detail.code}? Hành động này không thể hoàn tác.`
            : `Xác nhận rút lại yêu cầu ${detail.code}?`}
        </p>
        <input
          class="input-base h-8 w-52 text-sm"
          type="text"
          bind:value={actionReason}
          placeholder={isCancel ? 'Lý do hủy (tuỳ chọn)' : 'Lý do rút lại (tuỳ chọn)'}
        />
        <button
          class="btn btn-danger h-8 px-3 text-sm"
          onclick={isCancel ? handleCancel : handleWithdraw}
          disabled={actionBusy}
        >
          {#if actionBusy}<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />{/if}
          {isCancel ? 'Xác nhận hủy' : 'Xác nhận rút lại'}
        </button>
        <button
          class="btn btn-secondary h-8 px-3 text-sm"
          onclick={() => { confirmAction = null; }}
          disabled={actionBusy}
        >
          Quay lại
        </button>
      </div>
    {/if}

    <!-- ── Header card ────────────────────────────────────────────────────── -->
    <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">

        <!-- Type -->
        <div>
          <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Type' : $_('requests.field.type')}</p>
          <span class="badge badge-blue">{WF_TYPE_LABELS[detail.requestType] ?? detail.requestType}</span>
        </div>

        <!-- Priority -->
        <div>
          <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Priority' : $_('requests.field.priority')}</p>
          <span class={wfPriorityBadgeClass(detail.priority)}>
            {WF_PRIORITY_LABELS[detail.priority] ?? detail.priority}
          </span>
        </div>

        <!-- Created at -->
        <div>
          <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Created Date' : $_('requests.detail.createdAt')}</p>
          <p class="font-medium text-slate-100">{fmtDate(detail.createdAt)}</p>
        </div>

        <!-- Submitted at -->
        <div>
          <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Submitted at' : $_('requests.detail.submittedAt')}</p>
          <p class="font-medium text-slate-100">{fmtDate(detail.submittedAt)}</p>
        </div>

        {#if detail.dueAt}
          <div>
            <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Due Date' : $_('requests.field.dueDate')}</p>
            <p class="font-medium text-slate-100">{fmtDate(detail.dueAt)}</p>
          </div>
        {/if}

        {#if detail.currentStepNo}
          <div>
            <p class="mb-1 text-xs font-medium text-slate-400">{$isLoading ? 'Current step' : $_('requests.detail.currentStep')}</p>
            <p class="text-lg font-bold text-primary">{detail.currentStepNo}</p>
          </div>
        {/if}
      </div>

      <!-- Payload / extra info -->
      {#if Object.keys(detail.payload ?? {}).length > 0}
        <div class="mt-4 border-t border-slate-700 pt-4">
          <p class="mb-2 text-xs font-medium text-slate-400">{$isLoading ? 'Request Info' : $_('requests.detail.requestInfo')}</p>
          <div class="rounded-lg bg-slate-900/60 px-4 py-3 text-xs font-mono text-slate-300 space-y-1">
            {#each Object.entries(detail.payload) as [k, v]}
              <div><span class="text-slate-500">{k}:</span> {String(v)}</div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- ── Lines section ──────────────────────────────────────────────────── -->
    <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {$isLoading ? 'Request Lines' : $_('requests.detail.lines')}
            {#if detail.lines?.length}({detail.lines.length}){/if}
          </h3>
          <p class="text-xs text-slate-600 mt-0.5">{$isLoading ? 'Items requested' : $_('requests.linesHint')}</p>
        </div>
      </div>

      {#if !detail.lines || detail.lines.length === 0}
        <div class="py-6 text-center text-sm text-slate-500">
          {$isLoading ? 'No items' : $_('requests.noLines')}
        </div>
      {:else}
        <WfRequestLineEditor
          lines={detail.lines.map(l => ({
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

        <!-- Fulfillment summary bar -->
        <div class="mt-3 flex flex-wrap gap-2">
          {#each detail.lines as ln}
            <div class="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs">
              <span class="text-slate-400">{$isLoading ? 'Line' : $_('requests.detail.lineNo')} {ln.lineNo}:</span>
              <span class="tabular-nums font-medium text-slate-200">{ln.fulfilledQty}/{ln.requestedQty}</span>
              <span class="badge {LINE_STATUS_CLASS[ln.status] ?? 'badge-secondary'} text-xs">
                {LINE_STATUS_LABELS[ln.status] ?? ln.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {/if}
</div>
