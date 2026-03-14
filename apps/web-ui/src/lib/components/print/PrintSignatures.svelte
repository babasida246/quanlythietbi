<script lang="ts">
  import { printTemplate } from '$lib/stores/printTemplateStore'

  type Signer = {
    label: string
    name?: string
    title?: string
  }
  type Props = {
    signers: Signer[]
    date?: string
  }
  let { signers, date }: Props = $props()

  const today = new Date()
  const cfg = $derived($printTemplate)
  const displayDate = $derived(date ?? `${cfg.signatures.datePrefix} ${today.getDate()} thang ${today.getMonth() + 1} nam ${today.getFullYear()}`)
</script>

<div class="print-signatures">
  <div class="print-date-row">{displayDate}</div>
  <div class="print-signer-row">
    {#each signers as s}
      <div class="print-signer">
        <div class="print-signer-label">{s.label}</div>
        <div class="print-signer-title-line">{s.title ?? cfg.signatures.defaultTitleLine}</div>
        <div class="print-signer-space"></div>
        <div class="print-signer-name">{s.name ?? ''}</div>
      </div>
    {/each}
  </div>
</div>
