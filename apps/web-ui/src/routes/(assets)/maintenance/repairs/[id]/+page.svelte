<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui';
  import { ArrowLeft, RefreshCw, Link2, Printer } from 'lucide-svelte';
  import { openPrintPage } from '$lib/utils/printUtils';
  import {
    addRepairOrderPart,
    changeRepairOrderStatus,
    getRepairOrder,
    listRepairOrderEvents,
    listSpareParts,
    listWarehouses,
    updateRepairOrder,
    type RepairOrderDetail,
    type RepairOrderEvent,
    type RepairOrderRecord,
    type SparePartRecord,
    type WarehouseRecord
  } from '$lib/api/warehouse';
  import {
    repairStatusBadge,
    repairSeverityBadge,
    formatDuration
  } from '$lib/domain/repairs/presenters';
  import { listMaintenanceTickets } from '$lib/api/assetMgmt';
  import type { MaintenanceTicket } from '$lib/api/assets';

  const repairId = $derived(page.params.id);

  let detail = $state<RepairOrderDetail | null>(null);
  let events = $state<RepairOrderEvent[]>([]);
  let warehouses = $state<WarehouseRecord[]>([]);
  let spareParts = $state<SparePartRecord[]>([]);
  let relatedTickets = $state<MaintenanceTicket[]>([]);

  let loading = $state(true);
  let refreshing = $state(false);
  let savingStatus = $state(false);
  let savingOrder = $state(false);
  let addingPart = $state(false);

  let error = $state('');
  let actionError = $state('');
  let actionSuccess = $state('');

  let statusDraft = $state<RepairOrderRecord['status']>('open');

  let diagnosis = $state('');
  let resolution = $state('');
  let technicianName = $state('');
  let laborCost = $state('');
  let downtimeMinutes = $state('');

  let partId = $state('');
  let partName = $state('');
  let warehouseId = $state('');
  let partAction = $state<'replace' | 'add' | 'remove' | 'upgrade'>('replace');
  let partQty = $state('1');
  let partUnitCost = $state('');
  let partSerialNo = $state('');
  let partNote = $state('');

  const order = $derived(detail?.order ?? null);

  const statusLabel: Record<string, string> = {
    open: 'Mở',
    diagnosing: 'Đang chẩn đoán',
    waiting_parts: 'Chờ linh kiện',
    repaired: 'Đã sửa xong',
    closed: 'Đã đóng',
    canceled: 'Đã hủy'
  };
  const severityLabel: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng'
  };
  const repairTypeLabel: Record<string, string> = {
    internal: 'Nội bộ',
    vendor: 'Nhà thầu'
  };
  const actionLabel: Record<string, string> = {
    replace: 'Thay thế',
    add: 'Thêm mới',
    remove: 'Tháo ra',
    upgrade: 'Nâng cấp'
  };
  const ticketStatusLabel: Record<string, string> = {
    open: 'Mở',
    in_progress: 'Đang xử lý',
    resolved: 'Đã giải quyết',
    closed: 'Đã đóng'
  };
  const ticketSeverityLabel: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng'
  };

  function hydrateOrderForm() {
    if (!detail) return;
    statusDraft = detail.order.status;
    diagnosis = detail.order.diagnosis ?? '';
    resolution = detail.order.resolution ?? '';
    technicianName = detail.order.technicianName ?? '';
    laborCost = detail.order.laborCost == null ? '' : String(detail.order.laborCost);
    downtimeMinutes = detail.order.downtimeMinutes == null ? '' : String(detail.order.downtimeMinutes);
  }

  function resetPartForm() {
    partId = '';
    partName = '';
    warehouseId = '';
    partAction = 'replace';
    partQty = '1';
    partUnitCost = '';
    partSerialNo = '';
    partNote = '';
  }

  function parseOptionalNumber(raw: string | number, label: string): number | undefined {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error(`${label} khong hop le`);
    return numeric;
  }

  function parseOptionalInt(raw: string | number, label: string): number | undefined {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (!Number.isInteger(numeric) || numeric < 0) throw new Error(`${label} khong hop le`);
    return numeric;
  }

  function parsePositiveInt(raw: string | number, label: string): number {
    const numeric = Number(String(raw ?? '').trim());
    if (!Number.isInteger(numeric) || numeric <= 0) throw new Error(`${label} khong hop le`);
    return numeric;
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  function formatMoney(value: number | null | undefined) {
    if (value == null) return '-';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  function getWarehouseLabel(id: string | null | undefined) {
    if (!id) return '-';
    const found = warehouses.find((item) => item.id === id);
    return found ? `${found.code} - ${found.name}` : id;
  }

  function getPartLabel(id: string | null | undefined) {
    if (!id) return '-';
    const found = spareParts.find((item) => item.id === id);
    return found ? `${found.partCode} - ${found.name}` : id;
  }

  async function loadDetailData() {
    if (!repairId) return;
    const [detailResp, eventsResp] = await Promise.all([
      getRepairOrder(repairId),
      listRepairOrderEvents(repairId, { limit: 50 }).catch(() => ({ data: [] as RepairOrderEvent[] }))
    ]);
    detail = detailResp.data ?? null;
    events = eventsResp.data ?? [];
    hydrateOrderForm();

    // Load related tickets for same asset (client-side filter)
    if (detail?.order?.assetId) {
      const ticketResp = await listMaintenanceTickets({ limit: 200 }).catch(() => ({ data: [] as MaintenanceTicket[] }));
      relatedTickets = (ticketResp.data ?? []).filter(t => t.assetId === detail!.order.assetId);
    }
  }

  async function loadOptions() {
    const [warehouseResp, partResp] = await Promise.all([
      listWarehouses().catch(() => ({ data: [] as WarehouseRecord[] })),
      listSpareParts({ limit: 200 }).catch(() => ({ data: [] as SparePartRecord[] }))
    ]);
    warehouses = warehouseResp.data ?? [];
    spareParts = partResp.data ?? [];
  }

  async function loadPage(showSpinner = true) {
    try {
      if (showSpinner) loading = true;
      error = '';
      await Promise.all([loadDetailData(), loadOptions()]);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Khong the tai chi tiet repair order';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function handleRefresh() {
    try {
      refreshing = true;
      actionError = '';
      actionSuccess = '';
      await loadPage(false);
    } catch {
      refreshing = false;
    }
  }

  async function handleStatusChange() {
    if (!order) return;
    try {
      savingStatus = true;
      actionError = '';
      actionSuccess = '';
      await changeRepairOrderStatus(order.id, statusDraft);
      actionSuccess = 'Da cap nhat trang thai';
      await loadPage(false);
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Khong the cap nhat trang thai';
    } finally {
      savingStatus = false;
    }
  }

  async function handleSaveOrder() {
    if (!order) return;
    try {
      savingOrder = true;
      actionError = '';
      actionSuccess = '';
      await updateRepairOrder(order.id, {
        diagnosis: diagnosis.trim() || null,
        resolution: resolution.trim() || null,
        technicianName: technicianName.trim() || null,
        laborCost: parseOptionalNumber(laborCost, 'Labor cost'),
        downtimeMinutes: parseOptionalInt(downtimeMinutes, 'Downtime minutes')
      });
      actionSuccess = 'Da luu thong tin work order';
      await loadPage(false);
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Khong the luu work order';
    } finally {
      savingOrder = false;
    }
  }

  async function handleAddPart() {
    if (!order) return;
    try {
      if (!partId && !partName.trim()) throw new Error('Chon part hoac nhap ten part');
      if (partId && !warehouseId)       throw new Error('Chon kho cho stocked part');

      addingPart = true;
      actionError = '';
      actionSuccess = '';
      await addRepairOrderPart(order.id, {
        partId: partId || undefined,
        partName: partName.trim() || undefined,
        warehouseId: warehouseId || undefined,
        action: partAction,
        qty: parsePositiveInt(partQty, 'So luong'),
        unitCost: parseOptionalNumber(partUnitCost, 'Unit cost'),
        serialNo: partSerialNo.trim() || undefined,
        note: partNote.trim() || undefined
      });
      actionSuccess = 'Da them linh kien';
      resetPartForm();
      await loadPage(false);
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Khong the them linh kien';
    } finally {
      addingPart = false;
    }
  }

  onMount(() => { void loadPage(true); });

  function printRepairOrder() {
    if (!detail?.order) return;
    const o = detail.order;
    openPrintPage('lenh-sua-chua', o.id, {
      code: o.code,
      date: o.openedAt.slice(0, 10),
      asset: {
        code: o.assetId,
        name: o.title,
        serialNo: undefined,
        category: undefined,
        location: undefined,
      },
      issueDescription: o.description ?? o.title,
      severity: o.severity,
      diagnosis: o.diagnosis ?? undefined,
      resolution: o.resolution ?? undefined,
      technicianName: o.technicianName ?? undefined,
      repairType: o.repairType,
      vendorName: undefined,
      status: o.status,
      laborCost: o.laborCost ?? undefined,
      partsCost: o.partsCost ?? undefined,
      parts: (detail.parts ?? []).map((p) => ({
        name: p.partName ?? `(part ${p.partId})`,
        action: p.action,
        qty: p.qty,
        unitCost: p.unitCost ?? undefined,
        serialNo: p.serialNo ?? undefined,
        note: p.note ?? undefined,
      })),
      openedAt: o.openedAt.slice(0, 10),
      closedAt: o.closedAt?.slice(0, 10) ?? undefined,
      downtime: o.downtimeMinutes ?? undefined,
      note: undefined,
    });
  }
</script>

<div class="space-y-5">
  <!-- ── Top bar ───────────────────────────────────────────────── -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <Button variant="secondary" size="sm" data-testid="repair-detail-back" onclick={() => goto('/maintenance/repairs')}>
        <ArrowLeft class="w-4 h-4 mr-1" /> Đơn sửa chữa
      </Button>
      <h2 class="text-lg font-semibold text-slate-100">Chi tiết đơn sửa chữa</h2>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="secondary" size="sm" onclick={printRepairOrder} disabled={!detail}>
        <Printer class="w-4 h-4 mr-1" /> In lệnh sửa chữa
      </Button>
      <Button variant="secondary" size="sm" data-testid="repair-detail-refresh" onclick={handleRefresh} disabled={refreshing}>
        <RefreshCw class="w-4 h-4 mr-1 {refreshing ? 'animate-spin' : ''}" />
        {refreshing ? 'Đang làm mới...' : 'Làm mới'}
      </Button>
    </div>
  </div>

  <!-- ── Alerts ─────────────────────────────────────────────────── -->
  {#if error}
    <div class="alert alert-error" data-testid="repair-detail-error">{error}</div>
  {/if}
  {#if actionError}
    <div class="alert alert-error" data-testid="repair-action-error">{actionError}</div>
  {/if}
  {#if actionSuccess}
    <div class="alert alert-success" data-testid="repair-action-success">{actionSuccess}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
    </div>
  {:else if detail}
    <!-- ── Summary card ───────────────────────────────────────────── -->
    <div class="card flex flex-col" data-testid="repair-detail-summary">
      <div class="card-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-mono text-slate-400 mb-0.5">{detail.order.code}</p>
          <h3 class="text-base font-semibold text-slate-100 leading-snug">{detail.order.title}</h3>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge {repairStatusBadge[detail.order.status] ?? 'badge-gray'}" data-testid="repair-detail-status-badge">
            {statusLabel[detail.order.status] ?? detail.order.status}
          </span>
          <span class="badge {repairSeverityBadge[detail.order.severity] ?? 'badge-gray'}" data-testid="repair-detail-severity-badge">
            {severityLabel[detail.order.severity] ?? detail.order.severity}
          </span>
        </div>
      </div>
      <div class="card-body">
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Tài sản</dt>
            <dd class="font-mono text-xs text-slate-200">{detail.order.assetId}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Loại sửa chữa</dt>
            <dd class="font-medium text-slate-200">{repairTypeLabel[detail.order.repairType] ?? detail.order.repairType}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Ngày mở</dt>
            <dd class="font-medium text-slate-200">{formatDate(detail.order.openedAt)}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Ngày đóng</dt>
            <dd class="font-medium text-slate-200">{formatDate(detail.order.closedAt)}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Chi phí nhân công</dt>
            <dd class="font-medium text-slate-200">{formatMoney(detail.order.laborCost)}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Chi phí linh kiện</dt>
            <dd class="font-medium text-slate-200">{formatMoney(detail.order.partsCost)}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Kỹ thuật viên</dt>
            <dd class="font-medium text-slate-200">{detail.order.technicianName || '-'}</dd>
          </div>
          <div>
            <dt class="text-slate-400 text-xs mb-0.5">Downtime</dt>
            <dd class="font-medium text-slate-200">
              {detail.order.downtimeMinutes != null ? formatDuration(detail.order.downtimeMinutes) : '-'}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- ── Related maintenance tickets ───────────────────────────── -->
    {#if relatedTickets.length > 0}
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Link2 class="h-4 w-4 text-blue-400" />
            <h3 class="font-semibold text-slate-100">Phiếu bảo trì liên quan</h3>
          </div>
          <span class="text-sm text-slate-400">{relatedTickets.length} phiếu (cùng tài sản)</span>
        </div>
        <div class="card-body p-0">
          <div class="data-table-wrap">
            <div class="data-table-scroll">
              <table class="data-table" data-testid="repair-related-tickets-table">
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th>Mức độ</th>
                    <th>Ngày mở</th>
                  </tr>
                </thead>
                <tbody>
                  {#each relatedTickets as ticket (ticket.id)}
                    <tr>
                      <td class="text-slate-100">{ticket.title}</td>
                      <td>
                        <span class="badge badge-blue">{ticketStatusLabel[ticket.status] ?? ticket.status}</span>
                      </td>
                      <td>
                        <span class="badge badge-orange">{ticketSeverityLabel[ticket.severity] ?? ticket.severity}</span>
                      </td>
                      <td class="text-slate-400">{formatDate(ticket.openedAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── 2-column action cards ──────────────────────────────────── -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">

      <!-- Left: Update repair order -->
      <div class="card flex flex-col">
        <div class="card-header">
          <h3 class="font-semibold text-slate-100">Cập nhật đơn sửa chữa</h3>
        </div>
        <div class="card-body flex-1 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="label-base" for="repair-status-select">Trạng thái</label>
              <select class="select-base mt-1" id="repair-status-select" data-testid="repair-status-select" bind:value={statusDraft}>
                <option value="open">Mở</option>
                <option value="diagnosing">Đang chẩn đoán</option>
                <option value="waiting_parts">Chờ linh kiện</option>
                <option value="repaired">Đã sửa xong</option>
                <option value="closed">Đã đóng</option>
                <option value="canceled">Đã hủy</option>
              </select>
            </div>
            <div>
              <label class="label-base" for="repair-tech-input">Kỹ thuật viên</label>
              <input class="input-base mt-1" id="repair-tech-input" data-testid="repair-tech-input" bind:value={technicianName} placeholder="Tên kỹ thuật viên" />
            </div>
            <div>
              <label class="label-base" for="repair-labor-cost-input">Chi phí nhân công (VNĐ)</label>
              <input class="input-base mt-1" id="repair-labor-cost-input" data-testid="repair-labor-cost-input" type="number" min="0" step="1000" bind:value={laborCost} placeholder="0" />
            </div>
            <div>
              <label class="label-base" for="repair-downtime-input">Phút ngừng hoạt động</label>
              <input class="input-base mt-1" id="repair-downtime-input" data-testid="repair-downtime-input" type="number" min="0" step="1" bind:value={downtimeMinutes} placeholder="0" />
            </div>
          </div>
          <div>
            <label class="label-base" for="repair-diagnosis-input">Chẩn đoán</label>
            <textarea
              id="repair-diagnosis-input"
              data-testid="repair-diagnosis-input"
              class="textarea-base mt-1"
              rows="3"
              bind:value={diagnosis}
              placeholder="Mô tả tình trạng hư hỏng..."
            ></textarea>
          </div>
          <div>
            <label class="label-base" for="repair-resolution-input">Giải pháp</label>
            <textarea
              id="repair-resolution-input"
              data-testid="repair-resolution-input"
              class="textarea-base mt-1"
              rows="3"
              bind:value={resolution}
              placeholder="Mô tả giải pháp đã thực hiện..."
            ></textarea>
          </div>
        </div>
        <div class="card-footer flex justify-end gap-2">
          <Button variant="secondary" size="sm" data-testid="repair-status-submit" onclick={handleStatusChange} disabled={savingStatus}>
            {savingStatus ? 'Đang cập nhật...' : 'Đổi trạng thái'}
          </Button>
          <Button size="sm" data-testid="repair-save-order" onclick={handleSaveOrder} disabled={savingOrder}>
            {savingOrder ? 'Đang lưu...' : 'Lưu thông tin'}
          </Button>
        </div>
      </div>

      <!-- Right: Add parts -->
      <div class="card flex flex-col">
        <div class="card-header">
          <h3 class="font-semibold text-slate-100">Thêm linh kiện / vật tư</h3>
        </div>
        <div class="card-body flex-1 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="label-base" for="repair-part-id">Linh kiện dự phòng (tuỳ chọn)</label>
              <select class="select-base mt-1" id="repair-part-id" data-testid="repair-part-id" bind:value={partId}>
                <option value="">Không chọn — nhập tên tự do</option>
                {#each spareParts as part}
                  <option value={part.id}>{part.partCode} - {part.name}</option>
                {/each}
              </select>
            </div>
            <div class="sm:col-span-2">
              <label class="label-base" for="repair-part-name">Tên linh kiện (tự nhập)</label>
              <input class="input-base mt-1" id="repair-part-name" data-testid="repair-part-name" bind:value={partName} placeholder="Dùng khi không có mã linh kiện" />
            </div>
            <div>
              <label class="label-base" for="repair-part-warehouse">Kho hàng</label>
              <select class="select-base mt-1" id="repair-part-warehouse" data-testid="repair-part-warehouse" bind:value={warehouseId}>
                <option value="">Chọn kho</option>
                {#each warehouses as wh}
                  <option value={wh.id}>{wh.code} - {wh.name}</option>
                {/each}
              </select>
            </div>
            <div>
              <label class="label-base" for="repair-part-action">Hành động</label>
              <select class="select-base mt-1" id="repair-part-action" data-testid="repair-part-action" bind:value={partAction}>
                <option value="replace">Thay thế</option>
                <option value="add">Thêm mới</option>
                <option value="remove">Tháo ra</option>
                <option value="upgrade">Nâng cấp</option>
              </select>
            </div>
            <div>
              <label class="label-base" for="repair-part-qty">Số lượng</label>
              <input class="input-base mt-1" id="repair-part-qty" data-testid="repair-part-qty" type="number" min="1" step="1" bind:value={partQty} />
            </div>
            <div>
              <label class="label-base" for="repair-part-unit-cost">Đơn giá (VNĐ)</label>
              <input class="input-base mt-1" id="repair-part-unit-cost" data-testid="repair-part-unit-cost" type="number" min="0" step="1000" bind:value={partUnitCost} placeholder="0" />
            </div>
            <div>
              <label class="label-base" for="repair-part-serial">Số Serial</label>
              <input class="input-base mt-1" id="repair-part-serial" data-testid="repair-part-serial" bind:value={partSerialNo} placeholder="Tuỳ chọn" />
            </div>
            <div>
              <label class="label-base" for="repair-part-note">Ghi chú</label>
              <input class="input-base mt-1" id="repair-part-note" data-testid="repair-part-note" bind:value={partNote} placeholder="Tuỳ chọn" />
            </div>
          </div>
        </div>
        <div class="card-footer flex justify-end gap-2">
          <Button variant="secondary" size="sm" data-testid="repair-part-clear" onclick={resetPartForm} disabled={addingPart}>
            Xóa form
          </Button>
          <Button size="sm" data-testid="repair-part-submit" onclick={handleAddPart} disabled={addingPart}>
            {addingPart ? 'Đang thêm...' : 'Thêm linh kiện'}
          </Button>
        </div>
      </div>
    </div>

    <!-- ── Parts table ────────────────────────────────────────────── -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-100">Linh kiện đã ghi nhận</h3>
        <span class="text-sm text-slate-400">{detail.parts.length} dòng</span>
      </div>
      <div class="card-body p-0">
        {#if detail.parts.length === 0}
          <div class="empty-state py-10">
            <p class="empty-state-desc">Chưa có linh kiện nào được ghi nhận</p>
          </div>
        {:else}
          <div class="data-table-wrap">
            <div class="data-table-scroll">
              <table class="data-table" data-testid="repair-parts-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                    <th>Linh kiện</th>
                    <th>Kho</th>
                    <th class="text-right">SL</th>
                    <th class="text-right">Đơn giá</th>
                    <th>Serial</th>
                    <th>Ghi chú</th>
                    <th>Phiếu kho</th>
                  </tr>
                </thead>
                <tbody>
                  {#each detail.parts as part}
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="cell-mono text-xs">{formatDate(part.createdAt)}</td>
                      <td>{actionLabel[part.action] ?? part.action}</td>
                      <td>{part.partId ? getPartLabel(part.partId) : (part.partName || '-')}</td>
                      <td>{getWarehouseLabel(part.warehouseId)}</td>
                      <td class="text-right cell-mono">{part.qty}</td>
                      <td class="text-right cell-mono">{formatMoney(part.unitCost)}</td>
                      <td class="cell-mono text-xs">{part.serialNo || '-'}</td>
                      <td class="text-slate-400">{part.note || '-'}</td>
                      <td>
                        {#if part.stockDocumentId}
                          <a class="text-blue-400 hover:text-blue-300 hover:underline transition-colors" href={`/warehouse/documents/${part.stockDocumentId}`}>
                            {part.stockDocumentId}
                          </a>
                        {:else}
                          <span class="text-slate-500">-</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Event log ──────────────────────────────────────────────── -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-100">Nhật ký sự kiện</h3>
        <span class="text-sm text-slate-400">{events.length} sự kiện</span>
      </div>
      <div class="card-body space-y-2">
        {#if events.length === 0}
          <p class="text-sm text-slate-500">Không có sự kiện nào</p>
        {:else}
          {#each events as event}
            <div class="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p class="text-sm font-medium text-slate-200">{event.eventType}</p>
                <p class="text-xs text-slate-500 cell-mono">{formatDate(event.createdAt)}</p>
              </div>
              <pre class="overflow-auto rounded bg-slate-900/70 px-3 py-2 text-xs text-slate-300 leading-relaxed">{JSON.stringify(event.payload ?? {}, null, 2)}</pre>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
