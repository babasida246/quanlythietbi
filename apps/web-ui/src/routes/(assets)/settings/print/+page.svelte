<script lang="ts">
  import { onMount } from 'svelte'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { Button } from '$lib/components/ui'
  import { _, isLoading } from '$lib/i18n'
  import {
    listDocumentTemplates,
    createDocumentTemplate,
    updateDocumentTemplate,
    listDocumentTemplateVersions,
    publishDocumentTemplateVersion,
    type DocumentTemplateSummary,
    type DocumentTemplateVersion,
  } from '$lib/api/printTemplates'
  import {
    uploadDocxTemplateVersion,
    renderDocx,
    downloadDocxFromBase64,
    type BuiltinPrintType,
  } from '$lib/api/print'

  // ── Built-in templates ─────────────────────────────────────────────────────
  const BUILTIN_TYPES: Array<{ type: BuiltinPrintType; name: string; module: string }> = [
    { type: 'phieu-nhap-kho',      name: 'Phiếu nhập kho',        module: 'Kho hàng' },
    { type: 'phieu-xuat-kho',      name: 'Phiếu xuất kho',        module: 'Kho hàng' },
    { type: 'bien-ban-ban-giao',   name: 'Biên bản bàn giao',     module: 'Tài sản' },
    { type: 'bien-ban-luan-chuyen',name: 'Biên bản luân chuyển',  module: 'Tài sản' },
    { type: 'bien-ban-thu-hoi',    name: 'Biên bản thu hồi',      module: 'Tài sản' },
    { type: 'lenh-sua-chua',       name: 'Lệnh sửa chữa',         module: 'Bảo trì' },
    { type: 'bien-ban-kiem-ke',    name: 'Biên bản kiểm kê',      module: 'Kiểm kê' },
    { type: 'phieu-muon',          name: 'Phiếu mượn',            module: 'Tài sản' },
    { type: 'bien-ban-thanh-ly',   name: 'Biên bản thanh lý',     module: 'Tài sản' },
    { type: 'yeu-cau-mua-sam',     name: 'Yêu cầu mua sắm',       module: 'Mua sắm' },
    { type: 'bao-cao-tai-san',     name: 'Báo cáo tài sản',       module: 'Báo cáo' },
  ]

  const MODULE_OPTIONS = [
    { value: 'warehouse', label: 'Kho hàng' },
    { value: 'assets',    label: 'Tài sản' },
    { value: 'maintenance', label: 'Bảo trì' },
    { value: 'inventory', label: 'Kiểm kê' },
    { value: 'reports',   label: 'Báo cáo' },
    { value: 'requests',  label: 'Yêu cầu' },
    { value: 'other',     label: 'Khác' },
  ]

  // ── Custom templates state ─────────────────────────────────────────────────
  let templates = $state<DocumentTemplateSummary[]>([])
  let templatesLoading = $state(true)
  let templatesError = $state('')

  // Create form
  let showCreate = $state(false)
  let createName = $state('')
  let createDesc = $state('')
  let createModule = $state('warehouse')
  let createFile = $state<File | null>(null)
  let creating = $state(false)
  let createError = $state('')

  // Expanded version panel
  let expandedId = $state('')
  let versions = $state<DocumentTemplateVersion[]>([])
  let versionsLoading = $state(false)
  let versionsError = $state('')

  // Upload new version
  let uploadFile = $state<File | null>(null)
  let uploadNote = $state('')
  let uploading = $state(false)
  let uploadError = $state('')
  let uploadSuccess = $state('')

  // Row-level feedback
  let actionError = $state('')
  let actionSuccess = $state('')
  let downloadingId = $state('')
  let publishingId = $state('')
  let deactivatingId = $state('')

  onMount(async () => {
    await loadTemplates()
  })

  async function loadTemplates() {
    templatesLoading = true
    templatesError = ''
    try {
      templates = await listDocumentTemplates({ includeVersions: true, limit: 100 })
    } catch (e) {
      templatesError = String(e)
    } finally {
      templatesLoading = false
    }
  }

  async function handleCreate() {
    if (!createName.trim()) return
    creating = true
    createError = ''
    try {
      const tpl = await createDocumentTemplate({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
        module: createModule,
        htmlContent: '',
      })
      if (createFile) {
        await uploadDocxTemplateVersion(tpl.id, createFile, {
          title: 'v1',
          changeNote: 'Initial upload',
        })
      }
      showCreate = false
      createName = ''
      createDesc = ''
      createFile = null
      await loadTemplates()
    } catch (e) {
      createError = String(e)
    } finally {
      creating = false
    }
  }

  function cancelCreate() {
    showCreate = false
    createName = ''
    createDesc = ''
    createFile = null
    createError = ''
  }

  async function toggleExpand(tpl: DocumentTemplateSummary) {
    actionError = ''
    actionSuccess = ''
    if (expandedId === tpl.id) {
      expandedId = ''
      versions = []
      return
    }
    expandedId = tpl.id
    uploadFile = null
    uploadNote = ''
    uploadError = ''
    uploadSuccess = ''
    await loadVersions(tpl.id)
  }

  async function loadVersions(templateId: string) {
    versionsLoading = true
    versionsError = ''
    try {
      versions = await listDocumentTemplateVersions(templateId)
    } catch (e) {
      versionsError = String(e)
    } finally {
      versionsLoading = false
    }
  }

  async function handleUploadVersion() {
    if (!uploadFile || !expandedId) return
    uploading = true
    uploadError = ''
    uploadSuccess = ''
    try {
      await uploadDocxTemplateVersion(expandedId, uploadFile, {
        changeNote: uploadNote.trim() || undefined,
      })
      uploadFile = null
      uploadNote = ''
      uploadSuccess = 'Đã tải lên phiên bản mới.'
      await loadVersions(expandedId)
      await loadTemplates()
    } catch (e) {
      uploadError = String(e)
    } finally {
      uploading = false
    }
  }

  async function handlePublishVersion(templateId: string, versionId: string) {
    publishingId = versionId
    actionError = ''
    actionSuccess = ''
    try {
      await publishDocumentTemplateVersion(templateId, versionId)
      actionSuccess = 'Đã publish phiên bản.'
      await loadVersions(templateId)
      await loadTemplates()
    } catch (e) {
      actionError = String(e)
    } finally {
      publishingId = ''
    }
  }

  async function handleDownload(tpl: DocumentTemplateSummary) {
    const versionId = tpl.activeVersionId ?? tpl.latestVersion?.id
    if (!versionId) {
      actionError = 'Chưa có phiên bản nào để tải xuống.'
      return
    }
    downloadingId = tpl.id
    actionError = ''
    actionSuccess = ''
    try {
      const res = await renderDocx(tpl.id, versionId, {}, tpl.name)
      downloadDocxFromBase64(res.data.content, res.data.fileName || `${tpl.name}.docx`)
    } catch (e) {
      actionError = String(e)
    } finally {
      downloadingId = ''
    }
  }

  async function handleDeactivate(tpl: DocumentTemplateSummary) {
    const ok = window.confirm(`Vô hiệu hóa mẫu "${tpl.name}"?`)
    if (!ok) return
    deactivatingId = tpl.id
    actionError = ''
    try {
      await updateDocumentTemplate(tpl.id, { isActive: false })
      await loadTemplates()
    } catch (e) {
      actionError = String(e)
    } finally {
      deactivatingId = ''
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function moduleLabel(mod: string) {
    return MODULE_OPTIONS.find((o) => o.value === mod)?.label ?? mod
  }

  function versionBadgeClass(status: string) {
    if (status === 'published') return 'badge-success'
    if (status === 'archived') return 'badge-secondary'
    return 'badge-warning'
  }
</script>

<div class="page-shell page-content">
  <PageHeader
    title={$isLoading ? 'Mẫu in' : $_('printTemplates.title')}
    subtitle={$isLoading ? 'Quản lý mẫu in tích hợp và mẫu in tùy chỉnh (.docx)' : $_('printTemplates.subtitle')}
  />

  <!-- ── Built-in templates ─────────────────────────────────────────────── -->
  <div class="card p-4 space-y-3">
    <div>
      <h2 class="text-sm font-semibold" style="color: var(--color-text)">
        {$isLoading ? 'Mẫu in tích hợp' : $_('printTemplates.builtin.title')}
      </h2>
      <p class="text-xs mt-1" style="color: var(--color-text-muted)">
        {$isLoading
          ? '11 mẫu in được cài sẵn, tự động sử dụng khi tải xuống từ phiếu kho, biên bản, v.v.'
          : $_('printTemplates.builtin.subtitle')}
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="data-table w-full text-sm">
        <thead>
          <tr>
            <th class="w-8">#</th>
            <th>{$isLoading ? 'Tên mẫu' : $_('printTemplates.builtin.colName')}</th>
            <th>{$isLoading ? 'Mã phiếu' : $_('printTemplates.builtin.colCode')}</th>
            <th>{$isLoading ? 'Module' : $_('printTemplates.builtin.colModule')}</th>
          </tr>
        </thead>
        <tbody>
          {#each BUILTIN_TYPES as item, i}
            <tr>
              <td class="text-center" style="color: var(--color-text-muted)">{i + 1}</td>
              <td class="font-medium" style="color: var(--color-text)">{item.name}</td>
              <td>
                <code class="text-xs px-1.5 py-0.5 rounded" style="background: var(--color-surface-2); color: var(--color-text-muted)">{item.type}</code>
              </td>
              <td style="color: var(--color-text-muted)">{item.module}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="text-xs" style="color: var(--color-text-muted)">
      {$isLoading
        ? 'Để chỉnh sửa nội dung mẫu in tích hợp, hãy chỉnh sửa file .docx và chạy: pnpm generate:docx-templates'
        : $_('printTemplates.builtin.editHint')}
    </p>
  </div>

  <!-- ── Custom DOCX templates ───────────────────────────────────────────── -->
  <div class="card p-4 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold" style="color: var(--color-text)">
          {$isLoading ? 'Mẫu in tùy chỉnh' : $_('printTemplates.custom.title')}
        </h2>
        <p class="text-xs mt-1" style="color: var(--color-text-muted)">
          {$isLoading
            ? 'Tải lên file .docx với cú pháp {placeholder} để tạo mẫu in riêng cho tổ chức.'
            : $_('printTemplates.custom.subtitle')}
        </p>
      </div>
      {#if !showCreate}
        <Button size="sm" onclick={() => (showCreate = true)}>
          + {$isLoading ? 'Tạo mẫu mới' : $_('printTemplates.custom.createBtn')}
        </Button>
      {/if}
    </div>

    <!-- Create form -->
    {#if showCreate}
      <div class="border rounded-md p-4 space-y-3" style="border-color: var(--color-border)">
        <h3 class="text-sm font-semibold" style="color: var(--color-text)">
          {$isLoading ? 'Tạo mẫu in mới' : $_('printTemplates.custom.createTitle')}
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="space-y-1 text-sm">
            <span class="label-base">{$isLoading ? 'Tên mẫu *' : $_('printTemplates.custom.fieldName')}</span>
            <input
              class="input-base"
              placeholder="Ví dụ: Biên bản bàn giao v2"
              value={createName}
              oninput={(e) => (createName = (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="space-y-1 text-sm">
            <span class="label-base">{$isLoading ? 'Module' : $_('printTemplates.custom.fieldModule')}</span>
            <select
              class="select-base"
              value={createModule}
              onchange={(e) => (createModule = (e.target as HTMLSelectElement).value)}
            >
              {#each MODULE_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </label>
        </div>

        <label class="space-y-1 text-sm block">
          <span class="label-base">{$isLoading ? 'Mô tả' : $_('printTemplates.custom.fieldDesc')}</span>
          <input
            class="input-base"
            placeholder="Mô tả ngắn về mẫu in này"
            value={createDesc}
            oninput={(e) => (createDesc = (e.target as HTMLInputElement).value)}
          />
        </label>

        <label class="space-y-1 text-sm block">
          <span class="label-base">{$isLoading ? 'File .docx (tùy chọn)' : $_('printTemplates.custom.fieldFile')}</span>
          <input
            class="input-base"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onchange={(e) => {
              createFile = (e.target as HTMLInputElement).files?.[0] ?? null
            }}
          />
          <span class="text-xs" style="color: var(--color-text-muted)">
            {$isLoading
              ? 'Dùng cú pháp {placeholder} và {#items}...{/items} cho bảng lặp.'
              : $_('printTemplates.custom.fileHint')}
          </span>
        </label>

        {#if createError}
          <div class="alert alert-error text-sm">{createError}</div>
        {/if}

        <div class="flex gap-2">
          <Button size="sm" onclick={handleCreate} disabled={creating || !createName.trim()}>
            {creating
              ? ($isLoading ? 'Đang tạo...' : $_('printTemplates.custom.creating'))
              : ($isLoading ? 'Tạo mẫu' : $_('printTemplates.custom.createSubmit'))}
          </Button>
          <Button variant="secondary" size="sm" onclick={cancelCreate} disabled={creating}>
            {$isLoading ? 'Hủy' : $_('common.cancel')}
          </Button>
        </div>
      </div>
    {/if}

    <!-- Global action feedback -->
    {#if actionError}
      <div class="alert alert-error text-sm">{actionError}</div>
    {/if}
    {#if actionSuccess}
      <div class="alert alert-success text-sm">{actionSuccess}</div>
    {/if}

    <!-- Templates table -->
    {#if templatesLoading}
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    {:else if templatesError}
      <div class="alert alert-error text-sm">{templatesError}</div>
    {:else if templates.length === 0}
      <div class="text-sm" style="color: var(--color-text-muted)">
        {$isLoading ? 'Chưa có mẫu in tùy chỉnh nào.' : $_('printTemplates.custom.empty')}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th>{$isLoading ? 'Tên mẫu' : $_('printTemplates.custom.colName')}</th>
              <th>{$isLoading ? 'Module' : $_('printTemplates.custom.colModule')}</th>
              <th>{$isLoading ? 'Phiên bản' : $_('printTemplates.custom.colVersion')}</th>
              <th>{$isLoading ? 'Trạng thái' : $_('printTemplates.custom.colStatus')}</th>
              <th>{$isLoading ? 'Cập nhật' : $_('printTemplates.custom.colUpdated')}</th>
              <th>{$isLoading ? 'Thao tác' : $_('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each templates as tpl}
              {@const isExpanded = expandedId === tpl.id}
              {@const activeVer = tpl.activeVersion ?? tpl.latestVersion}
              <tr class:expanded-row={isExpanded}>
                <td>
                  <div class="font-medium" style="color: var(--color-text)">{tpl.name}</div>
                  {#if tpl.description}
                    <div class="text-xs" style="color: var(--color-text-muted)">{tpl.description}</div>
                  {/if}
                </td>
                <td style="color: var(--color-text-muted)">{moduleLabel(tpl.module)}</td>
                <td>
                  {#if activeVer}
                    <span class="text-xs">v{activeVer.versionNo}</span>
                    {#if activeVer.templateFormat === 'docx'}
                      <span class="badge badge-info ml-1">DOCX</span>
                    {/if}
                  {:else}
                    <span class="text-xs" style="color: var(--color-text-muted)">—</span>
                  {/if}
                </td>
                <td>
                  {#if !tpl.isActive}
                    <span class="badge badge-secondary">Vô hiệu</span>
                  {:else if activeVer}
                    <span class="badge {versionBadgeClass(activeVer.status)}">
                      {activeVer.status === 'published' ? 'Đang dùng' : activeVer.status === 'draft' ? 'Nháp' : 'Lưu trữ'}
                    </span>
                  {:else}
                    <span class="badge badge-warning">Chưa có version</span>
                  {/if}
                </td>
                <td style="color: var(--color-text-muted)">{formatDate(tpl.updatedAt)}</td>
                <td>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <Button variant="secondary" size="sm" onclick={() => toggleExpand(tpl)}>
                      {isExpanded
                        ? ($isLoading ? 'Đóng' : $_('common.close'))
                        : ($isLoading ? 'Phiên bản' : $_('printTemplates.custom.manageVersions'))}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onclick={() => handleDownload(tpl)}
                      disabled={downloadingId === tpl.id || !activeVer}
                    >
                      {downloadingId === tpl.id
                        ? ($isLoading ? 'Đang tải...' : $_('common.downloading'))
                        : ($isLoading ? 'Tải .docx' : $_('printTemplates.custom.download'))}
                    </Button>
                    {#if tpl.isActive}
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() => handleDeactivate(tpl)}
                        disabled={deactivatingId === tpl.id}
                      >
                        {$isLoading ? 'Vô hiệu' : $_('printTemplates.custom.deactivate')}
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>

              <!-- ── Version panel (expanded) ────────────────────────────── -->
              {#if isExpanded}
                <tr>
                  <td colspan="6" class="p-0">
                    <div class="version-panel space-y-4">

                      <!-- Version list -->
                      <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-muted)">
                          {$isLoading ? 'Lịch sử phiên bản' : $_('printTemplates.custom.versionsTitle')}
                        </h4>

                        {#if versionsLoading}
                          <div class="skeleton-row"></div>
                        {:else if versionsError}
                          <div class="alert alert-error text-sm">{versionsError}</div>
                        {:else if versions.length === 0}
                          <p class="text-sm" style="color: var(--color-text-muted)">
                            {$isLoading ? 'Chưa có phiên bản nào.' : $_('printTemplates.custom.noVersions')}
                          </p>
                        {:else}
                          <table class="data-table w-full text-xs">
                            <thead>
                              <tr>
                                <th>Ver</th>
                                <th>Định dạng</th>
                                <th>Trạng thái</th>
                                <th>Ghi chú</th>
                                <th>Ngày tạo</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each versions as ver}
                                <tr>
                                  <td class="font-medium">v{ver.versionNo}</td>
                                  <td>
                                    <span class="badge {ver.templateFormat === 'docx' ? 'badge-info' : 'badge-secondary'}">
                                      {ver.templateFormat?.toUpperCase() ?? 'HTML'}
                                    </span>
                                  </td>
                                  <td>
                                    <span class="badge {versionBadgeClass(ver.status)}">
                                      {ver.status === 'published' ? 'Đang dùng' : ver.status === 'draft' ? 'Nháp' : 'Lưu trữ'}
                                    </span>
                                  </td>
                                  <td style="color: var(--color-text-muted)">{ver.changeNote ?? '—'}</td>
                                  <td style="color: var(--color-text-muted)">{formatDate(ver.createdAt)}</td>
                                  <td>
                                    {#if ver.status !== 'published'}
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onclick={() => handlePublishVersion(tpl.id, ver.id)}
                                        disabled={publishingId === ver.id}
                                      >
                                        {publishingId === ver.id
                                          ? 'Đang...'
                                          : ($isLoading ? 'Publish' : $_('printTemplates.custom.publish'))}
                                      </Button>
                                    {/if}
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        {/if}
                      </div>

                      <!-- Upload new version -->
                      <div class="space-y-2 pt-2 border-t" style="border-color: var(--color-border)">
                        <h4 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-muted)">
                          {$isLoading ? 'Tải lên phiên bản mới' : $_('printTemplates.custom.uploadTitle')}
                        </h4>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label class="space-y-1 text-sm">
                            <span class="label-base">{$isLoading ? 'File .docx' : $_('printTemplates.custom.uploadFile')}</span>
                            <input
                              class="input-base"
                              type="file"
                              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onchange={(e) => {
                                uploadFile = (e.target as HTMLInputElement).files?.[0] ?? null
                              }}
                            />
                          </label>
                          <label class="space-y-1 text-sm">
                            <span class="label-base">{$isLoading ? 'Ghi chú thay đổi' : $_('printTemplates.custom.uploadNote')}</span>
                            <input
                              class="input-base"
                              placeholder="Ví dụ: Cập nhật bố cục, thêm cột số lượng"
                              value={uploadNote}
                              oninput={(e) => (uploadNote = (e.target as HTMLInputElement).value)}
                            />
                          </label>
                        </div>

                        {#if uploadError}
                          <div class="alert alert-error text-sm">{uploadError}</div>
                        {/if}
                        {#if uploadSuccess}
                          <div class="alert alert-success text-sm">{uploadSuccess}</div>
                        {/if}

                        <Button
                          size="sm"
                          onclick={handleUploadVersion}
                          disabled={!uploadFile || uploading}
                        >
                          {uploading
                            ? ($isLoading ? 'Đang tải lên...' : $_('printTemplates.custom.uploading'))
                            : ($isLoading ? 'Tải lên' : $_('printTemplates.custom.uploadSubmit'))}
                        </Button>
                      </div>

                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Docxtemplater syntax hint -->
  <div class="card p-4 text-xs space-y-1" style="color: var(--color-text-muted)">
    <strong style="color: var(--color-text)">
      {$isLoading ? 'Cú pháp template (.docx)' : $_('printTemplates.syntaxTitle')}
    </strong>
    <ul class="list-disc list-inside space-y-0.5 mt-1">
      <li><code>{'{field}'}</code> — thay thế giá trị đơn</li>
      <li><code>{'{#items}'}</code> ... <code>{'{/items}'}</code> — lặp theo mảng (dùng cho hàng bảng)</li>
      <li><code>{'{^items}'}</code> ... <code>{'{/items}'}</code> — hiển thị khi mảng rỗng</li>
    </ul>
    <p class="mt-1">
      Khi render từ phiếu kho/biên bản, dữ liệu được truyền vào tự động.
      Tải mẫu về để xem các trường (<code>orgName</code>, <code>sigDate</code>, <code>lines[].i</code>, v.v.).
    </p>
  </div>
</div>

<style>
  .expanded-row {
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  }

  .version-panel {
    padding: 1rem 1.25rem;
    background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }
</style>
