<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { Button } from '$lib/components/ui'
  import { _, isLoading } from '$lib/i18n'
  import { onMount } from 'svelte'
  import {
    printTemplate,
    DEFAULT_PRINT_TEMPLATE_CONFIG,
    buildPrintCssVariables,
    type PrintFontFamily
  } from '$lib/stores/printTemplateStore'
  import {
    printWordTemplates,
    encodeTemplateData,
    renderWordTemplate,
    type PrintWordTemplate
  } from '$lib/stores/printWordTemplateStore'

  const config = $derived($printTemplate)
  const wordTemplates = $derived($printWordTemplates.templates)

  let selectedTemplateId = $state('')
  let fieldValues = $state<Record<string, string>>({})
  let importName = $state('')
  let importError = $state('')
  let importSuccess = $state('')
  let importing = $state(false)
  let selectedFileName = $state('')
  let initializedSelection = $state(false)
  let sampleSourceId = $state<'asset' | 'warehouseDoc' | 'user'>('asset')
  let sampleRecordId = $state('')
  let exportingPdf = $state(false)
  let exportError = $state('')
  let exportSuccess = $state('')

  type SampleRecord = {
    id: string
    label: string
    data: Record<string, unknown>
  }

  const sampleSources = [
    { id: 'asset', labelKey: 'printCustomizer.templates.sampleSources.asset' },
    { id: 'warehouseDoc', labelKey: 'printCustomizer.templates.sampleSources.warehouseDoc' },
    { id: 'user', labelKey: 'printCustomizer.templates.sampleSources.user' }
  ] as const

  const sampleDataRecords: Record<'asset' | 'warehouseDoc' | 'user', SampleRecord[]> = {
    asset: [
      {
        id: 'asset-laptop',
        label: 'Laptop Dell Latitude 7420',
        data: {
          asset: {
            code: 'AST-0007420',
            name: 'Laptop Dell Latitude 7420',
            serialNo: 'DL7420SN001',
            model: 'Latitude 7420',
            brand: 'Dell',
            category: 'Laptop',
            location: 'Tang 3 - Phong IT',
            purchaseDate: '2025-06-12',
            warrantyEnd: '2028-06-12'
          },
          assignedTo: 'Nguyen Van A',
          department: 'Phong CNTT',
          note: 'Tai san cap cho nhan vien moi'
        }
      },
      {
        id: 'asset-printer',
        label: 'May in HP LaserJet Pro',
        data: {
          asset: {
            code: 'AST-PRN-0021',
            name: 'May in HP LaserJet Pro M404dn',
            serialNo: 'HPM404DN-21',
            model: 'LaserJet Pro M404dn',
            brand: 'HP',
            category: 'Printer',
            location: 'Tang 2 - Hanh chinh'
          },
          condition: 'Hoat dong tot',
          note: 'Da thay muc in thang 02/2026'
        }
      }
    ],
    warehouseDoc: [
      {
        id: 'wh-receipt',
        label: 'Phieu nhap kho PKN-2026-031',
        data: {
          doc: {
            code: 'PKN-2026-031',
            date: '2026-03-10',
            warehouseName: 'Kho trung tam',
            supplier: 'Cong ty Thiet Bi So 1',
            recipient: 'Le Thi B',
            department: 'Phong Kho',
            note: 'Nhap bo sung linh kien quy 1'
          }
        }
      },
      {
        id: 'wh-issue',
        label: 'Phieu xuat kho PXK-2026-014',
        data: {
          doc: {
            code: 'PXK-2026-014',
            date: '2026-03-11',
            warehouseName: 'Kho trung tam',
            recipient: 'Tran Van C',
            department: 'Phong Kham',
            purpose: 'Cap phat may tinh ban tiep don'
          }
        }
      }
    ],
    user: [
      {
        id: 'user-admin',
        label: 'Admin system',
        data: {
          user: {
            fullName: 'Tran Thi Admin',
            email: 'admin@example.com',
            phone: '0909123456',
            role: 'admin',
            department: 'Phong CNTT',
            title: 'Quan tri he thong'
          }
        }
      },
      {
        id: 'user-manager',
        label: 'IT Manager',
        data: {
          user: {
            fullName: 'Pham Van Manager',
            email: 'it_manager@example.com',
            phone: '0911222333',
            role: 'it_asset_manager',
            department: 'Phong CNTT',
            title: 'Quan ly tai san CNTT'
          }
        }
      }
    ]
  }

  onMount(() => {
    printTemplate.init()
    printWordTemplates.init()
  })

  $effect(() => {
    if (!initializedSelection && wordTemplates.length > 0) {
      selectedTemplateId = wordTemplates[0].id
      initializedSelection = true
    }
  })

  const selectedTemplate = $derived(
    wordTemplates.find((template) => template.id === selectedTemplateId) ?? null
  )

  let previousTemplateId = ''
  $effect(() => {
    if (!selectedTemplate) {
      previousTemplateId = ''
      fieldValues = {}
      return
    }

    if (selectedTemplate.id !== previousTemplateId) {
      previousTemplateId = selectedTemplate.id
      fieldValues = selectedTemplate.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field] = ''
        return acc
      }, {})
    }
  })

  const previewHref = $derived(
    selectedTemplate
      ? `/print/custom/${selectedTemplate.id}?data=${encodeURIComponent(encodeTemplateData(fieldValues))}`
      : ''
  )

  const sampleRecords = $derived(sampleDataRecords[sampleSourceId])
  const selectedSampleRecord = $derived(
    sampleRecords.find((record) => record.id === sampleRecordId) ?? null
  )

  $effect(() => {
    if (!sampleRecords.length) {
      sampleRecordId = ''
      return
    }

    if (!sampleRecords.some((record) => record.id === sampleRecordId)) {
      sampleRecordId = sampleRecords[0].id
    }
  })

  function toNumber(value: string): number {
    const n = Number.parseFloat(value)
    return Number.isNaN(n) ? 0 : n
  }

  function formatDate(value: string): string {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }

  async function handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    importError = ''
    importSuccess = ''

    if (!file) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      importError = $isLoading ? 'Only .docx files are supported.' : $_('printCustomizer.templates.onlyDocx')
      input.value = ''
      return
    }

    selectedFileName = file.name
    importing = true
    try {
      const imported = await printWordTemplates.importDocx(file, importName)
      selectedTemplateId = imported.id
      importName = ''
      importSuccess = $isLoading
        ? `Imported template: ${imported.name}`
        : `${$_('printCustomizer.templates.importedPrefix')}: ${imported.name}`
    } catch (error) {
      importError = error instanceof Error ? error.message : String(error)
    } finally {
      importing = false
      input.value = ''
    }
  }

  function fillSampleValues(template: PrintWordTemplate): void {
    const seeded: Record<string, string> = {}
    template.fields.forEach((field, index) => {
      seeded[field] = `${field.toUpperCase()}_${index + 1}`
    })
    fieldValues = seeded
  }

  function scalarToString(value: unknown): string {
    if (value == null) return ''
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
  }

  function flattenSampleData(value: unknown, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {}

    if (value == null) return result

    if (Array.isArray(value)) {
      const arrayValue = value
        .map((item) => (typeof item === 'object' ? JSON.stringify(item) : scalarToString(item)))
        .filter(Boolean)
        .join(', ')
      if (prefix && arrayValue) result[prefix] = arrayValue
      return result
    }

    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key
        const scalar = scalarToString(child)
        if (scalar) {
          result[nextPrefix] = scalar
          result[key] = scalar
          continue
        }
        Object.assign(result, flattenSampleData(child, nextPrefix))
      }
      return result
    }

    const scalar = scalarToString(value)
    if (prefix && scalar) result[prefix] = scalar
    return result
  }

  function normalizeFieldKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  function buildAliasCandidates(field: string): string[] {
    const base = field.split('.').at(-1) ?? field
    const aliases = [
      base,
      `asset.${base}`,
      `doc.${base}`,
      `user.${base}`
    ]

    if (base === 'name') aliases.push('fullName')
    if (base === 'code') aliases.push('assetCode')
    if (base === 'assetCode') aliases.push('code')
    if (base === 'phoneNumber') aliases.push('phone')

    return aliases
  }

  function applySampleDataMapping(): void {
    if (!selectedTemplate || !selectedSampleRecord) return

    const flatData = flattenSampleData(selectedSampleRecord.data)
    const normalizedData = new Map<string, string>()
    Object.entries(flatData).forEach(([key, value]) => {
      normalizedData.set(normalizeFieldKey(key), value)
    })

    const nextValues = { ...fieldValues }
    selectedTemplate.fields.forEach((field) => {
      if (flatData[field]) {
        nextValues[field] = flatData[field]
        return
      }

      const normalizedField = normalizeFieldKey(field)
      let mapped = normalizedData.get(normalizedField)

      if (!mapped) {
        const aliases = buildAliasCandidates(field)
        for (const alias of aliases) {
          mapped = normalizedData.get(normalizeFieldKey(alias))
          if (mapped) break
        }
      }

      if (mapped) nextValues[field] = mapped
    })

    fieldValues = nextValues
  }

  async function exportPdfClientSide(): Promise<void> {
    if (!selectedTemplate) return

    exportingPdf = true
    exportError = ''
    exportSuccess = ''

    let container: HTMLDivElement | null = null

    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = (html2pdfModule.default ?? html2pdfModule) as any
      const renderedHtml = renderWordTemplate(selectedTemplate.html, fieldValues)
      const styleVars = buildPrintCssVariables(config)

      container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-10000px'
      container.style.top = '0'
      container.style.width = '210mm'
      container.style.background = '#ffffff'
      container.style.zIndex = '-1'

      container.innerHTML = `
        <div style="${styleVars}">
          <article class="print-page custom-print-page" style="margin:0; box-shadow:none;">
            <div class="custom-print-content">${renderedHtml}</div>
          </article>
          ${config.footer.note.trim() ? `<div class="print-footer-note">${config.footer.note}</div>` : ''}
        </div>
      `

      document.body.appendChild(container)
      const target = container.querySelector('.print-page') as HTMLElement | null
      if (!target) throw new Error('Cannot render template for PDF export.')

      const safeFileName = selectedTemplate.name
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, '_')
      const fileName = `${safeFileName || 'print_template'}.pdf`

      await html2pdf()
        .set({
          margin: [0, 0, 0, 0],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(target)
        .save()

      exportSuccess = $isLoading
        ? 'PDF exported successfully.'
        : $_('printCustomizer.templates.pdfExportSuccess')
    } catch (error) {
      exportError = error instanceof Error ? error.message : String(error)
    } finally {
      container?.remove()
      exportingPdf = false
    }
  }

  function removeTemplate(id: string): void {
    const ok = window.confirm(
      $isLoading ? 'Delete this template?' : $_('printCustomizer.templates.deleteConfirm')
    )
    if (!ok) return

    printWordTemplates.remove(id)
    if (selectedTemplateId === id) {
      const next = wordTemplates.find((template) => template.id !== id)
      selectedTemplateId = next?.id ?? ''
    }
  }

  function renameTemplate(template: PrintWordTemplate): void {
    const nextName = window.prompt(
      $isLoading ? 'Template name' : $_('printCustomizer.templates.renamePrompt'),
      template.name
    )
    if (!nextName) return
    printWordTemplates.rename(template.id, nextName)
  }

  const fontOptions: Array<{ value: PrintFontFamily; label: string }> = [
    { value: 'times', label: 'Times New Roman' },
    { value: 'arial', label: 'Arial' },
    { value: 'inter', label: 'Inter' }
  ]
