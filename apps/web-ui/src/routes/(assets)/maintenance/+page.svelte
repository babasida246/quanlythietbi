<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, RefreshCw, Wrench, Edit, Trash2 } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Button } from '$lib/components/ui';
  import { Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { z } from 'zod';
  import { listAssets, openMaintenanceTicket, type Asset, type MaintenanceTicket } from '$lib/api/assets';
  import {
    deleteMaintenanceTicket,
    listMaintenanceTickets,
    updateMaintenanceTicketStatus
  } from '$lib/api/assetMgmt';
  import { listCis, type CiRecord } from '$lib/api/cmdb';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

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
  let assets = $state<Asset[]>([]);
  let cis = $state<CiRecord[]>([]);

  let createOpen = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let editingItem = $state<MaintenanceTicket | null>(null);
  let deletingItem = $state<MaintenanceTicket | null>(null);

  const assetOptions = $derived(assets.map((item) => ({ value: item.id, label: item.assetCode })));
  const ciOptions = $derived(cis.map((item) => ({ value: item.id, label: item.name })));

  function getCreateValues(): Record<string, unknown> {
    return {
      title: '',
      assetId: '',
      ciId: '',
      priority: 'low',
      status: 'open',
      assigneeId: '',
      dueDate: '',
      description: ''
    };
  }

  function getEditValues(item: MaintenanceTicket | null): Record<string, unknown> {
    if (!item) return getCreateValues();
    return {
      title: item.title,
      assetId: item.assetId ?? '',
      ciId: '',
      priority: item.severity ?? 'low',
      status: item.status ?? 'open',
      assigneeId: '',
      dueDate: '',
      description: item.diagnosis ?? item.resolution ?? ''
    };
  }

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [ticketResponse, assetResponse, ciResponse] = await Promise.all([
        listMaintenanceTickets({ limit: 200 }),
        listAssets({ limit: 200 }),
        listCis({ limit: 200 }).catch(() => ({ data: [] as CiRecord[] }))
      ]);
      tickets = ticketResponse.data ?? [];
      assets = assetResponse.data ?? [];
      cis = ciResponse.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : ($isLoading ? 'Failed to load maintenance list' : $_('maintenance.error.loadFailed'));
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function resolveAssetId(assetId: string, ciId: string): Promise<string> {
    if (assetId) return assetId;
    if (ciId) {
      const selectedCi = cis.find((ci) => ci.id === ciId);
      if (selectedCi?.assetId) return selectedCi.assetId;
    }
    const fallback = assets[0]?.id;
    if (!fallback) throw new Error($isLoading ? 'Must select a valid asset or CI' : $_('maintenance.error.assetOrCiRequired'));
    return fallback;
  }

  async function createTicket(values: Record<string, unknown>) {
    const parsed = ticketSchema.parse(values);
    const targetAssetId = await resolveAssetId(parsed.assetId || '', parsed.ciId || '');
    const extra = [
      parsed.description?.trim() || '',
      parsed.assigneeId?.trim() ? `Assignee:${parsed.assigneeId.trim()}` : '',
      parsed.dueDate?.trim() ? `Due:${parsed.dueDate.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const created = await openMaintenanceTicket({
      assetId: targetAssetId,
      title: parsed.title,
      severity: parsed.priority,
      diagnosis: extra || undefined
    });

    if (parsed.status !== 'open') {
      await updateMaintenanceTicketStatus(created.data.id, {
        status: parsed.status,
        diagnosis: extra || undefined,
        resolution: undefined
      });
    }

    toast.success($isLoading ? 'Maintenance ticket created' : $_('maintenance.toast.createSuccess'));
    await loadData();
  }

  async function updateTicket(values: Record<string, unknown>) {
    if (!editingItem) return;
    const parsed = ticketSchema.parse(values);
    const extra = [
      parsed.description?.trim() || '',
      parsed.assigneeId?.trim() ? `Assignee:${parsed.assigneeId.trim()}` : '',
      parsed.dueDate?.trim() ? `Due:${parsed.dueDate.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    await updateMaintenanceTicketStatus(editingItem.id, {
      status: parsed.status,
      diagnosis: extra || undefined,
      resolution: parsed.status === 'closed' ? 'Closed by workflow' : undefined,
      closedAt: parsed.status === 'closed' ? new Date().toISOString() : undefined
    });

    toast.success($isLoading ? 'Maintenance ticket updated' : $_('maintenance.toast.updateSuccess'));
    await loadData();
  }

  async function removeTicket() {
    if (!deletingItem) return;
    await deleteMaintenanceTicket(deletingItem.id);
    toast.success($isLoading ? 'Maintenance ticket deleted' : $_('maintenance.toast.deleteSuccess'));
    deleteOpen = false;
    deletingItem = null;
    await loadData();
  }

  onMount(() => {
    void loadData();
  });
</script>

<div class="page-shell page-content">
  <PageHeader title={$isLoading ? 'Maintenance' : $_('maintenance.pageTitle')} subtitle={`${tickets.length} ticket`}>
    {#snippet actions()}
      <Button variant="primary" size="sm" data-testid="btn-create" onclick={() => (createOpen = true)}>
        {#snippet leftIcon()}<Plus class="h-3.5 w-3.5" />{/snippet}
        {$isLoading ? 'Create' : $_('maintenance.actions.create')}
      </Button>
      <Button variant="ghost" size="sm" data-testid="btn-refresh" onclick={() => loadData()}>
        <RefreshCw class="h-3.5 w-3.5" />
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else if tickets.length === 0}
    <EmptyState
      icon={Wrench}
      title={$isLoading ? 'No maintenance tickets' : $_('maintenance.empty.title')}
      description={$isLoading ? 'Start by creating a new maintenance ticket.' : $_('maintenance.empty.description')}
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
              <span class={`badge ${
                ticket.severity === 'critical' ? 'badge-red' :
                ticket.severity === 'high' ? 'badge-yellow' :
                ticket.severity === 'medium' ? 'badge-blue' :
                'badge-gray'
              }`}>
                {ticket.severity}
              </span>
            </TableCell>
            <TableCell>
              <span class={`badge ${
                ticket.status === 'open' ? 'badge-blue' :
                ticket.status === 'in_progress' ? 'badge-yellow' :
                ticket.status === 'closed' ? 'badge-green' :
                'badge-gray'
              }`}>
                {ticket.status}
              </span>
            </TableCell>
            <TableCell align="right">
              <div class="cell-actions">
                <Button size="sm" variant="secondary" data-testid={`row-edit-${ticket.id}`}
                  onclick={() => { editingItem = ticket; editOpen = true; }}>
                  {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                  {$isLoading ? 'Edit' : $_('maintenance.actions.edit')}
                </Button>
                <Button size="sm" variant="danger" data-testid={`row-delete-${ticket.id}`}
                  onclick={() => { deletingItem = ticket; deleteOpen = true; }}>
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
</div>

<CreateEditModal
  bind:open={createOpen}
  mode="create"
  title={$isLoading ? 'Create maintenance ticket' : $_('maintenance.modal.createTitle')}
  schema={ticketSchema}
  initialValues={getCreateValues()}
  onSubmit={createTicket}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="maintenance-title-create" label={$isLoading ? 'Title' : $_('maintenance.field.title')} required value={String(values.title ?? '')} error={errors.title} onValueChange={(v) => setValue('title', v)} disabled={disabled} />
    <SelectField id="maintenance-asset-create" label={$isLoading ? 'Asset' : $_('maintenance.field.asset')} value={String(values.assetId ?? '')} options={assetOptions} placeholder={$isLoading ? 'Select asset (optional)' : $_('maintenance.field.assetPlaceholder')} onValueChange={(v) => setValue('assetId', v)} disabled={disabled} />
    <SelectField id="maintenance-ci-create" label="CI" value={String(values.ciId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select CI (optional)' : $_('maintenance.field.ciPlaceholder')} onValueChange={(v) => setValue('ciId', v)} disabled={disabled} />
    <SelectField id="maintenance-priority-create" label={$isLoading ? 'Priority' : $_('maintenance.field.priority')} required value={String(values.priority ?? 'low')} options={[{ value: 'low', label: $isLoading ? 'Low' : $_('maintenance.priority.low') }, { value: 'medium', label: $isLoading ? 'Medium' : $_('maintenance.priority.medium') }, { value: 'high', label: $isLoading ? 'High' : $_('maintenance.priority.high') }, { value: 'critical', label: $isLoading ? 'Critical' : $_('maintenance.priority.critical') }]} error={errors.priority} onValueChange={(v) => setValue('priority', v)} disabled={disabled} />
    <SelectField id="maintenance-status-create" label={$isLoading ? 'Status' : $_('maintenance.field.status')} required value={String(values.status ?? 'open')} options={[{ value: 'open', label: $isLoading ? 'Open' : $_('maintenance.status.open') }, { value: 'in_progress', label: $isLoading ? 'In Progress' : $_('maintenance.status.inProgress') }, { value: 'closed', label: $isLoading ? 'Closed' : $_('maintenance.status.closed') }, { value: 'canceled', label: $isLoading ? 'Canceled' : $_('maintenance.status.canceled') }]} error={errors.status} onValueChange={(v) => setValue('status', v)} disabled={disabled} />
    <TextField id="maintenance-assignee-create" label={$isLoading ? 'Assignee' : $_('maintenance.field.assignee')} value={String(values.assigneeId ?? '')} onValueChange={(v) => setValue('assigneeId', v)} disabled={disabled} />
    <TextField id="maintenance-due-date-create" type="date" label={$isLoading ? 'Due date' : $_('maintenance.field.dueDate')} value={String(values.dueDate ?? '')} onValueChange={(v) => setValue('dueDate', v)} disabled={disabled} />
    <TextareaField id="maintenance-desc-create" label={$isLoading ? 'Description' : $_('maintenance.field.description')} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>

<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title={$isLoading ? 'Update maintenance ticket' : $_('maintenance.modal.editTitle')}
  schema={ticketSchema}
  initialValues={getEditValues(editingItem)}
  onSubmit={updateTicket}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="maintenance-title-edit" label={$isLoading ? 'Title' : $_('maintenance.field.title')} required value={String(values.title ?? '')} error={errors.title} onValueChange={(v) => setValue('title', v)} disabled={disabled} />
    <SelectField id="maintenance-asset-edit" label={$isLoading ? 'Asset' : $_('maintenance.field.asset')} value={String(values.assetId ?? '')} options={assetOptions} placeholder={$isLoading ? 'Select asset (optional)' : $_('maintenance.field.assetPlaceholder')} onValueChange={(v) => setValue('assetId', v)} disabled={disabled} />
    <SelectField id="maintenance-ci-edit" label="CI" value={String(values.ciId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select CI (optional)' : $_('maintenance.field.ciPlaceholder')} onValueChange={(v) => setValue('ciId', v)} disabled={disabled} />
    <SelectField id="maintenance-priority-edit" label={$isLoading ? 'Priority' : $_('maintenance.field.priority')} required value={String(values.priority ?? 'low')} options={[{ value: 'low', label: $isLoading ? 'Low' : $_('maintenance.priority.low') }, { value: 'medium', label: $isLoading ? 'Medium' : $_('maintenance.priority.medium') }, { value: 'high', label: $isLoading ? 'High' : $_('maintenance.priority.high') }, { value: 'critical', label: $isLoading ? 'Critical' : $_('maintenance.priority.critical') }]} error={errors.priority} onValueChange={(v) => setValue('priority', v)} disabled={disabled} />
    <SelectField id="maintenance-status-edit" label={$isLoading ? 'Status' : $_('maintenance.field.status')} required value={String(values.status ?? 'open')} options={[{ value: 'open', label: $isLoading ? 'Open' : $_('maintenance.status.open') }, { value: 'in_progress', label: $isLoading ? 'In Progress' : $_('maintenance.status.inProgress') }, { value: 'closed', label: $isLoading ? 'Closed' : $_('maintenance.status.closed') }, { value: 'canceled', label: $isLoading ? 'Canceled' : $_('maintenance.status.canceled') }]} error={errors.status} onValueChange={(v) => setValue('status', v)} disabled={disabled} />
    <TextField id="maintenance-assignee-edit" label={$isLoading ? 'Assignee' : $_('maintenance.field.assignee')} value={String(values.assigneeId ?? '')} onValueChange={(v) => setValue('assigneeId', v)} disabled={disabled} />
    <TextField id="maintenance-due-date-edit" type="date" label={$isLoading ? 'Due date' : $_('maintenance.field.dueDate')} value={String(values.dueDate ?? '')} onValueChange={(v) => setValue('dueDate', v)} disabled={disabled} />
    <TextareaField id="maintenance-desc-edit" label={$isLoading ? 'Description' : $_('maintenance.field.description')} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>

<DeleteConfirmModal bind:open={deleteOpen} entityName={deletingItem?.title ?? 'ticket'} onConfirm={removeTicket} />
