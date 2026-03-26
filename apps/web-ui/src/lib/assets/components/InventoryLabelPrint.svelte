<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Printer, X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import type { Asset } from '$lib/api/assets';

  let {
    open = $bindable(false),
    assets = []
  }: {
    open: boolean;
    assets: Asset[];
  } = $props();

  const statusLabels = $derived<Record<string, string>>({
    in_stock: $isLoading ? 'In stock' : $_('inventoryLabel.statusInStock'),
    in_use: $isLoading ? 'In use' : $_('inventoryLabel.statusInUse'),
    in_repair: $isLoading ? 'Repairing' : $_('inventoryLabel.statusRepairing'),
    retired: $isLoading ? 'Retired' : $_('inventoryLabel.statusRetired'),
    disposed: $isLoading ? 'Disposed' : $_('inventoryLabel.statusDisposed'),
    lost: $isLoading ? 'Lost' : $_('inventoryLabel.statusLost')
  });

  function getStatusLabel(status: string | undefined | null): string {
    if (!status) return '-';
    return statusLabels[status] ?? status;
  }

  function buildQrPayload(asset: Asset): string {
    const id = asset.id ?? '';
    const code = asset.assetCode ?? '';
    if (id) return `assets/${encodeURIComponent(id)}`;
    if (code) return `assets/${encodeURIComponent(code)}`;
    return '';
  }

  function qrUrl(asset: Asset): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(buildQrPayload(asset))}&bgcolor=ffffff&color=000000&margin=2`;
  }

  function handlePrint() {
    window.print();
  }

  function handleClose() {
    open = false;
  }
</script>

{#if open}
  <!-- backdrop (hidden on print) -->
  <div class="label-backdrop no-print" role="dialog" aria-modal="true" aria-label="{$isLoading ? 'Print Inventory Labels' : $_('inventoryLabel.title')}">
    <div class="label-dialog">
      <!-- header -->
      <div class="label-dialog-header no-print">
        <div>
          <h2 class="text-base font-semibold text-slate-100">{$isLoading ? 'Print Inventory Labels' : $_('inventoryLabel.title')}</h2>
          <p class="text-xs text-slate-400">{$isLoading ? `${assets.length} assets selected` : $_('inventoryLabel.assetsSelected', { values: { count: assets.length } })}</p>
        </div>
        <div class="flex items-center gap-2">
          <Button size="sm" onclick={handlePrint}>
            {#snippet leftIcon()}<Printer class="h-3.5 w-3.5" />{/snippet}
            {$isLoading ? 'Print labels' : $_('inventoryLabel.print')}
          </Button>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-100 transition-colors p-1 rounded"
            onclick={handleClose}
            aria-label="{$isLoading ? 'Close' : $_('inventoryLabel.close')}"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- label grid (shown on print) -->
      <div class="label-print-area">
        <div class="label-grid">
          {#each assets as asset (asset.id)}
            <div class="label-card">
              <div class="label-qr">
                <img
                  src={qrUrl(asset)}
                  alt="QR {asset.assetCode}"
                  width="90"
                  height="90"
                />
              </div>
              <div class="label-info">
                <div class="label-name">{asset.hostname ?? asset.assetCode}</div>
                <div class="label-row">
                  <span class="label-field">{$isLoading ? 'Code:' : $_('inventoryLabel.code')}</span>
                  <span class="label-value">{asset.assetCode}</span>
                </div>
                {#if asset.modelName}
                  <div class="label-row">
                    <span class="label-field">Model:</span>
                    <span class="label-value">{asset.modelName}</span>
                  </div>
                {/if}
                {#if asset.serialNo}
                  <div class="label-row">
                    <span class="label-field">S/N:</span>
                    <span class="label-value">{asset.serialNo}</span>
                  </div>
                {/if}
                {#if asset.locationName}
                  <div class="label-row">
                    <span class="label-field">{$isLoading ? 'Location:' : $_('inventoryLabel.location')}</span>
                    <span class="label-value">{asset.locationName}</span>
                  </div>
                {/if}
                <div class="label-row">
                  <span class="label-field">{$isLoading ? 'Status:' : $_('inventoryLabel.status')}</span>
                  <span class="label-value">{getStatusLabel(asset.status)}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ============================================================ */
  /* Screen styles                                                 */
  /* ============================================================ */
  .label-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
  }

  .label-dialog {
    background: var(--color-surface-2, #1e293b);
    border: 1px solid var(--color-border, #334155);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 900px;
    overflow: hidden;
  }

  .label-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #334155);
  }

  .label-print-area {
    padding: 1.25rem;
    max-height: 70vh;
    overflow-y: auto;
    background: #f8fafc;
  }

  .label-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .label-card {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    border: 1.5px solid #1e293b;
    border-radius: 6px;
    background: #ffffff;
    overflow: hidden;
    min-height: 96px;
  }

  .label-qr {
    flex-shrink: 0;
    width: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
  }

  .label-qr img {
    display: block;
    image-rendering: crisp-edges;
  }

  .label-info {
    flex: 1;
    padding: 5px 7px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    background: #ffffff;
  }

  .label-name {
    font-size: 10px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .label-row {
    display: flex;
    gap: 3px;
    font-size: 8.5px;
    line-height: 1.3;
    color: #334155;
    overflow: hidden;
  }

  .label-field {
    flex-shrink: 0;
    font-weight: 600;
    color: #64748b;
    min-width: 30px;
  }

  .label-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ============================================================ */
  /* Print styles                                                  */
  /* ============================================================ */
  @media print {
    :global(body > *:not(.label-print-root)) {
      display: none !important;
    }

    .label-backdrop {
      position: static;
      background: transparent;
      padding: 0;
      overflow: visible;
    }

    .label-dialog {
      border: none;
      border-radius: 0;
      background: transparent;
      max-width: 100%;
      width: 100%;
    }

    .no-print {
      display: none !important;
    }

    .label-print-area {
      padding: 0;
      max-height: none;
      overflow: visible;
      background: transparent;
    }

    .label-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
      width: 100%;
    }

    .label-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1.5px solid #000;
      border-radius: 4px;
    }

    .label-qr {
      width: 90px;
    }

    .label-name {
      font-size: 9pt;
    }

    .label-row {
      font-size: 7pt;
    }
  }
</style>
