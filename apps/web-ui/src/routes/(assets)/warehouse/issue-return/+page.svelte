<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw, FileText, CheckCircle, XCircle, BookOpen } from 'lucide-svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';
  import {
    listStockDocuments,
    listWarehouses,
    submitStockDocument,
    approveStockDocument,
    postStockDocument,
    cancelStockDocument,
    type StockDocumentRecord,
    type WarehouseRecord
  } from '$lib/api/warehouse';

  // ── State ──────────────────────────────────────────────────────────────────
  let documents    = $state<StockDocumentRecord[]>([]);
  let warehouses   = $state<WarehouseRecord[]>([]);
  let loading      = $state(true);
  let error        = $state('');
  let actionBusy   = $state<string | null>(null);

  // Tabs: 'all' | 'issue' | 'return' | 'pending'
  let activeTab = $state<'all' | 'issue' | 'return' | 'pending'>('all');

  // Filters
  let filterWarehouse = $state('');
  let filterFrom      = $state('');
  let filterTo        = $state('');
  let meta = $state({ total: 0, page: 1, limit: 20 });

  // ── Labels / badges ────────────────────────────────────────────────────────
  const TYPE_LABELS: Record<string, string> = $derived({
    issue:  $_('warehouse.docType.issue'),
    return: $_('warehouse.docType.return'),
  });
  const TYPE_BADGE: Record<string, string> = {
    issue:  'badge-red',
    return: 'badge-yellow',
  };
  const STATUS_LABELS: Record<string, string> = $derived({
    draft:     $_('warehouse.docStatus.draft'),
    submitted: $_('warehouse.docStatus.submitted'),
    approved:  $_('warehouse.docStatus.approved'),
    posted:    $_('warehouse.docStatus.posted'),
    canceled:  $_('warehouse.docStatus.canceled'),
  });
  const STATUS_BADGE: Record<string, string> = {
    draft:     'badge-gray',
    submitted: 'badge-yellow',
    approved:  'badge-blue',
    posted:    'badge-green',
    canceled:  'badge-red',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function warehouseName(id: string | null | undefined): string {
    if (!id) return '—';
    const wh = warehouses.find(w => w.id === id);
    return wh ? `${wh.name} (${wh.code})` : id;
  }

  function fmtDate(d: string) {
    return d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  }

  // ── Data loading ────────────────────────────────────────────────────────────
  async function load(page = 1) {
    try {
      loading = true;
      error = '';

      let docTypes: string[] | undefined;
      let status: StockDocumentRecord['status'] | undefined;

      if (activeTab === 'issue') docTypes = ['issue'];
      else if (activeTab === 'return') docTypes = ['return'];
      else if (activeTab === 'pending') { docTypes = ['issue', 'return']; status = 'submitted'; }
      else docTypes = ['issue', 'return'];

      const [docsRes, whRes] = await Promise.all([
        listStockDocuments({
          docTypes,
          status,
          warehouseId: filterWarehouse || undefined,
          from:        filterFrom      || undefined,
          to:          filterTo        || undefined,
          page,
          limit: meta.limit,
        }),
        warehouses.length ? Promise.resolve({ data: warehouses }) : listWarehouses(),
      ]);
      documents  = docsRes.data ?? [];
      warehouses = whRes.data  ?? [];
      meta = {
        total: docsRes.meta?.total ?? documents.length,
        page:  docsRes.meta?.page  ?? page,
        limit: docsRes.meta?.limit ?? meta.limit,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadDocumentsFailed');
    } finally {
      loading = false;
    }
  }

  function switchTab(tab: typeof activeTab) {
    activeTab = tab;
    void load(1);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function doAction(
    id: string,
    fn: () => Promise<{ data: StockDocumentRecord }>,
    successMsg: string,
    errorPrefix: string
  ) {
    try {
      actionBusy = id;
      const res = await fn();
      documents = documents.map(d => d.id === id ? (res.data ?? d) : d);
      toast.success(successMsg);
    } catch (err) {
      toast.error(`${errorPrefix}: ${err instanceof Error ? err.message : $_('common.unknownError')}`);
    } finally {
      actionBusy = null;
    }
  }

  const handleSubmit  = (doc: StockDocumentRecord) =>
    doAction(doc.id, () => submitStockDocument(doc.id),  `${$_('warehouse.toast.submittedDoc')} ${doc.code}`, $_('warehouse.errors.submitFailed'));
  const handleApprove = (doc: StockDocumentRecord) =>
    doAction(doc.id, () => approveStockDocument(doc.id), `${$_('warehouse.toast.approvedDoc')} ${doc.code}`, $_('warehouse.errors.approveFailed'));
  const handlePost    = (doc: StockDocumentRecord) =>
    doAction(doc.id, () => postStockDocument(doc.id),    `${$_('warehouse.toast.postedDoc')} ${doc.code}`,   $_('warehouse.errors.postFailed'));
  const handleCancel  = (doc: StockDocumentRecord) =>
    doAction(doc.id, () => cancelStockDocument(doc.id),  `${$_('warehouse.toast.cancelledDoc')} ${doc.code}`, $_('warehouse.errors.cancelFailed'));

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = $derived(Math.max(1, Math.ceil(meta.total / meta.limit)));

  onMount(() => { void load(1); });
</script>

<style>
  :global(.badge-green)  { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(20 83 45 / 0.4); color: rgb(134 239 172); }
  :global(.badge-red)    { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(127 29 29 / 0.4); color: rgb(252 165 165); }
  :global(.badge-blue)   { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(30 58 138 / 0.4); color: rgb(147 197 253); }
  :global(.badge-yellow) { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(113 63 18 / 0.4); color: rgb(253 230 138); }
  :global(.badge-gray)   { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(51 65 85); color: rgb(203 213 225); }
  :global(.badge-purple) { display: inline-block; border-radius: 0.25rem; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; font-weight: 500; background-color: rgb(88 28 135 / 0.4); color: rgb(216 180 254); }
</style>

<div class="space-y-4">
  <!-- ── Header ────────────────────────────────────────────────────────────── -->
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-slate-100">{$isLoading ? 'Issue & Return Documents' : $_('warehouse.issueReturn.pageTitle')}</h2>
      <p class="text-sm text-slate-400">{meta.total} {$isLoading ? 'documents' : $_('warehouse.documents')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => load(1)} disabled={loading}>
        <RefreshCw class="h-4 w-4" />
      </Button>
      <Button onclick={() => goto('/warehouse/documents/new')}>
        <Plus class="mr-2 h-4 w-4" /> {$isLoading ? 'Create Document' : $_('warehouse.createDocument')}
      </Button>
    </div>
  </div>

  <!-- ── Tabs ──────────────────────────────────────────────────────────────── -->
  <div class="flex gap-1 border-b border-slate-700">
    {#each ([['all', $isLoading ? 'All' : $_('warehouse.issueReturn.tabAll')], ['issue', $isLoading ? 'Issue' : $_('warehouse.issueReturn.tabIssue')], ['return', $isLoading ? 'Return' : $_('warehouse.issueReturn.tabReturn')], ['pending', $isLoading ? 'Pending Approval' : $_('warehouse.issueReturn.tabPending')]] as const) as [tab, label]}
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px {activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}"
        onclick={() => switchTab(tab)}
      >
        {label}
      </button>
    {/each}
  </div>

  <!-- ── Filters ────────────────────────────────────────────────────────────── -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <select class="select-base" bind:value={filterWarehouse} onchange={() => load(1)}>
      <option value="">{$isLoading ? 'All Warehouses' : $_('warehouse.allWarehouses')}</option>
      {#each warehouses as wh}
        <option value={wh.id}>{wh.name} ({wh.code})</option>
      {/each}
    </select>
    <input class="input-base" type="date" bind:value={filterFrom} oninput={() => load(1)} />
    <input class="input-base" type="date" bind:value={filterTo} oninput={() => load(1)} />
    <Button variant="secondary" onclick={() => load(1)} disabled={loading}>
      <RefreshCw class="h-4 w-4 mr-2" /> {$isLoading ? 'Refresh' : $_('common.refresh')}
    </Button>
  </div>

  <!-- ── Error ──────────────────────────────────────────────────────────────── -->
  {#if error}
    <div class="rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
  {/if}

  <!-- ── Table ──────────────────────────────────────────────────────────────── -->
  <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    {:else if documents.length === 0}
      <div class="flex flex-col items-center gap-3 py-12 text-slate-500">
        <FileText class="h-10 w-10 opacity-30" />
        <p class="text-sm">{$isLoading ? 'No documents found' : $_('warehouse.issueReturn.noDocuments')}</p>
      </div>
    {:else}
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="px-3 py-2">{$isLoading ? 'Code' : $_('warehouse.header.code')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Type' : $_('warehouse.header.type')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Status' : $_('warehouse.header.status')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Warehouse' : $_('warehouse.field.warehouse')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Receiver / Returner' : $_('warehouse.header.person')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Date' : $_('warehouse.header.createdAt')}</th>
            <th class="px-3 py-2">{$isLoading ? 'Notes' : $_('warehouse.header.notes')}</th>
            <th class="px-3 py-2 text-right">{$isLoading ? 'Actions' : $_('warehouse.header.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each documents as doc (doc.id)}
            {@const busy = actionBusy === doc.id}
            <tr class="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="font-mono text-primary hover:underline"
                    onclick={() => goto(`/warehouse/documents/${doc.id}`)}
                  >
                    {doc.code}
                  </button>
                  {#if doc.note?.startsWith('WF-') || doc.note?.includes('auto') || doc.submitterName?.startsWith('WF')}
                    <span class="badge-purple text-[10px]">{$isLoading ? 'Auto' : $_('warehouse.issueReturn.autoGeneratedBadge')}</span>
                  {/if}
                </div>
              </td>
              <td class="px-3 py-2">
                <span class={TYPE_BADGE[doc.docType] ?? 'badge-gray'}>
                  {TYPE_LABELS[doc.docType] ?? doc.docType}
                </span>
              </td>
              <td class="px-3 py-2">
                <span class={STATUS_BADGE[doc.status] ?? 'badge-gray'}>
                  {STATUS_LABELS[doc.status] ?? doc.status}
                </span>
              </td>
              <td class="px-3 py-2 text-slate-300">{warehouseName(doc.warehouseId)}</td>
              <td class="px-3 py-2 text-slate-400">
                {doc.receiverName || doc.submitterName || '—'}
              </td>
              <td class="px-3 py-2 text-slate-400">{fmtDate(doc.docDate)}</td>
              <td class="px-3 py-2 max-w-[160px] truncate text-slate-400" title={doc.note ?? ''}>
                {doc.note || '—'}
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-1 flex-wrap">
                  <Button size="sm" variant="secondary" onclick={() => goto(`/warehouse/documents/${doc.id}`)}>
                    {$isLoading ? 'View' : $_('warehouse.action.view')}
                  </Button>

                  {#if doc.status === 'draft'}
                    <Button size="sm" onclick={() => handleSubmit(doc)} disabled={busy}>
                      {#snippet leftIcon()}<CheckCircle class="h-3.5 w-3.5" />{/snippet}
                      {busy ? '...' : $isLoading ? 'Submit' : $_('warehouse.action.submit')}
                    </Button>
                  {/if}

                  {#if doc.status === 'submitted'}
                    <Button size="sm" onclick={() => handleApprove(doc)} disabled={busy}>
                      {#snippet leftIcon()}<CheckCircle class="h-3.5 w-3.5" />{/snippet}
                      {busy ? '...' : $isLoading ? 'Approve' : $_('warehouse.action.approve')}
                    </Button>
                  {/if}

                  {#if doc.status === 'approved'}
                    <Button size="sm" onclick={() => handlePost(doc)} disabled={busy}>
                      {#snippet leftIcon()}<BookOpen class="h-3.5 w-3.5" />{/snippet}
                      {busy ? '...' : $isLoading ? 'Post' : $_('warehouse.action.post')}
                    </Button>
                  {/if}

                  {#if doc.status === 'draft' || doc.status === 'submitted' || doc.status === 'approved'}
                    <Button size="sm" variant="danger" onclick={() => handleCancel(doc)} disabled={busy}>
                      {#snippet leftIcon()}<XCircle class="h-3.5 w-3.5" />{/snippet}
                      {busy ? '...' : $isLoading ? 'Cancel' : $_('warehouse.action.cancel')}
                    </Button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- ── Pagination ─────────────────────────────────────────────────────────── -->
  {#if totalPages > 1}
    <div class="flex items-center justify-between text-sm text-slate-400">
      <span>{$isLoading ? 'Page' : $_('common.page')} {meta.page} / {totalPages} &nbsp;·&nbsp; {meta.total} {$isLoading ? 'documents' : $_('warehouse.documents')}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1}
          onclick={() => load(meta.page - 1)}>← {$isLoading ? 'Prev' : $_('common.prev')}</Button>
        <Button size="sm" variant="secondary" disabled={meta.page >= totalPages}
          onclick={() => load(meta.page + 1)}>{$isLoading ? 'Next' : $_('common.next')} →</Button>
      </div>
    </div>
  {/if}
</div>
