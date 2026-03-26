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
    if (normalized.includes('not found')) return 'Không tìm thấy tài sản từ mã/QR đã quét';
    if (normalized.includes('session')) return 'Phiên kiểm kê không hợp lệ hoặc đã đóng';
    if (normalized.includes('location')) return 'Vị trí quét không hợp lệ';
    if (normalized.includes('already')) return 'Tài sản đã được quét trong phiên này';
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
    if (!assetCode.trim()) {
      error = 'Vui lòng nhập mã tài sản hoặc QR URL';
      return;
    }

    const parsed = parseAssetInput(assetCode);
    if (!parsed || (!parsed.assetId && !parsed.assetCode)) {
      error = 'Không đọc được dữ liệu từ mã quét';
      return;
    }

    if (!canSubmitValue(assetCode.trim())) return;

    try {
      scanning = true;
      error = '';
      success = '';
      await scanInventoryAsset(sessionId, {
        ...parsed,
        scannedLocationId: scannedLocationId || undefined,
        note: note || undefined
      });
      success = 'Quét thành công';
      if (continuousMode) {
        assetCode = '';
      } else {
        assetCode = '';
        scannedLocationId = '';
      }
      onscanned?.();
    } catch (err) {
      error = err instanceof Error ? mapScanError(err.message) : 'Quét thất bại';
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
    <div>
      <label for="scan-asset-code" class="label-base mb-2">{$isLoading ? 'Asset Code' : $_('assets.assetCode')}</label>
      <input id="scan-asset-code" class="input-base" bind:value={assetCode} placeholder="ASSET-001 hoặc URL QR" onkeydown={onAssetCodeEnter} />
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
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label class="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" bind:checked={continuousMode} />
      <span>Chế độ quét liên tục</span>
    </label>
    <div>
      <label for="scan-note" class="label-base mb-2">Ghi chú quét</label>
      <input id="scan-note" class="input-base" bind:value={note} placeholder="Tùy chọn" />
    </div>
  </div>
</div>
