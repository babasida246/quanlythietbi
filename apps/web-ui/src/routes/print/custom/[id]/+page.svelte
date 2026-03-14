<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { printTemplate, buildPrintCssVariables } from '$lib/stores/printTemplateStore'
  import {
    printWordTemplates,
    renderWordTemplate,
    decodeTemplateData,
    type PrintWordTemplate
  } from '$lib/stores/printWordTemplateStore'

  const templateId = $derived(page.params.id ?? '')

  let loading = $state(true)
  let error = $state<string | null>(null)
  let template = $state<PrintWordTemplate | null>(null)
  let fieldValues = $state<Record<string, string>>({})

  const config = $derived($printTemplate)
  const printStyleVars = $derived(buildPrintCssVariables(config))
  const renderedHtml = $derived(template ? renderWordTemplate(template.html, fieldValues) : '')

  onMount(() => {
    printTemplate.init()
    printWordTemplates.init()

    const found = printWordTemplates.getById(templateId)
    if (!found) {
      error = `Template not found: ${templateId}`
      loading = false
      return
    }

    template = found
    fieldValues = decodeTemplateData(page.url.searchParams.get('data'))
    loading = false
  })
</script>

<svelte:head>
  <title>{template?.name ?? 'Word Template Print'}</title>
</svelte:head>

<div class="print-wrapper">
  <div class="print-toolbar no-print">
    <div class="print-toolbar-inner">
      <span class="print-toolbar-title">{template?.name ?? 'Word Template Print'}</span>
      <div class="print-toolbar-actions">
        <a class="print-btn-secondary" href="/settings/print">Tuy chinh mau in</a>
        <button class="print-btn-print" onclick={() => window.print()}>🖨️ In / Xuất PDF</button>
        <button class="print-btn-close" onclick={() => window.close()}>✕ Đóng</button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="print-loading">Đang tải mẫu in...</div>
  {:else if error}
    <div class="print-error">{error}</div>
  {:else if template}
    <div style={printStyleVars}>
      <article class="print-page custom-print-page">
        <div class="custom-print-content">{@html renderedHtml}</div>
      </article>

      {#if config.footer.note.trim()}
        <div class="print-footer-note">{config.footer.note}</div>
      {/if}
    </div>
  {/if}
</div>
