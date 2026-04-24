<script lang="ts">
  import { goto } from '$app/navigation'
  import { _, isLoading } from '$lib/i18n'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import { getAssetCatalogs, type AssetCategory } from '$lib/api/assetCatalogs'
  import { onMount } from 'svelte'
  import { Plus, Trash2, ArrowLeft, Send, Save } from 'lucide-svelte'

  // ── State ──────────────────────────────────────────────────────────────────

  let docDate   = $state(new Date().toISOString().split('T')[0])
  let fiscalYear = $state(new Date().getFullYear())
  let orgUnitName = $state('')
  let requiredByDate = $state('')
  let purpose   = $state('')   // maps to `title` in API
  let note      = $state('')
  let categories = $state<AssetCategory[]>([])

  interface LineItem {
    lineNo: number
    categoryId: string
    modelName: string
    quantity: number
    unit: string
    estimatedCost: number
    priority: 'high' | 'medium' | 'low'
    note: string
  }

  let lines = $state<LineItem[]>([{
    lineNo: 1, categoryId: '', modelName: '', quantity: 1, unit: 'cái', estimatedCost: 0, priority: 'medium', note: ''
  }])

  let saving = $state(false)
  let errorMessage = $state('')

  const totalCost = $derived(lines.reduce((s, l) => s + l.quantity * l.estimatedCost, 0))

  // ── Helpers ────────────────────────────────────────────────────────────────

  onMount(async () => {
    try {
      const catalogs = await getAssetCatalogs()
      categories = catalogs.data?.categories ?? []
    } catch { /* non-critical */ }
  })

  function addLine() {
    lines.push({
      lineNo: lines.length + 1,
      categoryId: '', modelName: '', quantity: 1, unit: 'cái', estimatedCost: 0, priority: 'medium', note: ''
    })
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return
    lines.splice(i, 1)
    lines.forEach((l, idx) => { l.lineNo = idx + 1 })
  }

  function fmt(n: number) {
    return new Intl.NumberFormat('vi-VN').format(n)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function save(action: 'draft' | 'submit') {
    if (!purpose.trim()) { errorMessage = 'Vui lòng nhập tiêu đề kế hoạch'; return }
    if (lines.some(l => !l.modelName.trim())) { errorMessage = 'Vui lòng nhập tên hàng hóa cho tất cả các dòng'; return }

    saving = true
    errorMessage = ''
    try {
      const payload = {
        docDate,
        fiscalYear,
        orgUnitName: orgUnitName || undefined,
        requiredByDate: requiredByDate || undefined,
        purpose: purpose.trim(),
        note: note || undefined,
        lines: lines.map(l => ({
          lineNo: l.lineNo,
          categoryId: l.categoryId || undefined,
          modelName: l.modelName.trim(),
          quantity: l.quantity,
          unit: l.unit || undefined,
          estimatedCost: l.estimatedCost,
          priority: l.priority,
          note: l.note || undefined,
        }))
      }
      const created = await apiJson<{ data: { id: string } }>(`${API_BASE}/v1/assets/purchase-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (action === 'submit') {
        await apiJson(`${API_BASE}/v1/assets/purchase-plans/${created.data.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvers: [] })
        })
      }
      goto('/assets/purchase-plans')
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Lỗi không xác định'
    } finally {
      saving = false
    }
  }
</script>

