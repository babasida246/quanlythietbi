<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { RefreshCw } from 'lucide-svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import {
    listAllWfRequests,
    wfStatusBadgeClass,
    wfPriorityBadgeClass,
    type WfRequest,
    type WfRequestStatus,
    type WfRequestType,
    type WfPriority,
  } from '$lib/api/wf';
  import { toast } from '$lib/components/toast';
  import { _, isLoading, locale } from '$lib/i18n';

  let requests   = $state<WfRequest[]>([]);
  let loading    = $state(true);
  let error      = $state('');
  let statusFilter = $state<WfRequestStatus | ''>('');
  let typeFilter   = $state<WfRequestType | ''>('');
  let meta         = $state({ total: 0, page: 1, limit: 20 });

  let statusLabels = $derived({
    draft: $_('requests.wfStatus.draft'),
    submitted: $_('requests.wfStatus.submitted'),
    in_review: $_('requests.wfStatus.inReview'),
    approved: $_('requests.wfStatus.approved'),
    rejected: $_('requests.wfStatus.rejected'),
    cancelled: $_('requests.wfStatus.cancelled'),
    closed: $_('requests.wfStatus.closed'),
  } as Record<WfRequestStatus, string>);

  let priorityLabels = $derived({
    low: $_('requests.wfPriority.low'),
    normal: $_('requests.wfPriority.normal'),
    high: $_('requests.wfPriority.high'),
    urgent: $_('requests.wfPriority.urgent'),
  } as Record<WfPriority, string>);

  let typeLabels = $derived({
    asset_request: $_('requests.wfType.assetRequest'),
    repair_request: $_('requests.wfType.repairRequest'),
    disposal_request: $_('requests.wfType.disposalRequest'),
    purchase: $_('requests.wfType.purchase'),
    other: $_('requests.wfType.other'),
  } as Record<WfRequestType, string>);

  onMount(() => { void load(1); });

  async function load(page = 1) {
    try {
      loading = true;
      error = '';
      const res = await listAllWfRequests({
        status:      statusFilter || undefined,
        requestType: typeFilter || undefined,
        page,
        limit: meta.limit,
      });
      requests = res.data ?? [];
      meta = { total: res.meta.total, page: res.meta.page, limit: res.meta.limit };
    } catch (e) {
      error = e instanceof Error ? e.message : $_('requests.loadFailed');
      toast.error(error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="page-shell page-content">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-white">{$isLoading ? 'Workflow Requests' : $_('requests.workflowTitle')}</h1>
      <p class="text-sm text-slate-300">{$isLoading ? 'Process requests' : $_('requests.workflowSubtitle')}</p>
    </div>
    <Button variant="secondary" size="sm" onclick={() => load(meta.page)} disabled={loading}>
      {#snippet leftIcon()}<RefreshCw class="h-3.5 w-3.5" />{/snippet}
      {$isLoading ? 'Refresh' : $_('common.refresh')}
    </Button>
  </div>

  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <select class="select-base" bind:value={statusFilter} onchange={() => load(1)}>
      <option value="">{$isLoading ? 'All Statuses' : $_('requests.allStatuses')}</option>
      {#each Object.entries(statusLabels) as [val, label]}
        <option value={val}>{label}</option>
      {/each}
    </select>
    <select class="select-base" bind:value={typeFilter} onchange={() => load(1)}>
      <option value="">{$isLoading ? 'All Types' : $_('requests.allTypes')}</option>
      {#each Object.entries(typeLabels) as [val, label]}
        <option value={val}>{label}</option>
      {/each}
    </select>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else if requests.length === 0}
    <div class="rounded-xl border border-slate-800 bg-surface-2 p-8 text-center text-sm text-slate-500">
      {$isLoading ? 'No requests' : $_('requests.workflowEmpty')}
    </div>
  {:else}
    <div class="data-table-wrap">
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{$isLoading ? 'Code / Title' : $_('requests.header.code')}</th>
              <th>{$isLoading ? 'Type' : $_('requests.header.type')}</th>
              <th>{$isLoading ? 'Priority' : $_('requests.header.priority')}</th>
              <th>{$isLoading ? 'Status' : $_('requests.header.status')}</th>
              <th>{$isLoading ? 'Requester' : $_('requests.header.requester')}</th>
              <th>{$isLoading ? 'Created At' : $_('requests.header.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {#each requests as item}
              <tr>
                <td>
                  <div class="font-mono text-xs text-slate-400">{item.code}</div>
                  <div class="font-medium text-slate-100 truncate max-w-xs">{item.title}</div>
                </td>
                <td>
                  <span class="badge badge-blue">{typeLabels[item.requestType] ?? item.requestType}</span>
                </td>
                <td>
                  <span class={wfPriorityBadgeClass(item.priority)}>
                    {priorityLabels[item.priority] ?? item.priority}
                  </span>
                </td>
                <td>
                  <span class={wfStatusBadgeClass(item.status)}>
                    {statusLabels[item.status] ?? item.status}
                  </span>
                </td>
                <td class="text-slate-400">{item.requesterName ?? item.requesterId}</td>
                <td class="text-slate-400">{new Date(item.createdAt).toLocaleDateString($locale ?? 'en')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{$isLoading ? `Total: ${meta.total} | Page ${meta.page}` : `${$_('common.total')}: ${meta.total} | ${$_('common.page')}: ${meta.page}`}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onclick={() => load(meta.page - 1)}>{$isLoading ? 'Previous' : $_('common.prev')}</Button>
        <Button size="sm" variant="secondary" disabled={(meta.page * meta.limit) >= meta.total} onclick={() => load(meta.page + 1)}>{$isLoading ? 'Next' : $_('common.next')}</Button>
      </div>
    </div>
  {/if}
</div>
