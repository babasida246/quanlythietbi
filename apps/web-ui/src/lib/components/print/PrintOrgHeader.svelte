<script lang="ts">
  import { printTemplate } from '$lib/stores/printTemplateStore'

  type Props = {
    orgName?: string
    orgShortName?: string
    orgAddress?: string
    orgPhone?: string
    orgTaxCode?: string
    formTitle: string
    formCode?: string
    formDate?: string
    formNo?: string
  }
  let { orgName, orgAddress, orgPhone, orgTaxCode, formTitle, formCode, formDate, formNo }: Props = $props()

  const cfg = $derived($printTemplate)
</script>

<div class="print-org-header">
  <div class="print-org-info">
    <div class="print-org-name">{orgName ?? ''}</div>
    {#if orgAddress}<div class="print-org-detail">{cfg.header.addressLabel}: {orgAddress}</div>{/if}
    {#if orgPhone}<div class="print-org-detail">{cfg.header.phoneLabel}: {orgPhone}</div>{/if}
    {#if orgTaxCode}<div class="print-org-detail">{cfg.header.taxLabel}: {orgTaxCode}</div>{/if}
  </div>
  <div class="print-form-title-block">
    <div class="print-form-title">{formTitle}</div>
    {#if formCode || formDate || formNo}
      <div class="print-form-meta">
        {#if formNo}{cfg.header.numberLabel}: {formNo}&nbsp;&nbsp;{/if}
        {#if formCode}{cfg.header.codeLabel}: {formCode}&nbsp;&nbsp;{/if}
        {#if formDate}{cfg.header.dateLabel}: {formDate}{/if}
      </div>
    {/if}
  </div>
  {#if cfg.header.showLogoPlaceholder}
    <div class="print-org-logo-placeholder">
      <div class="print-org-logo-text">{cfg.header.logoText || '[LOGO]'}</div>
    </div>
  {/if}
</div>