<div class="page-shell page-content space-y-4">

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button
        class="btn btn-ghost flex items-center gap-1.5 text-sm"
        onclick={() => goto('/assets/purchase-plans')}
      >
        <ArrowLeft class="h-4 w-4" />
        Danh sách
      </button>
      <div>
        <h1 class="text-xl font-bold">
          {$isLoading ? 'Tạo kế hoạch mua sắm' : $_('qlts.purchasePlan.form.createTitle')}
        </h1>
      </div>
    </div>
    <div class="flex gap-2">
      <button
        class="btn btn-secondary flex items-center gap-1.5 text-sm"
        onclick={() => save('draft')}
        disabled={saving}
      >
        <Save class="h-3.5 w-3.5" />
        {$isLoading ? 'Lưu nháp' : $_('qlts.common.saveDraft')}
      </button>
      <button
        class="btn btn-primary flex items-center gap-1.5 text-sm"
        onclick={() => save('submit')}
        disabled={saving}
      >
        <Send class="h-3.5 w-3.5" />
        {$isLoading ? 'Lưu & Gửi duyệt' : $_('qlts.common.saveAndSubmit')}
      </button>
    </div>
  </div>

  {#if errorMessage}
    <div class="alert alert-error text-sm">{errorMessage}</div>
  {/if}

  <!-- Basic info card -->
  <div class="card p-5 space-y-4">
    <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide">
      {$isLoading ? 'Thông tin chung' : $_('qlts.purchasePlan.form.basicInfo')}
    </h2>

    <!-- Row 1 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="space-y-1">
        <label class="text-xs text-slate-400" for="pp-purpose">
          {$isLoading ? 'Tiêu đề kế hoạch' : $_('qlts.purchasePlan.form.purpose')}
          <span class="text-red-400">*</span>
        </label>
        <input
          id="pp-purpose"
          class="input-base w-full"
          type="text"
          bind:value={purpose}
          placeholder="VD: Kế hoạch mua sắm CNTT Quý 2/2026"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-slate-400" for="pp-orgunit">
          {$isLoading ? 'Phòng ban / Đơn vị' : $_('qlts.common.orgUnit')}
        </label>
        <input
          id="pp-orgunit"
          class="input-base w-full"
          type="text"
          bind:value={orgUnitName}
          placeholder="VD: Phòng Công nghệ thông tin"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-slate-400" for="pp-fiscal">
          {$isLoading ? 'Năm tài chính' : $_('qlts.purchasePlan.form.fiscalYear')}
          <span class="text-red-400">*</span>
        </label>
        <input
          id="pp-fiscal"
          class="input-base w-full"
          type="number"
          bind:value={fiscalYear}
          min="2020" max="2100"
        />
      </div>
    </div>

    <!-- Row 2 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="text-xs text-slate-400" for="pp-docdate">
          {$isLoading ? 'Ngày chứng từ' : $_('qlts.common.docDate')}
          <span class="text-red-400">*</span>
        </label>
        <input
          id="pp-docdate"
          class="input-base w-full"
          type="date"
          bind:value={docDate}
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-slate-400" for="pp-reqdate">
          {$isLoading ? 'Ngày cần hàng' : $_('qlts.purchasePlan.form.requiredByDate')}
        </label>
        <input
          id="pp-reqdate"
          class="input-base w-full"
          type="date"
          bind:value={requiredByDate}
        />
      </div>
    </div>

    <!-- Note -->
    <div class="space-y-1">
      <label class="text-xs text-slate-400" for="pp-note">
        {$isLoading ? 'Ghi chú' : $_('qlts.common.note')}
      </label>
      <textarea
        id="pp-note"
        class="input-base w-full resize-none"
        rows="2"
        bind:value={note}
        placeholder="Thông tin bổ sung về kế hoạch..."
      ></textarea>
    </div>
  </div>

  <!-- Line items card -->
  <div class="card p-5 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide">
        {$isLoading ? 'Danh sách hàng hóa / vật tư' : $_('qlts.purchasePlan.form.lineItems')}
        <span class="ml-1.5 text-slate-500 font-normal normal-case">({lines.length} dòng)</span>
      </h2>
      <button
        type="button"
        class="btn btn-secondary flex items-center gap-1.5 text-xs h-7 px-2.5"
        onclick={addLine}
      >
        <Plus class="h-3 w-3" />
        {$isLoading ? '+ Thêm dòng' : $_('qlts.common.addLine')}
      </button>
    </div>

    <div class="overflow-x-auto rounded-lg border border-slate-700">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-800 text-xs uppercase text-slate-400">
          <tr>
            <th class="w-10 px-3 py-2 text-center">{$isLoading ? 'STT' : $_('qlts.common.lineNo')}</th>
            <th class="w-36 px-3 py-2 text-left">{$isLoading ? 'Loại tài sản' : $_('catalogs.tab.categories')}</th>
            <th class="px-3 py-2 text-left min-w-[200px]">{$isLoading ? 'Tên hàng hóa / Thiết bị' : $_('qlts.common.modelName')} <span class="text-red-400">*</span></th>
            <th class="w-20 px-3 py-2 text-center">{$isLoading ? 'Số lượng' : $_('qlts.common.quantity')}</th>
            <th class="w-20 px-3 py-2 text-left">{$isLoading ? 'ĐVT' : $_('qlts.common.unit')}</th>
            <th class="w-36 px-3 py-2 text-right">{$isLoading ? 'Đơn giá dự toán' : $_('qlts.common.estimatedCost')}</th>
            <th class="w-28 px-2 py-2 text-center">Ưu tiên</th>
            <th class="w-36 px-3 py-2 text-left">{$isLoading ? 'Ghi chú' : $_('qlts.common.note')}</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each lines as line, i}
            <tr class="border-t border-slate-800 hover:bg-slate-800/30">
              <td class="px-3 py-1.5 text-center text-slate-400 text-xs">{line.lineNo}</td>
              <td class="px-3 py-1">
                <select class="select-base w-full text-sm h-8 py-0" bind:value={line.categoryId}>
                  <option value="">--</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
              </td>
              <td class="px-3 py-1">
                <input
                  type="text"
                  class="input-base w-full text-sm h-8"
                  bind:value={line.modelName}
                  placeholder="Nhập tên hàng hóa..."
                />
              </td>
              <td class="px-3 py-1">
                <input
                  type="number"
                  class="input-base w-full text-sm h-8 text-center"
                  bind:value={line.quantity}
                  min="1"
                />
              </td>
              <td class="px-3 py-1">
                <input
                  type="text"
                  class="input-base w-full text-sm h-8"
                  bind:value={line.unit}
                  placeholder="cái"
                />
              </td>
              <td class="px-3 py-1">
                <input
                  type="number"
                  class="input-base w-full text-sm h-8 text-right"
                  bind:value={line.estimatedCost}
                  min="0"
                  step="100000"
                />
              </td>
              <td class="px-2 py-1">
                <select class="select-base w-full text-xs h-8 py-0" bind:value={line.priority}>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </td>
              <td class="px-3 py-1">
                <input
                  type="text"
                  class="input-base w-full text-sm h-8"
                  bind:value={line.note}
                  placeholder="Ghi chú..."
                />
              </td>
              <td class="px-2 py-1 text-center">
                {#if lines.length > 1}
                  <button
                    type="button"
                    class="text-slate-500 hover:text-red-400 transition-colors"
                    onclick={() => removeLine(i)}
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-slate-600 bg-slate-800/40">
            <td colspan="5" class="px-3 py-2 text-right text-sm font-semibold text-slate-300">
              {$isLoading ? 'Tổng dự toán:' : $_('qlts.common.total') + ':'}
            </td>
            <td class="px-3 py-2 text-right font-bold text-primary">{fmt(totalCost)} VND</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- Bottom actions (repeated for convenience) -->
  <div class="flex justify-end gap-2 pb-4">
    <button
      class="btn btn-secondary flex items-center gap-1.5"
      onclick={() => save('draft')}
      disabled={saving}
    >
      <Save class="h-4 w-4" />
      {$isLoading ? 'Lưu nháp' : $_('qlts.common.saveDraft')}
    </button>
    <button
      class="btn btn-primary flex items-center gap-1.5"
      onclick={() => save('submit')}
      disabled={saving}
    >
      <Send class="h-4 w-4" />
      {$isLoading ? 'Lưu & Gửi duyệt' : $_('qlts.common.saveAndSubmit')}
    </button>
  </div>

</div>
