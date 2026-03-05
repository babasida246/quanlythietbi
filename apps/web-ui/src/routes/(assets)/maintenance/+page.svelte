<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Plus, RefreshCw, Wrench, Edit, Trash2, ArrowRight, FileText, AlertTriangle, Wrench as RepairIcon, Link2 } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Button, StatsCard, MiniStat } from '$lib/components/ui';
  import { Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { z } from 'zod';
  import { listAssets, openMaintenanceTicket, type Asset, type MaintenanceTicket } from '$lib/api/assets';
  import {
    deleteMaintenanceTicket,
    listMaintenanceTickets,
    updateMaintenanceTicketStatus
  } from '$lib/api/assetMgmt';
  import {
    listRepairOrders,
    getRepairOrderSummary,
    type RepairOrderRecord,
    type RepairOrderSummary
  } from '$lib/api/warehouse';
  import {
    repairStatusLabel,
    repairStatusBadge,
    repairSeverityLabel,
    repairSeverityBadge,
    formatCurrencyVND,
    formatDuration,
    formatDate
  } from '$lib/domain/repairs/presenters';
  import { listCis, type CiRecord } from '$lib/api/cmdb';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  // ─── Tabs ────────────────────────────────────────────────────────────────
  type TabKey = 'tickets' | 'repairs';
  let activeTab = $state<TabKey>('tickets');

  // ─── Stats ───────────────────────────────────────────────────────────────
  let statsLoading = $state(true);
  let ticketStats = $state({ total: 0, open: 0, inProgress: 0, closed: 0 });
  let repairSummary = $state<RepairOrderSummary | null>(null);

  // ─── Ticket schema ───────────────────────────────────────────────────────
  const ticketSchema = z.object({
    title: z.string().trim().min(1, $isLoading ? 'Title is required' : $_('maintenance.validation.titleRequired')),
    assetId: z.string().optional(),
    ciId: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical'] as const),
    status: z.enum(['open', 'in_progress', 'closed', 'canceled'] as const),
    assigneeId: z.string().optional(),
    dueDate: z.string().optional(),
    description: z.string().optional()
  });

  let loading = $state(true);
  let error = $state('');
  let tickets = $state<MaintenanceTicket[]>([]);
  let repairs = $state<RepairOrderRecord[]>([]);
  let assets = $state<Asset[]>([]);
  let cis = $state<CiRecord[]>([]);

  let createOpen = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let editingItem = $state<MaintenanceTicket | null>(null);
  let deletingItem = $state<MaintenanceTicket | null>(null);

  // ─── Filter state for repairs ────────────────────────────────────────────
  let repairQuery = $state('');
  let repairStatus = $state<'' | RepairOrderRecord['status']>('');

  const assetOptions = $derived(assets.map((item) => ({ value: item.id, label: item.assetCode })));
  const ciOptions = $derived(cis.map((item) => ({ value: item.id, label: item.name })));

  const filteredRepairs = $derived.by(() => {
    let result = repairs;
    if (repairQuery.trim()) {
      const q = repairQuery.toLowerCase();
      result = result.filter(r => r.title?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q));
    }
    if (repairStatus) {
      result = result.filter(r => r.status === repairStatus);
    }
    return result;
  });

  function getCreateValues(): Record<string, unknown> {
    return { title: '', assetId: '', ciId: '', priority: 'low', status: 'open', assigneeId: '', dueDate: '', description: '' };
  }

  function getEditValues(item: MaintenanceTicket | null): Record<string, unknown> {
    if (!item) return getCreateValues();
    return { title: item.title, assetId: item.assetId ?? '', ciId: '', priority: item.severity ?? 'low', status: item.status ?? 'open', assigneeId: '', dueDate: '', description: item.diagnosis ?? item.resolution ?? '' };
  }

  // ─── Data loading ────────────────────────────────────────────────────────
  async function loadData() {
    try {
      loading = true;
      error = '';
      const [ticketRes, repairRes, assetRes, ciRes] = await Promise.all([
        listMaintenanceTickets({ limit: 200 }),
        listRepairOrders({ limit: 200 }).catch(() => ({ data: [] as RepairOrderRecord[], meta: { total: 0 } })),
        listAssets({ limit: 200 }),
        listCis({ limit: 200 }).catch(() => ({ data: [] as CiRecord[] }))
      ]);
      tickets = ticketRes.data ?? [];
      repairs = (repairRes as any).data ?? [];
      assets = assetRes.data ?? [];
      cis = ciRes.data ?? [];

      // compute ticket stats
      ticketStats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        closed: tickets.filter(t => t.status === 'closed').length
      };
    } catch (err) {
      error = err instanceof Error ? err.message : $_('maintenance.error.loadFailed');
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadRepairSummary() {
    try {
      statsLoading = true;
      const result = await getRepairOrderSummary().catch(() => null);
      repairSummary = result?.data ?? null;
    } finally {
      statsLoading = false;
    }
  }

  async function resolveAssetId(assetId: string, ciId: string): Promise<string> {
    if (assetId) return assetId;
    if (ciId) {
      const selectedCi = cis.find((ci) => ci.id === ciId);
      if (selectedCi?.assetId) return selectedCi.assetId;
    }
    const fallback = assets[0]?.id;
    if (!fallback) throw new Error($_('maintenance.error.assetOrCiRequired'));
    return fallback;
  }

  async function createTicket(values: Record<string, unknown>) {
    const parsed = ticketSchema.parse(values);
    const targetAssetId = await resolveAssetId(parsed.assetId || '', parsed.ciId || '');
    const extra = [parsed.description?.trim() || '', parsed.assigneeId?.trim() ? `Assignee:${parsed.assigneeId.trim()}` : '', parsed.dueDate?.trim() ? `Due:${parsed.dueDate.trim()}` : ''].filter(Boolean).join('\n');
    const created = await openMaintenanceTicket({ assetId: targetAssetId, title: parsed.title, severity: parsed.priority, diagnosis: extra || undefined });
    if (parsed.status !== 'open') {
      await updateMaintenanceTicketStatus(created.data.id, { status: parsed.status, diagnosis: extra || undefined, resolution: undefined });
    }
    toast.success($_('maintenance.toast.createSuccess'));
    await loadData();
  }

  async function updateTicket(values: Record<string, unknown>) {
    if (!editingItem) return;
    const parsed = ticketSchema.parse(values);
    const extra = [parsed.description?.trim() || '', parsed.assigneeId?.trim() ? `Assignee:${parsed.assigneeId.trim()}` : '', parsed.dueDate?.trim() ? `Due:${parsed.dueDate.trim()}` : ''].filter(Boolean).join('\n');
    await updateMaintenanceTicketStatus(editingItem.id, { status: parsed.status, diagnosis: extra || undefined, resolution: parsed.status === 'closed' ? 'Closed by workflow' : undefined, closedAt: parsed.status === 'closed' ? new Date().toISOString() : undefined });
    toast.success($_('maintenance.toast.updateSuccess'));
    await loadData();
  }

  async function removeTicket() {
    if (!deletingItem) return;
    await deleteMaintenanceTicket(deletingItem.id);
    toast.success($_('maintenance.toast.deleteSuccess'));
    deleteOpen = false;
    deletingItem = null;
    await loadData();
  }

  onMount(() => {
    void loadData();
    void loadRepairSummary();
  });
</script>

<div class="page-shell page-content space-y-6">

  <PageHeader title={$isLoading ? 'Maintenance & Repairs' : $_('maintenance.pageTitle')} subtitle={$isLoading ? 'Maintenance tickets and repair orders' : $_('maintenance.pageSubtitle')}>
    {#snippet actions()}
      <Button variant="primary" size="sm" data-testid="btn-create" onclick={() => (createOpen = true)}>
        {#snippet leftIcon()}<Plus class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Create ticket' : $_('maintenance.actions.create')}
      </Button>
      <Button variant="secondary" size="sm" onclick={() => goto('/maintenance/repairs')}>
        {#snippet leftIcon()}<FileText class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Repair Orders' : $_('maintenance.actions.goRepairs')}
      </Button>
      <Button variant="ghost" size="sm" data-testid="btn-refresh" onclick={() => { loadData(); loadRepairSummary(); }}>
        <RefreshCw class="h-3.5 w-3.5" />
      </Button>
    {/snippet}
  </PageHeader>

  <!-- Stat Cards -->
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
    <div class="rounded-xl border border-slate-700 bg-surface-2 p-4">
      <div class="text-xs text-slate-400 mb-1">{$isLoading ? 'Total tickets' : $_('maintenance.stats.totalTickets')}</div>
      <div class="text-2xl font-bold text-white">{ticketStats.total}</div>
    </div>
    <div class="rounded-xl border border-blue-800/50 bg-blue-900/20 p-4">
      <div class="text-xs text-blue-400 mb-1">{$isLoading ? 'Open' : $_('maintenance.status.open')}</div>
      <div class="text-2xl font-bold text-blue-300">{ticketStats.open}</div>
    </div>
    <div class="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4">
      <div class="text-xs text-amber-400 mb-1">{$isLoading ? 'In Progress' : $_('maintenance.status.inProgress')}</div>
      <div class="text-2xl font-bold text-amber-300">{ticketStats.inProgress}</div>
    </div>
    <div class="rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-4">
      <div class="text-xs text-emerald-400 mb-1">{$isLoading ? 'Closed' : $_('maintenance.status.closed')}</div>
      <div class="text-2xl font-bold text-emerald-300">{ticketStats.closed}</div>
    </div>
    {#if repairSummary}
      <div class="rounded-xl border border-orange-800/50 bg-orange-900/20 p-4">
        <div class="text-xs text-orange-400 mb-1">{$isLoading ? 'Repair Orders' : $_('maintenance.stats.repairOrders')}</div>
        <div class="text-2xl font-bold text-orange-300">{repairSummary.total ?? 0}</div>
        <div class="text-xs text-orange-500 mt-0.5">{$isLoading ? 'total cost' : $_('maintenance.stats.totalCost')}: {formatCurrencyVND(repairSummary.totalCost ?? 0)}</div>
      </div>
    {/if}
  </div>

  <!-- Tab bar -->
  <div class="flex gap-1 border-b border-slate-800">
    <button
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'tickets' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-white'}"
      onclick={() => (activeTab = 'tickets')}
    >
      {$isLoading ? 'Maintenance Tickets' : $_('maintenance.tabTickets')} ({ticketStats.total})
    </button>
    <button
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'repairs' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-slate-400 hover:text-white'}"
      onclick={() => (activeTab = 'repairs')}
    >
      {$isLoading ? 'Repair Orders' : $_('maintenance.tabRepairs')} ({repairs.length})
    </button>
  </div>

  {#if error}
    <div class="alert alert-error flex items-center gap-2"><AlertTriangle class="h-4 w-4" />{error}</div>
  {/if}

  <!-- Tickets Tab -->
  {#if activeTab === 'tickets'}
    {#if loading}
      <Skeleton rows={5} />
    {:else if tickets.length === 0}
      <EmptyState
        icon={Wrench}
        title={$isLoading ? 'No maintenance tickets' : $_('maintenance.empty.title')}
        description={$isLoading ? 'Start by creating a new ticket.' : $_('maintenance.empty.description')}
        actionLabel={$isLoading ? 'Create ticket' : $_('maintenance.empty.actionLabel')}
        onAction={() => (createOpen = true)}
      />
    {:else}
      <Table>
        <TableHeader>
          <tr>
            <TableHeaderCell>{$isLoading ? 'Title' : $_('maintenance.table.title')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Asset' : $_('maintenance.table.asset')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Priority' : $_('maintenance.table.priority')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Status' : $_('maintenance.table.status')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Repairs' : $_('maintenance.table.repairs')}</TableHeaderCell>
            <TableHeaderCell align="right">{$isLoading ? 'Actions' : $_('maintenance.table.actions')}</TableHeaderCell>
          </tr>
        </TableHeader>
        <tbody>
          {#each tickets as ticket}
            <TableRow>
              <TableCell class="font-medium">{ticket.title}</TableCell>
              <TableCell>
                <code class="code-inline">{assets.find((item) => item.id === ticket.assetId)?.assetCode ?? ticket.assetId}</code>
              </TableCell>
              <TableCell>
                <span class={`badge ${ticket.severity === 'critical' ? 'badge-red' : ticket.severity === 'high' ? 'badge-yellow' : ticket.severity === 'medium' ? 'badge-blue' : 'badge-gray'}`}>
                  {ticket.severity}
                </span>
              </TableCell>
              <TableCell>
                <span class={`badge ${ticket.status === 'open' ? 'badge-blue' : ticket.status === 'in_progress' ? 'badge-yellow' : ticket.status === 'closed' ? 'badge-green' : 'badge-gray'}`}>
                  {ticket.status}
                </span>
              </TableCell>
              <TableCell>
                {@const relatedRepairs = repairs.filter(r => r.assetId === ticket.assetId)}
                <div class="flex items-center gap-1">
                  {#if relatedRepairs.length > 0}
                    <span class="badge badge-orange flex items-center gap-1" title={$isLoading ? 'Related repair orders' : $_('maintenance.table.relatedRepairs')}>
                      <Link2 class="h-3 w-3" />{relatedRepairs.length}
                    </span>
                  {/if}
                  <button
                    class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    title={$isLoading ? 'Create repair order' : $_('maintenance.actions.createRepair')}
                    onclick={() => goto(`/maintenance/repairs?fromTicket=${ticket.id}&assetId=${ticket.assetId}&title=${encodeURIComponent(ticket.title)}`)}
                  >
                    <Plus class="h-3 w-3" />{$isLoading ? 'SC' : $_('maintenance.actions.repair')}
                  </button>
                </div>
              </TableCell>
              <TableCell align="right">
                <div class="cell-actions">
                  <Button size="sm" variant="secondary" onclick={() => { editingItem = ticket; editOpen = true; }}>
                    {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                    {$isLoading ? 'Edit' : $_('maintenance.actions.edit')}
                  </Button>
                  <Button size="sm" variant="danger" onclick={() => { deletingItem = ticket; deleteOpen = true; }}>
                    {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
                    {$isLoading ? 'Delete' : $_('maintenance.actions.delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          {/each}
        </tbody>
      </Table>
    {/if}
  {/if}

  <!-- Repairs Tab -->
  {#if activeTab === 'repairs'}
    <div class="flex flex-wrap gap-3 items-end">
      <input class="input-base flex-1 min-w-48" bind:value={repairQuery} placeholder={$isLoading ? 'Search repair orders...' : $_('maintenance.repairSearch')} />
      <select class="select-base w-44" bind:value={repairStatus}>
        <option value="">{$isLoading ? 'All statuses' : $_('maintenance.allStatuses')}</option>
        <option value="open">{$isLoading ? 'Open' : $_('maintenance.repairStatuses.open')}</option>
        <option value="diagnosing">{$isLoading ? 'Diagnosing' : $_('maintenance.repairStatuses.diagnosing')}</option>
        <option value="waiting_parts">{$isLoading ? 'Waiting parts' : $_('maintenance.repairStatuses.waitingParts')}</option>
        <option value="repairing">{$isLoading ? 'Repairing' : $_('maintenance.repairStatuses.repairing')}</option>
        <option value="done">{$isLoading ? 'Done' : $_('maintenance.repairStatuses.done')}</option>
        <option value="closed">{$isLoading ? 'Closed' : $_('maintenance.repairStatuses.closed')}</option>
        <option value="canceled">{$isLoading ? 'Canceled' : $_('maintenance.repairStatuses.canceled')}</option>
      </select>
    </div>

    {#if loading}
      <Skeleton rows={5} />
    {:else if filteredRepairs.length === 0}
      <EmptyState
        icon={Wrench}
        title={$isLoading ? 'No repair orders' : $_('maintenance.repairEmpty')}
        description={$isLoading ? 'Create repair orders from Warehouse > Repairs.' : $_('maintenance.repairEmptyDesc')}
      />
    {:else}
      <div class="rounded-xl border border-slate-800 bg-surface-2 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-800">
            <tr class="text-xs text-slate-400 uppercase">
              <th class="px-4 py-3 text-left">{$isLoading ? 'Code' : $_('maintenance.repairTable.code')}</th>
              <th class="px-4 py-3 text-left">{$isLoading ? 'Title' : $_('maintenance.repairTable.title')}</th>
              <th class="px-4 py-3 text-left">{$isLoading ? 'Status' : $_('maintenance.repairTable.status')}</th>
              <th class="px-4 py-3 text-left">{$isLoading ? 'Severity' : $_('maintenance.repairTable.severity')}</th>
              <th class="px-4 py-3 text-left hidden md:table-cell">{$isLoading ? 'Type' : $_('maintenance.repairTable.type')}</th>
              <th class="px-4 py-3 text-right hidden lg:table-cell">{$isLoading ? 'Cost' : $_('maintenance.repairTable.cost')}</th>
              <th class="px-4 py-3 text-left">{$isLoading ? 'Ticket' : $_('maintenance.repairTable.ticket')}</th>
              <th class="px-4 py-3 text-right">{$isLoading ? 'Actions' : $_('common.actions')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            {#each filteredRepairs as ro}
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-slate-300">{ro.code ?? '—'}</td>
                <td class="px-4 py-3 font-medium text-white">{ro.title}</td>
                <td class="px-4 py-3"><span class={repairStatusBadge[ro.status]}>{repairStatusLabel[ro.status]}</span></td>
                <td class="px-4 py-3"><span class={repairSeverityBadge[ro.severity]}>{repairSeverityLabel[ro.severity]}</span></td>
                <td class="px-4 py-3 hidden md:table-cell text-slate-400">{ro.repairType ?? '—'}</td>
                <td class="px-4 py-3 text-right hidden lg:table-cell text-slate-300">{formatCurrencyVND((ro.laborCost ?? 0) + (ro.partsCost ?? 0))}</td>
                <td class="px-4 py-3">
                  {#each [tickets.find(t => t.assetId === ro.assetId)] as relatedTicket}
                    {#if relatedTicket}
                      <span class="badge badge-blue flex items-center gap-1 w-fit" title={relatedTicket.title}>
                        <Link2 class="h-3 w-3" />{relatedTicket.title.slice(0, 20)}{relatedTicket.title.length > 20 ? '…' : ''}
                      </span>
                    {:else}
                      <span class="text-slate-500 text-xs">—</span>
                    {/if}
                  {/each}
                </td>
                <td class="px-4 py-3 text-right">
                  <a href="/maintenance/repairs/{ro.id}" class="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300">
                    {$isLoading ? 'View' : $_('common.view')} <ArrowRight class="h-3 w-3" />
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

</div>

<!-- Create Modal -->
<CreateEditModal
  bind:open={createOpen}
  mode="create"
  title={$isLoading ? 'Create maintenance ticket' : $_('maintenance.modal.createTitle')}
  schema={ticketSchema}
  initialValues={getCreateValues()}
  onSubmit={createTicket}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="maint-title-c" label={$isLoading ? 'Title' : $_('maintenance.field.title')} required value={String(values.title ?? '')} error={errors.title} onValueChange={(v) => setValue('title', v)} disabled={disabled} />
    <SelectField id="maint-asset-c" label={$isLoading ? 'Asset' : $_('maintenance.field.asset')} value={String(values.assetId ?? '')} options={assetOptions} placeholder={$isLoading ? 'Select asset' : $_('maintenance.field.assetPlaceholder')} onValueChange={(v) => setValue('assetId', v)} disabled={disabled} />
    <SelectField id="maint-ci-c" label="CI" value={String(values.ciId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select CI' : $_('maintenance.field.ciPlaceholder')} onValueChange={(v) => setValue('ciId', v)} disabled={disabled} />
    <SelectField id="maint-prio-c" label={$isLoading ? 'Priority' : $_('maintenance.field.priority')} required value={String(values.priority ?? 'low')} options={[{ value: 'low', label: $_('maintenance.priority.low') }, { value: 'medium', label: $_('maintenance.priority.medium') }, { value: 'high', label: $_('maintenance.priority.high') }, { value: 'critical', label: $_('maintenance.priority.critical') }]} error={errors.priority} onValueChange={(v) => setValue('priority', v)} disabled={disabled} />
    <SelectField id="maint-status-c" label={$isLoading ? 'Status' : $_('maintenance.field.status')} required value={String(values.status ?? 'open')} options={[{ value: 'open', label: $_('maintenance.status.open') }, { value: 'in_progress', label: $_('maintenance.status.inProgress') }, { value: 'closed', label: $_('maintenance.status.closed') }, { value: 'canceled', label: $_('maintenance.status.canceled') }]} error={errors.status} onValueChange={(v) => setValue('status', v)} disabled={disabled} />
    <TextField id="maint-assignee-c" label={$isLoading ? 'Assignee' : $_('maintenance.field.assignee')} value={String(values.assigneeId ?? '')} onValueChange={(v) => setValue('assigneeId', v)} disabled={disabled} />
    <TextField id="maint-due-c" type="date" label={$isLoading ? 'Due date' : $_('maintenance.field.dueDate')} value={String(values.dueDate ?? '')} onValueChange={(v) => setValue('dueDate', v)} disabled={disabled} />
    <TextareaField id="maint-desc-c" label={$isLoading ? 'Description' : $_('maintenance.field.description')} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>

<!-- Edit Modal -->
<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title={$isLoading ? 'Update maintenance ticket' : $_('maintenance.modal.editTitle')}
  schema={ticketSchema}
  initialValues={getEditValues(editingItem)}
  onSubmit={updateTicket}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="maint-title-e" label={$isLoading ? 'Title' : $_('maintenance.field.title')} required value={String(values.title ?? '')} error={errors.title} onValueChange={(v) => setValue('title', v)} disabled={disabled} />
    <SelectField id="maint-asset-e" label={$isLoading ? 'Asset' : $_('maintenance.field.asset')} value={String(values.assetId ?? '')} options={assetOptions} placeholder={$isLoading ? 'Select asset' : $_('maintenance.field.assetPlaceholder')} onValueChange={(v) => setValue('assetId', v)} disabled={disabled} />
    <SelectField id="maint-ci-e" label="CI" value={String(values.ciId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select CI' : $_('maintenance.field.ciPlaceholder')} onValueChange={(v) => setValue('ciId', v)} disabled={disabled} />
    <SelectField id="maint-prio-e" label={$isLoading ? 'Priority' : $_('maintenance.field.priority')} required value={String(values.priority ?? 'low')} options={[{ value: 'low', label: $_('maintenance.priority.low') }, { value: 'medium', label: $_('maintenance.priority.medium') }, { value: 'high', label: $_('maintenance.priority.high') }, { value: 'critical', label: $_('maintenance.priority.critical') }]} error={errors.priority} onValueChange={(v) => setValue('priority', v)} disabled={disabled} />
    <SelectField id="maint-status-e" label={$isLoading ? 'Status' : $_('maintenance.field.status')} required value={String(values.status ?? 'open')} options={[{ value: 'open', label: $_('maintenance.status.open') }, { value: 'in_progress', label: $_('maintenance.status.inProgress') }, { value: 'closed', label: $_('maintenance.status.closed') }, { value: 'canceled', label: $_('maintenance.status.canceled') }]} error={errors.status} onValueChange={(v) => setValue('status', v)} disabled={disabled} />
    <TextField id="maint-assignee-e" label={$isLoading ? 'Assignee' : $_('maintenance.field.assignee')} value={String(values.assigneeId ?? '')} onValueChange={(v) => setValue('assigneeId', v)} disabled={disabled} />
    <TextField id="maint-due-e" type="date" label={$isLoading ? 'Due date' : $_('maintenance.field.dueDate')} value={String(values.dueDate ?? '')} onValueChange={(v) => setValue('dueDate', v)} disabled={disabled} />
    <TextareaField id="maint-desc-e" label={$isLoading ? 'Description' : $_('maintenance.field.description')} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>

<DeleteConfirmModal bind:open={deleteOpen} entityName={deletingItem?.title ?? 'ticket'} onConfirm={removeTicket} />
