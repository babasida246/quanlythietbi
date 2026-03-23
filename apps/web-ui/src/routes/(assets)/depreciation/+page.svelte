<script lang="ts">
  import { onMount } from 'svelte'
  import { _, isLoading as i18nLoading } from '$lib/i18n'
  import {
    TrendingDown, Plus, RefreshCw, Square, Eye, X,
    ChevronDown, ChevronUp, AlertCircle, Play, CheckSquare,
    Clock, Check, History, FileText, AlertTriangle
  } from 'lucide-svelte'
  import {
    listSchedules, createSchedule, stopSchedule, previewSchedule,
    getDepreciationDashboard, postEntries, runMonthlyDepreciation,
    listEntries, listRuns,
    type DepreciationSchedule, type DepreciationDashboard, type DepreciationMethod,
    type ScheduleStatus, type SchedulePreview, type CreateScheduleInput,
    type DepreciationEntry, type DepreciationRun
  } from '$lib/api/depreciation'
  import { listAssets, type Asset } from '$lib/api/assets'

  type Tab = 'schedules' | 'entries' | 'runs'

  // ── Tabs ────────────────────────────────────────────────────────────────────
  let activeTab = $state<Tab>('schedules')

  // ── Shared ──────────────────────────────────────────────────────────────────
  let dashboard = $state<DepreciationDashboard | null>(null)
  let toast = $state('')
  let toastType = $state<'success' | 'error'>('success')

  // ── Schedules tab ────────────────────────────────────────────────────────────
  let schedules = $state<DepreciationSchedule[]>([])
  let assets = $state<Asset[]>([])
  let schedulesLoading = $state(true)
  let schedulesError = $state('')
  let filterStatus = $state<ScheduleStatus | ''>('')
  let filterMethod = $state<DepreciationMethod | ''>('')
  let searchQuery = $state('')
  let filterEndingSoon = $state(false)
  let currentPage = $state(1)
  let totalSchedules = $state(0)
  const PAGE_SIZE = 20

  // Create modal
  let showCreate = $state(false)
  let creating = $state(false)
  let createError = $state('')
  let form = $state<CreateScheduleInput>({
    assetId: '',
    depreciationMethod: 'straight_line',
    originalCost: 0,
    salvageValue: 0,
    usefulLifeYears: 3,
    startDate: new Date().toISOString().split('T')[0],
    notes: ''
  })

  // Preview modal
  let showPreview = $state(false)
  let preview = $state<SchedulePreview | null>(null)
  let previewLoading = $state(false)
  let showPreviewTable = $state(false)

  // Stop modal
  let stopTarget = $state<DepreciationSchedule | null>(null)
  let stopReason = $state('')
  let stopping = $state(false)

  // Detail drawer
  let detailTarget = $state<DepreciationSchedule | null>(null)

  // ── Entries tab ──────────────────────────────────────────────────────────────
  let entries = $state<DepreciationEntry[]>([])
  let entriesLoading = $state(false)
  let entriesLoaded = $state(false)
  let entriesError = $state('')
  let entriesFilter = $state<'pending' | 'all'>('pending')
  let selectedEntryIds = $state<Set<string>>(new Set())

  // Run Monthly modal
  let showRunModal = $state(false)
  let runYear = $state(new Date().getFullYear())
  let runMonth = $state(new Date().getMonth() + 1)
  let running = $state(false)

  // Post confirm
  let showPostConfirm = $state(false)
  let posting = $state(false)

  // ── Runs tab ─────────────────────────────────────────────────────────────────
  let runs = $state<DepreciationRun[]>([])
  let runsLoading = $state(false)
  let runsLoaded = $state(false)
  let runsError = $state('')

  // ── i18n ─────────────────────────────────────────────────────────────────────
  const t = (key: string, values?: Record<string, unknown>) =>
    $i18nLoading ? key.split('.').pop() ?? key : $_(key, values ? { values } : undefined)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredSchedules = $derived(
    schedules.filter(s => {
      if (filterStatus && s.status !== filterStatus) return false
      if (filterMethod && s.depreciationMethod !== filterMethod) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!(s.assetTag ?? '').toLowerCase().includes(q) && !(s.assetName ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  )

  const filteredEntries = $derived(
    entriesFilter === 'pending' ? entries.filter(e => !e.isPosted) : entries
  )

  const pendingEntries = $derived(entries.filter(e => !e.isPosted))

  const allPendingSelected = $derived(
    pendingEntries.length > 0 && pendingEntries.every(e => selectedEntryIds.has(e.id))
  )

  const selectedPendingCount = $derived(
    [...selectedEntryIds].filter(id => entries.find(e => e.id === id && !e.isPosted)).length
  )

  const statusClass: Record<ScheduleStatus, string> = {
    active: 'badge-success',
    fully_depreciated: 'badge-primary',
    stopped: 'badge-error'
  }

  const runStatusClass: Record<string, string> = {
    pending: 'badge-warning',
    processing: 'badge-info',
    completed: 'badge-success',
    failed: 'badge-error'
  }

  // ── Format helpers ────────────────────────────────────────────────────────────
  function fmtCurrency(n: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
  }
  function fmtPct(n: number) { return n.toFixed(2) + '%' }
  function fmtPeriod(year: number, month: number) { return `${String(month).padStart(2, '0')}/${year}` }
  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('vi-VN')
  }
  function fmtDateTime(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }
  function annualRate(s: DepreciationSchedule) {
    if (!s.originalCost || !s.usefulLifeYears) return 0
    return ((s.originalCost - (s.salvageValue ?? 0)) / s.originalCost / s.usefulLifeYears) * 100
  }
  function bookValue(s: DepreciationSchedule) {
    return s.currentBookValue ?? (s.originalCost - s.accumulatedDepreciation)
  }

  function showToast(msg: string, type: 'success' | 'error') {
    toast = msg; toastType = type
    setTimeout(() => { toast = '' }, 3500)
  }

  // ── Data loading ──────────────────────────────────────────────────────────────
  async function loadSchedules() {
    try {
      schedulesLoading = true
      schedulesError = ''
      const [schedulesResult, dashboardResult, assetsResult] = await Promise.all([
        listSchedules({ page: currentPage, limit: PAGE_SIZE, endingSoon: filterEndingSoon || undefined }),
        getDepreciationDashboard().catch(() => null),
        listAssets({ limit: 500 }).catch(() => ({ data: [] as Asset[] }))
      ])
      schedules = schedulesResult.data
      totalSchedules = schedulesResult.total
      dashboard = dashboardResult
      assets = (assetsResult.data ?? []) as Asset[]
    } catch (err) {
      schedulesError = err instanceof Error ? err.message : t('depreciation.error.loadFailed')
    } finally {
      schedulesLoading = false
    }
  }

  async function loadEntries() {
    try {
      entriesLoading = true
      entriesError = ''
      const result = await listEntries({ limit: 500 })
      entries = result.data
      entriesLoaded = true
    } catch (err) {
      entriesError = err instanceof Error ? err.message : t('depreciation.error.listEntriesFailed')
    } finally {
      entriesLoading = false
    }
  }

  async function loadRuns() {
    try {
      runsLoading = true
      runsError = ''
      const result = await listRuns({ limit: 50 })
      runs = result.data
      runsLoaded = true
    } catch (err) {
      runsError = err instanceof Error ? err.message : t('depreciation.error.listRunsFailed')
    } finally {
      runsLoading = false
    }
  }

  function switchTab(tab: Tab) {
    activeTab = tab
    if (tab === 'entries' && !entriesLoaded) loadEntries()
    if (tab === 'runs' && !runsLoaded) loadRuns()
  }

  async function refreshAll() {
    entriesLoaded = false
    runsLoaded = false
    await loadSchedules()
    if (activeTab === 'entries') loadEntries()
    if (activeTab === 'runs') loadRuns()
  }

  onMount(loadSchedules)

  // ── Create schedule ────────────────────────────────────────────────────────────
  function openCreate() {
    form = {
      assetId: '',
      depreciationMethod: 'straight_line',
      originalCost: 0,
      salvageValue: 0,
      usefulLifeYears: 3,
      startDate: new Date().toISOString().split('T')[0],
      notes: ''
    }
    preview = null
    createError = ''
    showCreate = true
  }

  async function handleCreate(e: Event) {
    e.preventDefault()
    if (!form.assetId || !form.originalCost || !form.usefulLifeYears) return
    try {
      creating = true
      createError = ''
      await createSchedule(form)
      showToast(t('depreciation.success.created'), 'success')
      showCreate = false
      await loadSchedules()
    } catch (err) {
      createError = err instanceof Error ? err.message : t('depreciation.error.createFailed')
    } finally {
      creating = false
    }
  }

  async function handlePreview() {
    if (!form.originalCost || !form.usefulLifeYears) return
    try {
      previewLoading = true
      preview = await previewSchedule({
        depreciationMethod: form.depreciationMethod,
        originalCost: form.originalCost,
        salvageValue: form.salvageValue ?? 0,
        usefulLifeYears: form.usefulLifeYears,
        startDate: form.startDate
      })
      showPreview = true
      showPreviewTable = false
    } catch {
      showToast(t('depreciation.error.previewFailed'), 'error')
    } finally {
      previewLoading = false
    }
  }

  // ── Stop schedule ──────────────────────────────────────────────────────────────
  function openStop(s: DepreciationSchedule) {
    stopTarget = s
    stopReason = ''
    stopping = false
  }

  async function handleStop() {
    if (!stopTarget) return
    try {
      stopping = true
      await stopSchedule(stopTarget.id, stopReason || undefined)
      showToast(t('depreciation.success.stopped'), 'success')
      stopTarget = null
      await loadSchedules()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('depreciation.error.stopFailed'), 'error')
    } finally {
      stopping = false
    }
  }

  // ── Run monthly ────────────────────────────────────────────────────────────────
  async function handleRunMonthly() {
    try {
      running = true
      const run = await runMonthlyDepreciation(runYear, runMonth)
      const count = run?.totalAssets ?? 0
      showToast(t('depreciation.success.run', {
        month: String(runMonth).padStart(2, '0'),
        year: runYear,
        count
      }), 'success')
      showRunModal = false
      entriesLoaded = false
      runsLoaded = false
      await loadSchedules()
      if (activeTab === 'entries') loadEntries()
      if (activeTab === 'runs') loadRuns()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('depreciation.error.runFailed'), 'error')
    } finally {
      running = false
    }
  }

  // ── Post entries ───────────────────────────────────────────────────────────────
  function toggleEntry(id: string) {
    const e = entries.find(x => x.id === id)
    if (e?.isPosted) return
    const next = new Set(selectedEntryIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedEntryIds = next
  }

  function toggleAllPending() {
    if (allPendingSelected) {
      const next = new Set(selectedEntryIds)
      pendingEntries.forEach(e => next.delete(e.id))
      selectedEntryIds = next
    } else {
      const next = new Set(selectedEntryIds)
      pendingEntries.forEach(e => next.add(e.id))
      selectedEntryIds = next
    }
  }

  async function handlePostEntries() {
    const ids = [...selectedEntryIds].filter(id => entries.find(e => e.id === id && !e.isPosted))
    if (!ids.length) return
    try {
      posting = true
      const result = await postEntries(ids)
      showToast(t('depreciation.success.posted', { count: result.postedCount }), 'success')
      showPostConfirm = false
      selectedEntryIds = new Set()
      entriesLoaded = false
      await loadEntries()
      await loadSchedules()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('depreciation.error.postFailed'), 'error')
    } finally {
      posting = false
    }
  }
