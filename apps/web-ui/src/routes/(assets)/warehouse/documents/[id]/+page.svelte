<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { _, isLoading } from '$lib/i18n';
  import { Printer } from 'lucide-svelte';
  import { PrintDialog } from '$lib/components/print';
  import { addNotification } from '$lib/stores/notifications';
  import StockDocumentLines from '$lib/warehouse/StockDocumentLines.svelte';
  import {
    approveStockDocument,
    cancelStockDocument,
    deleteStockDocAttachment,
    getStockDocument,
    getStockDocAttachmentUrl,
    listSpareParts,
    listStockDocAttachments,
    listWarehouses,
    listOrgUnits,
    postStockDocument,
    submitStockDocument,
    updateStockDocument,
    uploadStockDocAttachment,
    type OpsAttachment,
    type OrgUnitOption,
    type SparePartRecord,
    type StockDocumentLine,
    type StockDocumentRecord,
    type WarehouseRecord
  } from '$lib/api/warehouse';
  import FileGallery from '$lib/components/FileGallery.svelte';
  import { getAssetCatalogs, type AssetCategory } from '$lib/api/assetCatalogs';

  const docId = $derived(page.params.id ?? '');

  let document = $state<StockDocumentRecord | null>(null);
  let lines = $state<StockDocumentLine[]>([]);
  let warehouses = $state<WarehouseRecord[]>([]);
  let parts = $state<SparePartRecord[]>([]);

  type ModelOption = { id: string; name: string; categoryName?: string | null; categoryItemType?: string | null };
  let models = $state<ModelOption[]>([]);
  let assetCats = $state<AssetCategory[]>([]);

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let showPrintDialog = $state(false);

  let warehouseId = $state('');
  let targetWarehouseId = $state('');
  let docDate = $state('');
  let note = $state('');
  // Extended header fields
  let supplier = $state('');
  let submitterName = $state('');
  let receiverName = $state('');
  let recipientOuId = $state('');
  let orgUnits = $state<OrgUnitOption[]>([]);

  let attachments = $state<OpsAttachment[]>([])
  let attachmentsLoading = $state(false)

  const isDraft = $derived(document?.status === 'draft');
  const isSubmitted = $derived(document?.status === 'submitted');
  // Header fields (warehouse, date, note, receiver) editable in draft AND submitted.
  // Submitted docs auto-generated from workflow need the warehouse set before posting.
  const canEditHeader = $derived(isDraft || isSubmitted);
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

  const printDocType = $derived.by(() => {
    if (!document) return 'warehouse_issue';
    return document.docType === 'receipt' ? 'warehouse_receipt' : 'warehouse_issue';
  });

  const printSourceData = $derived.by(() => {
    if (!document) return {};
    return {
      ...document,
      warehouseName,
      targetWarehouseName,
      lines: lines.map((line, idx) => ({
        ...line,
        index: idx + 1,
        lineTotal: line.unitCost ? line.unitCost * line.qty : null
      }))
    };
  });

  async function loadAttachments() {
    if (!docId) return;
    attachmentsLoading = true;
    try {
      attachments = await listStockDocAttachments(docId);
    } catch { /* non-critical */ } finally {
      attachmentsLoading = false;
    }
  }

  async function handleAttachmentUpload(file: File) {
    await uploadStockDocAttachment(docId, file);
    await loadAttachments();
  }

  async function handleAttachmentDelete(attachmentId: string) {
    await deleteStockDocAttachment(docId, attachmentId);
    await loadAttachments();
  }

  async function loadDetail() {
    if (!docId) {
      loading = false;
      error = $_('warehouse.errors.loadDocumentFailed');
      return;
    }

    try {
      loading = true;
      error = '';
      const [detailResponse, warehouseResponse, partsResponse, orgUnitsResponse, catalogsResponse] = await Promise.all([
        getStockDocument(docId),
        listWarehouses(),
        listSpareParts({ page: 1, limit: 200 }),
        listOrgUnits(),
        getAssetCatalogs()
      ]);
      document = detailResponse.data.document;
      lines = detailResponse.data.lines ?? [];
      warehouses = warehouseResponse.data ?? [];
      parts = partsResponse.data ?? [];
      orgUnits = orgUnitsResponse.data ?? [];
      const allCats = catalogsResponse.data?.categories ?? [];
      const categoryById = Object.fromEntries(allCats.map(c => [c.id, c]));
      assetCats = allCats.filter(c => !c.itemType || c.itemType === 'asset');
      models = (catalogsResponse.data?.models ?? []).map(m => {
        const cat = m.categoryId ? categoryById[m.categoryId] : null;
        return { id: m.id, name: m.model, categoryName: cat?.name ?? null, categoryItemType: cat?.itemType ?? 'asset' };
      });
      warehouseId = document.warehouseId ?? '';
      targetWarehouseId = document.targetWarehouseId ?? '';
      docDate = document.docDate;
      note = document.note ?? '';
      supplier = document.supplier ?? '';
      submitterName = document.submitterName ?? '';
      receiverName = document.receiverName ?? '';
      recipientOuId = document.recipientOuId ?? '';
    } catch (err) {
      error = err instanceof Error ? err.message : $_('warehouse.errors.loadDocumentFailed');
    } finally {
      loading = false;
    }
    void loadAttachments();
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
        recipientOuId: recipientOuId || null,
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
      // Auto-save header (warehouse, receiver, etc.) before approving
      if (isSubmitted) {
        const saved = await updateStockDocument(document.id, {
          docDate, note: note || null,
          warehouseId: warehouseId || null,
          targetWarehouseId: document.docType === 'transfer' ? (targetWarehouseId || null) : null,
          supplier: supplier || null, submitterName: submitterName || null,
          receiverName: receiverName || null, recipientOuId: recipientOuId || null,
          lines
        });
        document = saved.data.document;
      }
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
    showPrintDialog = true;
  }

  function handlePrintExport(format: string) {
    addNotification(
      `${$isLoading ? 'Exported' : $_('assets.print.exportSuccess')} (${format.toUpperCase()})`,
      'success'
    );
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
          <input id="doc-date" class="input-base text-sm" type="date" bind:value={docDate} disabled={!canEditHeader} />
        </div>

        <!-- Kho -->
        <div>
          <label for="doc-warehouse" class="mb-1 block text-xs font-medium text-slate-400">
            {document.docType === 'issue' ? ($isLoading ? 'Source Warehouse' : $_('warehouse.field.sourceWarehouse')) : document.docType === 'transfer' ? ($isLoading ? 'Source Warehouse' : $_('warehouse.field.sourceWarehouse')) : ($isLoading ? 'Warehouse' : $_('warehouse.field.warehouse'))}
          </label>
          <select id="doc-warehouse" class="select-base text-sm" bind:value={warehouseId} disabled={!canEditHeader}>
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
            <select id="doc-target" class="select-base text-sm" bind:value={targetWarehouseId} disabled={!canEditHeader}>
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
            <input id="doc-supplier" class="input-base text-sm" bind:value={supplier} disabled={!canEditHeader} placeholder={$isLoading ? 'Supplier name...' : $_('warehouse.field.supplierPlaceholder')} />
          </div>
          <div>
            <label for="doc-submitter" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Submitter' : $_('warehouse.field.submitter')}</label>
            <input id="doc-submitter" class="input-base text-sm" bind:value={submitterName} disabled={!canEditHeader} placeholder={$isLoading ? 'Submitter name...' : $_('warehouse.field.submitterPlaceholder')} />
          </div>
        {/if}

        <!-- issue: người nhận + nơi nhận (OU) -->
        {#if document.docType === 'issue'}
          <div>
            <label for="doc-receiver" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Receiver' : $_('warehouse.field.receiver')}</label>
            <input id="doc-receiver" class="input-base text-sm" bind:value={receiverName} disabled={!canEditHeader} placeholder={$isLoading ? 'Receiver name...' : $_('warehouse.field.receiverPlaceholder')} />
          </div>
          <div>
            <label for="doc-ou" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Recipient' : $_('warehouse.field.department')}</label>
            {#if isDraft}
              <select id="doc-ou" class="select-base text-sm" bind:value={recipientOuId}>
                <option value="">{$isLoading ? '-- No recipient --' : $_('warehouse.field.noRecipientOu')}</option>
                {#each orgUnits as ou}
                  <option value={ou.id}>{'　'.repeat(ou.depth)}{ou.name}</option>
                {/each}
              </select>
            {:else}
              <input class="input-base text-sm" disabled value={orgUnits.find(o => o.id === recipientOuId)?.path ?? document.department ?? ''} />
            {/if}
          </div>
        {/if}

        <!-- adjust / transfer: nơi nhận + người thực hiện -->
        {#if document.docType === 'adjust' || document.docType === 'transfer'}
          <div>
            <label for="doc-ou2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Recipient' : $_('warehouse.field.department')}</label>
            {#if isDraft}
              <select id="doc-ou2" class="select-base text-sm" bind:value={recipientOuId}>
                <option value="">{$isLoading ? '-- No recipient --' : $_('warehouse.field.noRecipientOu')}</option>
                {#each orgUnits as ou}
                  <option value={ou.id}>{'　'.repeat(ou.depth)}{ou.name}</option>
                {/each}
              </select>
            {:else}
              <input class="input-base text-sm" disabled value={orgUnits.find(o => o.id === recipientOuId)?.path ?? document.department ?? ''} />
            {/if}
          </div>
          <div>
            <label for="doc-submitter2" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Executor' : $_('warehouse.field.executor')}</label>
            <input id="doc-submitter2" class="input-base text-sm" bind:value={submitterName} disabled={!canEditHeader} placeholder={$isLoading ? 'Executor name...' : $_('warehouse.field.executorPlaceholder')} />
          </div>
        {/if}

        <!-- Ghi chú -->
        <div class="col-span-2" style="grid-column: span 2">
          <label for="doc-note" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Notes' : $_('common.note')}</label>
          <input id="doc-note" class="input-base text-sm" bind:value={note} disabled={!canEditHeader} placeholder={$isLoading ? 'Enter notes...' : $_('common.notePlaceholder')} />
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
      <StockDocumentLines bind:lines={lines} parts={parts} {models} assetCategories={assetCats} docType={document.docType} warehouseId={warehouseId} readonly={!isDraft} />
    </div>

    <!-- ── Attachments (invoices, delivery notes, photos) ───────────────── -->
    <div class="rounded-xl border border-slate-700 bg-slate-900/40 px-5 py-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {$isLoading ? 'Đính kèm (hóa đơn, phiếu giao hàng...)' : $_('fileGallery.sectionTitle')}
      </h3>
      <FileGallery
        attachments={attachments}
        loading={attachmentsLoading}
        readonly={!isDraft}
        getDownloadUrl={(id) => getStockDocAttachmentUrl(docId, id)}
        onUpload={isDraft ? handleAttachmentUpload : undefined}
        onDelete={isDraft ? handleAttachmentDelete : undefined}
      />
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
          <Button variant="secondary" disabled={saving} onclick={save}>
            {saving ? '...' : $isLoading ? 'Save' : $_('warehouse.action.saveDraft')}
          </Button>
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

<PrintDialog
  bind:isOpen={showPrintDialog}
  docType={printDocType}
  recordId={document?.id}
  sourceData={printSourceData}
  onClose={() => (showPrintDialog = false)}
  onExport={(format) => handlePrintExport(format)}
/>