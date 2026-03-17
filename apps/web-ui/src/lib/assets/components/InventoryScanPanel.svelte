<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import { scanInventoryAsset } from '$lib/api/assetMgmt';

  let {
    sessionId = '',
    locations = [],
    onscanned
  } = $props<{ sessionId?: string; locations?: Array<{ id: string; name: string }>; onscanned?: () => void }>();

  let assetCode = $state('');
  let scannedLocationId = $state('');
  let error = $state('');
  let scanning = $state(false);

  async function handleScan() {
    if (!sessionId) {
      error = $_('assets.inventory.selectSessionError');
      return;
    }
    if (!assetCode) {
      error = 'Asset code is required';
      return;
    }
    try {
      scanning = true;
      error = '';
      await scanInventoryAsset(sessionId, {
        assetCode,
        scannedLocationId: scannedLocationId || undefined
      });
      assetCode = '';
      scannedLocationId = '';
      onscanned?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Scan failed';
    } finally {
      scanning = false;
    }
  }
</script>

<div class="space-y-3">
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div>
      <label for="scan-asset-code" class="label-base mb-2">{$isLoading ? 'Asset Code' : $_('assets.assetCode')}</label>
      <input id="scan-asset-code" class="input-base" bind:value={assetCode} placeholder="ASSET-001" />
    </div>
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
</div>
