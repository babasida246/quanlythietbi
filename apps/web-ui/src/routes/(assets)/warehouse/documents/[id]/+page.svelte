<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { _, isLoading } from '$lib/i18n';
  import { Printer } from 'lucide-svelte';
  import { addNotification } from '$lib/stores/notifications';
  import StockDocumentLines from '$lib/warehouse/StockDocumentLines.svelte';
  import { openPrintPage } from '$lib/utils/printUtils';
  import {
    approveStockDocument,
    cancelStockDocument,
    getStockDocument,
    listSpareParts,
    listWarehouses,
    postStockDocument,
    submitStockDocument,
    updateStockDocument,
    type SparePartRecord,
    type StockDocumentLine,
    type StockDocumentRecord,
    type WarehouseRecord
  } from '$lib/api/warehouse';

  const docId = $derived(page.params.id ?? '');

  let document = $state<StockDocumentRecord | null>(null);
  let lines = $state<StockDocumentLine[]>([]);
  let warehouses = $state<WarehouseRecord[]>([]);
  let parts = $state<SparePartRecord[]>([]);

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');

  let warehouseId = $state('');
  let targetWarehouseId = $state('');
  let docDate = $state('');
  let note = $state('');
  // Extended header fields
  let supplier = $state('');
  let submitterName = $state('');
  let receiverName = $state('');
  let department = $state('');

  const isDraft = $derived(document?.status === 'draft');
  const isSubmitted = $derived(document?.status === 'submitted');
  const isApproved = $derived(document?.status === 'approved');
  const canCancel = $derived(document?.status === 'draft' || document?.status === 'submitted' || document?.status === 'approved');
  const statusLabel = $derived(document ? $_(`warehouse.docStatus.${document.status}`) : '');
  const warehouseName = $derived.by(() => {
    if (!document?.warehouseId || warehouses.length === 0) return '';
    const wId = document.warehouseId;
    const wh = warehouses.find((w) => w.id === wId);
    return wh ? `${wh.name} (${wh.code})` : wId;
  });
  const targetWarehouseName = $derived.by(() => {
    if (!document?.targetWarehouseId || warehouses.length === 0) return '';
    const tId = document.targetWarehouseId;
    const wh = warehouses.find((w) => w.id === tId);
    return wh ? `${wh.name} (${wh.code})` : tId;
  });

  const statusTimeline = $derived.by(() => {
    if (!document) return [];
    const steps = ['draft', 'submitted', 'approved', 'posted'];
    const currentIdx = steps.indexOf(document.status);
    if (document.status === 'canceled') {
      return steps.map((s) => ({ step: s, label: $_(`warehouse.docStatus.${s}`), active: false, canceled: true }));
    }
    return steps.map((s, i) => ({ step: s, label: $_(`warehouse.docStatus.${s}`), active: i <= currentIdx, canceled: false }));
  });

  async function loadDetail() {
    if (!docId) {
      loading = false;
      error = $_('warehouse.errors.loadDocumentFailed');
      return;
    }

    try {
      loading = true;
      error = '';
      const [detailResponse, warehouseResponse, partsResponse] = await Promise.all([
        getStockDocument(docId),
        listWarehouses(),
        listSpareParts({ page: 1, limit: 200 })
      ]);
      document = detailResponse.data.document;
      lines = detailResponse.data.lines ?? [];
      warehouses = warehouseResponse.data ?? [];
      parts = partsResponse.data ?? [];
      warehouseId = document.warehouseId ?? '';
      targetWarehouseId = document.targetWarehouseId ?? '';
      docDate = document.docDate;
      note = document.note ?? '';
      supplier = document.supplier ?? '';
      submitterName = document.submitterName ?? '';
      receiverName = document.receiverName ?? '';
      department = document.department ?? '';
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadDocumentFailed');
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (!document) return;
    try {
      saving = true;
      error = '';
      const response = await updateStockDocument(document.id, {
        docDate,
        note: note || null,
        warehouseId: warehouseId || null,
        targetWarehouseId: document.docType === 'transfer' ? (targetWarehouseId || null) : null,
        supplier: supplier || null,
        submitterName: submitterName || null,
        receiverName: receiverName || null,
        department: department || null,
        lines
      });
      document = response.data.document;
      lines = response.data.lines ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.updateDocumentFailed');
    } finally {
      saving = false;
    }
  }

  async function postDoc() {
    if (!document) return;
    try {
      saving = true;
      error = '';
      const response = await postStockDocument(document.id);
      document = response.data ?? null;
      addNotification(`${$_('warehouse.toast.postedDoc')} ${document?.code}`, 'success');
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.postDocumentFailed');
      addNotification(`${$_('warehouse.errors.postFailed')}: ${error}`, 'error');
    } finally {
      saving = false;
    }
  }

  async function cancelDoc() {
    if (!document) return;
    try {
      saving = true;
      error = '';
      const response = await cancelStockDocument(document.id);
      document = response.data ?? null;
      addNotification(`${$_('warehouse.toast.cancelledDoc')} ${document?.code}`, 'warning');
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.cancelDocumentFailed');
      addNotification(`${$_('warehouse.errors.cancelFailed')}: ${error}`, 'error');
    } finally {
      saving = false;
    }
  }

  async function submitDoc() {
    if (!document) return;
    try {
      saving = true;
      error = '';
      const response = await submitStockDocument(document.id);
      document = response.data ?? null;
      addNotification(`${$_('warehouse.toast.submittedDoc')} ${document?.code}`, 'info');
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.submitDocumentFailed');
      addNotification(`${$_('warehouse.errors.submitFailed')}: ${error}`, 'error');
    } finally {
      saving = false;
    }
  }

  async function approveDoc() {
    if (!document) return;
    try {
      saving = true;
      error = '';
      const response = await approveStockDocument(document.id);
      document = response.data ?? null;
      addNotification(`${$_('warehouse.toast.approvedDoc')} ${document?.code}`, 'success');
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.approveDocumentFailed');
      addNotification(`${$_('warehouse.errors.approveFailed')}: ${error}`, 'error');
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    void loadDetail();
  });

  function printDoc() {
    if (!document) return;
    const theLines = lines.map((l, i) => ({
      stt: i + 1,
      partCode: l.partId,
      partName: `(${l.partId})`,
      qty: l.qty,
      unitCost: l.unitCost ?? undefined,
      total: l.unitCost ? l.qty * l.unitCost : undefined,
      serialNo: l.serialNo ?? undefined,
      note: l.note ?? undefined,
    }));
    const printType = document.docType === 'receipt' ? 'phieu-nhap-kho' : 'phieu-xuat-kho';
    const data = document.docType === 'receipt'
      ? {
          code: document.code,
          date: document.docDate,
          warehouseName: warehouseName || document.warehouseId || 'Kho',
          supplier: document.supplier ?? undefined,
          note: document.note ?? undefined,
          lines: theLines,
          preparedBy: document.submitterName ?? undefined,
          approvedBy: document.approvedBy ?? undefined,
          receivedBy: document.receiverName ?? undefined,
        }
      : {
          code: document.code,
          date: document.docDate,
          warehouseName: warehouseName || document.warehouseId || 'Kho',
          recipient: document.receiverName ?? undefined,
          department: document.department ?? undefined,
          note: document.note ?? undefined,
          lines: theLines,
          preparedBy: document.submitterName ?? undefined,
          approvedBy: document.approvedBy ?? undefined,
        };
    openPrintPage(printType, document.id, data);
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Stock Document' : $_('warehouse.documentDetail')}</h2>
      <p class="text-sm text-slate-500">{document?.code ?? ''}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={printDoc} data-testid="btn-print">
        <Printer class="h-4 w-4 mr-1" /> {$isLoading ? 'Print' : $_('common.print')}
      </Button>
      <Button variant="secondary" onclick={() => goto('/warehouse/documents')}>{$isLoading ? 'Back' : $_('common.back')}</Button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading || !document}
    <div class="flex items-center justify-center py-10">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <!-- ── Header form: compact ERP-style grid ───────────────────────────── -->
    <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">

        <!-- Loại phiếu (read-only) -->
        <div>
          <label for="doc-type" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Document Type' : $_('warehouse.field.docType')}</label>
          <input id="doc-type" class="input-base text-sm" value={document.docType} disabled />
        </div>

        <!-- Trạng thái (read-only) -->
        <div>
          <label for="doc-status" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Status' : $_('warehouse.header.status')}</label>
          <input id="doc-status" class="input-base text-sm" value={statusLabel || document.status} disabled />
        </div>

        <!-- Ngày lập -->
        <div>
          <label for="doc-date" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Date' : $_('warehouse.field.docDate')}</label>
          <input id="doc-date" class="input-base text-sm" type="date" bind:value={docDate} disabled={!isDraft} />
        </div>

        <!-- Kho -->
        <div>
          <label for="doc-warehouse" class="mb-1 block text-xs font-medium text-slate-400">
            {document.docType === 'issue' ? ($isLoading ? 'Source Warehouse' : $_('warehouse.field.sourceWarehouse')) : document.docType === 'transfer' ? ($isLoading ? 'Source Warehouse' : $_('warehouse.field.sourceWarehouse')) : ($isLoading ? 'Warehouse' : $_('warehouse.field.warehouse'))}
          </label>
          <select id="doc-warehouse" class="select-base text-sm" bind:value={warehouseId} disabled={!isDraft}>
            <option value="">{$isLoading ? '-- Select --' : $_('warehouse.field.selectWarehouse')}</option>
            {#each warehouses as wh}
              <option value={wh.id}>{wh.name} ({wh.code})</option>
            {/each}
          </select>
        </div>

        <!-- Kho đích (transfer) -->
        {#if document.docType === 'transfer'}
          <div>
            <label for="doc-target" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Dest. Warehouse' : $_('warehouse.field.destWarehouse')}</label>
            <select id="doc-target" class="select-base text-sm" bind:value={targetWarehouseId} disabled={!isDraft}>
              <option value="">{$isLoading ? '-- Select --' : $_('warehouse.field.selectDestWarehouse')}</option>
              {#each warehouses as wh}
                <option value={wh.id}>{wh.name} ({wh.code})</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- receipt: nhà CC + người nhập -->
        {#if document.docType === 'receipt'}
          <div>
            <label for="doc-supplier" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Supplier' : $_('warehouse.field.supplier')}</label>
            <input id="doc-supplier" class="input-base text-sm" bind:value={supplier} disabled={!isDraft} placeholder={$isLoading ? 'Supplier name...' : $_('warehouse.field.supplierPlaceholder')} />
          </div>
          <div>
            <label for="doc-submitter" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Submitter' : $_('warehouse.field.submitter')}</label>
            <input id="doc-submitter" class="input-base text-sm" bind:value={submitterName} disabled={!isDraft} placeholder={$isLoading ? 'Submitter name...' : $_('warehouse.field.submitterPlaceholder')} />
          </div>
        {/if}

        <!-- issue: người nhận + phòng ban -->
        {#if document.docType === 'issue'}
          <div>
            <label for="doc-receiver" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Receiver' : $_('warehouse.field.receiver')}</label>
            <input id="doc-receiver" class="input-base text-sm" bind:value={receiverName} disabled={!isDraft} placeholder={$isLoading ? 'Receiver name...' : $_('warehouse.field.receiverPlaceholder')} />
          </div>
          <div>
            <label for="doc-dept" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Department' : $_('warehouse.field.department')}</label>
            <input id="doc-dept" class="input-base text-sm" bind:value={department} disabled={!isDraft} placeholder={$isLoading ? 'Department...' : $_('warehouse.field.departmentPlaceholder')} />
          </div>
        {/if}

        <!-- adjust / transfer: bộ phận + người thực hiện -->
        {#if document.docType === 'adjust' || document.docType === 'transfer'}
          <div>
            <label for="doc-dept2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Department' : $_('warehouse.field.department')}</label>
            <input id="doc-dept2" class="input-base text-sm" bind:value={department} disabled={!isDraft} placeholder={$isLoading ? 'Related department...' : $_('warehouse.field.departmentPlaceholder')} />
          </div>
          <div>
            <label for="doc-submitter2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Executor' : $_('warehouse.field.executor')}</label>
            <input id="doc-submitter2" class="input-base text-sm" bind:value={submitterName} disabled={!isDraft} placeholder={$isLoading ? 'Executor name...' : $_('warehouse.field.executorPlaceholder')} />
          </div>
        {/if}

        <!-- Ghi chú -->
        <div class="col-span-2" style="grid-column: span 2">
          <label for="doc-note" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Notes' : $_('common.note')}</label>
          <input id="doc-note" class="input-base text-sm" bind:value={note} disabled={!isDraft} placeholder={$isLoading ? 'Enter notes...' : $_('common.notePlaceholder')} />
        </div>
      </div>
    </div>

    <!-- ── Lines table ───────────────────────────────────────────────────── -->
    <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
      <div class="mb-3 flex items-center gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">{$isLoading ? 'Item Lines' : $_('warehouse.linesHeading')}</h3>
        {#if !isDraft && lines.length > 0}
          <span class="text-xs text-slate-500">{lines.length} {$isLoading ? 'lines' : $_('warehouse.linesCount')}</span>
        {/if}
      </div>
      <StockDocumentLines bind:lines={lines} parts={parts} docType={document.docType} warehouseId={warehouseId} readonly={!isDraft} />
    </div>

    <!-- ── Status timeline + action buttons ─────────────────────────────── -->
    <div class="mt-4 space-y-3">
      <!-- timeline -->
      <div class="flex items-center gap-1">
        {#each statusTimeline as step, i}
          <div class="flex items-center gap-1">
            <div
              class={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                document?.status === 'canceled'
                  ? 'bg-red-900/30 text-red-400'
                  : step.active
                    ? 'bg-primary/20 text-primary'
                    : 'bg-slate-800 text-slate-500'
              }`}
            >
              {step.label}
            </div>
            {#if i < statusTimeline.length - 1}
              <div class={`h-0.5 w-6 ${step.active && statusTimeline[i + 1]?.active ? 'bg-primary' : 'bg-slate-700'}`}></div>
            {/if}
          </div>
        {/each}
        {#if document?.status === 'canceled'}
          <div class="ml-2 rounded-full bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-400">
            {$_('warehouse.docStatus.canceled')}
          </div>
        {/if}
      </div>
      {#if document?.createdAt}
        <p class="text-xs text-slate-500">{$isLoading ? 'Created at:' : $_('warehouse.createdAtLabel')} {new Date(document.createdAt).toLocaleString('vi-VN')}</p>
      {/if}

      <!-- action buttons -->
      <div class="flex flex-wrap justify-end gap-2">
        {#if isDraft}
          <Button variant="secondary" disabled={saving} onclick={cancelDoc}>{$isLoading ? 'Cancel Document' : $_('warehouse.action.cancelDoc')}</Button>
          <Button variant="secondary" disabled={saving} onclick={save}>
            {saving ? '...' : $isLoading ? 'Save Draft' : $_('warehouse.action.saveDraft')}
          </Button>
          <Button disabled={saving} onclick={submitDoc}>
            {saving ? '...' : $isLoading ? 'Submit' : $_('warehouse.action.submit')}
          </Button>
        {:else if isSubmitted}
          <Button variant="secondary" disabled={saving} onclick={cancelDoc}>{$isLoading ? 'Cancel Document' : $_('warehouse.action.cancelDoc')}</Button>
          <Button disabled={saving} onclick={approveDoc}>
            {saving ? '...' : $isLoading ? 'Approve' : $_('warehouse.action.approve')}
          </Button>
        {:else if isApproved}
          <Button variant="secondary" disabled={saving} onclick={cancelDoc}>{$isLoading ? 'Cancel Document' : $_('warehouse.action.cancelDoc')}</Button>
          <Button disabled={saving} onclick={postDoc}>
            {saving ? '...' : $isLoading ? 'Post' : $_('warehouse.action.post')}
          </Button>
        {:else if canCancel}
          <Button variant="secondary" disabled={saving} onclick={cancelDoc}>{$isLoading ? 'Cancel Document' : $_('warehouse.action.cancelDoc')}</Button>
        {/if}
      </div>
    </div>
  {/if}
</div>