</script>

<div class="page-shell page-content">
  <PageHeader
    title={$isLoading ? 'Print Template Customization' : $_('printCustomizer.title')}
    subtitle={$isLoading ? 'Customize print layout, typography and labels directly from UI.' : $_('printCustomizer.subtitle')}
  />

  <div class="card p-4 space-y-4">
    <h2 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Header labels' : $_('printCustomizer.header.title')}</h2>

    <label class="inline-flex items-center gap-2 text-sm" style="color: var(--color-text)">
      <input
        type="checkbox"
        checked={config.header.showLogoPlaceholder}
        onchange={(e) => printTemplate.updateHeader('showLogoPlaceholder', (e.target as HTMLInputElement).checked)}
      />
      {$isLoading ? 'Show logo placeholder' : $_('printCustomizer.header.showLogo')}
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Logo text' : $_('printCustomizer.header.logoText')}</span>
        <input class="input-base" value={config.header.logoText} oninput={(e) => printTemplate.updateHeader('logoText', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Address label' : $_('printCustomizer.header.addressLabel')}</span>
        <input class="input-base" value={config.header.addressLabel} oninput={(e) => printTemplate.updateHeader('addressLabel', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Phone label' : $_('printCustomizer.header.phoneLabel')}</span>
        <input class="input-base" value={config.header.phoneLabel} oninput={(e) => printTemplate.updateHeader('phoneLabel', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Tax label' : $_('printCustomizer.header.taxLabel')}</span>
        <input class="input-base" value={config.header.taxLabel} oninput={(e) => printTemplate.updateHeader('taxLabel', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Document number label' : $_('printCustomizer.header.numberLabel')}</span>
        <input class="input-base" value={config.header.numberLabel} oninput={(e) => printTemplate.updateHeader('numberLabel', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Code label' : $_('printCustomizer.header.codeLabel')}</span>
        <input class="input-base" value={config.header.codeLabel} oninput={(e) => printTemplate.updateHeader('codeLabel', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Date label' : $_('printCustomizer.header.dateLabel')}</span>
        <input class="input-base" value={config.header.dateLabel} oninput={(e) => printTemplate.updateHeader('dateLabel', (e.target as HTMLInputElement).value)} />
      </label>
    </div>
  </div>

  <div class="card p-4 space-y-4">
    <h2 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Typography and spacing' : $_('printCustomizer.typography.title')}</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Font family' : $_('printCustomizer.typography.fontFamily')}</span>
        <select class="select-base" value={config.typography.fontFamily} onchange={(e) => printTemplate.updateTypography('fontFamily', (e.target as HTMLSelectElement).value as PrintFontFamily)}>
          {#each fontOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Base font size (pt)' : $_('printCustomizer.typography.fontSize')}</span>
        <input type="number" min="10" max="14" step="0.5" class="input-base" value={config.typography.fontSizePt} oninput={(e) => printTemplate.updateTypography('fontSizePt', toNumber((e.target as HTMLInputElement).value))} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Line height' : $_('printCustomizer.typography.lineHeight')}</span>
        <input type="number" min="1.2" max="1.9" step="0.05" class="input-base" value={config.typography.lineHeight} oninput={(e) => printTemplate.updateTypography('lineHeight', toNumber((e.target as HTMLInputElement).value))} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Title size (pt)' : $_('printCustomizer.typography.titleSize')}</span>
        <input type="number" min="13" max="20" step="0.5" class="input-base" value={config.typography.titleSizePt} oninput={(e) => printTemplate.updateTypography('titleSizePt', toNumber((e.target as HTMLInputElement).value))} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Table font size (pt)' : $_('printCustomizer.typography.tableFontSize')}</span>
        <input type="number" min="8" max="12" step="0.5" class="input-base" value={config.typography.tableFontSizePt} oninput={(e) => printTemplate.updateTypography('tableFontSizePt', toNumber((e.target as HTMLInputElement).value))} />
      </label>
    </div>

    <h3 class="text-xs font-semibold pt-2" style="color: var(--color-text-muted)">{$isLoading ? 'Page padding (mm)' : $_('printCustomizer.layout.title')}</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="space-y-1 text-sm"><span class="label-base">Top</span><input type="number" min="8" max="25" step="1" class="input-base" value={config.layout.pagePaddingTopMm} oninput={(e) => printTemplate.updateLayout('pagePaddingTopMm', toNumber((e.target as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span class="label-base">Right</span><input type="number" min="8" max="25" step="1" class="input-base" value={config.layout.pagePaddingRightMm} oninput={(e) => printTemplate.updateLayout('pagePaddingRightMm', toNumber((e.target as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span class="label-base">Bottom</span><input type="number" min="8" max="25" step="1" class="input-base" value={config.layout.pagePaddingBottomMm} oninput={(e) => printTemplate.updateLayout('pagePaddingBottomMm', toNumber((e.target as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span class="label-base">Left</span><input type="number" min="8" max="25" step="1" class="input-base" value={config.layout.pagePaddingLeftMm} oninput={(e) => printTemplate.updateLayout('pagePaddingLeftMm', toNumber((e.target as HTMLInputElement).value))} /></label>
    </div>
  </div>

  <div class="card p-4 space-y-4">
    <h2 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Signature and footer' : $_('printCustomizer.signature.title')}</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Default signature note' : $_('printCustomizer.signature.defaultTitleLine')}</span>
        <input class="input-base" value={config.signatures.defaultTitleLine} oninput={(e) => printTemplate.updateSignatures('defaultTitleLine', (e.target as HTMLInputElement).value)} />
      </label>
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Date prefix' : $_('printCustomizer.signature.datePrefix')}</span>
        <input class="input-base" value={config.signatures.datePrefix} oninput={(e) => printTemplate.updateSignatures('datePrefix', (e.target as HTMLInputElement).value)} />
      </label>
    </div>

    <label class="space-y-1 text-sm block">
      <span class="label-base">{$isLoading ? 'Footer note on print pages' : $_('printCustomizer.signature.footerNote')}</span>
      <textarea rows="2" class="input-base" value={config.footer.note} oninput={(e) => printTemplate.updateFooter('note', (e.target as HTMLTextAreaElement).value)}></textarea>
    </label>

    <div class="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onclick={() => printTemplate.reset()}>
        {$isLoading ? 'Reset to defaults' : $_('printCustomizer.reset')}
      </Button>
      <a href="/print/bao-cao-tai-san/preview?data=eyJkYXRlIjoiMjAyNi0wMy0xMyIsInJlcG9ydFBlcmlvZCI6IlRoxrDhu51uZyAzLzIwMjYiLCJwcmVwYXJlZEJ5IjoiQWRtaW4iLCJzdW1tYXJ5Ijp7InRvdGFsQXNzZXRzIjoxMjAsInRvdGFsVmFsdWUiOjE1MDAwMDAwMDAsImluVXNlIjo4OCwiaW5TdG9jayI6MjAsImluUmVwYWlyIjo4LCJyZXRpcmVkIjo0fSwiYnlDYXRlZ29yeSI6W3siY2F0ZWdvcnlOYW1lIjoiTGFwdG9wIiwiY291bnQiOjQwLCJpblVzZSI6MzIsImluU3RvY2siOjYsInZhbHVlIjo2MDAwMDAwMDB9LHsiY2F0ZWdvcnlOYW1lIjoiRGVza3RvcCIsImNvdW50Ijo1MCwiaW5Vc2UiOjM4LCJpblN0b2NrIjo5LCJ2YWx1ZSI6NTAwMDAwMDAwfV19" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
        {$isLoading ? 'Open sample print' : $_('printCustomizer.openSample')}
      </a>
    </div>
  </div>

  <div class="card p-4 text-xs" style="color: var(--color-text-muted)">
    <strong>{$isLoading ? 'Tip:' : $_('printCustomizer.tipTitle')}</strong>
    <span class="ml-1">{$isLoading ? 'Changes are saved automatically and apply to all print templates.' : $_('printCustomizer.tip')}</span>
  </div>

  <div class="card p-4 space-y-4">
    <div>
      <h2 class="text-sm font-semibold" style="color: var(--color-text)">
        {$isLoading ? 'Word print templates' : $_('printCustomizer.templates.title')}
      </h2>
      <p class="text-xs mt-1" style="color: var(--color-text-muted)">
        {$isLoading
          ? 'Import a .docx file, use {{field_name}} placeholders, then map values and print/PDF.'
          : $_('printCustomizer.templates.subtitle')}
      </p>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <label class="space-y-1 text-sm">
        <span class="label-base">{$isLoading ? 'Template name (optional)' : $_('printCustomizer.templates.nameLabel')}</span>
        <input
          class="input-base"
          value={importName}
          placeholder={$isLoading ? 'Example: Asset handover v2' : $_('printCustomizer.templates.namePlaceholder')}
          oninput={(e) => (importName = (e.target as HTMLInputElement).value)}
        />
      </label>
      <label class="space-y-1 text-sm xl:col-span-2">
        <span class="label-base">{$isLoading ? 'Import .docx file' : $_('printCustomizer.templates.importLabel')}</span>
        <input class="input-base" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange={handleImport} disabled={importing} />
      </label>
    </div>

    {#if selectedFileName}
      <div class="text-xs" style="color: var(--color-text-muted)">
        {$isLoading ? 'Selected file' : $_('printCustomizer.templates.selectedFile')}: <strong>{selectedFileName}</strong>
      </div>
    {/if}

    {#if importError}
      <div class="alert alert-error text-sm">{importError}</div>
    {/if}
    {#if importSuccess}
      <div class="alert alert-success text-sm">{importSuccess}</div>
    {/if}

    {#if importing}
      <div class="text-sm" style="color: var(--color-text-muted)">
        {$isLoading ? 'Importing template...' : $_('printCustomizer.templates.importing')}
      </div>
    {/if}

    {#if wordTemplates.length === 0}
      <div class="text-sm" style="color: var(--color-text-muted)">
        {$isLoading ? 'No custom templates yet.' : $_('printCustomizer.templates.empty')}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th>{$isLoading ? 'Template' : $_('printCustomizer.templates.table.name')}</th>
              <th>{$isLoading ? 'Fields' : $_('printCustomizer.templates.table.fields')}</th>
              <th>{$isLoading ? 'Updated' : $_('printCustomizer.templates.table.updatedAt')}</th>
              <th>{$isLoading ? 'Actions' : $_('printCustomizer.templates.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each wordTemplates as template}
              <tr class:selected-row={template.id === selectedTemplateId}>
                <td>
                  <div class="font-medium" style="color: var(--color-text)">{template.name}</div>
                  {#if template.sourceFileName}
                    <div class="text-xs" style="color: var(--color-text-muted)">{template.sourceFileName}</div>
                  {/if}
                </td>
                <td>{template.fields.length}</td>
                <td>{formatDate(template.updatedAt)}</td>
                <td>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onclick={() => (selectedTemplateId = template.id)}>
                      {$isLoading ? 'Select' : $_('printCustomizer.templates.actions.select')}
                    </Button>
                    <Button variant="secondary" size="sm" onclick={() => renameTemplate(template)}>
                      {$isLoading ? 'Rename' : $_('printCustomizer.templates.actions.rename')}
                    </Button>
                    <Button variant="danger" size="sm" onclick={() => removeTemplate(template.id)}>
                      {$isLoading ? 'Delete' : $_('printCustomizer.templates.actions.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if selectedTemplate}
        <div class="border rounded-md p-3 space-y-3" style="border-color: var(--color-border)">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold" style="color: var(--color-text)">
                {$isLoading ? 'Field mapping' : $_('printCustomizer.templates.mappingTitle')}: {selectedTemplate.name}
              </h3>
              <p class="text-xs" style="color: var(--color-text-muted)">
                {$isLoading ? 'Fill values for each {{field_name}} placeholder.' : $_('printCustomizer.templates.mappingSubtitle')}
              </p>
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" size="sm" onclick={() => fillSampleValues(selectedTemplate)}>
                {$isLoading ? 'Auto-fill sample' : $_('printCustomizer.templates.fillSample')}
              </Button>
              <Button variant="secondary" size="sm" onclick={exportPdfClientSide} disabled={exportingPdf}>
                {#if exportingPdf}
                  {$isLoading ? 'Exporting...' : $_('printCustomizer.templates.exportingPdf')}
                {:else}
                  {$isLoading ? 'Export PDF' : $_('printCustomizer.templates.exportPdf')}
                {/if}
              </Button>
              <a class="btn btn-sm btn-primary" href={previewHref} target="_blank" rel="noopener noreferrer">
                {$isLoading ? 'Preview / Print' : $_('printCustomizer.templates.openPreview')}
              </a>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <label class="space-y-1 text-sm">
              <span class="label-base">
                {$isLoading ? 'Sample data source' : $_('printCustomizer.templates.sampleSource')}
              </span>
              <select
                class="select-base"
                value={sampleSourceId}
                onchange={(e) => (sampleSourceId = (e.target as HTMLSelectElement).value as 'asset' | 'warehouseDoc' | 'user')}
              >
                {#each sampleSources as source}
                  <option value={source.id}>
                    {$isLoading ? source.id : $_(source.labelKey)}
                  </option>
                {/each}
              </select>
            </label>

            <label class="space-y-1 text-sm">
              <span class="label-base">
                {$isLoading ? 'Sample record' : $_('printCustomizer.templates.sampleRecord')}
              </span>
              <select class="select-base" value={sampleRecordId} onchange={(e) => (sampleRecordId = (e.target as HTMLSelectElement).value)}>
                {#each sampleRecords as record}
                  <option value={record.id}>{record.label}</option>
                {/each}
              </select>
            </label>

            <div class="flex items-end">
              <Button variant="secondary" size="sm" onclick={applySampleDataMapping} class="w-full">
                {$isLoading ? 'Auto map from source' : $_('printCustomizer.templates.autoMapFromSource')}
              </Button>
            </div>
          </div>

          {#if exportError}
            <div class="alert alert-error text-sm">{exportError}</div>
          {/if}
          {#if exportSuccess}
            <div class="alert alert-success text-sm">{exportSuccess}</div>
          {/if}

          {#if selectedTemplate.fields.length === 0}
            <div class="text-sm" style="color: var(--color-text-muted)">
              {$isLoading ? 'No placeholders found in this template.' : $_('printCustomizer.templates.noFields')}
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              {#each selectedTemplate.fields as field}
                <label class="space-y-1 text-sm">
                  <span class="label-base">{`{{${field}}}`}</span>
                  <textarea
                    rows="2"
                    class="input-base"
                    value={fieldValues[field] ?? ''}
                    oninput={(e) => {
                      const value = (e.target as HTMLTextAreaElement).value
                      fieldValues = { ...fieldValues, [field]: value }
                    }}
                  ></textarea>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .selected-row {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }
</style>
