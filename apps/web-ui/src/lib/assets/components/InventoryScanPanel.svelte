<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import { scanInventoryAsset } from '$lib/api/assetMgmt';

  let {
    sessionId = '',
    locations = [],
    fixedAssetId,
    fixedAssetCode,
    onscanned
  } = $props<{
    sessionId?: string;
    locations?: Array<{ id: string; name: string }>;
    fixedAssetId?: string;
    fixedAssetCode?: string;
    onscanned?: () => void;
  }>();

  let assetCode = $state('');
  let scannedLocationId = $state('');
  let note = $state('');
  let error = $state('');
  let success = $state('');
  let scanning = $state(false);
  let continuousMode = $state(true);
  let lastSubmittedValue = $state('');
  let lastSubmittedAt = $state(0);

  function parseAssetInput(raw: string): { assetId?: string; assetCode?: string } | null {
    const value = raw.trim();
    if (!value) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      return { assetId: value };
    }

    try {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((part) => part.toLowerCase() === 'assets');
      if (idx >= 0 && parts[idx + 1]) {
        const candidate = parts[idx + 1];
        if (uuidRegex.test(candidate)) return { assetId: candidate };
        return { assetCode: candidate.toUpperCase() };
      }
    } catch {
      // ignore non-url input
    }

    return { assetCode: value.toUpperCase() };
  }

  function mapScanError(message: string): string {
    const normalized = message.toLowerCase();
    if (normalized.includes('not found')) return $_('assets.inventory.scanPanel.errors.notFound');
    if (normalized.includes('session')) return $_('assets.inventory.scanPanel.errors.sessionInvalid');
    if (normalized.includes('location')) return $_('assets.inventory.scanPanel.errors.locationInvalid');
    if (normalized.includes('already')) return $_('assets.inventory.scanPanel.errors.alreadyScanned');
    return message;
  }

  function canSubmitValue(value: string): boolean {
    const now = Date.now();
    if (value === lastSubmittedValue && now - lastSubmittedAt < 1200) {
      return false;
    }
    lastSubmittedValue = value;
    lastSubmittedAt = now;
    return true;
  }

  async function handleScan() {
    if (!sessionId) {
      error = $_('assets.inventory.selectSessionError');
      return;
    }

    let payload: { assetId?: string; assetCode?: string; scannedLocationId?: string; note?: string };
    if (fixedAssetId) {
      payload = {
        assetId: fixedAssetId,
        scannedLocationId: scannedLocationId || undefined,
        note: note || undefined
      };
      if (!canSubmitValue(`${fixedAssetId}:${sessionId}`)) return;
    } else {
      if (!assetCode.trim()) {
        error = $_('assets.inventory.scanPanel.errors.codeRequired');
        return;
      }

      const parsed = parseAssetInput(assetCode);
      if (!parsed || (!parsed.assetId && !parsed.assetCode)) {
        error = $_('assets.inventory.scanPanel.errors.parseFailed');
        return;
      }

      if (!canSubmitValue(assetCode.trim())) return;
      payload = {
        ...parsed,
        scannedLocationId: scannedLocationId || undefined,
        note: note || undefined
      };
    }

    try {
      scanning = true;
      error = '';
      success = '';
      await scanInventoryAsset(sessionId, payload);
      success = $_('assets.inventory.scanPanel.success');
      if (continuousMode) {
        assetCode = '';
      } else {
        assetCode = '';
        scannedLocationId = '';
      }
      onscanned?.();
    } catch (err) {
      error = err instanceof Error ? mapScanError(err.message) : $_('assets.inventory.scanPanel.errors.scanFailed');
    } finally {
      scanning = false;
    }
  }

  async function onAssetCodeEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await handleScan();
  }
</script>

<div class="space-y-3">
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}
  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    {#if fixedAssetId}
      <div>
        <div class="label-base mb-2">{$isLoading ? 'Asset' : $_('assets.asset')}</div>
        <div class="input-base flex items-center text-sm text-slate-300">{fixedAssetCode || fixedAssetId}</div>
      </div>
    {:else}
      <div>
        <label for="scan-asset-code" class="label-base mb-2">{$isLoading ? 'Asset Code' : $_('assets.assetCode')}</label>
        <input id="scan-asset-code" class="input-base" bind:value={assetCode} placeholder={$isLoading ? 'ASSET-001 or QR URL' : $_('assets.inventory.scanPanel.codePlaceholder')} onkeydown={onAssetCodeEnter} />
      </div>
    {/if}
    <div>
      <label for="scan-location" class="label-base mb-2">{$isLoading ? 'Scanned Location' : $_('assets.scannedLocation')}</label>
      <select id="scan-location" class="select-base" bind:value={scannedLocationId}>
        <option value="">{$isLoading ? 'Select location' : $_('assets.placeholders.selectLocation')}</option>
        {#each locations as location}
          <option value={location.id}>{location.name}</option>
        {/each}
      </select>
    </div>
    <div class="flex items-end">
      <Button onclick={handleScan} disabled={scanning || !assetCode || !sessionId}>
        {scanning ? ($isLoading ? 'Scanning...' : $_('assets.scanning')) : ($isLoading ? 'Scan' : $_('assets.scan'))}
      </Button>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label class="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" bind:checked={continuousMode} />
      <span>{$isLoading ? 'Continuous scan mode' : $_('assets.inventory.scanPanel.continuousMode')}</span>
    </label>
    <div>
      <label for="scan-note" class="label-base mb-2">{$isLoading ? 'Scan note' : $_('assets.inventory.scanPanel.noteLabel')}</label>
      <input id="scan-note" class="input-base" bind:value={note} placeholder={$isLoading ? 'Optional' : $_('assets.inventory.scanPanel.notePlaceholder')} />
    </div>
  </div>
</div>
