<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import { Plus, RefreshCw } from 'lucide-svelte';
  import {
    listMyWfRequests,
    WF_STATUS_LABELS,
    WF_PRIORITY_LABELS,
    WF_TYPE_LABELS,
    wfStatusBadgeClass,
    wfPriorityBadgeClass,
    type WfRequest,
    type WfRequestType,
    type WfRequestStatus,
  } from '$lib/api/wf';
  import { _, isLoading } from '$lib/i18n';

  let requests     = $state<WfRequest[]>([]);
  let loading      = $state(true);
  let error        = $state('');
  let statusFilter = $state<WfRequestStatus | ''>('');
  let typeFilter   = $state<WfRequestType | ''>('');
  let meta         = $state({ total: 0, page: 1, limit: 20 });

  onMount(() => { void load(1); });

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
                <Button size="sm" variant="ghost" onclick={() => goto(`/me/requests/${item.id}`)}>{$isLoading ? 'Detail' : $_('common.detail')}</Button>
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

