<script lang="ts">
  import { onMount } from 'svelte'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import { Button } from '$lib/components/ui'
  import { _, isLoading } from '$lib/i18n'
  import {
    listDocumentTemplates,
    createDocumentTemplate,
    updateDocumentTemplate,
    deleteDocumentTemplate,
    listDocumentTemplateVersions,
    publishDocumentTemplateVersion,
    upsertLabelSetting,
    getLabelSetting,
    type DocumentTemplateSummary,
    type DocumentTemplateVersion,
  } from '$lib/api/printTemplates'
  import {
    uploadDocxTemplateVersion,
    renderDocx,
    downloadDocxFromBase64,
    extractDocxPlaceholders,
    registerPrintSqlDataSource,
    sandboxPrintSqlDataSource,
    introspectPrintSqlDataSource,
    type BuiltinPrintType,
    type ExtractPlaceholdersResponse,
    type SqlDataSourceKind,
  } from '$lib/api/print'
  import { getCurrentUserId } from '$lib/admin/permissionState'
  import {
    listStockDocuments,
    getStockDocument,
    listRepairOrders,
    getRepairOrder,
    listWarehouses,
    type StockDocumentRecord,
    type RepairOrderRecord,
  } from '$lib/api/warehouse'
  import { listAssets, getAssetDetail, type Asset } from '$lib/api/assets'

  // ── Built-in templates ─────────────────────────────────────────────────────
  const BUILTIN_TYPES: Array<{ type: BuiltinPrintType; name: string; module: string }> = [
    { type: 'phieu-nhap-kho',        name: 'Phiếu nhập kho',        module: 'Kho hàng' },
    { type: 'phieu-xuat-kho',        name: 'Phiếu xuất kho',        module: 'Kho hàng' },
    { type: 'bien-ban-ban-giao',     name: 'Biên bản bàn giao',     module: 'Tài sản' },
    { type: 'bien-ban-luan-chuyen',  name: 'Biên bản luân chuyển',  module: 'Tài sản' },
    { type: 'bien-ban-thu-hoi',      name: 'Biên bản thu hồi',      module: 'Tài sản' },
    { type: 'lenh-sua-chua',         name: 'Lệnh sửa chữa',         module: 'Bảo trì' },
    { type: 'bien-ban-kiem-ke',      name: 'Biên bản kiểm kê',      module: 'Kiểm kê' },
    { type: 'phieu-muon',            name: 'Phiếu mượn',            module: 'Tài sản' },
    { type: 'bien-ban-thanh-ly',     name: 'Biên bản thanh lý',     module: 'Tài sản' },
    { type: 'yeu-cau-mua-sam',       name: 'Yêu cầu mua sắm',       module: 'Mua sắm' },
    { type: 'bao-cao-tai-san',       name: 'Báo cáo tài sản',       module: 'Báo cáo' },
  ]

  const MODULE_OPTIONS = [
    { value: 'warehouse',    label: 'Kho hàng' },
    { value: 'assets',       label: 'Tài sản' },
    { value: 'maintenance',  label: 'Bảo trì' },
    { value: 'inventory',    label: 'Kiểm kê' },
    { value: 'reports',      label: 'Báo cáo' },
    { value: 'requests',     label: 'Yêu cầu' },
    { value: 'other',        label: 'Khác' },
  ]

  // ── Tabs ───────────────────────────────────────────────────────────────────
  type Tab = 'custom' | 'builtin' | 'dataSource' | 'defaults' | 'inspector'
  let activeTab = $state<Tab>('custom')

  // ── Custom templates state ─────────────────────────────────────────────────
  let templates = $state<DocumentTemplateSummary[]>([])
  let templatesLoading = $state(true)
  let templatesError = $state('')

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
  let deletingId = $state('')

  // Field inspector
  let fieldPanel = $state<{ versionId: string } & ExtractPlaceholdersResponse | null>(null)
  let fieldLoading = $state(false)
  let fieldError = $state('')

  // ── Create modal ───────────────────────────────────────────────────────────
  let createOpen = $state(false)
  let createName = $state('')
  let createDesc = $state('')
  let createModule = $state('warehouse')
  let createFile = $state<File | null>(null)
  let creating = $state(false)
  let createError = $state('')

  // ── Edit modal ─────────────────────────────────────────────────────────────
  let editOpen = $state(false)
  let editTarget = $state<DocumentTemplateSummary | null>(null)
  let editName = $state('')
  let editDesc = $state('')
  let editModule = $state('warehouse')
  let editSaving = $state(false)
  let editError = $state('')

  // ── Field Inspector (DB source data) ──────────────────────────────────────
  interface FlatField { key: string; value: unknown; type: string; isArray?: boolean; arrayLen?: number }

  const DB_DOC_TYPES = [
    { value: 'warehouse_issue',   label: 'Phiếu xuất kho' },
    { value: 'warehouse_receipt', label: 'Phiếu nhập kho' },
    { value: 'repair_order',      label: 'Lệnh sửa chữa' },
    { value: 'asset',             label: 'Tài sản' },
  ]

  let dbDocType     = $state('warehouse_issue')
  let dbRecords     = $state<Array<{ id: string; label: string }>>([])
  let dbRecordsLoading = $state(false)
  let dbRecordId    = $state('')
  let dbInspecting  = $state(false)
  let dbError       = $state('')
  let dbSourceData  = $state<Record<string, unknown> | null>(null)
  let dbFields      = $state<FlatField[]>([])
  let copiedField   = $state('')
  let showRawJson   = $state(false)

  // Scalar fields (no numeric index segment)
  const dbScalarFields = $derived(dbFields.filter((f) => !f.isArray && !/\.\d+\./.test(f.key) && !/^\d+/.test(f.key.split('.').at(-1)!)))
  // Array root fields (e.g. "lines[]")
  const dbArrayFields = $derived(dbFields.filter((f) => f.isArray))
  // Array item fields grouped by array name
  const dbArrayItemGroups = $derived.by(() => {
    const groups: Record<string, FlatField[]> = {}
    for (const f of dbFields) {
      const m = f.key.match(/^(.+?)\.\d+\.(.+)$/)
      if (m) {
        const arr = m[1]
        if (!groups[arr]) groups[arr] = []
        // Deduplicate by inner key name
        const inner = m[2]
        if (!groups[arr].some((x) => x.key.replace(/^.+\.\d+\./, '') === inner)) {
          groups[arr].push({ ...f, key: inner })
        }
      }
    }
    return groups
  })

  function flattenForInspector(obj: unknown, prefix = ''): FlatField[] {
    const result: FlatField[] = []
    if (obj === null || obj === undefined) return result
    if (Array.isArray(obj)) {
      result.push({ key: (prefix || 'root') + '[]', value: `[${obj.length} phần tử]`, type: 'array', isArray: true, arrayLen: obj.length })
      for (let i = 0; i < Math.min(obj.length, 1); i++) {
        result.push(...flattenForInspector(obj[i], prefix ? `${prefix}.${i}` : String(i)))
      }
      return result
    }
    if (typeof obj !== 'object') return result
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (value === null || value === undefined) {
        result.push({ key: fullKey, value: null, type: 'null' })
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result.push({ key: fullKey, value, type: typeof value })
      } else if (Array.isArray(value)) {
        result.push({ key: fullKey + '[]', value: `[${value.length} phần tử]`, type: 'array', isArray: true, arrayLen: value.length })
        if (value.length > 0) {
          result.push(...flattenForInspector(value[0], `${fullKey}.0`))
        }
      } else if (typeof value === 'object') {
        result.push(...flattenForInspector(value, fullKey))
      }
    }
    return result
  }

  async function loadDbRecords() {
    dbRecords = []
    dbRecordId = ''
    dbSourceData = null
    dbFields = []
    dbError = ''
    dbRecordsLoading = true
    try {
      if (dbDocType === 'warehouse_issue') {
        const res = await listStockDocuments({ docType: 'issue', limit: 15 })
        dbRecords = (res.data ?? []).map((d: StockDocumentRecord) => ({ id: d.id, label: `${d.code} — ${d.status}` }))
      } else if (dbDocType === 'warehouse_receipt') {
        const res = await listStockDocuments({ docType: 'receipt', limit: 15 })
        dbRecords = (res.data ?? []).map((d: StockDocumentRecord) => ({ id: d.id, label: `${d.code} — ${d.status}` }))
      } else if (dbDocType === 'repair_order') {
        const res = await listRepairOrders({ limit: 15 })
        dbRecords = (res.data ?? []).map((d: RepairOrderRecord) => {
          const raw = d as any
          const orderCode = raw.orderNo
            ?? raw.orderCode
            ?? d.id
          return { id: d.id, label: `${String(orderCode)} — ${String(raw.status ?? '')}` }
        })
      } else if (dbDocType === 'asset') {
        const res = await listAssets({ limit: 15 })
        dbRecords = (res.data ?? []).map((d: Asset) => {
          const code = d.assetCode ?? d.id
          const name = d.modelName ?? d.hostname ?? d.serialNo ?? ''
          return { id: d.id, label: `${code} — ${name}` }
        })
      }
      if (dbRecords.length > 0) dbRecordId = dbRecords[0].id
    } catch (e) {
      dbError = String(e)
    } finally {
      dbRecordsLoading = false
    }
  }

  async function inspectDbRecord() {
    if (!dbRecordId) return
    dbInspecting = true
    dbError = ''
    dbSourceData = null
    dbFields = []
    try {
      let data: Record<string, unknown> = {}
      if (dbDocType === 'warehouse_issue' || dbDocType === 'warehouse_receipt') {
        const res = await getStockDocument(dbRecordId)
        const doc  = res.data.document
        const lines = res.data.lines ?? []
        data = {
          ...doc,
          lines: lines.map((l, idx) => ({ ...l, index: idx + 1, lineTotal: l.unitCost != null ? (l.unitCost as number) * (l.qty as number) : null }))
        }
      } else if (dbDocType === 'repair_order') {
        const res = await getRepairOrder(dbRecordId)
        data = { ...res.data.order, parts: res.data.parts ?? [] }
      } else if (dbDocType === 'asset') {
        const res = await getAssetDetail(dbRecordId)
        data = { ...res.data.asset }
      }
      dbSourceData = data
      dbFields = flattenForInspector(data)
    } catch (e) {
      dbError = String(e)
    } finally {
      dbInspecting = false
    }
  }

  $effect(() => {
    if (activeTab === 'inspector' && dbRecords.length === 0 && !dbRecordsLoading) {
      void loadDbRecords()
    }
  })

  $effect(() => {
    if (!dsDefinitionSql.trim()) {
      dsDefinitionSql = buildRoutineSnippet(dsKind, dsRoutineName)
    }
  })

  $effect(() => {
    const tpl = dsTemplate
    if (!tpl) return

    if (tpl.dataSourceKind && tpl.dataSourceKind !== 'none') {
      dsKind = tpl.dataSourceKind
    }
    if (tpl.dataSourceName) {
      dsRoutineName = tpl.dataSourceName
    }
  })

  async function copyField(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copiedField = text
      setTimeout(() => { copiedField = '' }, 1500)
    } catch { /* clipboard not available */ }
  }

  // ── Default template per docType ──────────────────────────────────────────
  const DOC_TYPE_OPTIONS = [
    { value: 'warehouse_receipt', label: 'Phiếu nhập kho',     module: 'warehouse' },
    { value: 'warehouse_issue',   label: 'Phiếu xuất kho',     module: 'warehouse' },
    { value: 'repair_order',      label: 'Lệnh sửa chữa',      module: 'maintenance' },
    { value: 'asset',             label: 'Biên bản tài sản',   module: 'assets' },
  ]
  let defaultDraft = $state<Record<string, string>>({})
  let defaultSaving = $state<Record<string, boolean>>({})
  let defaultError = $state<Record<string, string>>({})
  let defaultSuccess = $state<Record<string, boolean>>({})

  // ── SQL data source for print templates ──────────────────────────────────
  let dsTemplateId = $state('')
  let dsKind = $state<SqlDataSourceKind>('function')
  let dsRoutineName = $state('print_data_sources.fn_print_data')
  let dsDefinitionSql = $state('')
  let dsPayloadText = $state('{\n  "recordId": ""\n}')
  let dsSaving = $state(false)
  let dsTesting = $state(false)
  let dsIntrospecting = $state(false)
  let dsError = $state('')
  let dsSuccess = $state('')
  let dsRows = $state<Record<string, unknown>[]>([])
  let dsResolved = $state<Record<string, unknown> | null>(null)
  let dsFields = $state<string[]>([])

  const dsTemplate = $derived(templates.find((t) => t.id === dsTemplateId) ?? null)

  function buildRoutineSnippet(kind: SqlDataSourceKind, routineName: string): string {
    const normalized = routineName.trim() || 'print_data_sources.fn_print_data'
    const [schemaPart, namePart] = normalized.includes('.')
      ? normalized.split('.', 2)
      : ['print_data_sources', normalized]

    if (kind === 'function') {
      return `CREATE OR REPLACE FUNCTION ${schemaPart}.${namePart}(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_id uuid;
BEGIN
    v_record_id := NULLIF(p_input->>'recordId', '')::uuid;

    RETURN jsonb_build_object(
        'recordId', v_record_id,
        'generatedAt', now(),
        'docType', p_input->>'docType'
    );
END;
$$;`
    }

    return `CREATE OR REPLACE PROCEDURE ${schemaPart}.${namePart}(IN p_input jsonb, INOUT p_output jsonb)
LANGUAGE plpgsql
AS $$
BEGIN
    p_output := jsonb_build_object(
        'recordId', NULLIF(p_input->>'recordId', '')::uuid,
        'generatedAt', now(),
        'docType', p_input->>'docType'
    );
END;
$$;`
  }

  function parseDsPayload(): Record<string, unknown> {
    const text = dsPayloadText.trim()
    if (!text) return {}

    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload phải là JSON object, ví dụ: {"recordId": "..."}')
    }
    return parsed as Record<string, unknown>
  }

  async function handleRegisterDataSource() {
    if (!dsTemplateId) {
      dsError = 'Chọn mẫu in trước khi cấu hình SQL data source.'
      return
    }
    dsSaving = true
    dsError = ''
    dsSuccess = ''
    try {
      const payload = parseDsPayload()
      const result = await registerPrintSqlDataSource({
        templateId: dsTemplateId,
        kind: dsKind,
        routineName: dsRoutineName.trim(),
        definitionSql: dsDefinitionSql.trim(),
        samplePayload: payload,
        sampleLimit: 30,
      })

      dsRows = result.data.sampleRows ?? []
      dsResolved = result.data.sampleData ?? {}
      dsFields = result.data.availableFields ?? []
      dsSuccess = `Đã tạo/cập nhật routine ${result.data.routine.qualifiedName} và liên kết mẫu in.`

      await loadTemplates()
    } catch (e) {
      dsError = String(e)
    } finally {
      dsSaving = false
    }
  }

  async function handleSandboxDataSource() {
    if (!dsTemplateId) {
      dsError = 'Chọn mẫu in trước khi sandbox.'
      return
    }
    dsTesting = true
    dsError = ''
    try {
      const payload = parseDsPayload()
      const result = await sandboxPrintSqlDataSource({
        templateId: dsTemplateId,
        payload,
        limit: 30,
      })
      dsRows = result.data.rows ?? []
      dsResolved = result.data.resolvedData ?? {}
      dsFields = result.data.fields ?? []
    } catch (e) {
      dsError = String(e)
    } finally {
      dsTesting = false
    }
  }

  async function handleIntrospectDataSource() {
    if (!dsTemplateId) {
      dsError = 'Chọn mẫu in trước khi đọc field.'
      return
    }
    dsIntrospecting = true
    dsError = ''
    try {
      const payload = parseDsPayload()
      const result = await introspectPrintSqlDataSource({
        templateId: dsTemplateId,
        payload,
        limit: 30,
      })
      dsFields = result.data.fields ?? []
      dsResolved = result.data.sampleData ?? {}
    } catch (e) {
      dsError = String(e)
    } finally {
      dsIntrospecting = false
    }
  }

  async function handleUnbindDataSource() {
    if (!dsTemplateId) return
    dsError = ''
    dsSuccess = ''
    try {
      await updateDocumentTemplate(dsTemplateId, {
        dataSourceKind: 'none',
        dataSourceName: '',
      })
      dsSuccess = 'Đã gỡ liên kết SQL data source khỏi mẫu in.'
      dsRows = []
      dsResolved = null
      dsFields = []
      await loadTemplates()
    } catch (e) {
      dsError = String(e)
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    await Promise.all([loadTemplates(), loadDefaultSettings()])
  })

  async function loadTemplates() {
    templatesLoading = true
    templatesError = ''
    try {
      templates = await listDocumentTemplates({ includeVersions: true, limit: 100 })
      if (!dsTemplateId || !templates.some((t) => t.id === dsTemplateId)) {
        dsTemplateId = templates[0]?.id ?? ''
      }
    } catch (e) {
      templatesError = String(e)
    } finally {
      templatesLoading = false
    }
  }

  async function loadDefaultSettings() {
    const results = await Promise.all(
      DOC_TYPE_OPTIONS.map(async ({ value }) => {
        const v = await getLabelSetting(`print.defaultTemplateId.${value}`)
        return [value, v ?? ''] as [string, string]
      })
    )
    const draft: Record<string, string> = {}
    for (const [k, v] of results) draft[k] = v
    defaultDraft = draft
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  function openCreate() {
    createName = ''
    createDesc = ''
    createModule = 'warehouse'
    createFile = null
    createError = ''
    createOpen = true
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
      })
      if (createFile) {
        await uploadDocxTemplateVersion(tpl.id, createFile, { title: 'v1', changeNote: 'Initial upload' })
      }
      createOpen = false
      await loadTemplates()
    } catch (e) {
      createError = String(e)
    } finally {
      creating = false
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(tpl: DocumentTemplateSummary) {
    editTarget = tpl
    editName = tpl.name
    editDesc = tpl.description ?? ''
    editModule = tpl.module
    editError = ''
    editOpen = true
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return
    editSaving = true
    editError = ''
    try {
      await updateDocumentTemplate(editTarget.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        module: editModule,
      })
      editOpen = false
      await loadTemplates()
    } catch (e) {
      editError = String(e)
    } finally {
      editSaving = false
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(tpl: DocumentTemplateSummary) {
    if (!confirm(`Xóa mẫu "${tpl.name}"? Thao tác này không thể hoàn tác.`)) return
    deletingId = tpl.id
    actionError = ''
    actionSuccess = ''
    try {
      await deleteDocumentTemplate(tpl.id)
      if (expandedId === tpl.id) {
        expandedId = ''
        versions = []
      }
      await loadTemplates()
    } catch (e) {
      actionError = String(e)
    } finally {
      deletingId = ''
    }
  }

  // ── Toggle/deactivate ──────────────────────────────────────────────────────
  async function handleToggleActive(tpl: DocumentTemplateSummary) {
    actionError = ''
    try {
      await updateDocumentTemplate(tpl.id, { isActive: !tpl.isActive })
      await loadTemplates()
    } catch (e) {
      actionError = String(e)
    }
  }

  // ── Version management ─────────────────────────────────────────────────────
  async function toggleExpand(tpl: DocumentTemplateSummary) {
    actionError = ''
    actionSuccess = ''
    if (expandedId === tpl.id) {
      expandedId = ''
      versions = []
      fieldPanel = null
      fieldError = ''
      return
    }
    expandedId = tpl.id
    uploadFile = null
    uploadNote = ''
    uploadError = ''
    uploadSuccess = ''
    fieldPanel = null
    fieldError = ''
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
      await uploadDocxTemplateVersion(expandedId, uploadFile, { changeNote: uploadNote.trim() || undefined })
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

  async function viewFields(templateId: string, versionId: string) {
    if (fieldPanel?.versionId === versionId) {
      fieldPanel = null
      return
    }
    fieldLoading = true
    fieldError = ''
    try {
      const result = await extractDocxPlaceholders(templateId, versionId)
      fieldPanel = { versionId, ...result }
    } catch (e) {
      fieldError = String(e)
    } finally {
      fieldLoading = false
    }
  }

  async function handleDownload(tpl: DocumentTemplateSummary) {
    const versionId = tpl.activeVersionId ?? tpl.latestVersion?.id
    if (!versionId) { actionError = 'Chưa có phiên bản nào.'; return }
    downloadingId = tpl.id
    actionError = ''
    try {
      const res = await renderDocx(tpl.id, versionId, {}, tpl.name)
      downloadDocxFromBase64(res.data.content, res.data.fileName || `${tpl.name}.docx`)
    } catch (e) {
      actionError = String(e)
    } finally {
      downloadingId = ''
    }
  }

  // ── Default settings ───────────────────────────────────────────────────────
  async function saveDefault(docType: string) {
    const userId = getCurrentUserId()
    if (!userId) return
    defaultSaving = { ...defaultSaving, [docType]: true }
    defaultError = { ...defaultError, [docType]: '' }
    defaultSuccess = { ...defaultSuccess, [docType]: false }
    try {
      await upsertLabelSetting(`print.defaultTemplateId.${docType}`, defaultDraft[docType] ?? '', userId)
      defaultSuccess = { ...defaultSuccess, [docType]: true }
      setTimeout(() => { defaultSuccess = { ...defaultSuccess, [docType]: false } }, 2000)
    } catch (e) {
      defaultError = { ...defaultError, [docType]: String(e) }
    } finally {
      defaultSaving = { ...defaultSaving, [docType]: false }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  <!-- ── Tabs ─────────────────────────────────────────────────────────────── -->
  <div class="flex gap-1 border-b" style="border-color: var(--color-border)">
    {#each [
      { id: 'custom',    label: 'Mẫu tùy chỉnh' },
      { id: 'builtin',   label: 'Mẫu tích hợp' },
      { id: 'dataSource', label: 'Nguồn dữ liệu SQL' },
      { id: 'defaults',  label: 'Cấu hình mặc định' },
      { id: 'inspector', label: 'Kiểm tra Fields' },
    ] as tab}
      <button
        type="button"
        class="tabs-trigger {activeTab === tab.id ? 'active' : ''}"
        onclick={() => (activeTab = tab.id as Tab)}
      >{tab.label}</button>
    {/each}
  </div>

  <!-- ═══ Tab: Mẫu tùy chỉnh ════════════════════════════════════════════════ -->
  {#if activeTab === 'custom'}
    <div class="card p-4 space-y-4">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold" style="color: var(--color-text)">Mẫu in tùy chỉnh (.docx)</h2>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            Tải lên file .docx với cú pháp {'{placeholder}'} để tạo mẫu in riêng.
          </p>
        </div>
        <Button size="sm" onclick={openCreate}>+ Tạo mẫu mới</Button>
      </div>

      <!-- Feedback -->
      {#if actionError}
        <div class="alert alert-error text-sm">{actionError}</div>
      {/if}
      {#if actionSuccess}
        <div class="alert alert-success text-sm">{actionSuccess}</div>
      {/if}

      <!-- Table -->
      {#if templatesLoading}
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      {:else if templatesError}
        <div class="alert alert-error text-sm">{templatesError}</div>
      {:else if templates.length === 0}
        <div class="rounded-xl border border-dashed border-slate-700 py-10 text-center text-sm" style="color: var(--color-text-muted)">
          Chưa có mẫu in tùy chỉnh nào. Nhấn "Tạo mẫu mới" để bắt đầu.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Tên mẫu</th>
                <th>Module</th>
                <th>Phiên bản</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Thao tác</th>
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
                      <div class="text-xs truncate max-w-[240px]" style="color: var(--color-text-muted)" title={tpl.description}>{tpl.description}</div>
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
                      <Button variant="secondary" size="sm" onclick={() => openEdit(tpl)}>Sửa</Button>
                      <Button variant="secondary" size="sm" onclick={() => toggleExpand(tpl)}>
                        {isExpanded ? 'Đóng' : 'Phiên bản'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => handleDownload(tpl)}
                        disabled={downloadingId === tpl.id || !activeVer}
                      >
                        {downloadingId === tpl.id ? 'Đang tải...' : 'Tải .docx'}
                      </Button>
                      <Button
                        variant={tpl.isActive ? 'secondary' : 'primary'}
                        size="sm"
                        onclick={() => handleToggleActive(tpl)}
                      >
                        {tpl.isActive ? 'Vô hiệu' : 'Kích hoạt'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() => handleDelete(tpl)}
                        disabled={deletingId === tpl.id}
                      >
                        {deletingId === tpl.id ? 'Đang xóa...' : 'Xóa'}
                      </Button>
                    </div>
                  </td>
                </tr>

                <!-- Version panel -->
                {#if isExpanded}
                  <tr>
                    <td colspan="6" class="p-0">
                      <div class="version-panel space-y-4">

                        <!-- Version list -->
                        <div class="space-y-2">
                          <h4 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-muted)">
                            Lịch sử phiên bản
                          </h4>

                          {#if versionsLoading}
                            <div class="skeleton-row"></div>
                          {:else if versionsError}
                            <div class="alert alert-error text-sm">{versionsError}</div>
                          {:else if versions.length === 0}
                            <p class="text-sm" style="color: var(--color-text-muted)">Chưa có phiên bản nào.</p>
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
                                      <div class="flex gap-1">
                                        {#if ver.templateFormat === 'docx'}
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            onclick={() => viewFields(tpl.id, ver.id)}
                                            disabled={fieldLoading && fieldPanel?.versionId !== ver.id}
                                          >
                                            {fieldLoading && fieldPanel == null ? '...' : fieldPanel?.versionId === ver.id ? 'Ẩn fields' : 'Xem fields'}
                                          </Button>
                                        {/if}
                                        {#if ver.status !== 'published'}
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            onclick={() => handlePublishVersion(tpl.id, ver.id)}
                                            disabled={publishingId === ver.id}
                                          >
                                            {publishingId === ver.id ? 'Đang...' : 'Publish'}
                                          </Button>
                                        {/if}
                                      </div>
                                    </td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>

                            <!-- Field inspector panel -->
                            {#if fieldError}
                              <div class="alert alert-error text-xs mt-2">{fieldError}</div>
                            {/if}
                            {#if fieldPanel}
                              <div class="mt-3 rounded-lg border p-3 space-y-3 text-xs" style="border-color: var(--color-border); background: var(--color-surface-2)">
                                <div class="font-semibold uppercase tracking-wide" style="color: var(--color-text-muted)">
                                  Cấu trúc fields của phiên bản này
                                </div>

                                <!-- Loop / table fields -->
                                {#if fieldPanel.loopFields.length > 0}
                                  <div>
                                    <p class="mb-1.5 font-medium" style="color: var(--color-text)">
                                      Bảng lặp ({fieldPanel.loopFields.length})
                                      <span class="ml-1 font-normal" style="color: var(--color-text-muted)">— dùng để tạo hàng bảng trong Word: <code>{'{#field}'}...{'{/field}'}</code></span>
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                      {#each fieldPanel.loopFields as f}
                                        <span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono" style="background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info)">
                                          <span class="opacity-60">#</span>{f}
                                        </span>
                                      {/each}
                                    </div>
                                    <p class="mt-1.5" style="color: var(--color-text-muted)">
                                      Ví dụ trong Word: đặt vào một hàng bảng:
                                      <code class="ml-1">{'{#' + (fieldPanel.loopFields[0] ?? 'lines') + '}'} ... {'{/' + (fieldPanel.loopFields[0] ?? 'lines') + '}'}</code>
                                    </p>
                                  </div>
                                {/if}

                                <!-- Scalar fields -->
                                {#if fieldPanel.simpleFields.length > 0}
                                  <div>
                                    <p class="mb-1.5 font-medium" style="color: var(--color-text)">
                                      Field đơn ({fieldPanel.simpleFields.length})
                                      <span class="ml-1 font-normal" style="color: var(--color-text-muted)">— thay thế giá trị trực tiếp: <code>{'{field}'}</code></span>
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                      {#each fieldPanel.simpleFields as f}
                                        <span class="inline-flex items-center rounded-md px-2 py-0.5 font-mono" style="background: var(--color-surface-3); color: var(--color-text)">
                                          {'{' + f + '}'}
                                        </span>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}

                                {#if fieldPanel.loopFields.length === 0 && fieldPanel.simpleFields.length === 0}
                                  <p style="color: var(--color-text-muted)">Không tìm thấy placeholder nào trong file .docx này.</p>
                                {/if}
                              </div>
                            {/if}
                          {/if}
                        </div>

                        <!-- Upload new version -->
                        <div class="space-y-2 pt-2 border-t" style="border-color: var(--color-border)">
                          <h4 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-muted)">
                            Tải lên phiên bản mới
                          </h4>

                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label class="space-y-1 text-sm">
                              <span class="label-base">File .docx</span>
                              <input
                                class="input-base"
                                type="file"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onchange={(e) => { uploadFile = (e.target as HTMLInputElement).files?.[0] ?? null }}
                              />
                            </label>
                            <label class="space-y-1 text-sm">
                              <span class="label-base">Ghi chú thay đổi</span>
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

                          <Button size="sm" onclick={handleUploadVersion} disabled={!uploadFile || uploading}>
                            {uploading ? 'Đang tải lên...' : 'Tải lên phiên bản mới'}
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

  <!-- ═══ Tab: Mẫu tích hợp ══════════════════════════════════════════════════ -->
  {:else if activeTab === 'builtin'}
    <div class="card p-4 space-y-4">
      <div>
        <h2 class="text-sm font-semibold" style="color: var(--color-text)">Mẫu in tích hợp</h2>
        <p class="text-xs mt-1" style="color: var(--color-text-muted)">
          11 mẫu in được cài sẵn, tự động sử dụng khi tải xuống từ phiếu kho, biên bản, v.v.
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th class="w-8">#</th>
              <th>Tên mẫu</th>
              <th>Mã phiếu</th>
              <th>Module</th>
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
        Để chỉnh sửa nội dung mẫu in tích hợp, hãy chỉnh sửa file .docx và chạy:
        <code class="ml-1 px-1 rounded" style="background: var(--color-surface-2)">pnpm generate:docx-templates</code>
      </p>
    </div>

    <!-- Syntax hint -->
    <div class="card p-4 text-xs space-y-1" style="color: var(--color-text-muted)">
      <strong style="color: var(--color-text)">Cú pháp template (.docx)</strong>
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

  <!-- ═══ Tab: Nguồn dữ liệu SQL ═════════════════════════════════════════════ -->
  {:else if activeTab === 'dataSource'}
    <div class="space-y-4">
      <div class="card p-4 space-y-4">
        <div>
          <h2 class="text-sm font-semibold" style="color: var(--color-text)">Nguồn dữ liệu SQL cho mẫu in</h2>
          <p class="text-xs mt-1" style="color: var(--color-text-muted)">
            Mỗi mẫu in có thể liên kết tới một function/procedure để lấy dữ liệu in. Sandbox luôn chạy trong transaction read-only.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="space-y-1 text-sm">
            <span class="label-base">Mẫu in</span>
            <select
              class="select-base"
              value={dsTemplateId}
              onchange={(e) => (dsTemplateId = (e.target as HTMLSelectElement).value)}
              disabled={templatesLoading || templates.length === 0}
            >
              {#if templates.length === 0}
                <option value="">— Không có mẫu in —</option>
              {:else}
                {#each templates as tpl}
                  <option value={tpl.id}>{tpl.name} ({moduleLabel(tpl.module)})</option>
                {/each}
              {/if}
            </select>
          </label>

          <label class="space-y-1 text-sm">
            <span class="label-base">Loại routine</span>
            <select class="select-base" value={dsKind} onchange={(e) => (dsKind = (e.target as HTMLSelectElement).value as SqlDataSourceKind)}>
              <option value="function">Function</option>
              <option value="procedure">Procedure</option>
            </select>
          </label>

          <label class="space-y-1 text-sm md:col-span-2">
            <span class="label-base">Routine name (schema.name)</span>
            <div class="flex flex-wrap gap-2">
              <input
                class="input-base flex-1"
                placeholder="print_data_sources.fn_print_data"
                value={dsRoutineName}
                oninput={(e) => (dsRoutineName = (e.target as HTMLInputElement).value)}
              />
              <Button variant="secondary" size="sm" onclick={() => (dsDefinitionSql = buildRoutineSnippet(dsKind, dsRoutineName))}>
                Tạo snippet
              </Button>
            </div>
          </label>

          <label class="space-y-1 text-sm md:col-span-2">
            <span class="label-base">Định nghĩa SQL (CREATE OR REPLACE ...)</span>
            <textarea
              class="input-base min-h-[220px] font-mono text-xs"
              spellcheck="false"
              value={dsDefinitionSql}
              oninput={(e) => (dsDefinitionSql = (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>

          <label class="space-y-1 text-sm md:col-span-2">
            <span class="label-base">Payload sandbox (JSON object)</span>
            <textarea
              class="input-base min-h-[110px] font-mono text-xs"
              spellcheck="false"
              value={dsPayloadText}
              oninput={(e) => (dsPayloadText = (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
        </div>

        {#if dsTemplate}
          <div class="rounded-lg border p-3 text-xs" style="border-color: var(--color-border); background: var(--color-surface-2)">
            <span style="color: var(--color-text-muted)">Liên kết hiện tại:</span>
            {#if dsTemplate.dataSourceKind !== 'none' && dsTemplate.dataSourceName}
              <span class="ml-1 font-mono" style="color: var(--color-text)">{dsTemplate.dataSourceKind} {dsTemplate.dataSourceName}</span>
            {:else}
              <span class="ml-1" style="color: var(--color-text-muted)">Chưa liên kết</span>
            {/if}
          </div>
        {/if}

        {#if dsError}
          <div class="alert alert-error text-sm">{dsError}</div>
        {/if}
        {#if dsSuccess}
          <div class="alert alert-success text-sm">{dsSuccess}</div>
        {/if}

        <div class="flex flex-wrap items-center gap-2">
          <Button onclick={handleRegisterDataSource} disabled={dsSaving || !dsTemplateId || !dsRoutineName.trim() || !dsDefinitionSql.trim()}>
            {dsSaving ? 'Đang lưu routine...' : 'Tạo/Cập nhật + liên kết mẫu'}
          </Button>
          <Button variant="secondary" onclick={handleSandboxDataSource} disabled={dsTesting || !dsTemplateId}>
            {dsTesting ? 'Đang sandbox...' : 'Sandbox dữ liệu'}
          </Button>
          <Button variant="secondary" onclick={handleIntrospectDataSource} disabled={dsIntrospecting || !dsTemplateId}>
            {dsIntrospecting ? 'Đang đọc fields...' : 'Đọc fields có thể chèn'}
          </Button>
          <Button variant="danger" onclick={handleUnbindDataSource} disabled={!dsTemplateId}>
            Gỡ liên kết
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold" style="color: var(--color-text)">Fields có thể chèn vào DOCX</h3>
            <span class="badge badge-info">{dsFields.length}</span>
          </div>
          {#if dsFields.length === 0}
            <p class="text-xs" style="color: var(--color-text-muted)">Chưa có field. Hãy chạy "Đọc fields có thể chèn".</p>
          {:else}
            <div class="max-h-80 overflow-y-auto pr-1 space-y-1">
              {#each dsFields as field}
                <div class="group flex items-center gap-2 rounded px-2.5 py-1.5" style="background: var(--color-surface-2)">
                  <code class="text-xs font-mono flex-1" style="color: var(--color-text)">{field}</code>
                  <button type="button" class="copy-btn opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => copyField('{' + field + '}')}>
                    {copiedField === '{' + field + '}' ? '✓' : 'Copy'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="card p-4 space-y-3">
          <h3 class="text-sm font-semibold" style="color: var(--color-text)">Sandbox review</h3>
          <div class="text-xs" style="color: var(--color-text-muted)">
            Rows: {dsRows.length} • Dữ liệu resolve cho template:
          </div>
          <pre class="rounded-lg p-3 text-xs font-mono overflow-auto max-h-80" style="background: var(--color-surface-2); color: var(--color-text)">{JSON.stringify(dsResolved ?? {}, null, 2)}</pre>
        </div>
      </div>
    </div>

  <!-- ═══ Tab: Cấu hình mặc định ═════════════════════════════════════════════ -->
  {:else if activeTab === 'defaults'}
    <div class="card p-4 space-y-4">
      <div>
        <h2 class="text-sm font-semibold" style="color: var(--color-text)">Mẫu in mặc định theo loại phiếu</h2>
        <p class="text-xs mt-1" style="color: var(--color-text-muted)">
          Khi mở hộp thoại in, mẫu được chọn sẵn sẽ là mẫu đã cấu hình ở đây.
          Chỉ áp dụng cho mẫu tùy chỉnh (.docx). Để trống = dùng mẫu đầu tiên trong danh sách.
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Loại phiếu</th>
              <th>Mẫu mặc định</th>
              <th class="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {#each DOC_TYPE_OPTIONS as dt}
              {@const relevantTemplates = templates.filter((t) => t.module === dt.module && t.isActive)}
              <tr>
                <td class="font-medium" style="color: var(--color-text)">{dt.label}</td>
                <td>
                  <select
                    class="select-base text-sm"
                    value={defaultDraft[dt.value] ?? ''}
                    onchange={(e) => (defaultDraft = { ...defaultDraft, [dt.value]: (e.target as HTMLSelectElement).value })}
                    disabled={defaultSaving[dt.value]}
                  >
                    <option value="">— Không có (dùng mẫu đầu tiên) —</option>
                    {#each relevantTemplates as tpl}
                      <option value={tpl.id}>{tpl.name}</option>
                    {/each}
                  </select>
                  {#if defaultError[dt.value]}
                    <p class="text-xs text-red-400 mt-1">{defaultError[dt.value]}</p>
                  {/if}
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <Button size="sm" onclick={() => saveDefault(dt.value)} disabled={defaultSaving[dt.value]}>
                      {defaultSaving[dt.value] ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                    {#if defaultSuccess[dt.value]}
                      <span class="text-xs text-green-400">✓ Đã lưu</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if templates.filter(t => t.isActive).length === 0 && !templatesLoading}
        <p class="text-xs" style="color: var(--color-text-muted)">
          Chưa có mẫu tùy chỉnh nào. Tạo mẫu trong tab "Mẫu tùy chỉnh" trước.
        </p>
      {/if}
    </div>

  <!-- ═══ Tab: Kiểm tra Fields (DB source data) ══════════════════════════════ -->
  {:else if activeTab === 'inspector'}
    <div class="space-y-4">

      <!-- Selector card -->
      <div class="card p-4 space-y-4">
        <div>
          <h2 class="text-sm font-semibold" style="color: var(--color-text)">Kiểm tra field từ dữ liệu DB</h2>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            Chọn loại phiếu và một record thực tế để xem chính xác những field nào có thể dùng trong mẫu Word.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <!-- DocType -->
          <label class="space-y-1 text-sm">
            <span class="label-base">Loại phiếu</span>
            <select
              class="select-base"
              value={dbDocType}
              onchange={async (e) => {
                dbDocType = (e.target as HTMLSelectElement).value
                await loadDbRecords()
              }}
            >
              {#each DB_DOC_TYPES as dt}
                <option value={dt.value}>{dt.label}</option>
              {/each}
            </select>
          </label>

          <!-- Record picker -->
          <label class="space-y-1 text-sm">
            <span class="label-base">
              Record mẫu
              {#if dbRecordsLoading}<span class="ml-1 text-xs opacity-60">Đang tải...</span>{/if}
            </span>
            <select
              class="select-base"
              value={dbRecordId}
              onchange={(e) => { dbRecordId = (e.target as HTMLSelectElement).value }}
              disabled={dbRecordsLoading || dbRecords.length === 0}
            >
              {#if dbRecords.length === 0}
                <option value="">— Không có dữ liệu —</option>
              {:else}
                {#each dbRecords as r}
                  <option value={r.id}>{r.label}</option>
                {/each}
              {/if}
            </select>
          </label>

          <!-- Inspect button -->
          <Button onclick={inspectDbRecord} disabled={!dbRecordId || dbInspecting}>
            {dbInspecting ? 'Đang lấy dữ liệu...' : 'Kiểm tra fields'}
          </Button>
        </div>

        {#if dbError}
          <div class="alert alert-error text-sm">{dbError}</div>
        {/if}
      </div>

      <!-- Result -->
      {#if dbInspecting}
        <div class="card p-6 space-y-2">
          <div class="skeleton-row"></div>
          <div class="skeleton-row w-4/5"></div>
          <div class="skeleton-row w-3/5"></div>
        </div>

      {:else if dbSourceData}
        <!-- Stats bar -->
        <div class="card px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs" style="color: var(--color-text-muted)">
          <span>
            <span class="font-semibold text-sm" style="color: var(--color-text)">{dbScalarFields.length}</span>
            field đơn
          </span>
          <span>
            <span class="font-semibold text-sm" style="color: var(--color-info)">{dbArrayFields.length}</span>
            mảng (bảng lặp)
          </span>
          <div class="ml-auto flex gap-2">
            <button
              type="button"
              class="copy-btn"
              onclick={() => {
                const ref = [
                  ...dbScalarFields.map(f => `{${f.key}}`),
                  ...Object.entries(dbArrayItemGroups).flatMap(([arr, items]) => [
                    `{#${arr}}`, ...items.map(f => `  {${f.key}}`), `{/${arr}}`
                  ])
                ].join('\n')
                void copyField(ref)
              }}
            >
              {copiedField.length > 20 ? '✓ Đã copy' : 'Copy tất cả field'}
            </button>
            <button
              type="button"
              class="copy-btn"
              onclick={() => { showRawJson = !showRawJson }}
            >
              {showRawJson ? 'Ẩn JSON' : 'Xem JSON gốc'}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <!-- Scalar fields -->
          <div class="card p-4 space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" style="color: var(--color-text)">Field đơn (scalar)</span>
              <span class="badge badge-secondary">{dbScalarFields.length}</span>
            </div>
            <p class="text-xs" style="color: var(--color-text-muted)">
              Dùng trực tiếp trong Word bằng cú pháp <code class="px-1 rounded" style="background:var(--color-surface-3)">{'{fieldName}'}</code>
            </p>

            <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
              {#each dbScalarFields as f}
                {@const tag = '{' + f.key + '}'}
                <div class="group flex items-start gap-2 rounded px-2.5 py-1.5" style="background: var(--color-surface-2)">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <code class="text-xs font-mono font-semibold" style="color: var(--color-text)">{f.key}</code>
                      <span class="text-xs rounded px-1" style="background:var(--color-surface-3); color: var(--color-text-muted)">{f.type}</span>
                    </div>
                    {#if f.value !== null && f.value !== undefined && f.value !== ''}
                      <div class="text-xs truncate mt-0.5" style="color: var(--color-text-muted)" title={String(f.value)}>
                        = {String(f.value).slice(0, 80)}{String(f.value).length > 80 ? '…' : ''}
                      </div>
                    {/if}
                  </div>
                  <button type="button" class="copy-btn shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onclick={() => copyField(tag)}>
                    {copiedField === tag ? '✓' : 'Copy'}
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <!-- Array / loop fields -->
          <div class="card p-4 space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" style="color: var(--color-text)">Bảng lặp (array loops)</span>
              <span class="badge badge-info">{dbArrayFields.length}</span>
            </div>
            <p class="text-xs" style="color: var(--color-text-muted)">
              Đặt tag vào <strong>1 hàng bảng</strong> trong Word để tự nhân bản theo số phần tử.
            </p>

            <div class="space-y-4 max-h-80 overflow-y-auto pr-1">
              {#each dbArrayFields as arr}
                {@const arrName = arr.key.replace('[]', '')}
                {@const innerFields = dbArrayItemGroups[arrName] ?? []}
                <div class="rounded-lg border p-3 space-y-2"
                     style="border-color: color-mix(in srgb, var(--color-info) 30%, transparent); background: color-mix(in srgb, var(--color-info) 5%, transparent)">
                  <!-- Array header -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <code class="text-sm font-semibold" style="color: var(--color-info)">{arrName}</code>
                      <span class="text-xs" style="color: var(--color-text-muted)">{arr.arrayLen} phần tử</span>
                    </div>
                    <div class="flex gap-1">
                      <button type="button" class="copy-btn" onclick={() => copyField('{#' + arrName + '}')}>
                        {copiedField === '{#' + arrName + '}' ? '✓' : '{#}'}
                      </button>
                      <button type="button" class="copy-btn" onclick={() => copyField('{/' + arrName + '}')}>
                        {copiedField === '{/' + arrName + '}' ? '✓' : '{/}'}
                      </button>
                    </div>
                  </div>

                  <!-- Word syntax preview -->
                  <div class="text-xs font-mono rounded p-2 space-y-0.5" style="background: var(--color-surface-3)">
                    <div style="color: var(--color-info)">{'{#' + arrName + '}'}</div>
                    <div class="pl-3 opacity-70">
                      {innerFields.slice(0, 3).map(f => '{' + f.key + '}').join(' | ')}{innerFields.length > 3 ? ' | ...' : ''}
                    </div>
                    <div style="color: var(--color-info)">{'{/' + arrName + '}'}</div>
                  </div>

                  <!-- Inner fields -->
                  {#if innerFields.length > 0}
                    <div class="space-y-1">
                      <div class="text-xs font-medium" style="color: var(--color-text-muted)">Fields bên trong:</div>
                      <div class="flex flex-wrap gap-1">
                        {#each innerFields as f}
                          {@const tag = '{' + f.key + '}'}
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono cursor-pointer transition-colors"
                            style="background: var(--color-surface-2); color: var(--color-text); border: 1px solid var(--color-border)"
                            onclick={() => copyField(tag)}
                            title="Click để copy"
                          >
                            {copiedField === tag ? '✓ ' : ''}{tag}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}

              {#if dbArrayFields.length === 0}
                <p class="text-xs" style="color: var(--color-text-muted)">Không có mảng nào trong dữ liệu này.</p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Usage hint -->
        <div class="card px-4 py-3 text-xs space-y-1" style="color: var(--color-text-muted)">
          <div class="font-medium" style="color: var(--color-text)">Cách dùng trong Word (.docx)</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            <div><code class="px-1 rounded" style="background:var(--color-surface-2)">{'{code}'}</code> → giá trị đơn, thay trực tiếp</div>
            <div><code class="px-1 rounded" style="background:var(--color-surface-2)">{'{#lines}'}</code>...<code class="px-1 rounded" style="background:var(--color-surface-2)">{'{/lines}'}</code> → lặp theo array, nhân bản từng hàng bảng</div>
            <div><code class="px-1 rounded" style="background:var(--color-surface-2)">{'{^lines}'}</code>...<code class="px-1 rounded" style="background:var(--color-surface-2)">{'{/lines}'}</code> → hiển thị khi array rỗng</div>
          </div>
        </div>

        <!-- Raw JSON -->
        {#if showRawJson}
          <div class="card p-4 space-y-2">
            <div class="text-sm font-semibold" style="color: var(--color-text)">JSON gốc (source data)</div>
            <pre class="rounded-lg p-3 text-xs font-mono overflow-auto max-h-96" style="background: var(--color-surface-2); color: var(--color-text)">{JSON.stringify(dbSourceData, null, 2)}</pre>
          </div>
        {/if}

      {:else if !dbInspecting && !dbSourceData && dbRecordId}
        <div class="card p-6 text-center text-sm" style="color: var(--color-text-muted)">
          Nhấn "Kiểm tra fields" để xem cấu trúc dữ liệu.
        </div>
      {:else if !dbInspecting}
        <div class="card p-6 text-center space-y-1" style="color: var(--color-text-muted)">
          <p class="text-sm">Chọn loại phiếu và record, nhấn "Kiểm tra fields" để xem tất cả field từ DB.</p>
          <p class="text-xs">Kết quả hiển thị chính xác field nào có thể dùng trong mẫu Word.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- ── Modal: Tạo mẫu mới ─────────────────────────────────────────────────── -->
<Modal bind:open={createOpen} title="Tạo mẫu in mới" size="md">
  {#snippet children()}
    <div class="space-y-4 py-1">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="space-y-1 text-sm md:col-span-2">
          <span class="label-base">Tên mẫu <span class="text-red-400">*</span></span>
          <input
            class="input-base"
            placeholder="Ví dụ: Biên bản bàn giao v2"
            value={createName}
            oninput={(e) => (createName = (e.target as HTMLInputElement).value)}
            onkeydown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </label>
        <label class="space-y-1 text-sm">
          <span class="label-base">Module</span>
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
        <label class="space-y-1 text-sm">
          <span class="label-base">File .docx <span style="color: var(--color-text-muted)">(tùy chọn)</span></span>
          <input
            class="input-base"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onchange={(e) => { createFile = (e.target as HTMLInputElement).files?.[0] ?? null }}
          />
        </label>
        <label class="space-y-1 text-sm md:col-span-2">
          <span class="label-base">Mô tả</span>
          <input
            class="input-base"
            placeholder="Mô tả ngắn về mẫu in này"
            value={createDesc}
            oninput={(e) => (createDesc = (e.target as HTMLInputElement).value)}
          />
        </label>
      </div>

      <p class="text-xs" style="color: var(--color-text-muted)">
        Dùng cú pháp <code>{'{placeholder}'}</code> và <code>{'{#items}'}...{'{/items}'}</code> cho bảng lặp.
        Có thể tải lên .docx sau khi tạo mẫu.
      </p>

      {#if createError}
        <div class="alert alert-error text-sm">{createError}</div>
      {/if}

      <div class="flex gap-2 justify-end">
        <Button variant="secondary" onclick={() => (createOpen = false)} disabled={creating}>Hủy</Button>
        <Button onclick={handleCreate} disabled={creating || !createName.trim()}>
          {creating ? 'Đang tạo...' : 'Tạo mẫu'}
        </Button>
      </div>
    </div>
  {/snippet}
</Modal>

<!-- ── Modal: Sửa mẫu ────────────────────────────────────────────────────── -->
<Modal bind:open={editOpen} title="Sửa thông tin mẫu in" size="md">
  {#snippet children()}
    <div class="space-y-4 py-1">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="space-y-1 text-sm md:col-span-2">
          <span class="label-base">Tên mẫu <span class="text-red-400">*</span></span>
          <input
            class="input-base"
            value={editName}
            oninput={(e) => (editName = (e.target as HTMLInputElement).value)}
            onkeydown={(e) => e.key === 'Enter' && handleEdit()}
          />
        </label>
        <label class="space-y-1 text-sm">
          <span class="label-base">Module</span>
          <select
            class="select-base"
            value={editModule}
            onchange={(e) => (editModule = (e.target as HTMLSelectElement).value)}
          >
            {#each MODULE_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1 text-sm md:col-span-2">
          <span class="label-base">Mô tả</span>
          <input
            class="input-base"
            value={editDesc}
            oninput={(e) => (editDesc = (e.target as HTMLInputElement).value)}
          />
        </label>
      </div>

      {#if editError}
        <div class="alert alert-error text-sm">{editError}</div>
      {/if}

      <div class="flex gap-2 justify-end">
        <Button variant="secondary" onclick={() => (editOpen = false)} disabled={editSaving}>Hủy</Button>
        <Button onclick={handleEdit} disabled={editSaving || !editName.trim()}>
          {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  {/snippet}
</Modal>

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

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface-3);
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .copy-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text);
  }
</style>
