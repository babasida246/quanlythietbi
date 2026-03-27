<script lang="ts">
  import Modal from '$lib/components/Modal.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import { _, isLoading } from '$lib/i18n'
  import {
    listDocumentTemplates,
    type DocumentTemplateSummary,
    type DocumentTemplateVersion
  } from '$lib/api/printTemplates'
  import { autoMapFields, renderTemplate, exportFile } from '$lib/api/print'

  type ExportFormat = 'pdf' | 'excel' | 'csv' | 'word' | 'json'
  type Step = 'select' | 'preview' | 'config'

  interface Props {
    isOpen: boolean
    docType: string
    recordId?: string
    sourceData?: Record<string, unknown>
    onClose: () => void
    onExport?: (format: ExportFormat, payload: { html: string; mappings: Record<string, unknown> }) => void
  }

  let {
    isOpen = $bindable(false),
    docType,
    recordId,
    sourceData = {},
    onClose,
    onExport
  }: Props = $props()

  let loading = $state(false)
  let exporting = $state(false)
  let error = $state('')
  let step = $state<Step>('select')

  let templates = $state<DocumentTemplateSummary[]>([])
  let selectedTemplateId = $state('')
  let fieldMappings = $state<Record<string, unknown>>({})
  let previewHtml = $state('')
  let confidence = $state(0)
  let exportFormat = $state<ExportFormat>('pdf')

  const selectedTemplate = $derived(templates.find((item) => item.id === selectedTemplateId) ?? null)
  const templateVersion = $derived<DocumentTemplateVersion | null>(
    selectedTemplate?.activeVersion ?? selectedTemplate?.latestVersion ?? null
  )

  $effect(() => {
    if (isOpen) {
      void initDialog()
    }
  })

  async function initDialog() {
    loading = true
    error = ''
    step = 'select'
    selectedTemplateId = ''
    previewHtml = ''
    fieldMappings = {}
    confidence = 0

    try {
      const list = await listDocumentTemplates({
        module: docType,
        includeVersions: true,
        limit: 100
      })

      templates = list
      if (templates.length > 0) {
        selectedTemplateId = templates[0].id
        await runAutoMap()
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  }

  async function runAutoMap() {
    if (!templateVersion) return

    loading = true
    error = ''

    try {
      const fields = templateVersion.fields ?? []
      const mapped = await autoMapFields(docType, sourceData, fields)
      fieldMappings = mapped.data.mappings ?? {}
      confidence = mapped.data.confidence ?? 0
      await refreshPreview()
      step = 'preview'
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  }

  async function refreshPreview() {
    if (!templateVersion) return

    try {
      const rendered = await renderTemplate(templateVersion.htmlContent, fieldMappings)
      previewHtml = rendered.data.html ?? ''
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  async function exportCurrent() {
    if (!templateVersion) return

    exporting = true
    error = ''

    try {
      const safeName = (selectedTemplate?.name ?? 'print').trim().replace(/[^a-zA-Z0-9-_]+/g, '_')
      const html = previewHtml || (await renderTemplate(templateVersion.htmlContent, fieldMappings)).data.html || ''

      const exported = await exportFile(html, fieldMappings, exportFormat, {
        fileName: safeName || 'print',
        templateId: selectedTemplateId,
        templateName: selectedTemplate?.name,
        docType,
        recordId,
        confidence
      })

      const content = exported.data.content ?? ''
      const mimeType = exported.data.mimeType || 'application/octet-stream'
      const fileName = exported.data.fileName || `${safeName || 'print'}.${exportFormat === 'excel' ? 'xls' : exportFormat === 'word' ? 'doc' : exportFormat}`
      const binary = atob(content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }

      saveBlob(new Blob([bytes], { type: mimeType }), fileName)

      onExport?.(exportFormat, { html, mappings: fieldMappings })
      onClose()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      exporting = false
    }
  }

  function handleCancel() {
    onClose()
  }
</script>

<Modal bind:open={isOpen} title={$isLoading ? 'Print' : $_('assets.print.title')}>
  <div class="space-y-4">
    {#if error}
      <div class="alert alert-error text-sm">{error}</div>
    {/if}

    {#if step === 'select'}
      <div class="space-y-3">
        <label class="space-y-1 text-sm block">
          <span class="label-base">{$isLoading ? 'Select template' : $_('assets.print.selectTemplate')}</span>
          <select class="select-base w-full" bind:value={selectedTemplateId} disabled={loading}>
            <option value="">{$isLoading ? '-- Choose template --' : $_('assets.print.selectTemplate')}</option>
            {#each templates as template}
              <option value={template.id}>{template.name}</option>
            {/each}
          </select>
        </label>

        {#if selectedTemplate}
          <div class="rounded-md bg-surface-2 p-3 text-sm space-y-1">
            <div class="font-semibold text-slate-100">{selectedTemplate.name}</div>
            <div class="text-xs text-slate-400">Fields: {templateVersion?.fields?.length ?? 0}</div>
            <div class="text-xs text-slate-400">{$isLoading ? 'Type' : $_('assets.print.docType')}: {docType}</div>
          </div>
        {:else}
          <div class="text-xs text-slate-400">
            {$isLoading ? 'No templates available' : $_('assets.print.noTemplates')}
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={handleCancel}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={runAutoMap} disabled={!selectedTemplateId || loading}>
          {loading ? ($isLoading ? 'Mapping...' : $_('assets.print.autoMapping')) : ($isLoading ? 'Next' : $_('common.next'))}
        </Button>
      </div>
    {/if}

    {#if step === 'preview'}
      <div class="space-y-3">
        <div class="rounded-md border border-border bg-white p-4 max-h-96 overflow-y-auto">
          <div class="w-full max-w-2xl mx-auto bg-white" style="width: 210mm; aspect-ratio: 210/297; border: 1px solid #ddd; padding: 16mm; font-size: 11pt; line-height: 1.5; color: #000;">
            {#if previewHtml}
              {@html previewHtml}
            {:else}
              <div class="text-center text-slate-400">{$isLoading ? 'Rendering...' : $_('assets.print.renderingPreview')}</div>
            {/if}
          </div>
        </div>

        <div class="rounded-md bg-surface-2 p-2 text-xs text-slate-400">
          Auto-map confidence: {Math.round(confidence * 100)}%
        </div>

        <div class="space-y-2">
          <p class="text-xs text-slate-500">{$isLoading ? 'Export format' : $_('assets.print.exportFormat')}:</p>
          <div class="flex flex-wrap gap-3">
            <label class="inline-flex items-center gap-2 text-sm"><input type="radio" value="pdf" bind:group={exportFormat} /> {$isLoading ? 'PDF' : $_('assets.print.exportFormatPdf')}</label>
            <label class="inline-flex items-center gap-2 text-sm"><input type="radio" value="excel" bind:group={exportFormat} /> {$isLoading ? 'Excel' : $_('assets.print.exportFormatExcel')}</label>
            <label class="inline-flex items-center gap-2 text-sm"><input type="radio" value="csv" bind:group={exportFormat} /> {$isLoading ? 'CSV' : $_('assets.print.exportFormatCsv')}</label>
            <label class="inline-flex items-center gap-2 text-sm"><input type="radio" value="word" bind:group={exportFormat} /> {$isLoading ? 'Word' : $_('assets.print.exportFormatWord')}</label>
            <label class="inline-flex items-center gap-2 text-sm"><input type="radio" value="json" bind:group={exportFormat} /> {$isLoading ? 'JSON' : $_('assets.print.exportFormatJson')}</label>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => (step = 'select')}>{$isLoading ? 'Back' : $_('common.back')}</Button>
        <Button variant="secondary" onclick={() => (step = 'config')}>{$isLoading ? 'Customize' : $_('assets.print.customize')}</Button>
        <Button onclick={exportCurrent} disabled={exporting}>
          {exporting ? ($isLoading ? 'Exporting...' : $_('assets.print.exporting')) : ($isLoading ? 'Export' : $_('assets.print.export'))}
        </Button>
      </div>
    {/if}

    {#if step === 'config'}
      <div class="space-y-3 max-h-96 overflow-y-auto">
        {#if templateVersion}
          {#each templateVersion.fields as field}
            <div class="space-y-1">
              <div class="text-xs font-semibold text-slate-400">{`{{${field}}}`}</div>
              <input
                class="input-base w-full text-sm"
                type="text"
                value={String(fieldMappings[field] ?? '')}
                oninput={(e) => {
                  fieldMappings = { ...fieldMappings, [field]: (e.target as HTMLInputElement).value }
                  void refreshPreview()
                }}
                placeholder={field}
              />
            </div>
          {/each}
        {/if}
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => (step = 'preview')}>{$isLoading ? 'Back' : $_('common.back')}</Button>
        <Button onclick={exportCurrent} disabled={exporting}>
          {exporting ? ($isLoading ? 'Exporting...' : $_('assets.print.exporting')) : ($isLoading ? 'Export' : $_('assets.print.export'))}
        </Button>
      </div>
    {/if}
  </div>
</Modal>