</script>

<!-- Toast -->
{#if toast}
  <div class="fixed top-4 right-4 z-50 max-w-sm alert {toastType === 'success' ? 'alert-success' : 'alert-error'} shadow-lg">
    {toast}
  </div>
{/if}

<!-- ── Page layout ───────────────────────────────────────────────────────────── -->
<div class="flex flex-col gap-6 p-6">

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-slate-100 flex items-center gap-2">
        <TrendingDown class="w-6 h-6 text-primary" />
        {t('depreciation.title')}
      </h1>
      <p class="text-sm text-slate-400 mt-1">{t('depreciation.subtitle')}</p>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn" onclick={refreshAll} aria-label="refresh">
        <RefreshCw class="w-4 h-4" />
      </button>
      <button
        class="btn"
        onclick={() => { runYear = new Date().getFullYear(); runMonth = new Date().getMonth() + 1; showRunModal = true }}
      >
        <Play class="w-4 h-4" />
        {t('depreciation.runMonthly')}
      </button>
      <button class="btn btn-primary" onclick={openCreate}>
        <Plus class="w-4 h-4" />
        {t('depreciation.createSchedule')}
      </button>
    </div>
  </div>

  <!-- Dashboard cards — 6 metrics -->
  {#if dashboard}
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <div class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.totalOriginalCost')}</p>
        <p class="text-base font-semibold text-slate-100 tabular-nums">{fmtCurrency(dashboard.totalOriginalCost)}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.totalAccumulated')}</p>
        <p class="text-base font-semibold text-warning tabular-nums">{fmtCurrency(dashboard.totalAccumulatedDepreciation)}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.totalBookValue')}</p>
        <p class="text-base font-semibold text-success tabular-nums">{fmtCurrency(dashboard.totalBookValue)}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.thisMonthAmount')}</p>
        <p class="text-base font-semibold text-primary tabular-nums">{fmtCurrency(dashboard.thisMonthDepreciation)}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.activeSchedules')}</p>
        <p class="text-base font-semibold text-slate-100">{dashboard.activeSchedules}</p>
        {#if dashboard.endingSoonCount > 0}
          <p class="text-xs text-warning mt-1 flex items-center gap-1">
            <AlertTriangle class="w-3 h-3" />
            {dashboard.endingSoonCount} {t('depreciation.dashboard.endingSoon')}
          </p>
        {/if}
      </div>
      <div class="card p-4 {dashboard.pendingEntriesCount > 0 ? 'border-warning/40' : ''}">
        <p class="text-xs text-slate-400 mb-1">{t('depreciation.dashboard.pendingEntries')}</p>
        <p class="text-base font-semibold {dashboard.pendingEntriesCount > 0 ? 'text-warning' : 'text-slate-100'}">
          {dashboard.pendingEntriesCount}
        </p>
        {#if dashboard.pendingEntriesCount > 0}
          <button
            class="text-xs text-primary hover:underline mt-1"
            onclick={() => switchTab('entries')}
          >
            {t('depreciation.postEntries')} →
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="flex gap-1 border-b border-border">
    <button
      class="tabs-trigger {activeTab === 'schedules' ? 'active' : ''}"
      onclick={() => switchTab('schedules')}
    >
      <TrendingDown class="w-4 h-4" />
      {t('depreciation.tab.schedules')}
      {#if totalSchedules > 0}
        <span class="ml-1 text-xs bg-surface-3 text-slate-400 px-1.5 py-0.5 rounded">{totalSchedules}</span>
      {/if}
    </button>
    <button
      class="tabs-trigger {activeTab === 'entries' ? 'active' : ''}"
      onclick={() => switchTab('entries')}
    >
      <FileText class="w-4 h-4" />
      {t('depreciation.tab.entries')}
      {#if dashboard && dashboard.pendingEntriesCount > 0}
        <span class="ml-1 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">{dashboard.pendingEntriesCount}</span>
      {/if}
    </button>
    <button
      class="tabs-trigger {activeTab === 'runs' ? 'active' : ''}"
      onclick={() => switchTab('runs')}
    >
      <History class="w-4 h-4" />
      {t('depreciation.tab.runs')}
    </button>
  </div>

  <!-- ── TAB: Schedules ────────────────────────────────────────────────────────── -->
  {#if activeTab === 'schedules'}

    <!-- Filters -->
    <div class="card p-4 flex flex-wrap gap-3 items-center">
      <input
        type="text"
        class="input-base flex-1 min-w-48"
        placeholder={t('common.search') + '...'}
        bind:value={searchQuery}
      />
      <select class="select-base" bind:value={filterStatus}>
        <option value="">{t('depreciation.filter.allStatus')}</option>
        <option value="active">{t('depreciation.status.active')}</option>
        <option value="fully_depreciated">{t('depreciation.status.fully_depreciated')}</option>
        <option value="stopped">{t('depreciation.status.stopped')}</option>
      </select>
      <select class="select-base" bind:value={filterMethod}>
        <option value="">{t('depreciation.filter.allMethods')}</option>
        <option value="straight_line">{t('depreciation.method.straight_line')}</option>
        <option value="declining_balance">{t('depreciation.method.declining_balance')}</option>
        <option value="double_declining">{t('depreciation.method.double_declining')}</option>
        <option value="sum_of_years">{t('depreciation.method.sum_of_years')}</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
        <input type="checkbox" class="rounded" bind:checked={filterEndingSoon} onchange={loadSchedules} />
        <AlertTriangle class="w-3.5 h-3.5 text-warning" />
        {t('depreciation.filter.endingSoon')}
      </label>
    </div>

    {#if schedulesError}
      <div class="alert alert-error flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />{schedulesError}
      </div>
    {/if}

    <div class="card overflow-hidden">
      {#if schedulesLoading}
        <div class="p-8 text-center text-slate-400">{t('common.loading')}</div>
      {:else if filteredSchedules.length === 0}
        <div class="p-12 text-center">
          <TrendingDown class="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p class="text-slate-300 font-medium">{t('depreciation.empty.schedules')}</p>
          <p class="text-slate-500 text-sm mt-1">{t('depreciation.empty.schedulesHint')}</p>
          <button class="btn btn-primary mt-4" onclick={openCreate}>
            <Plus class="w-4 h-4" /> {t('depreciation.createSchedule')}
          </button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table w-full">
            <thead>
              <tr>
                <th>{t('depreciation.field.assetTag')}</th>
                <th>{t('depreciation.field.assetName')}</th>
                <th>{t('depreciation.field.method')}</th>
                <th class="text-right">{t('depreciation.field.originalCost')}</th>
                <th class="text-right">{t('depreciation.field.annualRate')}</th>
                <th class="text-right">{t('depreciation.field.accumulated')}</th>
                <th class="text-right">{t('depreciation.field.bookValue')}</th>
                <th>{t('depreciation.field.progress')}</th>
                <th>{t('depreciation.field.endDate')}</th>
                <th>{t('depreciation.field.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each filteredSchedules as s (s.id)}
                <tr>
                  <td class="font-mono text-sm text-slate-300">{s.assetTag ?? '—'}</td>
                  <td class="max-w-48 truncate">{s.assetName ?? '—'}</td>
                  <td class="text-xs">{t('depreciation.method.' + s.depreciationMethod)}</td>
                  <td class="text-right tabular-nums">{fmtCurrency(s.originalCost)}</td>
                  <td class="text-right tabular-nums text-warning">{fmtPct(annualRate(s))}</td>
                  <td class="text-right tabular-nums">{fmtCurrency(s.accumulatedDepreciation)}</td>
                  <td class="text-right tabular-nums text-success font-medium">{fmtCurrency(bookValue(s))}</td>
                  <td class="w-28">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full bg-primary transition-all"
                          style="width: {Math.min(Number(s.depreciationProgressPercent ?? 0), 100)}%"
                        ></div>
                      </div>
                      <span class="text-xs text-slate-400 tabular-nums w-8 text-right">
                        {Number(s.depreciationProgressPercent ?? 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td class="text-xs text-slate-400">{fmtDate(s.endDate)}</td>
                  <td>
                    <span class="badge {statusClass[s.status]}">{t('depreciation.status.' + s.status)}</span>
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button class="btn btn-xs" title={t('common.view')} onclick={() => { detailTarget = s }}>
                        <Eye class="w-3.5 h-3.5" />
                      </button>
                      {#if s.status === 'active'}
                        <button
                          class="btn btn-xs text-error border-error/30 hover:bg-error/10"
                          title={t('depreciation.stopSchedule')}
                          onclick={() => openStop(s)}
                        >
                          <Square class="w-3.5 h-3.5" />
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  <!-- ── TAB: Entries ──────────────────────────────────────────────────────────── -->
  {:else if activeTab === 'entries'}

    <!-- Action bar -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Sub-filter tabs -->
      <div class="flex rounded-lg border border-border overflow-hidden">
        <button
          class="px-3 py-1.5 text-sm {entriesFilter === 'pending' ? 'bg-surface-2 text-slate-100' : 'text-slate-400 hover:text-slate-200'}"
          onclick={() => { entriesFilter = 'pending'; selectedEntryIds = new Set() }}
        >
          <Clock class="w-3.5 h-3.5 inline mr-1" />
          {t('depreciation.entry.filterPending')}
          {#if pendingEntries.length > 0}
            <span class="ml-1 bg-warning/20 text-warning text-xs px-1.5 rounded">{pendingEntries.length}</span>
          {/if}
        </button>
        <button
          class="px-3 py-1.5 text-sm border-l border-border {entriesFilter === 'all' ? 'bg-surface-2 text-slate-100' : 'text-slate-400 hover:text-slate-200'}"
          onclick={() => { entriesFilter = 'all'; selectedEntryIds = new Set() }}
        >
          {t('depreciation.entry.filterAll')}
          <span class="ml-1 text-xs text-slate-500">({entries.length})</span>
        </button>
      </div>

      <div class="flex-1"></div>

      <!-- Post selected -->
      {#if selectedPendingCount > 0}
        <button
          class="btn btn-primary"
          onclick={() => { showPostConfirm = true }}
        >
          <Check class="w-4 h-4" />
          {t('depreciation.entry.postSelected', { count: selectedPendingCount })}
        </button>
      {/if}

      <!-- Run Monthly button -->
      <button
        class="btn"
        onclick={() => { runYear = new Date().getFullYear(); runMonth = new Date().getMonth() + 1; showRunModal = true }}
      >
        <Play class="w-4 h-4" />
        {t('depreciation.runMonthly')}
      </button>

      <button class="btn btn-xs" onclick={loadEntries} aria-label="refresh entries">
        <RefreshCw class="w-3.5 h-3.5" />
      </button>
    </div>

    {#if entriesError}
      <div class="alert alert-error flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />{entriesError}
      </div>
    {/if}

    <div class="card overflow-hidden">
      {#if entriesLoading}
        <div class="p-8 text-center text-slate-400">{t('common.loading')}</div>
      {:else if filteredEntries.length === 0}
        <div class="p-12 text-center">
          <FileText class="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p class="text-slate-300 font-medium">
            {entriesFilter === 'pending' ? t('depreciation.entry.noPending') : t('depreciation.entry.noEntries')}
          </p>
          <p class="text-slate-500 text-sm mt-1">{t('depreciation.entry.noPendingHint')}</p>
          <button
            class="btn mt-4"
            onclick={() => { runYear = new Date().getFullYear(); runMonth = new Date().getMonth() + 1; showRunModal = true }}
          >
            <Play class="w-4 h-4" /> {t('depreciation.runMonthly')}
          </button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table w-full">
            <thead>
              <tr>
                {#if entriesFilter === 'pending'}
                  <th class="w-10">
                    <button onclick={toggleAllPending} class="p-0.5">
                      {#if allPendingSelected}
                        <CheckSquare class="w-4 h-4 text-primary" />
                      {:else}
                        <Square class="w-4 h-4 text-slate-500" />
                      {/if}
                    </button>
                  </th>
                {/if}
                <th>{t('depreciation.field.period')}</th>
                <th>{t('depreciation.field.assetTag')}</th>
                <th>{t('depreciation.field.assetName')}</th>
                <th class="text-right">{t('depreciation.field.beginningValue')}</th>
                <th class="text-right">{t('depreciation.field.depreciationAmount')}</th>
                <th class="text-right">{t('depreciation.field.endingValue')}</th>
                <th>{t('depreciation.field.posted')}</th>
                <th>{t('depreciation.entry.postedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredEntries as entry (entry.id)}
                <tr
                  class="{entriesFilter === 'pending' && !entry.isPosted ? 'cursor-pointer hover:bg-surface-2/50' : ''}"
                  onclick={() => entriesFilter === 'pending' && !entry.isPosted && toggleEntry(entry.id)}
                >
                  {#if entriesFilter === 'pending'}
                    <td onclick={(e) => e.stopPropagation()}>
                      {#if !entry.isPosted}
                        <button class="p-0.5" onclick={() => toggleEntry(entry.id)}>
                          {#if selectedEntryIds.has(entry.id)}
                            <CheckSquare class="w-4 h-4 text-primary" />
                          {:else}
                            <Square class="w-4 h-4 text-slate-500" />
                          {/if}
                        </button>
                      {/if}
                    </td>
                  {/if}
                  <td class="font-mono text-sm">{fmtPeriod(entry.periodYear, entry.periodMonth)}</td>
                  <td class="font-mono text-xs text-slate-300">{entry.assetTag ?? '—'}</td>
                  <td class="max-w-36 truncate text-sm">{entry.assetName ?? '—'}</td>
                  <td class="text-right tabular-nums text-sm">{fmtCurrency(entry.beginningBookValue)}</td>
                  <td class="text-right tabular-nums text-sm text-warning font-medium">{fmtCurrency(entry.depreciationAmount)}</td>
                  <td class="text-right tabular-nums text-sm text-success">{fmtCurrency(entry.endingBookValue)}</td>
                  <td>
                    {#if entry.isPosted}
                      <span class="badge badge-success flex items-center gap-1 w-fit">
                        <Check class="w-3 h-3" /> {t('depreciation.field.posted')}
                      </span>
                    {:else if entry.isAdjustment}
                      <span class="badge badge-warning">{t('depreciation.entry.adjustmentLabel')}</span>
                    {:else}
                      <span class="badge badge-warning flex items-center gap-1 w-fit">
                        <Clock class="w-3 h-3" /> Chờ ghi sổ
                      </span>
                    {/if}
                  </td>
                  <td class="text-xs text-slate-400">{entry.isPosted ? fmtDateTime(entry.postedAt) : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  <!-- ── TAB: Runs ─────────────────────────────────────────────────────────────── -->
  {:else if activeTab === 'runs'}

    <div class="flex items-center gap-3">
      <div class="flex-1"></div>
      <button
        class="btn"
        onclick={() => { runYear = new Date().getFullYear(); runMonth = new Date().getMonth() + 1; showRunModal = true }}
      >
        <Play class="w-4 h-4" /> {t('depreciation.runMonthly')}
      </button>
      <button class="btn btn-xs" onclick={loadRuns} aria-label="refresh runs">
        <RefreshCw class="w-3.5 h-3.5" />
      </button>
    </div>

    {#if runsError}
      <div class="alert alert-error flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />{runsError}
      </div>
    {/if}

    <div class="card overflow-hidden">
      {#if runsLoading}
        <div class="p-8 text-center text-slate-400">{t('common.loading')}</div>
      {:else if runs.length === 0}
        <div class="p-12 text-center">
          <History class="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p class="text-slate-300 font-medium">{t('depreciation.run.empty')}</p>
          <p class="text-slate-500 text-sm mt-1">{t('depreciation.run.emptyHint')}</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table w-full">
            <thead>
              <tr>
                <th>{t('depreciation.run.code')}</th>
                <th>{t('depreciation.run.period')}</th>
                <th>{t('depreciation.run.type')}</th>
                <th>{t('depreciation.field.status')}</th>
                <th class="text-right">{t('depreciation.run.assets')}</th>
                <th class="text-right">{t('depreciation.run.amount')}</th>
                <th>{t('depreciation.run.completedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {#each runs as run (run.id)}
                <tr>
                  <td class="font-mono text-sm text-slate-300">{run.runCode}</td>
                  <td class="font-mono text-sm">{fmtPeriod(run.periodYear, run.periodMonth)}</td>
                  <td>
                    <span class="text-xs text-slate-400">
                      {t('depreciation.run.type_label.' + run.runType)}
                    </span>
                  </td>
                  <td>
                    <span class="badge {runStatusClass[run.status] ?? 'badge-primary'}">
                      {t('depreciation.run.status.' + run.status)}
                    </span>
                  </td>
                  <td class="text-right tabular-nums">{run.totalAssets ?? 0}</td>
                  <td class="text-right tabular-nums text-warning">{fmtCurrency(run.totalAmount ?? 0)}</td>
                  <td class="text-xs text-slate-400">{fmtDateTime(run.completedAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

</div>

<!-- ── Create modal ──────────────────────────────────────────────────────────── -->
{#if showCreate}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onclick={() => { showCreate = false }}>
    <div class="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold">{t('depreciation.newSchedule')}</h2>
        <button class="btn btn-xs" onclick={() => { showCreate = false }}><X class="w-4 h-4" /></button>
      </div>

      <form onsubmit={handleCreate} class="flex flex-col gap-4">

        <!-- Asset -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-300" for="dep-asset">
            {t('depreciation.field.asset')} *
          </label>
          <select id="dep-asset" class="select-base" bind:value={form.assetId} required>
            <option value="">— {t('depreciation.field.asset')} —</option>
            {#each assets as a (a.id)}
              <option value={a.id}>{a.assetCode} — {a.modelName ?? a.modelId ?? a.id}</option>
            {/each}
          </select>
        </div>

        <!-- Method -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-300" for="dep-method">
            {t('depreciation.field.method')} *
          </label>
          <select id="dep-method" class="select-base" bind:value={form.depreciationMethod}>
            <option value="straight_line">{t('depreciation.method.straight_line')}</option>
            <option value="declining_balance">{t('depreciation.method.declining_balance')}</option>
            <option value="double_declining">{t('depreciation.method.double_declining')}</option>
            <option value="sum_of_years">{t('depreciation.method.sum_of_years')}</option>
          </select>
          {#if form.depreciationMethod === 'straight_line'}
            <p class="text-xs text-slate-500">Phổ biến nhất, phù hợp với Thông tư 45/2013/TT-BTC</p>
          {:else if form.depreciationMethod === 'declining_balance' || form.depreciationMethod === 'double_declining'}
            <p class="text-xs text-slate-500">Khấu hao nhanh hơn ở những năm đầu</p>
          {/if}
        </div>

        <!-- Original cost + Salvage -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-300" for="dep-cost">
              {t('depreciation.field.originalCost')} (VND) *
            </label>
            <input id="dep-cost" type="number" min="0" step="1000" class="input-base"
              bind:value={form.originalCost} required />
            <p class="text-xs text-slate-500">{t('depreciation.hint.originalCost')}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-300" for="dep-salvage">
              {t('depreciation.field.salvageValue')} (VND)
            </label>
            <input id="dep-salvage" type="number" min="0" step="1000" class="input-base"
              bind:value={form.salvageValue} />
            <p class="text-xs text-slate-500">{t('depreciation.hint.salvageValue')}</p>
          </div>
        </div>

        <!-- Useful life + Start date -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-300" for="dep-life">
              {t('depreciation.field.usefulLifeYears')} *
            </label>
            <input id="dep-life" type="number" min="1" max="50" step="1" class="input-base"
              bind:value={form.usefulLifeYears} required />
            <p class="text-xs text-slate-500">{t('depreciation.hint.usefulLifeYears')}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-300" for="dep-start">
              {t('depreciation.field.startDate')} *
            </label>
            <input id="dep-start" type="date" class="input-base" bind:value={form.startDate} required />
            <p class="text-xs text-slate-500">{t('depreciation.hint.startDate')}</p>
          </div>
        </div>

        <!-- Calculated preview (inline) -->
        {#if form.originalCost > 0 && form.usefulLifeYears > 0}
          {@const depreciable = form.originalCost - (form.salvageValue ?? 0)}
          {@const annualAmt = depreciable / form.usefulLifeYears}
          {@const rate = (annualAmt / form.originalCost) * 100}
          <div class="bg-surface-2 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-xs text-slate-400">{t('depreciation.field.annualRate')}</p>
              <p class="font-semibold text-warning">{rate.toFixed(2)}%</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">{t('depreciation.field.annualAmount')}</p>
              <p class="font-semibold">{fmtCurrency(annualAmt)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">{t('depreciation.field.monthlyAmount')}</p>
              <p class="font-semibold text-primary">{fmtCurrency(annualAmt / 12)}</p>
            </div>
          </div>
        {/if}

        <!-- Notes -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-300" for="dep-notes">
            {t('depreciation.field.notes')}
          </label>
          <textarea id="dep-notes" class="input-base min-h-16 resize-y" bind:value={form.notes}></textarea>
        </div>

        {#if createError}
          <div class="alert alert-error text-sm">{createError}</div>
        {/if}

        <div class="flex justify-between pt-2">
          <button type="button" class="btn" onclick={handlePreview}
            disabled={previewLoading || !form.originalCost || !form.usefulLifeYears}>
            {previewLoading ? t('common.loading') : t('depreciation.previewSchedule')}
          </button>
          <div class="flex gap-2">
            <button type="button" class="btn" onclick={() => { showCreate = false }}>{t('common.cancel')}</button>
            <button type="submit" class="btn btn-primary" disabled={creating || !form.assetId || !form.originalCost}>
              {creating ? t('common.loading') : t('common.create')}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Preview modal ─────────────────────────────────────────────────────────── -->
{#if showPreview && preview}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onclick={() => { showPreview = false }}>
    <div class="modal-panel w-full max-w-xl max-h-[85vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">{t('depreciation.preview.title')}</h2>
        <button class="btn btn-xs" onclick={() => { showPreview = false }}><X class="w-4 h-4" /></button>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400">{t('depreciation.field.originalCost')}</p>
          <p class="font-semibold">{fmtCurrency(preview.originalCost)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400">{t('depreciation.field.salvageValue')}</p>
          <p class="font-semibold">{fmtCurrency(preview.salvageValue)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400">{t('depreciation.preview.depreciableAmount')}</p>
          <p class="font-semibold text-warning">{fmtCurrency(preview.depreciableAmount)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400">{t('depreciation.preview.monthlyAmount')}</p>
          <p class="font-semibold text-primary">{fmtCurrency(preview.monthlyDepreciation)}</p>
        </div>
      </div>

      <button
        class="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-3"
        onclick={() => { showPreviewTable = !showPreviewTable }}
      >
        {#if showPreviewTable}<ChevronUp class="w-4 h-4" />{:else}<ChevronDown class="w-4 h-4" />{/if}
        {t('depreciation.preview.schedule')}
      </button>

      {#if showPreviewTable}
        <div class="overflow-x-auto rounded border border-border">
          <table class="w-full text-xs">
            <thead class="bg-surface-2">
              <tr>
                <th class="px-3 py-2 text-left text-slate-400">{t('depreciation.preview.period')}</th>
                <th class="px-3 py-2 text-right text-slate-400">{t('depreciation.preview.amount')}</th>
                <th class="px-3 py-2 text-right text-slate-400">{t('depreciation.preview.accumulated')}</th>
                <th class="px-3 py-2 text-right text-slate-400">{t('depreciation.preview.bookValue')}</th>
              </tr>
            </thead>
            <tbody>
              {#each preview.entries as entry (entry.periodYear + '-' + entry.periodMonth)}
                <tr class="border-t border-border hover:bg-surface-2/50">
                  <td class="px-3 py-1.5 font-mono">{fmtPeriod(entry.periodYear, entry.periodMonth)}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{fmtCurrency(entry.depreciationAmount)}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums text-warning">{fmtCurrency(entry.accumulatedDepreciation)}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums text-success">{fmtCurrency(entry.bookValue)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="flex justify-end mt-4">
        <button class="btn btn-primary" onclick={() => { showPreview = false }}>{t('common.close')}</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Run Monthly modal ─────────────────────────────────────────────────────── -->
{#if showRunModal}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onclick={() => { showRunModal = false }}>
    <div class="modal-panel w-full max-w-md" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold flex items-center gap-2">
          <Play class="w-5 h-5 text-primary" />
          {t('depreciation.runMonthly')}
        </h2>
        <button class="btn btn-xs" onclick={() => { showRunModal = false }}><X class="w-4 h-4" /></button>
      </div>

      <p class="text-sm text-slate-400 mb-4">
        {t('depreciation.confirm.runMonthly', {
          month: String(runMonth).padStart(2, '0'),
          year: runYear
        })}
      </p>

      <div class="grid grid-cols-2 gap-4 mb-5">
        <div class="flex flex-col gap-1">
          <label class="text-sm text-slate-400" for="run-year">Năm</label>
          <input id="run-year" type="number" min="2020" max="2040" class="input-base" bind:value={runYear} />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-slate-400" for="run-month">Tháng</label>
          <select id="run-month" class="select-base" bind:value={runMonth}>
            {#each Array.from({length: 12}, (_, i) => i + 1) as m}
              <option value={m}>{String(m).padStart(2, '0')}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if dashboard && dashboard.activeSchedules > 0}
        <div class="bg-surface-2 rounded-lg p-3 text-sm mb-4">
          <p class="text-slate-300">
            Sẽ tạo bút toán cho <span class="text-primary font-semibold">{dashboard.activeSchedules}</span> tài sản đang khấu hao.
          </p>
        </div>
      {/if}

      <div class="flex justify-end gap-2">
        <button class="btn" onclick={() => { showRunModal = false }}>{t('common.cancel')}</button>
        <button class="btn btn-primary" onclick={handleRunMonthly} disabled={running}>
          {#if running}
            <RefreshCw class="w-4 h-4 animate-spin" />
          {:else}
            <Play class="w-4 h-4" />
          {/if}
          {running ? t('common.loading') : t('depreciation.runMonthly')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Post confirm modal ────────────────────────────────────────────────────── -->
{#if showPostConfirm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onclick={() => { showPostConfirm = false }}>
    <div class="modal-panel w-full max-w-sm" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-semibold mb-2">{t('depreciation.postEntries')}</h2>
      <p class="text-slate-400 text-sm mb-4">
        {t('depreciation.confirm.postEntries', { count: selectedPendingCount })}
      </p>
      <div class="flex justify-end gap-2">
        <button class="btn" onclick={() => { showPostConfirm = false }}>{t('common.cancel')}</button>
        <button class="btn btn-primary" onclick={handlePostEntries} disabled={posting}>
          {posting ? t('common.loading') : t('depreciation.postEntries')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Stop modal ────────────────────────────────────────────────────────────── -->
{#if stopTarget}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onclick={() => { stopTarget = null }}>
    <div class="modal-panel w-full max-w-md" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-semibold mb-2">{t('depreciation.stopSchedule')}</h2>
      <p class="text-slate-400 text-sm mb-3">{t('depreciation.confirm.stop')}</p>
      <p class="text-sm text-slate-300 mb-4 font-medium">{stopTarget.assetTag} — {stopTarget.assetName}</p>
      <div class="flex flex-col gap-1 mb-4">
        <label class="text-sm text-slate-400" for="stop-reason">{t('depreciation.field.stoppedReason')}</label>
        <input id="stop-reason" type="text" class="input-base" bind:value={stopReason} />
      </div>
      <div class="flex justify-end gap-2">
        <button class="btn" onclick={() => { stopTarget = null }}>{t('common.cancel')}</button>
        <button class="btn bg-error/20 text-error border-error/30 hover:bg-error/30"
          onclick={handleStop} disabled={stopping}>
          {stopping ? t('common.loading') : t('depreciation.stopSchedule')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Detail drawer ─────────────────────────────────────────────────────────── -->
{#if detailTarget}
  {@const s = detailTarget}
  <div class="fixed inset-0 z-40 flex items-end justify-end" onclick={() => { detailTarget = null }}>
    <div class="bg-surface-1 border-l border-border w-full max-w-md h-full overflow-y-auto p-6 flex flex-col gap-4 shadow-2xl"
      onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">{t('depreciation.schedule')}</h2>
        <button class="btn btn-xs" onclick={() => { detailTarget = null }}><X class="w-4 h-4" /></button>
      </div>

      <div>
        <p class="text-sm font-medium text-slate-200">{s.assetTag} — {s.assetName}</p>
        {#if s.categoryName}
          <p class="text-xs text-slate-400 mt-0.5">{s.categoryName}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <span class="badge {statusClass[s.status]}">{t('depreciation.status.' + s.status)}</span>
        <span class="text-sm text-slate-400">{t('depreciation.method.' + s.depreciationMethod)}</span>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.originalCost')}</p>
          <p class="font-semibold">{fmtCurrency(s.originalCost)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.salvageValue')}</p>
          <p class="font-semibold">{fmtCurrency(s.salvageValue ?? 0)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.accumulated')}</p>
          <p class="font-semibold text-warning">{fmtCurrency(s.accumulatedDepreciation)}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.bookValue')}</p>
          <p class="font-semibold text-success">{fmtCurrency(bookValue(s))}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.annualRate')}</p>
          <p class="font-semibold text-warning">{fmtPct(annualRate(s))}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.monthlyAmount')}</p>
          <p class="font-semibold">{s.monthlyDepreciation ? fmtCurrency(s.monthlyDepreciation) : '—'}</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.usefulLifeYears')}</p>
          <p class="font-semibold">{s.usefulLifeYears} năm</p>
        </div>
        <div class="bg-surface-2 rounded-lg p-3">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.remainingMonths')}</p>
          <p class="font-semibold {s.remainingMonths && s.remainingMonths <= 6 ? 'text-warning' : ''}">
            {s.remainingMonths ?? '—'} tháng
          </p>
        </div>
      </div>

      {#if s.depreciationProgressPercent !== undefined}
        <div>
          <div class="flex justify-between text-xs text-slate-400 mb-1">
            <span>{t('depreciation.field.progress')}</span>
            <span>{Number(s.depreciationProgressPercent ?? 0).toFixed(1)}%</span>
          </div>
          <div class="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all"
              style="width: {Math.min(s.depreciationProgressPercent, 100)}%"></div>
          </div>
        </div>
      {/if}

      <div class="text-sm text-slate-400 space-y-1 border-t border-border pt-3">
        <div class="flex justify-between">
          <span>{t('depreciation.field.startDate')}</span>
          <span class="text-slate-300">{fmtDate(s.startDate)}</span>
        </div>
        <div class="flex justify-between">
          <span>{t('depreciation.field.endDate')}</span>
          <span class="text-slate-300">{fmtDate(s.endDate)}</span>
        </div>
        {#if s.stoppedAt}
          <div class="flex justify-between">
            <span>{t('depreciation.field.stoppedReason')}</span>
            <span class="text-slate-300 text-right max-w-40 truncate">{s.stoppedReason ?? '—'}</span>
          </div>
        {/if}
      </div>

      {#if s.notes}
        <div class="bg-surface-2 rounded-lg p-3 text-sm">
          <p class="text-xs text-slate-400 mb-1">{t('depreciation.field.notes')}</p>
          <p class="text-slate-300">{s.notes}</p>
        </div>
      {/if}

      <div class="flex gap-2 mt-auto">
        <button
          class="btn flex-1"
          onclick={() => { detailTarget = null; switchTab('entries') }}
        >
          <FileText class="w-4 h-4" /> Xem bút toán
        </button>
        {#if s.status === 'active'}
          <button
            class="btn text-error border-error/30 hover:bg-error/10"
            onclick={() => { detailTarget = null; openStop(s) }}
          >
            <Square class="w-4 h-4" /> {t('depreciation.stopSchedule')}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
