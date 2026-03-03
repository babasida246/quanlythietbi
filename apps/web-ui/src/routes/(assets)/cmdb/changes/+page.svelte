<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw } from 'lucide-svelte';
  import { z } from 'zod';
  import {
    approveCmdbChange,
    cancelCmdbChange,
    closeCmdbChange,
    createCmdbChange,
    getCmdbChange,
    implementCmdbChange,
    listCis,
    listCmdbChanges,
    submitCmdbChange,
    updateCmdbChange,
    type CiRecord,
    type CmdbChangeRecord
  } from '$lib/api/cmdb';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import { toast } from '$lib/components/toast';

  type ChangeStatus = CmdbChangeRecord['status'];
  type ChangeRisk = CmdbChangeRecord['risk'];
  type ChangeAction = 'submit' | 'approve' | 'implement' | 'close' | 'cancel';

  const statusValues = ['draft', 'submitted', 'approved', 'implemented', 'closed', 'canceled'] as const;
  const riskValues = ['low', 'medium', 'high', 'critical'] as const;

  const formSchema = z.object({
    title: z.string().trim().min(1, 'Tieu de la bat buoc'),
    description: z.string().optional().default(''),
    risk: z.enum(riskValues).default('medium'),
    primaryCiId: z.string().optional().default(''),
    implementationPlan: z.string().optional().default(''),
    rollbackPlan: z.string().optional().default(''),
    plannedStartAt: z.string().optional().default(''),
    plannedEndAt: z.string().optional().default(''),
    metadataJson: z.string().optional().default('')
  });

  type FormValues = z.infer<typeof formSchema>;

  let loading = $state(true);
  let detailLoading = $state(false);
  let error = $state('');
  let actionBusy = $state('');
  let rows = $state<CmdbChangeRecord[]>([]);
  let total = $state(0);
  let cis = $state<CiRecord[]>([]);
  let selectedId = $state('');
  let selected = $state<CmdbChangeRecord | null>(null);
  let modalOpen = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');

  let filters = $state<{ q: string; status: '' | ChangeStatus; risk: '' | ChangeRisk; primaryCiId: string }>({
    q: '',
    status: '',
    risk: '',
    primaryCiId: ''
  });

  const statusOptions = statusValues.map((value) => ({ value, label: value }));
  const riskOptions = riskValues.map((value) => ({ value, label: value }));
  const ciOptions = $derived(cis.map((ci) => ({ value: ci.id, label: `${ci.name} (${ci.ciCode})` })));
  const modalTitle = $derived(modalMode === 'create' ? 'Create CMDB Change' : 'Edit Draft CMDB Change');
  const modalInitialValues = $derived(modalMode === 'create' ? emptyForm() : toForm(selected));

  function emptyForm(): FormValues {
    return {
      title: '',
      description: '',
      risk: 'medium',
      primaryCiId: '',
      implementationPlan: '',
      rollbackPlan: '',
      plannedStartAt: '',
      plannedEndAt: '',
      metadataJson: ''
    };
  }

  function toForm(change: CmdbChangeRecord | null): FormValues {
    if (!change) return emptyForm();
    return {
      title: change.title ?? '',
      description: change.description ?? '',
      risk: change.risk ?? 'medium',
      primaryCiId: change.primaryCiId ?? '',
      implementationPlan: change.implementationPlan ?? '',
      rollbackPlan: change.rollbackPlan ?? '',
      plannedStartAt: toInputDateTime(change.plannedStartAt),
      plannedEndAt: toInputDateTime(change.plannedEndAt),
      metadataJson: change.metadata ? jsonText(change.metadata) : ''
    };
  }

  function hydrateFilters() {
    const query = page.url.searchParams;
    const status = query.get('status');
    const risk = query.get('risk');
    filters = {
      q: query.get('q') ?? '',
      status: statusValues.includes((status ?? '') as ChangeStatus) ? ((status ?? '') as ChangeStatus) : '',
      risk: riskValues.includes((risk ?? '') as ChangeRisk) ? ((risk ?? '') as ChangeRisk) : '',
      primaryCiId: query.get('primaryCiId') ?? ''
    };
  }

  async function loadCisOptions() {
    try {
      const res = await listCis({ limit: 1000 });
      cis = res.data ?? [];
    } catch (err) {
      console.error('Failed to load CIs', err);
    }
  }

  async function loadList() {
    try {
      loading = true;
      error = '';
      const res = await listCmdbChanges({
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        risk: filters.risk || undefined,
        primaryCiId: filters.primaryCiId || undefined,
        page: 1,
        limit: 100
      });
      rows = res.data ?? [];
      total = res.meta?.total ?? rows.length;
      if (!selectedId && rows[0]) {
        void selectChange(rows[0].id);
      } else if (selectedId && rows.some((row) => row.id === selectedId)) {
        void loadDetail(selectedId);
      } else if (!rows.length) {
        selectedId = '';
        selected = null;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Khong the tai CMDB changes';
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadDetail(id: string) {
    if (!id) return;
    try {
      detailLoading = true;
      const res = await getCmdbChange(id);
      selected = res.data ?? null;
      const current = selected;
      if (current) {
        rows = rows.map((row) => (row.id === current.id ? current : row));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Khong the tai chi tiet change');
    } finally {
      detailLoading = false;
    }
  }

  async function selectChange(id: string) {
    selectedId = id;
    await loadDetail(id);
  }

  function openCreate() {
    modalMode = 'create';
    modalOpen = true;
  }

  function openEdit() {
    if (!selected || selected.status !== 'draft') return;
    modalMode = 'edit';
    modalOpen = true;
  }

  function toIsoDateTime(value: string | undefined): string | null {
    const text = (value ?? '').trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new Error('Ngay gio khong hop le');
    return date.toISOString();
  }

  function toInputDateTime(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function parseMetadata(raw: string | undefined): Record<string, unknown> | null {
    const text = (raw ?? '').trim();
    if (!text) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Metadata JSON khong hop le');
    }
    if (parsed == null) return null;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metadata phai la JSON object');
    return parsed as Record<string, unknown>;
  }

  function jsonText(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      return String(value);
    }
  }

  function fmt(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  }

  function ciName(ciId?: string | null): string {
    if (!ciId) return '-';
    const ci = cis.find((item) => item.id === ciId);
    return ci ? `${ci.name} (${ci.ciCode})` : ciId;
  }

  async function submitModal(values: Record<string, unknown>) {
    const form = formSchema.parse(values);
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      risk: form.risk,
      primaryCiId: form.primaryCiId || null,
      implementationPlan: form.implementationPlan?.trim() || null,
      rollbackPlan: form.rollbackPlan?.trim() || null,
      plannedStartAt: toIsoDateTime(form.plannedStartAt),
      plannedEndAt: toIsoDateTime(form.plannedEndAt),
      metadata: parseMetadata(form.metadataJson)
    };

    if (modalMode === 'create') {
      const res = await createCmdbChange(payload);
      rows = [res.data, ...rows];
      total += 1;
      selectedId = res.data.id;
      selected = res.data;
      toast.success('Tao CMDB change thanh cong');
      await loadDetail(res.data.id);
      return;
    }

    if (!selected) throw new Error('Chua chon change');
    const res = await updateCmdbChange(selected.id, payload);
    rows = rows.map((row) => (row.id === res.data.id ? res.data : row));
    selected = res.data;
    toast.success('Cap nhat draft change thanh cong');
    await loadDetail(res.data.id);
  }

  function actionsFor(change: CmdbChangeRecord | null): ChangeAction[] {
    if (!change) return [];
    switch (change.status) {
      case 'draft':
        return ['submit', 'cancel'];
      case 'submitted':
        return ['approve', 'cancel'];
      case 'approved':
        return ['implement', 'cancel'];
      case 'implemented':
        return ['close'];
      default:
        return [];
    }
  }

  function statusBadge(status: ChangeStatus): string {
    if (status === 'closed') return 'badge-success';
    if (status === 'canceled') return 'badge-error';
    if (status === 'approved') return 'badge-info';
    if (status === 'implemented') return 'badge-primary';
    if (status === 'submitted') return 'badge-warning';
    return 'badge-primary';
  }

  function riskBadge(risk: ChangeRisk): string {
    if (risk === 'low') return 'badge-success';
    if (risk === 'medium') return 'badge-warning';
    if (risk === 'high') return 'badge-error';
    return 'badge-error';
  }

  function actionVariant(action: ChangeAction): 'primary' | 'secondary' | 'danger' {
    if (action === 'submit') return 'primary';
    if (action === 'approve' || action === 'close') return 'primary';
    if (action === 'implement') return 'secondary';
    return 'danger';
  }

  async function runAction(action: ChangeAction) {
    if (!selected || actionBusy) return;
    const key = `${selected.id}:${action}`;
    try {
      actionBusy = key;
      const fn =
        action === 'submit'
          ? submitCmdbChange
          : action === 'approve'
            ? approveCmdbChange
            : action === 'implement'
              ? implementCmdbChange
              : action === 'close'
                ? closeCmdbChange
                : cancelCmdbChange;
      const res = await fn(selected.id);
      rows = rows.map((row) => (row.id === res.data.id ? res.data : row));
      selected = res.data;
      toast.success(`${action} thanh cong`);
      await loadDetail(res.data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thao tac that bai');
    } finally {
      actionBusy = '';
    }
  }

  onMount(() => {
    hydrateFilters();
    void Promise.all([loadCisOptions(), loadList()]);
  });
</script>

<div class="page-shell page-content">
  <PageHeader title="CMDB Changes" subtitle={`${total} records`}>
    {#snippet actions()}
      <Button variant="secondary" onclick={openCreate} data-testid="cmdb-changes-new">
        <Plus class="mr-2 h-4 w-4" /> New Change
      </Button>
      <Button variant="secondary" onclick={loadList}>
        <RefreshCw class="h-4 w-4" />
      </Button>
      <a href="/cmdb/relationships/import" class="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Relationship Import</a>
    {/snippet}
  </PageHeader>

  <div class="mb-4 rounded-xl border border-slate-800 bg-surface-1 p-4">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <TextField id="cmdb-changes-q" label="Search" value={filters.q} onValueChange={(v) => (filters = { ...filters, q: v })} />
      <SelectField id="cmdb-changes-status" label="Status" value={filters.status} options={statusOptions} placeholder="All" onValueChange={(v) => (filters = { ...filters, status: (v as ChangeStatus | '') })} />
      <SelectField id="cmdb-changes-risk" label="Risk" value={filters.risk} options={riskOptions} placeholder="All" onValueChange={(v) => (filters = { ...filters, risk: (v as ChangeRisk | '') })} />
      <SelectField id="cmdb-changes-ci" label="Primary CI" value={filters.primaryCiId} options={ciOptions} placeholder="All" onValueChange={(v) => (filters = { ...filters, primaryCiId: v })} />
      <div class="flex items-end gap-2">
        <Button class="flex-1" onclick={loadList}>Apply</Button>
        <Button variant="secondary" class="flex-1" onclick={() => { filters = { q: '', status: '', risk: '', primaryCiId: '' }; loadList(); }}>Clear</Button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  {/if}

  <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
    <div class="overflow-hidden rounded-xl border border-slate-800 bg-surface-1">
      {#if loading}
        <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-100 text-left text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th class="px-3 py-2">Code</th>
                <th class="px-3 py-2">Title</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Risk</th>
                <th class="px-3 py-2">Primary CI</th>
              </tr>
            </thead>
            <tbody>
              {#if rows.length === 0}
                <tr><td colspan="5" class="px-3 py-8 text-center text-slate-500">No changes</td></tr>
              {:else}
                {#each rows as row}
                  <tr class={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selectedId === row.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onclick={() => selectChange(row.id)}>
                    <td class="px-3 py-2 font-mono text-xs">{row.code}</td>
                    <td class="px-3 py-2">
                      <div class="font-medium">{row.title}</div>
                      <div class="text-xs text-slate-500">{fmt(row.updatedAt)}</div>
                    </td>
                    <td class="px-3 py-2"><span class={statusBadge(row.status)}>{row.status}</span></td>
                    <td class="px-3 py-2"><span class={riskBadge(row.risk)}>{row.risk}</span></td>
                    <td class="px-3 py-2 text-xs">{ciName(row.primaryCiId)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="rounded-xl border border-slate-800 bg-surface-1 p-4">
      {#if detailLoading}
        <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
      {:else if !selected}
        <div class="py-10 text-center text-sm text-slate-500">Select a change</div>
      {:else}
        <div class="space-y-4" data-testid="cmdb-change-detail">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-xs font-mono text-slate-500">{selected.code}</div>
              <h2 class="text-lg font-semibold">{selected.title}</h2>
            </div>
            <div class="flex gap-2">
              <span class={statusBadge(selected.status)}>{selected.status}</span>
              <span class={riskBadge(selected.risk)}>{selected.risk}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            {#if selected.status === 'draft'}
              <Button size="sm" variant="secondary" onclick={openEdit}>Edit Draft</Button>
            {/if}
            {#each actionsFor(selected) as action}
              <Button size="sm" variant={actionVariant(action)} disabled={Boolean(actionBusy)} onclick={() => runAction(action)}>{action}</Button>
            {/each}
            <Button size="sm" variant="secondary" onclick={() => loadDetail(selectedId)}>Reload</Button>
          </div>

          <dl class="grid gap-3 md:grid-cols-2">
            <div><dt class="text-xs uppercase text-slate-500">Primary CI</dt><dd class="mt-1 text-sm">{ciName(selected.primaryCiId)}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Requested By</dt><dd class="mt-1 text-sm">{selected.requestedBy ?? '-'}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Approved By</dt><dd class="mt-1 text-sm">{selected.approvedBy ?? '-'}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Implemented By</dt><dd class="mt-1 text-sm">{selected.implementedBy ?? '-'}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Planned Start</dt><dd class="mt-1 text-sm">{fmt(selected.plannedStartAt)}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Planned End</dt><dd class="mt-1 text-sm">{fmt(selected.plannedEndAt)}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Implemented At</dt><dd class="mt-1 text-sm">{fmt(selected.implementedAt)}</dd></div>
            <div><dt class="text-xs uppercase text-slate-500">Closed At</dt><dd class="mt-1 text-sm">{fmt(selected.closedAt)}</dd></div>
          </dl>

          <div class="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 class="mb-1 text-sm font-semibold">Description</h3>
              <div class="min-h-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-800/70">{selected.description ?? '-'}</div>
            </div>
            <div>
              <h3 class="mb-1 text-sm font-semibold">Implementation / Rollback</h3>
              <div class="min-h-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-800/70">
                <div><span class="font-semibold">Implement:</span> {selected.implementationPlan ?? '-'}</div>
                <div class="mt-2"><span class="font-semibold">Rollback:</span> {selected.rollbackPlan ?? '-'}</div>
              </div>
            </div>
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between">
              <h3 class="text-sm font-semibold">Impact Snapshot</h3>
              {#if selected.primaryCiId}
                <a href={`/cmdb/cis/${selected.primaryCiId}?tab=relationships`} class="text-xs text-blue-600 hover:underline">Open CI relationships</a>
              {/if}
            </div>
            {#if selected.impactSnapshot}
              <pre class="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-xs text-slate-100">{jsonText(selected.impactSnapshot)}</pre>
            {:else}
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/70">No snapshot yet</div>
            {/if}
          </div>

          <div>
            <h3 class="mb-1 text-sm font-semibold">Metadata</h3>
            {#if selected.metadata}
              <pre class="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-xs text-slate-100">{jsonText(selected.metadata)}</pre>
            {:else}
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/70">-</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<CreateEditModal bind:open={modalOpen} mode={modalMode} title={modalTitle} schema={formSchema} initialValues={modalInitialValues} onSubmit={submitModal}>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="cmdb-change-title" label="Title" required value={String(values.title ?? '')} error={errors.title} onValueChange={(v) => setValue('title', v)} disabled={disabled} />
    <TextareaField id="cmdb-change-desc" label="Description" rows={3} value={String(values.description ?? '')} onValueChange={(v) => setValue('description', v)} disabled={disabled} />
    <div class="grid gap-4 md:grid-cols-2">
      <SelectField id="cmdb-change-risk" label="Risk" required value={String(values.risk ?? 'medium')} options={riskOptions} onValueChange={(v) => setValue('risk', v)} disabled={disabled} />
      <SelectField id="cmdb-change-primary-ci" label="Primary CI" value={String(values.primaryCiId ?? '')} options={ciOptions} placeholder="Optional" onValueChange={(v) => setValue('primaryCiId', v)} disabled={disabled} />
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-1">
        <label for="cmdb-change-planned-start" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Planned Start</label>
        <input id="cmdb-change-planned-start" type="datetime-local" value={String(values.plannedStartAt ?? '')} disabled={disabled} oninput={(e) => setValue('plannedStartAt', (e.currentTarget as HTMLInputElement).value)} class={`w-full rounded-lg border bg-surface-1 px-3 py-2 text-sm ${errors.plannedStartAt ? 'border-red-500' : 'border-slate-700'}`} />
      </div>
      <div class="space-y-1">
        <label for="cmdb-change-planned-end" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Planned End</label>
        <input id="cmdb-change-planned-end" type="datetime-local" value={String(values.plannedEndAt ?? '')} disabled={disabled} oninput={(e) => setValue('plannedEndAt', (e.currentTarget as HTMLInputElement).value)} class={`w-full rounded-lg border bg-surface-1 px-3 py-2 text-sm ${errors.plannedEndAt ? 'border-red-500' : 'border-slate-700'}`} />
      </div>
    </div>
    <TextareaField id="cmdb-change-impl" label="Implementation Plan" rows={4} value={String(values.implementationPlan ?? '')} onValueChange={(v) => setValue('implementationPlan', v)} disabled={disabled} />
    <TextareaField id="cmdb-change-rollback" label="Rollback Plan" rows={4} value={String(values.rollbackPlan ?? '')} onValueChange={(v) => setValue('rollbackPlan', v)} disabled={disabled} />
    <TextareaField id="cmdb-change-metadata" label="Metadata JSON" rows={4} value={String(values.metadataJson ?? '')} onValueChange={(v) => setValue('metadataJson', v)} disabled={disabled} />
  {/snippet}
</CreateEditModal>
