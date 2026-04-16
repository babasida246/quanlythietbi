<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { _, isLoading } from '$lib/i18n'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import { ArrowLeft, Send, CheckCircle, XCircle, Loader2, Printer } from 'lucide-svelte'

  interface PurchasePlanLine {
    id: string
    lineNo: number
    modelId: string | null
    categoryId: string | null
    itemDescription: string
    quantity: number
    unit: string | null
    estimatedUnitCost: number | null
    estimatedTotalCost: number | null
    priority: string
    note: string | null
  }

  interface PurchasePlanDoc {
    id: string
    docNo: string
    docDate: string
    fiscalYear: number
    orgUnitName: string | null
    title: string
    description: string | null
    totalEstimatedCost: number | null
    currency: string
    status: string
    createdBy: string
    createdAt: string
    submittedBy: string | null
    submittedAt: string | null
    approvedBy: string | null
    approvedAt: string | null
    postedBy: string | null
    postedAt: string | null
    cancelledBy: string | null
    cancelledAt: string | null
    lines: PurchasePlanLine[]
  }

  let doc = $state<PurchasePlanDoc | null>(null)
  let loading = $state(true)
  let acting = $state(false)
  let printing = $state(false)
  let error = $state('')
  let confirmCancel = $state(false)

  const id = $derived(page.params.id)

  async function load() {
    loading = true
    error = ''
    try {
      const res = await apiJson<{ data: PurchasePlanDoc }>(`${API_BASE}/v1/assets/purchase-plans/${id}`)
      doc = res.data
    } catch (e) {
      error = e instanceof Error ? e.message : 'Không tải được kế hoạch mua sắm'
    } finally {
      loading = false
    }
  }

  async function submit() {
    if (!doc) return
    error = ''
    acting = true
    try {
      await apiJson(`${API_BASE}/v1/assets/purchase-plans/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvers: [] })
      })
      await load()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Gửi duyệt thất bại'
    } finally {
      acting = false
    }
  }

  async function approve() {
    if (!doc) return
    error = ''
    acting = true
    try {
      await apiJson(`${API_BASE}/v1/assets/purchase-plans/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      await load()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Phê duyệt thất bại'
    } finally {
      acting = false
    }
  }

  async function cancelDoc() {
    if (!doc) return
    error = ''
    acting = true
    confirmCancel = false
    try {
      await apiJson(`${API_BASE}/v1/assets/purchase-plans/${id}/cancel`, { method: 'DELETE' })
      goto('/assets/purchase-plans')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Hủy thất bại'
      acting = false
    }
  }

  async function printDoc() {
    if (!doc) return
    printing = true
    try {
      const PRIORITY_PRINT: Record<string, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
      const data = {
        docNo: doc.docNo,
        docDate: fmtDate(doc.docDate),
        fiscalYear: String(doc.fiscalYear),
        orgUnitName: doc.orgUnitName ?? '',
        requiredByDate: '',
        title: doc.title,
        note: doc.description ?? '',
        createdBy: doc.createdBy,
        approvedBy: doc.approvedBy ?? '',
        totalEstimatedCost: fmt(doc.totalEstimatedCost),
        lines: doc.lines.map(l => ({
          lineNo: l.lineNo,
          itemDescription: l.itemDescription,
          specs: '',
          quantity: l.quantity,
          unit: l.unit ?? '',
          estimatedUnitCost: fmt(l.estimatedUnitCost),
          estimatedTotalCost: fmt(l.estimatedTotalCost),
          priority: PRIORITY_PRINT[l.priority] ?? l.priority,
          lineNote: l.note ?? '',
        })),
      }
      const res = await apiJson<{ data: { content: string; fileName: string; mimeType: string } }>(
        `${API_BASE}/v1/print/render-builtin-docx`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printType: 'ke-hoach-mua-sam', data, fileName: doc.docNo }),
        }
      )
      const bytes = Uint8Array.from(atob(res.data.content), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: res.data.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.data.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      error = e instanceof Error ? e.message : 'In phiếu thất bại'
    } finally {
      printing = false
    }
  }

  onMount(() => { void load() })

  const STATUS_COLORS: Record<string, string> = {
    draft: 'badge-secondary', submitted: 'badge-warning',
    approved: 'badge-success', rejected: 'badge-error',
    posted: 'badge-info', cancelled: 'badge-secondary',
  }
  const STATUS_LABELS: Record<string, string> = {
    draft: 'Nháp', submitted: 'Chờ duyệt', approved: 'Đã duyệt',
    rejected: 'Từ chối', posted: 'Hoàn thành', cancelled: 'Đã hủy',
  }
  const PRIORITY_LABELS: Record<string, string> = {
    high: 'Cao', medium: 'Trung bình', low: 'Thấp',
  }

  function fmt(n: number | null) {
    if (n == null) return '—'
    return new Intl.NumberFormat('vi-VN').format(n)
  }
  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('vi-VN')
  }
</script>

