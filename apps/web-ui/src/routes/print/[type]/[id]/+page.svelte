<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { orgStore } from '$lib/stores/orgStore'
  import { decodePrintData, PRINT_LABELS, type PrintType } from '$lib/utils/printUtils'
  import { getStockDocument } from '$lib/api/warehouse'
  import { getAssetDetail } from '$lib/api/assets'
  import { renderBuiltinDocx, downloadDocxFromBase64, type BuiltinPrintType } from '$lib/api/print'
  import { fmtDateVi, fmtVnd } from '$lib/utils/printUtils'

  const type = $derived(page.params.type as PrintType)
  const id   = $derived(page.params.id ?? '')

  let loading      = $state(true)
  let error        = $state<string | null>(null)
  let rawData      = $state<Record<string, unknown> | null>(null)
  let exporting    = $state(false)
  let exportError  = $state<string | null>(null)
  let exportDone   = $state(false)

  const org       = $derived($orgStore)
  const formTitle = $derived(PRINT_LABELS[type] ?? type)

  // ─── Flatten data for docxtemplater ───────────────────────────────────────
  function buildDocxData(data: Record<string, unknown>): Record<string, unknown> {
    const d = new Date()
    const sigDate = `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`

    // Số thứ tự cho mảng nếu chưa có
    const addIndex = (arr: unknown[], key = 'i') =>
      (arr ?? []).map((item: unknown, idx) => ({
        ...(item as object),
        [key]: (item as Record<string, unknown>)[key] ?? idx + 1,
      }))

    // Format currency array fields
    const fmtLines = (lines: unknown[]) =>
      addIndex(lines).map((l: Record<string, unknown>) => ({
        ...l,
        unitCost: l.unitCost != null ? fmtVnd(Number(l.unitCost)) : '',
        total:    l.total    != null ? fmtVnd(Number(l.total))    : '',
      }))

    const totalLines = (lines: unknown[], field: string) =>
      (lines ?? []).reduce((s, l: unknown) => s + (Number((l as Record<string, unknown>)[field]) || 0), 0)

    // Common org fields
    const orgFields = {
      orgName:    org?.name    ?? '',
      orgAddress: org?.address ?? '',
      orgPhone:   org?.phone   ?? '',
      orgTaxCode: org?.taxCode ?? '',
      sigDate,
    }

    // type-specific conversions
    const lines = (data.lines as unknown[]) ?? []
    const items = (data.items as unknown[]) ?? []

    if (type === 'phieu-nhap-kho' || type === 'phieu-xuat-kho') {
      const fLines = fmtLines(lines)
      return {
        ...orgFields,
        ...data,
        date:        fmtDateVi(String(data.date ?? '')),
        lines:       fLines,
        totalQty:    totalLines(lines, 'qty'),
        totalAmount: fmtVnd(totalLines(lines, 'total')),
      }
    }

    if (type === 'lenh-sua-chua') {
      const parts = addIndex((data.parts as unknown[]) ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        unitCost:  p.unitCost  != null ? fmtVnd(Number(p.unitCost))  : '',
        partTotal: p.partTotal != null ? fmtVnd(Number(p.partTotal)) : '',
      }))
      return {
        ...orgFields,
        ...data,
        date:    fmtDateVi(String(data.date ?? '')),
        parts,
        laborCost: data.laborCost != null ? fmtVnd(Number(data.laborCost)) : '',
        partsCost: data.partsCost != null ? fmtVnd(Number(data.partsCost)) : '',
      }
    }

    if (type === 'bien-ban-kiem-ke') {
      const total  = (data.totalExpected as number) ?? 0
      const matched = (data.totalMatched as number) ?? 0
      return {
        ...orgFields,
        ...data,
        date:      fmtDateVi(String(data.date ?? '')),
        items:     addIndex(items),
        matchRate: total > 0 ? `${Math.round((matched / total) * 100)}%` : '–',
      }
    }

    if (type === 'bien-ban-thanh-ly') {
      return {
        ...orgFields,
        ...data,
        date:   fmtDateVi(String(data.date ?? '')),
        assets: addIndex((data.assets as unknown[]) ?? []).map((a: Record<string, unknown>) => ({
          ...a,
          originalValue: a.originalValue != null ? fmtVnd(Number(a.originalValue)) : '',
          residualValue: a.residualValue != null ? fmtVnd(Number(a.residualValue)) : '',
          purchaseDate:  fmtDateVi(String(a.purchaseDate ?? '')),
        })),
        proceedsAmount: data.proceedsAmount != null ? fmtVnd(Number(data.proceedsAmount)) : '',
      }
    }

    if (type === 'yeu-cau-mua-sam') {
      const fItems = addIndex(items).map((it: Record<string, unknown>) => ({
        ...it,
        unitPrice: it.unitPrice != null ? fmtVnd(Number(it.unitPrice)) : '',
        total:     it.total     != null ? fmtVnd(Number(it.total))     : '',
      }))
      return {
        ...orgFields,
        ...data,
        date:          fmtDateVi(String(data.date ?? '')),
        items:         fItems,
        totalEstimate: data.totalEstimate != null ? fmtVnd(Number(data.totalEstimate)) : '',
      }
    }

    if (type === 'bao-cao-tai-san') {
      const summary = (data.summary as Record<string, unknown>) ?? {}
      return {
        ...orgFields,
        ...summary,
        ...data,
        date:          fmtDateVi(String(data.date ?? '')),
        totalValue:    summary.totalValue != null ? fmtVnd(Number(summary.totalValue)) : '',
        byCategory:    addIndex((data.byCategory as unknown[]) ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          value: c.value != null ? fmtVnd(Number(c.value)) : '',
        })),
      }
    }

    // Default: phieu-muon, bien-ban-ban-giao, bien-ban-luan-chuyen, bien-ban-thu-hoi
    return {
      ...orgFields,
      ...data,
      date:  fmtDateVi(String(data.date ?? '')),
      items: addIndex(items),
    }
  }

  async function downloadDocx() {
    if (!rawData) return
    exporting   = true
    exportError = null
    exportDone  = false
    try {
      const docxData = buildDocxData(rawData)
      const result   = await renderBuiltinDocx(type as BuiltinPrintType, docxData, id || type)
      downloadDocxFromBase64(result.data.content, result.data.fileName)
      exportDone = true
    } catch (e) {
      exportError = e instanceof Error ? e.message : String(e)
    } finally {
      exporting = false
    }
  }

  // ─── Load data ────────────────────────────────────────────────────────────
  onMount(async () => {
    orgStore.loadFromStorage()

    // Thử decode từ URL trước
    const decoded = decodePrintData<Record<string, unknown>>(page.url.searchParams)
    if (decoded) {
      rawData = decoded
      loading = false
      return
    }

    // Fetch từ API theo type
    try {
      if (type === 'phieu-nhap-kho' || type === 'phieu-xuat-kho') {
        const res = await getStockDocument(id)
        if (res.data) {
          const doc = res.data.document
          rawData = {
            code:          doc.code,
            date:          doc.docDate,
            warehouseName: doc.warehouseName ?? doc.warehouseId ?? 'Kho',
            supplier:      doc.supplier,
            reference:     doc.reference,
            recipient:     doc.receiverName,
            department:    doc.department,
            note:          doc.note,
            preparedBy:    doc.submitterName,
            approvedBy:    doc.approvedBy,
            receivedBy:    doc.receiverName,
            issuedBy:      doc.issuedBy,
            lines: res.data.lines.map((l: Record<string, unknown>, i: number) => ({
              i:        i + 1,
              partCode: l.partCode ?? l.partId ?? '',
              partName: l.partName ?? `Vật tư ${l.partId}`,
              uom:      l.uom,
              qty:      l.qty,
              unitCost: l.unitCost,
              total:    l.unitCost ? Number(l.qty) * Number(l.unitCost) : undefined,
              serialNo: l.serialNo,
              lineNote: l.note,
            })),
          }
        }
      } else if (type === 'bien-ban-ban-giao' || type === 'bien-ban-thu-hoi') {
        const res = await getAssetDetail(id)
        if (res.data) {
          const asset = res.data.asset
          const lastAsgn = res.data.assignments?.slice(-1)[0] as Record<string, unknown> | undefined
          const today = new Date().toISOString().slice(0, 10)
          rawData = {
            date: lastAsgn?.assignedAt ?? today,
            asset: {
              code:        asset.assetCode,
              name:        asset.modelName ?? asset.assetCode,
              serialNo:    asset.serialNo,
              model:       asset.modelName,
              brand:       asset.modelBrand,
              category:    asset.categoryName,
              location:    asset.locationName,
            },
            toPerson:   lastAsgn?.assigneeName ?? '',
            fromPerson:  lastAsgn?.assigneeName ?? '',
            reason:      lastAsgn?.note ?? 'Thu hồi thiết bị',
            condition:   '',
          }
        }
      } else {
        error = `Không thể tự động tải dữ liệu cho loại "${type}". Vui lòng truyền data=... qua URL.`
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <title>{formTitle}</title>
</svelte:head>

<div class="dl-wrapper">
  <!-- Toolbar -->
  <div class="dl-toolbar">
    <span class="dl-title">{formTitle}</span>
    <div class="dl-actions">
      <button class="dl-btn-close" onclick={() => window.close()}>✕ Đóng</button>
    </div>
  </div>

  <!-- Main content -->
  <div class="dl-body">
    {#if loading}
      <div class="dl-status">
        <div class="dl-spinner"></div>
        <p>Đang tải dữ liệu...</p>
      </div>

    {:else if error}
      <div class="dl-error">
        <div class="dl-error-icon">⚠</div>
        <p><strong>Lỗi:</strong> {error}</p>
      </div>

    {:else if !rawData}
      <div class="dl-error">
        <p>Không có dữ liệu để xuất. Vui lòng kiểm tra lại đường dẫn.</p>
      </div>

    {:else}
      <!-- Document card -->
      <div class="dl-card">
        <div class="dl-card-icon">📄</div>

        <h1 class="dl-card-title">{formTitle}</h1>

        {#if rawData.code}
          <p class="dl-card-meta">Số: <strong>{rawData.code}</strong></p>
        {/if}
        {#if rawData.date}
          <p class="dl-card-meta">Ngày: <strong>{fmtDateVi(String(rawData.date))}</strong></p>
        {/if}
        {#if org?.name}
          <p class="dl-card-meta dl-card-org">{org.name}</p>
        {/if}

        <div class="dl-divider"></div>

        <!-- Primary action -->
        <button
          class="dl-btn-primary"
          disabled={exporting}
          onclick={downloadDocx}
        >
          {#if exporting}
            <span class="dl-spinner-sm"></span>
            Đang tạo file...
          {:else}
            📥 Tải xuống DOCX
          {/if}
        </button>

        {#if exportDone}
          <p class="dl-success">
            ✓ File đã được tải xuống. Mở bằng Microsoft Word để in hoặc chỉnh sửa.
          </p>
        {/if}

        {#if exportError}
          <p class="dl-export-error">⚠ {exportError}</p>
        {/if}

        <p class="dl-hint">
          Mẫu Word sử dụng font Times New Roman, bố cục A4.
          Chỉnh sửa nội dung trong Word sau khi tải xuống.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ─── Layout ─── */
  .dl-wrapper {
    min-height: 100vh;
    background: var(--surface-bg, #f8fafc);
    display: flex;
    flex-direction: column;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* ─── Toolbar ─── */
  .dl-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--surface-1, #fff);
    border-bottom: 1px solid var(--border, #e2e8f0);
    gap: 12px;
  }
  .dl-title {
    font-weight: 600;
    font-size: 15px;
    color: var(--color-text, #1e293b);
  }
  .dl-actions {
    display: flex;
    gap: 8px;
  }
  .dl-btn-close {
    padding: 6px 14px;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: var(--color-text-muted, #64748b);
  }
  .dl-btn-close:hover { background: var(--surface-2, #f1f5f9); }

  /* ─── Body ─── */
  .dl-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  /* ─── Status ─── */
  .dl-status {
    text-align: center;
    color: var(--color-text-muted, #64748b);
  }
  .dl-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border, #e2e8f0);
    border-top-color: var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin .8s linear infinite;
    margin: 0 auto 12px;
  }
  .dl-spinner-sm {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .8s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ─── Error ─── */
  .dl-error {
    text-align: center;
    max-width: 480px;
    padding: 32px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    color: #dc2626;
  }
  .dl-error-icon { font-size: 32px; margin-bottom: 12px; }

  /* ─── Card ─── */
  .dl-card {
    background: var(--surface-1, #fff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 16px;
    padding: 40px 48px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,.06);
  }
  .dl-card-icon { font-size: 48px; margin-bottom: 16px; }
  .dl-card-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text, #0f172a);
    margin: 0 0 12px;
    line-height: 1.3;
  }
  .dl-card-meta {
    font-size: 14px;
    color: var(--color-text-muted, #64748b);
    margin: 4px 0;
  }
  .dl-card-meta strong { color: var(--color-text, #1e293b); }
  .dl-card-org {
    margin-top: 8px;
    font-size: 13px;
    font-style: italic;
    color: var(--color-text-muted, #94a3b8);
  }
  .dl-divider {
    height: 1px;
    background: var(--border, #e2e8f0);
    margin: 24px 0;
  }

  /* ─── Primary button ─── */
  .dl-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 32px;
    background: var(--primary, #3b82f6);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: background .15s;
  }
  .dl-btn-primary:hover:not(:disabled) { background: #2563eb; }
  .dl-btn-primary:disabled { opacity: .6; cursor: not-allowed; }

  /* ─── Status messages ─── */
  .dl-success {
    margin-top: 16px;
    font-size: 13px;
    color: #16a34a;
  }
  .dl-export-error {
    margin-top: 16px;
    font-size: 13px;
    color: #dc2626;
  }
  .dl-hint {
    margin-top: 20px;
    font-size: 12px;
    color: var(--color-text-muted, #94a3b8);
    line-height: 1.5;
  }
</style>
