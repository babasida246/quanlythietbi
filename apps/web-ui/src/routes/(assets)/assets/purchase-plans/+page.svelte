<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { _, isLoading } from '$lib/i18n'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import { Plus, RefreshCw, FileText, Lightbulb, Eye, ChevronRight } from 'lucide-svelte'

  // ── Types ──────────────────────────────────────────────────────────────────

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
    submittedAt: string | null
    approvedAt: string | null
    postedAt: string | null
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let activeTab = $state<'list' | 'suggestions'>('list')
  let docs = $state<PurchasePlanDoc[]>([])
  let total = $state(0)
  let loadingDocs = $state(true)
  let filterStatus = $state('')
  let filterYear = $state(new Date().getFullYear())

  // ── Load ───────────────────────────────────────────────────────────────────

  async function loadDocs() {
    loadingDocs = true
    try {
      const params = new URLSearchParams({ limit: '50', page: '1' })
      if (filterStatus) params.set('status', filterStatus)
      if (filterYear) params.set('fiscalYear', String(filterYear))
      const res = await apiJson<{ data: PurchasePlanDoc[]; pagination?: { total: number } }>(
        `${API_BASE}/v1/assets/purchase-plans?${params}`
      )
      docs = res.data ?? []
      total = res.pagination?.total ?? docs.length
    } catch (e) {
      console.error('Failed to load purchase plans', e)
      docs = []
    } finally {
      loadingDocs = false
    }
  }

  onMount(() => { void loadDocs() })

  // ── Helpers ────────────────────────────────────────────────────────────────

  const STATUS_COLORS: Record<string, string> = {
    draft:     'badge-secondary',
    submitted: 'badge-warning',
    approved:  'badge-success',
    rejected:  'badge-error',
    posted:    'badge-info',
    cancelled: 'badge-secondary',
  }

  const STATUS_LABELS: Record<string, string> = {
    draft:     'Nháp',
    submitted: 'Chờ duyệt',
    approved:  'Đã duyệt',
    rejected:  'Từ chối',
    posted:    'Hoàn thành',
    cancelled: 'Đã hủy',
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

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-xl font-bold">
        {$isLoading ? 'Kế hoạch mua sắm' : $_('nav.purchasePlans')}
      </h1>
      <p class="text-sm text-slate-500 mt-0.5">
        {$isLoading ? 'Quản lý và theo dõi kế hoạch mua sắm thiết bị' : 'Quản lý và theo dõi kế hoạch mua sắm thiết bị'}
      </p>
    </div>
    <a
      href="/assets/purchase-plans/new"
      class="btn btn-primary flex items-center gap-2"
    >
      <Plus class="h-4 w-4" />
      Tạo kế hoạch
    </a>
  </div>

  <!-- Tabs -->
  <div class="flex border-b border-slate-700">
    <button
      class="tabs-trigger {activeTab === 'list' ? 'tabs-trigger-active' : ''}"
      onclick={() => { activeTab = 'list'; void loadDocs() }}
    >
      <FileText class="h-4 w-4 mr-1.5" />
      Danh sách kế hoạch
      {#if total > 0}
        <span class="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">{total}</span>
      {/if}
    </button>
    <button
      class="tabs-trigger {activeTab === 'suggestions' ? 'tabs-trigger-active' : ''}"
      onclick={() => activeTab = 'suggestions'}
    >
      <Lightbulb class="h-4 w-4 mr-1.5" />
      Gợi ý mua sắm
    </button>
  </div>

  <!-- ── TAB: Danh sách ─────────────────────────────────────────────────── -->
  {#if activeTab === 'list'}

    <!-- Filters -->
    <div class="card p-3 flex flex-wrap gap-3 items-end">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">Trạng thái</label>
        <select
          class="select-base text-sm h-8 py-0 px-2"
          bind:value={filterStatus}
          onchange={() => loadDocs()}
        >
          <option value="">Tất cả</option>
          <option value="draft">Nháp</option>
          <option value="submitted">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="posted">Hoàn thành</option>
          <option value="rejected">Từ chối</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">Năm tài chính</label>
        <input
          type="number"
          class="input-base text-sm h-8 py-0 px-2 w-24"
          bind:value={filterYear}
          min="2020" max="2100"
          onchange={() => loadDocs()}
        />
      </div>
      <button
        class="btn btn-secondary flex items-center gap-1.5 h-8 text-sm"
        onclick={() => loadDocs()}
      >
        <RefreshCw class="h-3.5 w-3.5" />
        Làm mới
      </button>
    </div>

    <!-- Table -->
    {#if loadingDocs}
      <div class="flex justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    {:else if docs.length === 0}
      <div class="card flex flex-col items-center justify-center py-16 text-center gap-3">
        <FileText class="h-12 w-12 text-slate-500" />
        <p class="text-slate-400 text-sm">Chưa có kế hoạch mua sắm nào</p>
        <a href="/assets/purchase-plans/new" class="btn btn-primary flex items-center gap-2">
          <Plus class="h-4 w-4" />
          Tạo kế hoạch đầu tiên
        </a>
      </div>
    {:else}
      <div class="overflow-x-auto rounded-xl border border-slate-700">
        <table class="data-table min-w-full text-sm">
          <thead>
            <tr>
              <th class="text-left">Số chứng từ</th>
              <th class="text-left">Tiêu đề</th>
              <th class="text-left">Phòng ban</th>
              <th class="text-center">Năm TC</th>
              <th class="text-left">Ngày lập</th>
              <th class="text-right">Tổng dự toán</th>
              <th class="text-center">Trạng thái</th>
              <th class="text-center w-12"></th>
            </tr>
          </thead>
          <tbody>
            {#each docs as doc}
              <tr
                class="cursor-pointer hover:bg-slate-800/50"
                onclick={() => goto(`/assets/purchase-plans/${doc.id}`)}
              >
                <td class="font-mono text-xs font-medium text-primary">{doc.docNo}</td>
                <td class="max-w-xs truncate" title={doc.title}>{doc.title}</td>
                <td class="text-slate-400">{doc.orgUnitName ?? '—'}</td>
                <td class="text-center">{doc.fiscalYear}</td>
                <td>{fmtDate(doc.docDate)}</td>
                <td class="text-right font-medium">
                  {fmt(doc.totalEstimatedCost)}
                  <span class="text-xs text-slate-500 ml-0.5">{doc.currency}</span>
                </td>
                <td class="text-center">
                  <span class="badge {STATUS_COLORS[doc.status] ?? 'badge-secondary'} text-xs">
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </td>
                <td class="text-center">
                  <ChevronRight class="h-4 w-4 text-slate-500 mx-auto" />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if total > docs.length}
        <p class="text-xs text-slate-500 text-right">Hiển thị {docs.length} / {total} kế hoạch</p>
      {/if}
    {/if}

  <!-- ── TAB: Gợi ý ──────────────────────────────────────────────────────── -->
  {:else}
    <div class="card p-6 text-center text-slate-400 space-y-2">
      <Lightbulb class="h-10 w-10 mx-auto text-yellow-400" />
      <p class="text-sm">Công cụ phân tích tồn kho và gợi ý mua sắm</p>
      <a href="/warehouse/purchase-plans" class="btn btn-secondary inline-flex items-center gap-2 mt-2">
        <Eye class="h-4 w-4" />
        Mở công cụ gợi ý mua sắm
      </a>
    </div>
  {/if}

</div>
