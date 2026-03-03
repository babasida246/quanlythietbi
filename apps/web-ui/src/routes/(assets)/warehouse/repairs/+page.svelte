<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button, StatsCard, MiniStat, BreakdownCard } from '$lib/components/ui';
  import { Plus, RefreshCw, Wrench } from 'lucide-svelte';
  import { listAssets, type Asset } from '$lib/api/assets';
  import {
    createRepairOrder,
    getRepairOrderSummary,
    listRepairOrders,
    type RepairOrderRecord,
    type RepairOrderSummary
  } from '$lib/api/warehouse';
  import {
    repairStatusLabel,
    repairStatusBadge,
    repairStatusTone,
    repairSeverityLabel,
    repairSeverityBadge,
    repairSeverityTone,
    repairTypeLabel,
    formatCurrencyVND,
    formatNumber,
    formatDuration,
    formatDate,
  } from '$lib/domain/repairs/presenters';

  let repairs = $state<RepairOrderRecord[]>([]);
  let assets  = $state<Asset[]>([]);
  let summary = $state<RepairOrderSummary | null>(null);
  let loading    = $state(true);
  let createOpen = $state(false);
  let creating   = $state(false);
  let error      = $state('');
  let createError = $state('');
  let meta = $state({ total: 0, page: 1, limit: 20 });

  // ── Filters ──────────────────────────────────────────────────────────────
  let q      = $state('');
  let status = $state<'' | RepairOrderRecord['status']>('');

  // ── Create form ──────────────────────────────────────────────────────────
  let assetId       = $state('');
  let title         = $state('');
  let description   = $state('');
  let severity      = $state<RepairOrderRecord['severity']>('medium');
  let repairType    = $state<RepairOrderRecord['repairType']>('internal');
  let technicianName = $state('');
  let laborCost      = $state('');
  let downtimeMinutes = $state('');

  const statusOrder: RepairOrderRecord['status'][]   = ['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled'];
  const severityOrder: RepairOrderRecord['severity'][] = ['low', 'medium', 'high', 'critical'];
  const repairTypeOrder: RepairOrderRecord['repairType'][] = ['internal', 'vendor'];

  const assetOptions = $derived.by(() =>
    assets.map((a) => ({ value: a.id, label: `${a.assetCode} (${a.status})` }))
  );

  function resetCreateForm() {
    assetId = ''; title = ''; description = ''; severity = 'medium';
    repairType = 'internal'; technicianName = ''; laborCost = '';
    downtimeMinutes = ''; createError = '';
  }

  function parseOptionalNumber(raw: string | number, label: string): number | undefined {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} không hợp lệ`);
    return n;
  }
  function parseOptionalInt(raw: string | number, label: string): number | undefined {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${label} không hợp lệ`);
    return n;
  }

  async function loadData(page = 1) {
    try {
      loading = true; error = ''; summary = null;
      const [repairResp, summaryResp, assetsResp] = await Promise.all([
        listRepairOrders({ q: q.trim() || undefined, status: status || undefined, page, limit: meta.limit }),
        getRepairOrderSummary({ q: q.trim() || undefined, status: status || undefined }),
        listAssets({ limit: 200 }).catch(() => ({ data: [] as Asset[] })),
      ]);
      repairs = repairResp.data ?? [];
      summary = summaryResp.data ?? null;
      assets  = assetsResp.data ?? [];
      meta = {
        total: repairResp.meta?.total ?? repairs.length,
        page:  repairResp.meta?.page  ?? page,
        limit: repairResp.meta?.limit ?? meta.limit,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Không thể tải danh sách đơn sửa chữa';
    } finally {
      loading = false;
    }
  }

  async function submitCreate() {
    try {
      if (!assetId)     throw new Error('Chọn tài sản');
      if (!title.trim()) throw new Error('Nhập tiêu đề');
      creating = true; createError = '';
      await createRepairOrder({
        assetId, title: title.trim(),
        description: description.trim() || undefined,
        severity, repairType,
        technicianName:  technicianName.trim() || undefined,
        laborCost:       parseOptionalNumber(laborCost, 'Chi phí nhân công'),
        downtimeMinutes: parseOptionalInt(downtimeMinutes, 'Phút ngừng hoạt động'),
      });
      createOpen = false;
      resetCreateForm();
      await loadData(1);
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Không thể tạo đơn sửa chữa';
    } finally {
      creating = false;
    }
  }

  function getAssetLabel(id: string | null | undefined) {
    if (!id) return '—';
    const a = assets.find((x) => x.id === id);
    return a ? a.assetCode : id;
  }

  // ── Derived BreakdownCard items ──────────────────────────────────────────
  const statusBreakdown = $derived.by(() =>
    summary
      ? statusOrder.map((s) => ({
          label:   repairStatusLabel[s] ?? s,
          value:   summary!.byStatus[s] ?? 0,
          tone:    repairStatusTone[s] ?? 'gray',
        }))
      : []
  );
  const severityBreakdown = $derived.by(() =>
    summary
      ? severityOrder.map((s) => ({
          label: repairSeverityLabel[s] ?? s,
          value: summary!.bySeverity[s] ?? 0,
          tone:  repairSeverityTone[s] ?? 'gray',
        }))
      : []
  );
  const typeBreakdown = $derived.by(() =>
    summary
      ? repairTypeOrder.map((t) => ({
          label: repairTypeLabel[t] ?? t,
          value: summary!.byType[t] ?? 0,
          tone:  'blue',
        }))
      : []
  );

  const totalPages = $derived(Math.max(1, Math.ceil(meta.total / meta.limit)));

  onMount(() => { void loadData(1); });
</script>

<div class="page-shell page-content py-4">

  <!-- ══ HEADER ══════════════════════════════════════════════════════════════ -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-slate-100 md:text-2xl">Đơn Sửa Chữa</h2>
      <p class="mt-0.5 text-sm text-slate-400">{meta.total} đơn</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" size="sm" data-testid="repairs-refresh" onclick={() => loadData(meta.page)}>
        <RefreshCw class="h-4 w-4" />
      </Button>
      <Button data-testid="repairs-create-toggle" onclick={() => { createOpen = !createOpen; if (!createOpen) resetCreateForm(); }}>
        <Plus class="mr-1.5 h-4 w-4" /> {createOpen ? 'Thu gọn' : 'Tạo đơn sửa chữa'}
      </Button>
    </div>
  </div>

  <!-- ══ FILTER BAR ═══════════════════════════════════════════════════════════ -->
  <div class="toolbar flex-wrap gap-2">
    <input
      class="input-base input-sm flex-1 min-w-[180px]"
      type="search"
      placeholder="Mã / tiêu đề..."
      data-testid="repairs-filter-q"
      bind:value={q}
      onkeydown={(e) => e.key === 'Enter' && loadData(1)}
    />
    <select class="select-base input-sm w-44" data-testid="repairs-filter-status" bind:value={status}>
      <option value="">Tất cả trạng thái</option>
      {#each statusOrder as s}
        <option value={s}>{repairStatusLabel[s] ?? s}</option>
      {/each}
    </select>
    <Button variant="secondary" size="sm" data-testid="repairs-filter-apply" onclick={() => loadData(1)}>Lọc</Button>
  </div>

  <!-- ══ DASHBOARD ════════════════════════════════════════════════════════════ -->
  {#if !loading && summary}
    <!-- Row 1: 4 primary KPIs -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        label="Tổng đơn"
        value={formatNumber(summary.total)}
        tone="neutral"
        testid="repair-summary-total"
      />
      <StatsCard
        label="Đang xử lý"
        value={formatNumber(summary.activeCount)}
        tone="warning"
        hint="open + diagnosing + waiting_parts"
        testid="repair-summary-active"
      />
      <StatsCard
        label="Đã đóng"
        value={formatNumber(summary.closedCount)}
        tone="success"
        testid="repair-summary-closed"
      />
      <StatsCard
        label="Tổng chi phí"
        value={formatCurrencyVND(summary.totalCost)}
        tone="primary"
        hint="nhân công + linh kiện"
        testid="repair-summary-total-cost"
      />
    </div>

    <!-- Row 2: 2 secondary mini-stats -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MiniStat
        label="Tổng ngừng hoạt động"
        value={formatDuration(summary.totalDowntimeMinutes)}
        tone="warning"
        testid="repair-summary-downtime"
      />
      <MiniStat
        label="TB thời gian xử lý"
        value="{formatNumber(summary.avgResolutionHours, 1)} giờ"
        tone="neutral"
        testid="repair-summary-avg-resolution-hours"
      />
    </div>

    <!-- Row 3: 3 breakdown cards -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BreakdownCard
        title="Theo trạng thái"
        items={statusBreakdown}
        total={summary.total}
      />
      <BreakdownCard
        title="Theo mức độ"
        items={severityBreakdown}
        total={summary.total}
      />
      <BreakdownCard
        title="Theo loại sửa chữa"
        items={typeBreakdown}
        total={summary.total}
        footer="Nhân công: {formatCurrencyVND(summary.totalLaborCost)}  |  Linh kiện: {formatCurrencyVND(summary.totalPartsCost)}"
      />
    </div>
  {/if}

  <!-- ══ CREATE FORM (inline collapsible) ════════════════════════════════════ -->
  {#if createOpen}
    <div class="card" data-testid="repairs-create-form">
      <div class="card-header">
        <h3 class="text-sm font-semibold text-slate-100">Tạo đơn sửa chữa mới</h3>
        <Button size="sm" variant="secondary" onclick={() => { createOpen = false; resetCreateForm(); }}>Hủy</Button>
      </div>
      <div class="card-body space-y-4">
        {#if createError}
          <div class="alert alert-error" role="alert">{createError}</div>
        {/if}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="label-base label-required" for="repair-create-asset">Tài sản</label>
            <select class="select-base" id="repair-create-asset" data-testid="repair-create-asset" bind:value={assetId}>
              <option value="">Chọn tài sản...</option>
              {#each assetOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="label-base label-required" for="repair-create-title">Tiêu đề</label>
            <input class="input-base" id="repair-create-title" data-testid="repair-create-title" bind:value={title} placeholder="Mô tả công việc sửa chữa" />
          </div>
          <div>
            <label class="label-base" for="repair-create-severity">Mức độ</label>
            <select class="select-base" id="repair-create-severity" data-testid="repair-create-severity" bind:value={severity}>
              {#each severityOrder as s}
                <option value={s}>{repairSeverityLabel[s] ?? s}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="label-base" for="repair-create-type">Loại sửa chữa</label>
            <select class="select-base" id="repair-create-type" data-testid="repair-create-type" bind:value={repairType}>
              {#each repairTypeOrder as t}
                <option value={t}>{repairTypeLabel[t] ?? t}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="label-base" for="repair-create-technician">Kỹ thuật viên</label>
            <input class="input-base" id="repair-create-technician" data-testid="repair-create-technician" bind:value={technicianName} placeholder="Tên kỹ thuật viên" />
          </div>
          <div>
            <label class="label-base" for="repair-create-labor-cost">Chi phí nhân công (VNĐ)</label>
            <input class="input-base" id="repair-create-labor-cost" data-testid="repair-create-labor-cost" type="number" min="0" step="1000" bind:value={laborCost} placeholder="0" />
          </div>
          <div>
            <label class="label-base" for="repair-create-downtime">Phút ngừng hoạt động</label>
            <input class="input-base" id="repair-create-downtime" data-testid="repair-create-downtime" type="number" min="0" step="1" bind:value={downtimeMinutes} placeholder="0" />
          </div>
        </div>
        <div>
          <label class="label-base" for="repair-create-description">Mô tả</label>
          <textarea
            id="repair-create-description"
            data-testid="repair-create-description"
            class="textarea-base"
            rows="3"
            bind:value={description}
            placeholder="Mô tả chi tiết vấn đề cần sửa chữa"
          ></textarea>
        </div>
      </div>
      <div class="card-footer flex justify-end gap-2">
        <Button variant="secondary" onclick={() => { createOpen = false; resetCreateForm(); }}>Hủy</Button>
        <Button data-testid="repair-create-submit" onclick={submitCreate} disabled={creating}>
          {creating ? 'Đang tạo...' : 'Tạo đơn'}
        </Button>
      </div>
    </div>
  {/if}

  <!-- ══ ERROR ════════════════════════════════════════════════════════════════ -->
  {#if error}
    <div class="alert alert-error" role="alert">{error}</div>
  {/if}

  <!-- ══ TABLE ════════════════════════════════════════════════════════════════ -->
  <div class="data-table-wrap">
    {#if loading}
      <div class="flex items-center justify-center py-14 gap-3">
        <div class="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span class="text-sm text-slate-400">Đang tải...</span>
      </div>
    {:else if repairs.length === 0}
      <!-- Empty state -->
      <div class="empty-state py-16">
        <Wrench class="empty-state-icon" />
        <p class="empty-state-title">Không có đơn sửa chữa nào</p>
        <p class="empty-state-desc">Thử thay đổi bộ lọc hoặc tạo đơn sửa chữa mới.</p>
        <Button class="mt-4" onclick={() => { createOpen = true; }}>
          <Plus class="mr-1.5 h-4 w-4" /> Tạo đơn sửa chữa
        </Button>
      </div>
    {:else}
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tiêu đề</th>
              <th>Tài sản</th>
              <th>Trạng thái</th>
              <th>Mức độ</th>
              <th>Ngày mở</th>
              <th class="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {#each repairs as repair (repair.id)}
              <tr>
                <td class="cell-mono">{repair.code}</td>
                <td class="max-w-[260px] truncate text-slate-100" title={repair.title}>{repair.title}</td>
                <td class="cell-mono">{getAssetLabel(repair.assetId)}</td>
                <td>
                  <span class="badge {repairStatusBadge[repair.status] ?? 'badge-gray'}">
                    {repairStatusLabel[repair.status] ?? repair.status}
                  </span>
                </td>
                <td>
                  <span class="badge {repairSeverityBadge[repair.severity] ?? 'badge-gray'}">
                    {repairSeverityLabel[repair.severity] ?? repair.severity}
                  </span>
                </td>
                <td class="text-slate-400">{formatDate(repair.openedAt)}</td>
                <td class="cell-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`repair-row-open-${repair.id}`}
                    onclick={() => goto(`/warehouse/repairs/${repair.id}`)}
                  >
                    Chi tiết
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- ══ PAGINATION ════════════════════════════════════════════════════════════ -->
  {#if totalPages > 1}
    <div class="flex items-center justify-between text-sm text-slate-400">
      <span>Trang {meta.page} / {totalPages} &nbsp;·&nbsp; {meta.total} bản ghi</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} data-testid="repairs-page-prev"
          onclick={() => loadData(meta.page - 1)}>← Trước</Button>
        <Button size="sm" variant="secondary" disabled={meta.page >= totalPages} data-testid="repairs-page-next"
          onclick={() => loadData(meta.page + 1)}>Tiếp →</Button>
      </div>
    </div>
  {/if}

</div>
