<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import {
    FileCode, Plus, Trash2, Edit, History, RotateCcw,
    Copy, Check, Search, Eye, ArrowRight, Upload
  } from 'lucide-svelte'
  import { _, isLoading } from '$lib/i18n'
  import { toast } from '$lib/components/toast'
  import { Button } from '$lib/components/ui'
  import { Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui'
  import Modal from '$lib/components/Modal.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import TextareaField from '$lib/components/TextareaField.svelte'
  import SelectField from '$lib/components/SelectField.svelte'
  import {
    listConfigFiles,
    createConfigFile,
    updateConfigFile,
    deleteConfigFile,
    listConfigFileVersions,
    listCis,
    type CmdbConfigFileRecord,
    type CmdbConfigFileVersionRecord,
    type CmdbConfigFileType,
    type ConfigFileCreateInput,
    type ConfigFileUpdateInput,
    type CiRecord
  } from '$lib/api/cmdb'

  // ── Props ─────────────────────────────────────────────────────────────────
  let { ciId }: { ciId?: string } = $props()
  const isGlobalView = $derived(!ciId)

  // ── Data state ────────────────────────────────────────────────────────────
  let files       = $state<CmdbConfigFileRecord[]>([])
  let ciList      = $state<CiRecord[]>([])
  let loading     = $state(true)
  let error       = $state('')
  let total       = $state(0)
  let currentPage = $state(1)
  const PAGE_SIZE = 20

  // ── Filters ───────────────────────────────────────────────────────────────
  let searchQ      = $state('')
  let filterCiId   = $state(ciId ?? '')
  let filterType   = $state('')
  let searchDebounce: ReturnType<typeof setTimeout>

  // ── Modal state ───────────────────────────────────────────────────────────
  let createOpen   = $state(false)
  let editOpen     = $state(false)
  let editingFile  = $state<CmdbConfigFileRecord | null>(null)
  let deleteOpen   = $state(false)
  let deletingFile = $state<CmdbConfigFileRecord | null>(null)
  let viewOpen     = $state(false)
  let viewingFile  = $state<CmdbConfigFileRecord | null>(null)
  let historyOpen  = $state(false)
  let diffOpen     = $state(false)

  // ── Version & diff state ─────────────────────────────────────────────────
  let versions        = $state<CmdbConfigFileVersionRecord[]>([])
  let versionsLoading = $state(false)
  let diffOldVer      = $state<CmdbConfigFileVersionRecord | null>(null)
  let diffNewVer      = $state<CmdbConfigFileVersionRecord | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────
  let formCiId          = $state('')   // only used in global view create
  let formName          = $state('')
  let formFileType      = $state<CmdbConfigFileType>('config')
  let formLanguage      = $state('')
  let formDescription   = $state('')
  let formFilePath      = $state('')
  let formContent       = $state('')
  let formChangeSummary = $state('')
  let formSubmitting    = $state(false)

  // ── Copy state ────────────────────────────────────────────────────────────
  let copiedId = $state<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)))

  const fileTypeOptions = $derived([
    { value: 'config',   label: $isLoading ? 'Config'    : $_('cmdb.configFiles.fileType.config') },
    { value: 'script',   label: $isLoading ? 'Script'    : $_('cmdb.configFiles.fileType.script') },
    { value: 'template', label: $isLoading ? 'Template'  : $_('cmdb.configFiles.fileType.template') },
    { value: 'env',      label: $isLoading ? 'Env vars'  : $_('cmdb.configFiles.fileType.env') },
    { value: 'other',    label: $isLoading ? 'Other'     : $_('cmdb.configFiles.fileType.other') }
  ])

  const typeFilterOptions = $derived([
    { value: '', label: $isLoading ? 'All types' : $_('cmdb.changes.all') },
    ...fileTypeOptions
  ])

  const ciOptions = $derived([
    { value: '', label: $isLoading ? 'All CIs' : $_('cmdb.configFiles.allCis') },
    ...ciList.map(c => ({ value: c.id, label: c.name }))
  ])

  // ── Diff engine (pure JS LCS) ─────────────────────────────────────────────
  type DiffLine = { type: 'equal' | 'added' | 'removed'; content: string; lineA: number | null; lineB: number | null }

  function computeLCS(a: string[], b: string[]): number[][] {
    const m = a.length, n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
    return dp
  }

  function computeDiff(oldText: string, newText: string): DiffLine[] {
    const a = oldText.split('\n')
    const b = newText.split('\n')
    const dp = computeLCS(a, b)
    const result: DiffLine[] = []
    let i = a.length, j = b.length
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
        result.unshift({ type: 'equal',   content: a[i-1], lineA: i, lineB: j }); i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        result.unshift({ type: 'added',   content: b[j-1], lineA: null, lineB: j }); j--
      } else {
        result.unshift({ type: 'removed', content: a[i-1], lineA: i, lineB: null }); i--
      }
    }
    return result
  }

  const diffLines = $derived(
    diffOldVer && diffNewVer
      ? computeDiff(diffOldVer.content, diffNewVer.content)
      : [] as DiffLine[]
  )

  const diffStats = $derived({
    added:     diffLines.filter(l => l.type === 'added').length,
    removed:   diffLines.filter(l => l.type === 'removed').length,
    unchanged: diffLines.filter(l => l.type === 'equal').length
  })

  // ── Load functions ────────────────────────────────────────────────────────
  async function load(page = 1) {
    try {
      loading = true; error = ''
      const res = await listConfigFiles({
        ciId:     filterCiId || undefined,
        fileType: (filterType as CmdbConfigFileType) || undefined,
        q:        searchQ || undefined,
        page,
        limit:    PAGE_SIZE
      })
      files       = res.data
      total       = res.meta?.total ?? res.data.length
      currentPage = page
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  async function loadCiList() {
    if (!isGlobalView) return
    try {
      const res = await listCis({ limit: 200 })
      ciList = res.data ?? []
    } catch { /* ignore */ }
  }

  async function loadVersions(file: CmdbConfigFileRecord) {
    versionsLoading = true; versions = []
    try {
      const res = await listConfigFileVersions(file.id)
      versions = res.data
    } catch (e) { toast.error(String(e)) }
    finally { versionsLoading = false }
  }

  onMount(async () => {
    await Promise.all([load(), loadCiList()])
  })

  // ── Search debounce ───────────────────────────────────────────────────────
  function onSearchInput(v: string) {
    searchQ = v
    clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => load(1), 350)
  }

  function applyFilters() { load(1) }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function resetForm() {
    formCiId = ciId ?? ''; formName = ''; formFileType = 'config'; formLanguage = ''
    formDescription = ''; formFilePath = ''; formContent = ''; formChangeSummary = ''
  }

  function openCreate() { resetForm(); createOpen = true }

  function openEdit(file: CmdbConfigFileRecord) {
    editingFile       = file
    formName          = file.name
    formFileType      = file.fileType
    formLanguage      = file.language ?? ''
    formDescription   = file.description ?? ''
    formFilePath      = file.filePath ?? ''
    formContent       = file.content
    formChangeSummary = ''
    editOpen = true
  }

  function openView(file: CmdbConfigFileRecord) {
    viewingFile = file
    viewOpen    = true
  }

  async function openHistory(file: CmdbConfigFileRecord) {
    viewingFile = file; historyOpen = true
    await loadVersions(file)
  }

  function openDiff(older: CmdbConfigFileVersionRecord, newer: CmdbConfigFileVersionRecord) {
    diffOldVer = older; diffNewVer = newer; diffOpen = true
  }

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  async function copyContent(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copiedId = id
      setTimeout(() => { if (copiedId === id) copiedId = null }, 1800)
    } catch { toast.error('Copy failed') }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function submitCreate() {
    const targetCiId = ciId ?? formCiId
    if (!formName.trim() || !targetCiId) return
    formSubmitting = true
    try {
      await createConfigFile({
        ciId: targetCiId,
        name: formName.trim(),
        fileType: formFileType,
        language: formLanguage.trim() || null,
        description: formDescription.trim() || null,
        filePath: formFilePath.trim() || null,
        content: formContent,
        changeSummary: formChangeSummary.trim() || null
      })
      toast.success($isLoading ? 'Config file added' : $_('cmdb.configFiles.createSuccess'))
      createOpen = false; await load(1)
    } catch (e) { toast.error(String(e)) }
    finally { formSubmitting = false }
  }

  async function submitEdit() {
    if (!editingFile || !formName.trim()) return
    formSubmitting = true
    try {
      await updateConfigFile(editingFile.id, {
        name: formName.trim(),
        fileType: formFileType,
        language: formLanguage.trim() || null,
        description: formDescription.trim() || null,
        filePath: formFilePath.trim() || null,
        content: formContent,
        changeSummary: formChangeSummary.trim() || null
      })
      toast.success($isLoading ? 'Updated' : $_('cmdb.configFiles.updateSuccess'))
      editOpen = false
      // refresh viewing file if open
      if (viewingFile?.id === editingFile.id)
        viewingFile = { ...viewingFile, content: formContent, currentVersion: (viewingFile.currentVersion ?? 0) + 1 }
      await load(currentPage)
    } catch (e) { toast.error(String(e)) }
    finally { formSubmitting = false }
  }

  async function confirmDelete() {
    if (!deletingFile) return
    try {
      await deleteConfigFile(deletingFile.id)
      toast.success($isLoading ? 'Deleted' : $_('cmdb.configFiles.deleteSuccess'))
      deleteOpen = false; deletingFile = null; await load(1)
    } catch (e) { toast.error(String(e)) }
  }

  async function restoreVersion(ver: CmdbConfigFileVersionRecord) {
    if (!viewingFile) return
    try {
      await updateConfigFile(viewingFile.id, {
        content: ver.content,
        changeSummary: `Restored to v${ver.version}`
      })
      toast.success($_('cmdb.configFiles.restoreSuccess', { values: { version: ver.version } }))
      historyOpen = false; diffOpen = false
      await load(currentPage)
    } catch (e) { toast.error(String(e)) }
  }

  // ── File import ───────────────────────────────────────────────────────────
  const EXT_LANG: Record<string, string> = {
    conf: 'nginx', cfg: 'ini', ini: 'ini', toml: 'toml', yaml: 'yaml', yml: 'yaml',
    json: 'json', xml: 'xml', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'fish',
    py: 'python', js: 'javascript', ts: 'typescript', rb: 'ruby', go: 'go',
    sql: 'sql', env: 'env', properties: 'properties', tf: 'terraform', hcl: 'hcl',
    Dockerfile: 'dockerfile', makefile: 'makefile', txt: '', md: 'markdown'
  }
  const EXT_TYPE: Record<string, CmdbConfigFileType> = {
    sh: 'script', bash: 'script', zsh: 'script', fish: 'script', py: 'script',
    env: 'env', j2: 'template', jinja: 'template', jinja2: 'template', tpl: 'template'
  }

  function onFileImport(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : file.name.toLowerCase()
    const reader = new FileReader()
    reader.onload = (ev) => {
      formContent = (ev.target?.result as string) ?? ''
      if (!formName) formName = file.name
      if (!formLanguage && EXT_LANG[ext] !== undefined) formLanguage = EXT_LANG[ext]
      if (EXT_TYPE[ext]) formFileType = EXT_TYPE[ext]
    }
    reader.readAsText(file, 'utf-8')
    input.value = ''   // reset so same file can be re-imported
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function fileTypeBadge(ft: CmdbConfigFileType): string {
    return ({ config: 'badge-info', script: 'badge-warning', template: 'badge-secondary', env: 'badge-success', other: 'badge-neutral' })[ft] ?? 'badge-neutral'
  }

  function fmt(iso: string) { return new Date(iso).toLocaleString() }
  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString() }

  function lineCount(text: string) { return text ? text.split('\n').length : 0 }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- MAIN PANEL                                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="space-y-4">

  <!-- ── Header ── -->
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <FileCode class="h-4 w-4 text-primary shrink-0" />
      <h3 class="text-base font-semibold truncate">
        {$isLoading
          ? (isGlobalView ? 'All Config Files' : 'Config Files')
          : (isGlobalView ? $_('cmdb.configFiles.titleGlobal') : $_('cmdb.configFiles.title'))}
      </h3>
      {#if total > 0}
        <span class="text-xs text-slate-400 shrink-0">({total})</span>
      {/if}
    </div>

    <Button size="sm" variant="primary" onclick={openCreate}>
      {#snippet leftIcon()}<Plus class="h-3 w-3" />{/snippet}
      {$isLoading ? 'Add Config File' : $_('cmdb.configFiles.add')}
    </Button>
  </div>

  <!-- ── Filters ── -->
  <div class="flex flex-wrap gap-2">
    <!-- Search -->
    <div class="relative flex-1 min-w-48">
      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
      <input
        type="text"
        class="input-base pl-8 w-full text-sm"
        placeholder={$isLoading ? 'Search by name, path...' : $_('cmdb.configFiles.search')}
        value={searchQ}
        oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
      />
    </div>

    <!-- CI filter (global view only) -->
    {#if isGlobalView}
      <select class="select-base text-sm" bind:value={filterCiId} onchange={applyFilters}>
        {#each ciOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    {/if}

    <!-- File type filter -->
    <select class="select-base text-sm" bind:value={filterType} onchange={applyFilters}>
      {#each typeFilterOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <!-- ── Table ── -->
  {#if loading}
    <div class="space-y-2">
      {#each [1,2,3] as _}<div class="skeleton-row"></div>{/each}
    </div>
  {:else if error}
    <div class="alert alert-error">{error}</div>
  {:else if files.length === 0}
    <div class="empty-state py-10 text-center">
      <FileCode class="h-10 w-10 text-slate-600 mx-auto mb-3" />
      <p class="text-slate-400 text-sm">
        {$isLoading ? 'No config files found.' : (searchQ || filterCiId || filterType)
          ? $_('cmdb.configFiles.emptyFiltered')
          : isGlobalView
            ? $_('cmdb.configFiles.emptyGlobal')
            : $_('cmdb.configFiles.empty')}
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <tr>
            <TableHeaderCell>{$isLoading ? 'File name' : $_('cmdb.configFiles.header.name')}</TableHeaderCell>
            {#if isGlobalView}
              <TableHeaderCell>{$isLoading ? 'CI' : $_('cmdb.configFiles.header.ci')}</TableHeaderCell>
            {/if}
            <TableHeaderCell>{$isLoading ? 'Type' : $_('cmdb.configFiles.header.fileType')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Syntax' : $_('cmdb.configFiles.header.language')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Path' : $_('cmdb.configFiles.header.filePath')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Ver' : $_('cmdb.configFiles.header.version')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Updated' : $_('cmdb.configFiles.header.updatedAt')}</TableHeaderCell>
            <TableHeaderCell align="right">{$isLoading ? 'Actions' : $_('cmdb.configFiles.header.actions')}</TableHeaderCell>
          </tr>
        </TableHeader>
        <tbody>
          {#each files as file (file.id)}
            <TableRow>
              <!-- Name + description -->
              <TableCell>
                <button
                  type="button"
                  class="text-left hover:text-primary transition-colors"
                  onclick={() => openView(file)}
                >
                  <span class="font-medium text-sm">{file.name}</span>
                  {#if file.description}
                    <p class="text-xs text-slate-500 mt-0.5 truncate max-w-48">{file.description}</p>
                  {/if}
                </button>
              </TableCell>

              <!-- CI name (global only) -->
              {#if isGlobalView}
                <TableCell>
                  {#if file.ciName}
                    <button
                      type="button"
                      class="text-xs text-primary hover:underline flex items-center gap-1"
                      onclick={() => goto(`/cmdb/cis/${file.ciId}?tab=config-files`)}
                    >
                      {file.ciName}
                      <ArrowRight class="h-2.5 w-2.5" />
                    </button>
                  {:else}
                    <span class="text-slate-500 text-xs">—</span>
                  {/if}
                </TableCell>
              {/if}

              <!-- File type badge -->
              <TableCell>
                <span class="badge {fileTypeBadge(file.fileType)} text-xs">
                  {$isLoading ? file.fileType : $_(`cmdb.configFiles.fileType.${file.fileType}`)}
                </span>
              </TableCell>

              <!-- Language -->
              <TableCell>
                {#if file.language}
                  <code class="code-inline text-xs">{file.language}</code>
                {:else}
                  <span class="text-slate-600">—</span>
                {/if}
              </TableCell>

              <!-- Path -->
              <TableCell>
                {#if file.filePath}
                  <code class="code-inline text-xs truncate max-w-40 block" title={file.filePath}>{file.filePath}</code>
                {:else}
                  <span class="text-slate-600">—</span>
                {/if}
              </TableCell>

              <!-- Version -->
              <TableCell>
                <span class="text-xs font-mono text-slate-400">v{file.currentVersion}</span>
              </TableCell>

              <!-- Updated -->
              <TableCell>
                <span class="text-xs text-slate-500">{fmtDate(file.updatedAt)}</span>
              </TableCell>

              <!-- Actions -->
              <TableCell align="right">
                <div class="cell-actions">
                  <Button size="sm" variant="ghost" title="View" onclick={() => openView(file)}>
                    {#snippet leftIcon()}<Eye class="h-3 w-3" />{/snippet}
                  </Button>
                  <Button size="sm" variant="ghost" title="History" onclick={() => openHistory(file)}>
                    {#snippet leftIcon()}<History class="h-3 w-3" />{/snippet}
                  </Button>
                  {#if ciId}
                    <Button size="sm" variant="secondary" onclick={() => openEdit(file)}>
                      {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                      {$isLoading ? 'Edit' : $_('common.edit')}
                    </Button>
                    <Button size="sm" variant="danger" onclick={() => { deletingFile = file; deleteOpen = true }}>
                      {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
                    </Button>
                  {/if}
                </div>
              </TableCell>
            </TableRow>
          {/each}
        </tbody>
      </Table>
    </div>

    <!-- ── Pagination ── -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between text-xs text-slate-400 mt-2">
        <span>{$isLoading ? `Page ${currentPage}/${totalPages} · ${total}` : $_('cmdb.pagination.page', { values: { current: currentPage, total: totalPages, count: total } })}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" disabled={currentPage <= 1} onclick={() => load(currentPage - 1)}>
            {$isLoading ? '← Prev' : $_('cmdb.pagination.prev')}
          </Button>
          <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onclick={() => load(currentPage + 1)}>
            {$isLoading ? 'Next →' : $_('cmdb.pagination.next')}
          </Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- VIEW MODAL — content + line numbers + copy                             -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{#if viewingFile}
<Modal bind:open={viewOpen} title={$isLoading ? 'View Config File' : $_('cmdb.configFiles.viewTitle')}>
  <div class="space-y-4">
    <!-- Meta info -->
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span class="text-slate-500 text-xs uppercase tracking-wide">{$isLoading ? 'Name' : $_('cmdb.configFiles.fields.name')}</span>
        <p class="font-medium mt-0.5">{viewingFile.name}</p>
      </div>
      <div>
        <span class="text-slate-500 text-xs uppercase tracking-wide">{$isLoading ? 'Type' : $_('cmdb.configFiles.header.fileType')}</span>
        <p class="mt-0.5">
          <span class="badge {fileTypeBadge(viewingFile.fileType)} text-xs">
            {$isLoading ? viewingFile.fileType : $_(`cmdb.configFiles.fileType.${viewingFile.fileType}`)}
          </span>
          {#if viewingFile.language}
            <code class="code-inline text-xs ml-1">{viewingFile.language}</code>
          {/if}
        </p>
      </div>
      {#if viewingFile.filePath}
        <div class="col-span-2">
          <span class="text-slate-500 text-xs uppercase tracking-wide">{$isLoading ? 'Path' : $_('cmdb.configFiles.header.filePath')}</span>
          <code class="code-inline text-xs block mt-0.5">{viewingFile.filePath}</code>
        </div>
      {/if}
      {#if viewingFile.description}
        <div class="col-span-2">
          <span class="text-slate-500 text-xs uppercase tracking-wide">{$isLoading ? 'Description' : $_('cmdb.configFiles.fields.description')}</span>
          <p class="text-slate-300 text-sm mt-0.5">{viewingFile.description}</p>
        </div>
      {/if}
    </div>

    <!-- Content viewer with line numbers -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-slate-500">
          {$isLoading ? `v${viewingFile.currentVersion}` : $_('cmdb.configFiles.currentVersion')}
          · v{viewingFile.currentVersion}
          · {$isLoading ? `${lineCount(viewingFile.content)} lines` : $_('cmdb.configFiles.lineCount', { values: { n: lineCount(viewingFile.content) } })}
        </span>
        <Button size="sm" variant="ghost" onclick={() => copyContent('view-' + viewingFile!.id, viewingFile!.content)}>
          {#snippet leftIcon()}
            {#if copiedId === 'view-' + viewingFile?.id}
              <Check class="h-3 w-3 text-success" />
            {:else}
              <Copy class="h-3 w-3" />
            {/if}
          {/snippet}
          {copiedId === 'view-' + viewingFile?.id
            ? ($isLoading ? 'Copied!' : $_('cmdb.configFiles.copied'))
            : ($isLoading ? 'Copy' : $_('cmdb.configFiles.copyContent'))}
        </Button>
      </div>
      <!-- Line-numbered code viewer -->
      <div class="bg-slate-950 rounded-md border border-slate-800 overflow-auto max-h-80">
        <table class="w-full text-xs font-mono border-collapse">
          {#each viewingFile.content.split('\n') as line, i}
            <tr class="hover:bg-slate-800/40">
              <td class="select-none text-right text-slate-600 px-3 py-0 w-10 border-r border-slate-800 sticky left-0 bg-slate-950">{i + 1}</td>
              <td class="px-3 py-0 text-slate-200 whitespace-pre">{line || ' '}</td>
            </tr>
          {/each}
        </table>
      </div>
    </div>

    <div class="flex justify-between gap-2 pt-1">
      {#if ciId}
        <Button size="sm" variant="secondary" onclick={() => { viewOpen = false; openEdit(viewingFile!) }}>
          {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
          {$isLoading ? 'Edit' : $_('common.edit')}
        </Button>
      {/if}
      <div class="flex gap-2 ml-auto">
        <Button size="sm" variant="secondary" onclick={() => { viewOpen = false; openHistory(viewingFile!) }}>
          {#snippet leftIcon()}<History class="h-3 w-3" />{/snippet}
          {$isLoading ? 'History' : $_('cmdb.configFiles.versionsTitle')}
        </Button>
        <Button size="sm" variant="secondary" onclick={() => (viewOpen = false)}>
          {$isLoading ? 'Close' : $_('common.close')}
        </Button>
      </div>
    </div>
  </div>
</Modal>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- HISTORY MODAL                                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{#if viewingFile}
<Modal bind:open={historyOpen} title={$isLoading ? 'Version History' : $_('cmdb.configFiles.versionsTitle')}>
  <p class="text-xs text-slate-500 mb-3">{viewingFile.name} · {$isLoading ? `${versions.length} versions` : ''}</p>

  {#if versionsLoading}
    <div class="space-y-2">{#each [1,2,3] as _}<div class="skeleton-row"></div>{/each}</div>
  {:else if versions.length === 0}
    <p class="text-sm text-slate-400">{$isLoading ? 'No versions yet.' : $_('cmdb.configFiles.versionsEmpty')}</p>
  {:else}
    <div class="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {#each versions as ver, idx}
        {@const isLatest = idx === 0}
        {@const prevVer = versions[idx + 1] ?? null}
        <div class="rounded-md border border-border bg-surface-1 px-3 py-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-sm font-semibold">v{ver.version}</span>
                {#if isLatest}
                  <span class="badge-success text-xs px-1.5 py-0.5 rounded">current</span>
                {/if}
                {#if ver.changeSummary}
                  <span class="text-slate-400 text-xs truncate">— {ver.changeSummary}</span>
                {/if}
              </div>
              <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{fmt(ver.createdAt)}</span>
                <span>·</span>
                <span>{$isLoading ? `${lineCount(ver.content)} lines` : $_('cmdb.configFiles.lineCount', { values: { n: lineCount(ver.content) } })}</span>
              </div>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <!-- Copy this version -->
              <Button size="sm" variant="ghost" title="Copy" onclick={() => copyContent('ver-' + ver.id, ver.content)}>
                {#snippet leftIcon()}
                  {#if copiedId === 'ver-' + ver.id}
                    <Check class="h-3 w-3 text-success" />
                  {:else}
                    <Copy class="h-3 w-3" />
                  {/if}
                {/snippet}
              </Button>
              <!-- Diff with previous -->
              {#if prevVer}
                <Button size="sm" variant="secondary" onclick={() => { historyOpen = false; openDiff(prevVer, ver) }}>
                  {$isLoading ? 'Diff' : $_('cmdb.configFiles.viewDiff')}
                </Button>
              {/if}
              <!-- Restore (not for current) -->
              {#if !isLatest}
                <Button size="sm" variant="secondary" onclick={() => restoreVersion(ver)}>
                  {#snippet leftIcon()}<RotateCcw class="h-3 w-3" />{/snippet}
                  {$isLoading ? 'Restore' : $_('cmdb.configFiles.restore')}
                </Button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="flex justify-end mt-4">
    <Button variant="secondary" onclick={() => (historyOpen = false)}>
      {$isLoading ? 'Close' : $_('common.close')}
    </Button>
  </div>
</Modal>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- DIFF MODAL — line-by-line diff with color coding                       -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{#if diffOldVer && diffNewVer}
<Modal bind:open={diffOpen} title={$isLoading ? `Compare v${diffOldVer.version} → v${diffNewVer.version}` : $_('cmdb.configFiles.diffTitle', { values: { a: diffOldVer.version, b: diffNewVer.version } })}>
  <!-- Stats bar -->
  {#if diffLines.length > 0}
    <div class="flex gap-4 text-xs mb-3">
      {#if diffStats.added > 0}
        <span class="text-green-400">
          + {$isLoading ? `${diffStats.added} added` : $_('cmdb.configFiles.diffAdded', { values: { n: diffStats.added } })}
        </span>
      {/if}
      {#if diffStats.removed > 0}
        <span class="text-red-400">
          − {$isLoading ? `${diffStats.removed} removed` : $_('cmdb.configFiles.diffRemoved', { values: { n: diffStats.removed } })}
        </span>
      {/if}
      <span class="text-slate-500">
        = {$isLoading ? `${diffStats.unchanged} unchanged` : $_('cmdb.configFiles.diffUnchanged', { values: { n: diffStats.unchanged } })}
      </span>
    </div>
  {:else}
    <p class="text-sm text-slate-400 mb-3">{$isLoading ? 'Versions are identical.' : $_('cmdb.configFiles.diffEmpty')}</p>
  {/if}

  <!-- Unified diff view -->
  <div class="bg-slate-950 rounded-md border border-slate-800 overflow-auto max-h-[480px]">
    <table class="w-full text-xs font-mono border-collapse min-w-0">
      <thead class="sticky top-0 bg-slate-900 z-10">
        <tr>
          <th class="text-slate-500 font-normal px-2 py-1 w-8 text-right border-r border-slate-800">v{diffOldVer.version}</th>
          <th class="text-slate-500 font-normal px-2 py-1 w-8 text-right border-r border-slate-800">v{diffNewVer.version}</th>
          <th class="text-slate-500 font-normal px-3 py-1 text-left">content</th>
        </tr>
      </thead>
      <tbody>
        {#each diffLines as dl, i}
          {@const bg = dl.type === 'added' ? 'bg-green-950/60' : dl.type === 'removed' ? 'bg-red-950/60' : ''}
          {@const tc = dl.type === 'added' ? 'text-green-300' : dl.type === 'removed' ? 'text-red-300' : 'text-slate-300'}
          {@const prefix = dl.type === 'added' ? '+' : dl.type === 'removed' ? '−' : ' '}
          <tr class="{bg} {i % 2 === 0 && dl.type === 'equal' ? 'bg-slate-900/20' : ''}">
            <td class="text-slate-600 text-right px-2 py-0 w-8 border-r border-slate-800 select-none">
              {dl.lineA ?? ''}
            </td>
            <td class="text-slate-600 text-right px-2 py-0 w-8 border-r border-slate-800 select-none">
              {dl.lineB ?? ''}
            </td>
            <td class="px-3 py-0 whitespace-pre {tc}">
              <span class="select-none mr-1 opacity-60">{prefix}</span>{dl.content || ' '}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex justify-between gap-2 mt-4">
    <Button size="sm" variant="secondary" onclick={() => { diffOpen = false; historyOpen = true }}>
      ← {$isLoading ? 'Back to History' : $_('cmdb.configFiles.versionsTitle')}
    </Button>
    {#if viewingFile && diffNewVer.version !== viewingFile.currentVersion}
      <Button size="sm" variant="secondary" onclick={() => restoreVersion(diffNewVer!)}>
        {#snippet leftIcon()}<RotateCcw class="h-3 w-3" />{/snippet}
        {$isLoading ? 'Restore v' + diffNewVer.version : $_('cmdb.configFiles.restore')}
      </Button>
    {/if}
    <Button variant="secondary" onclick={() => (diffOpen = false)}>
      {$isLoading ? 'Close' : $_('common.close')}
    </Button>
  </div>
</Modal>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- CREATE MODAL                                                            -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<Modal bind:open={createOpen} title={$isLoading ? 'Add New Config File' : $_('cmdb.configFiles.createTitle')}>
  <form class="space-y-3" onsubmit={(e) => { e.preventDefault(); void submitCreate() }}>
    {#if isGlobalView}
      <SelectField id="cfg-ci-c" label={$isLoading ? 'CI *' : $_('cmdb.configFiles.fields.ci')}
        value={formCiId}
        options={[{ value: '', label: $isLoading ? '— Select CI —' : $_('cmdb.configFiles.fields.selectCi') }, ...ciList.map(c => ({ value: c.id, label: c.name }))]}
        onValueChange={(v) => (formCiId = v)} disabled={formSubmitting} />
    {/if}
    <div class="grid grid-cols-2 gap-3">
      <TextField id="cfg-name-c" label={$isLoading ? 'File name *' : $_('cmdb.configFiles.fields.name')} required
        value={formName} placeholder="nginx.conf"
        onValueChange={(v) => (formName = v)} disabled={formSubmitting} />
      <SelectField id="cfg-type-c" label={$isLoading ? 'Type' : $_('cmdb.configFiles.fields.fileType')}
        value={formFileType} options={fileTypeOptions}
        onValueChange={(v) => (formFileType = v as CmdbConfigFileType)} disabled={formSubmitting} />
      <TextField id="cfg-lang-c" label={$isLoading ? 'Language' : $_('cmdb.configFiles.fields.language')}
        value={formLanguage} placeholder="nginx, bash, yaml..."
        onValueChange={(v) => (formLanguage = v)} disabled={formSubmitting} />
      <TextField id="cfg-path-c" label={$isLoading ? 'Server path' : $_('cmdb.configFiles.fields.filePath')}
        value={formFilePath} placeholder="/etc/nginx/nginx.conf"
        onValueChange={(v) => (formFilePath = v)} disabled={formSubmitting} />
    </div>
    <TextareaField id="cfg-desc-c" label={$isLoading ? 'Description' : $_('cmdb.configFiles.fields.description')}
      value={formDescription} onValueChange={(v) => (formDescription = v)}
      disabled={formSubmitting} rows={2} />

    <!-- Content with line count + import button -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label for="cfg-content-c" class="text-sm font-medium">
          {$isLoading ? 'Content' : $_('cmdb.configFiles.fields.content')}
        </label>
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500">
            {$isLoading ? `${lineCount(formContent)} lines` : $_('cmdb.configFiles.lineCount', { values: { n: lineCount(formContent) } })}
          </span>
          <!-- Hidden file input -->
          <input id="file-import-c" type="file" class="sr-only" accept="*/*" onchange={onFileImport} disabled={formSubmitting} />
          <label for="file-import-c"
            class="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium cursor-pointer
                   bg-surface-3 text-slate-200 hover:bg-surface-3/80 border border-slate-600 transition-colors
                   disabled:opacity-45">
            <Upload class="h-3 w-3" />
            {$isLoading ? 'Import file' : $_('cmdb.configFiles.importFile')}
          </label>
        </div>
      </div>
      <textarea
        id="cfg-content-c"
        class="input-base w-full font-mono text-xs resize-y"
        rows={12}
        bind:value={formContent}
        disabled={formSubmitting}
        spellcheck={false}
      ></textarea>
    </div>

    <TextareaField id="cfg-summary-c" label={$isLoading ? 'Change notes (optional)' : $_('cmdb.configFiles.fields.changeSummary')}
      value={formChangeSummary} placeholder="Initial version"
      onValueChange={(v) => (formChangeSummary = v)} disabled={formSubmitting} rows={2} />

    <div class="flex justify-end gap-2 pt-1">
      <Button variant="secondary" type="button" onclick={() => (createOpen = false)} disabled={formSubmitting}>
        {$isLoading ? 'Cancel' : $_('common.cancel')}
      </Button>
      <Button variant="primary" type="submit" disabled={formSubmitting || !formName.trim() || (isGlobalView && !formCiId)}>
        {$isLoading ? 'Create' : $_('common.create')}
      </Button>
    </div>
  </form>
</Modal>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- EDIT MODAL                                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<Modal bind:open={editOpen} title={$isLoading ? 'Edit Config File' : $_('cmdb.configFiles.editTitle')}>
  <form class="space-y-3" onsubmit={(e) => { e.preventDefault(); void submitEdit() }}>
    <div class="grid grid-cols-2 gap-3">
      <TextField id="cfg-name-e" label={$isLoading ? 'File name *' : $_('cmdb.configFiles.fields.name')} required
        value={formName} placeholder="nginx.conf"
        onValueChange={(v) => (formName = v)} disabled={formSubmitting} />
      <SelectField id="cfg-type-e" label={$isLoading ? 'Type' : $_('cmdb.configFiles.fields.fileType')}
        value={formFileType} options={fileTypeOptions}
        onValueChange={(v) => (formFileType = v as CmdbConfigFileType)} disabled={formSubmitting} />
      <TextField id="cfg-lang-e" label={$isLoading ? 'Language' : $_('cmdb.configFiles.fields.language')}
        value={formLanguage} placeholder="nginx, bash, yaml..."
        onValueChange={(v) => (formLanguage = v)} disabled={formSubmitting} />
      <TextField id="cfg-path-e" label={$isLoading ? 'Server path' : $_('cmdb.configFiles.fields.filePath')}
        value={formFilePath} placeholder="/etc/nginx/nginx.conf"
        onValueChange={(v) => (formFilePath = v)} disabled={formSubmitting} />
    </div>
    <TextareaField id="cfg-desc-e" label={$isLoading ? 'Description' : $_('cmdb.configFiles.fields.description')}
      value={formDescription} onValueChange={(v) => (formDescription = v)}
      disabled={formSubmitting} rows={2} />

    <!-- Content with line count + version bump warning + import -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label for="cfg-content-e" class="text-sm font-medium">
          {$isLoading ? 'Content' : $_('cmdb.configFiles.fields.content')}
        </label>
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500">
            {$isLoading ? `${lineCount(formContent)} lines` : $_('cmdb.configFiles.lineCount', { values: { n: lineCount(formContent) } })}
            {#if formContent !== editingFile?.content}
              <span class="text-amber-400 ml-1">→ v{(editingFile?.currentVersion ?? 0) + 1}</span>
            {/if}
          </span>
          <input id="file-import-e" type="file" class="sr-only" accept="*/*" onchange={onFileImport} disabled={formSubmitting} />
          <label for="file-import-e"
            class="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium cursor-pointer
                   bg-surface-3 text-slate-200 hover:bg-surface-3/80 border border-slate-600 transition-colors">
            <Upload class="h-3 w-3" />
            {$isLoading ? 'Import file' : $_('cmdb.configFiles.importFile')}
          </label>
        </div>
      </div>
      <textarea
        id="cfg-content-e"
        class="input-base w-full font-mono text-xs resize-y"
        rows={12}
        bind:value={formContent}
        disabled={formSubmitting}
        spellcheck={false}
      ></textarea>
    </div>

    {#if formContent !== editingFile?.content}
      <TextareaField id="cfg-summary-e" label={$isLoading ? 'Change notes' : $_('cmdb.configFiles.fields.changeSummary')}
        value={formChangeSummary} placeholder="What changed?"
        onValueChange={(v) => (formChangeSummary = v)} disabled={formSubmitting} rows={2} />
    {/if}

    <div class="flex justify-end gap-2 pt-1">
      <Button variant="secondary" type="button" onclick={() => (editOpen = false)} disabled={formSubmitting}>
        {$isLoading ? 'Cancel' : $_('common.cancel')}
      </Button>
      <Button variant="primary" type="submit" disabled={formSubmitting || !formName.trim()}>
        {$isLoading ? 'Save' : $_('common.save')}
      </Button>
    </div>
  </form>
</Modal>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- DELETE CONFIRM                                                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<Modal bind:open={deleteOpen} title={$isLoading ? 'Delete' : $_('common.delete')}>
  <p class="text-sm text-slate-300 mb-4">
    {$isLoading
      ? `Delete "${deletingFile?.name}"?`
      : $_('cmdb.configFiles.deleteConfirm', { values: { name: deletingFile?.name ?? '' } })}
  </p>
  <div class="flex justify-end gap-2">
    <Button variant="secondary" onclick={() => { deleteOpen = false; deletingFile = null }}>
      {$isLoading ? 'Cancel' : $_('common.cancel')}
    </Button>
    <Button variant="danger" onclick={confirmDelete}>
      {$isLoading ? 'Delete' : $_('common.delete')}
    </Button>
  </div>
</Modal>