<div class="page-shell page-content space-y-4">

  <!-- Back -->
  <div class="flex items-center gap-2">
    <button class="btn btn-ghost flex items-center gap-1.5 text-sm" onclick={() => goto('/assets/purchase-plans')}>
      <ArrowLeft class="h-4 w-4" />
      Danh sách kế hoạch
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
    </div>
  {:else if error && !doc}
    <div class="alert alert-error">{error}</div>
  {:else if doc}

    <!-- Header card -->
    <div class="card p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-bold text-primary">{doc.docNo}</span>
            <span class="badge {STATUS_COLORS[doc.status] ?? 'badge-secondary'} text-xs">
              {STATUS_LABELS[doc.status] ?? doc.status}
            </span>
          </div>
          <h1 class="text-lg font-bold">{doc.title}</h1>
          {#if doc.description}
            <p class="text-sm text-slate-400">{doc.description}</p>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-2 shrink-0">
          <button
            class="btn btn-secondary flex items-center gap-1.5 text-sm"
            onclick={printDoc}
            disabled={printing}
          >
            {#if printing}
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            {:else}
              <Printer class="h-3.5 w-3.5" />
            {/if}
            In phiếu
          </button>
          {#if doc.status === 'draft'}
            <a href="/assets/purchase-plans/{doc.id}/edit" class="btn btn-secondary text-sm">Sửa</a>
            <button class="btn btn-primary flex items-center gap-1.5 text-sm" onclick={submit} disabled={acting}>
              <Send class="h-3.5 w-3.5" />
              Gửi duyệt
            </button>
            <button class="btn btn-danger text-sm" onclick={() => { confirmCancel = true }} disabled={acting}>
              Hủy kế hoạch
            </button>
          {:else if doc.status === 'submitted'}
            <button class="btn btn-success flex items-center gap-1.5 text-sm" onclick={approve} disabled={acting}>
              <CheckCircle class="h-3.5 w-3.5" />
              Phê duyệt
            </button>
            <button class="btn btn-danger flex items-center gap-1.5 text-sm" onclick={() => { confirmCancel = true }} disabled={acting}>
              <XCircle class="h-3.5 w-3.5" />
              Hủy kế hoạch
            </button>
          {/if}
        </div>
      </div>

      <!-- Inline cancel confirmation -->
      {#if confirmCancel}
        <div class="mt-3 flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
          <p class="flex-1 text-sm text-red-300">Xác nhận hủy kế hoạch <span class="font-semibold">{doc.docNo}</span>? Hành động này không thể hoàn tác.</p>
          <button
            class="btn btn-danger text-sm h-8 px-3"
            onclick={cancelDoc}
            disabled={acting}
          >
            {#if acting}<Loader2 class="h-3.5 w-3.5 animate-spin mr-1" />{/if}
            Xác nhận hủy
          </button>
          <button
            class="btn btn-secondary text-sm h-8 px-3"
            onclick={() => { confirmCancel = false }}
            disabled={acting}
          >
            Quay lại
          </button>
        </div>
      {/if}

      <!-- Meta grid -->
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm border-t border-slate-700 pt-4">
        <div>
          <p class="text-xs text-slate-500">Ngày lập</p>
          <p class="font-medium">{fmtDate(doc.docDate)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Năm tài chính</p>
          <p class="font-medium">{doc.fiscalYear}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Phòng ban</p>
          <p class="font-medium">{doc.orgUnitName ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Tổng dự toán</p>
          <p class="font-bold text-primary">{fmt(doc.totalEstimatedCost)} {doc.currency}</p>
        </div>
        {#if doc.submittedAt}
          <div>
            <p class="text-xs text-slate-500">Ngày gửi duyệt</p>
            <p class="font-medium">{fmtDate(doc.submittedAt)}</p>
          </div>
        {/if}
        {#if doc.approvedAt}
          <div>
            <p class="text-xs text-slate-500">Ngày duyệt</p>
            <p class="font-medium">{fmtDate(doc.approvedAt)}</p>
          </div>
        {/if}
        {#if doc.postedAt}
          <div>
            <p class="text-xs text-slate-500">Ngày hoàn thành</p>
            <p class="font-medium">{fmtDate(doc.postedAt)}</p>
          </div>
        {/if}
      </div>
    </div>

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <!-- Lines table -->
    <div class="card p-4">
      <h2 class="text-sm font-semibold mb-3">Danh sách hàng hóa / vật tư ({doc.lines.length} dòng)</h2>
      <div class="overflow-x-auto">
        <table class="data-table min-w-full text-sm">
          <thead>
            <tr>
              <th class="text-center w-10">STT</th>
              <th class="text-left">Tên hàng hóa / thiết bị</th>
              <th class="text-center">SL</th>
              <th class="text-left">ĐVT</th>
              <th class="text-right">Đơn giá dự toán</th>
              <th class="text-right">Thành tiền</th>
              <th class="text-center">Ưu tiên</th>
              <th class="text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {#each doc.lines as line}
              <tr>
                <td class="text-center text-slate-400">{line.lineNo}</td>
                <td>{line.itemDescription}</td>
                <td class="text-center font-medium">{line.quantity}</td>
                <td>{line.unit ?? '—'}</td>
                <td class="text-right">{fmt(line.estimatedUnitCost)}</td>
                <td class="text-right font-medium">{fmt(line.estimatedTotalCost)}</td>
                <td class="text-center">
                  <span class="text-xs {line.priority === 'high' ? 'text-orange-400' : line.priority === 'low' ? 'text-slate-400' : 'text-yellow-400'}">
                    {PRIORITY_LABELS[line.priority] ?? line.priority}
                  </span>
                </td>
                <td class="text-slate-400 text-xs">{line.note ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-slate-600 bg-slate-800/40">
              <td colspan="5" class="text-right font-semibold px-3 py-2">Tổng cộng:</td>
              <td class="text-right font-bold px-3 py-2">{fmt(doc.totalEstimatedCost)} {doc.currency}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

  {/if}
</div>
