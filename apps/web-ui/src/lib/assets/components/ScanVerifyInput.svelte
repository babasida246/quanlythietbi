<script lang="ts">
  import { verifyScan, type VerifyScanResult } from '$lib/api/assetMgmt';

  let {
    requestId,
    onverified,
    disabled = false,
    placeholder = 'Quét mã vạch thiết bị...'
  } = $props<{
    requestId: string;
    onverified?: (result: VerifyScanResult, scanType: 'barcode' | 'manual') => void;
    disabled?: boolean;
    placeholder?: string;
  }>();

  type ScanState = 'idle' | 'loading' | 'match' | 'nomatch' | 'error';

  let inputValue = $state('');
  let state = $state<ScanState>('idle');
  let result = $state<VerifyScanResult | null>(null);
  let errorMsg = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let lastSubmitted = $state('');
  let lastSubmittedAt = $state(0);

  // UUID regex for detecting scanner output vs manual input
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function parseInput(raw: string): string {
    const value = raw.trim();
    if (!value) return '';
    // URL pattern (e.g. QR code containing asset detail URL)
    try {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p.toLowerCase() === 'assets');
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].toUpperCase();
    } catch {
      // not a URL
    }
    return value.toUpperCase();
  }

  async function doScan(raw: string, scanType: 'barcode' | 'manual') {
    const code = parseInput(raw);
    if (!code) return;

    // Debounce: same value within 1.5s (prevents double-scan from USB barcode guns)
    const now = Date.now();
    if (code === lastSubmitted && now - lastSubmittedAt < 1500) return;
    lastSubmitted = code;
    lastSubmittedAt = now;

    state = 'loading';
    result = null;
    errorMsg = '';

    try {
      const res = await verifyScan(requestId, code, scanType);
      result = res.data;
      state = res.data.match ? 'match' : 'nomatch';
      if (res.data.match) {
        onverified?.(res.data, scanType);
      }
    } catch (e) {
      state = 'error';
      errorMsg = String(e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doScan(inputValue, 'barcode');
      inputValue = '';
    }
  }

  function handleManual() {
    if (!inputValue.trim()) return;
    doScan(inputValue, 'manual');
    inputValue = '';
  }

  function reset() {
    state = 'idle';
    result = null;
    errorMsg = '';
    inputValue = '';
    inputEl?.focus();
  }
</script>

<div class="scan-verify-input">
  <!-- Input row -->
  <div class="flex gap-2">
    <div class="relative flex-1">
      <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        <!-- barcode icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v3M21 16v3M21 10v4"/>
        </svg>
      </span>
      <input
        bind:this={inputEl}
        type="text"
        bind:value={inputValue}
        {placeholder}
        {disabled}
        onkeydown={handleKeydown}
        autofocus
        class="input-base pl-8 pr-3 w-full font-mono text-sm
               {state === 'match' ? 'border-success ring-1 ring-success/30' : ''}
               {state === 'nomatch' || state === 'error' ? 'border-error ring-1 ring-error/30' : ''}"
      />
    </div>
    <button
      type="button"
      onclick={handleManual}
      disabled={disabled || !inputValue.trim() || state === 'loading'}
      class="btn btn-sm px-3 text-xs"
    >
      Kiểm tra
    </button>
    {#if state !== 'idle'}
      <button type="button" onclick={reset} class="btn btn-sm px-2 text-xs text-slate-500">✕</button>
    {/if}
  </div>

  <!-- Status feedback -->
  {#if state === 'loading'}
    <p class="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
      Đang kiểm tra...
    </p>
  {:else if state === 'match' && result?.asset}
    <div class="mt-1.5 flex items-start gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2">
      <span class="text-success mt-0.5 shrink-0">✓</span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-success">Xác nhận đúng thiết bị</p>
        <p class="text-xs text-slate-600 dark:text-slate-300 truncate">
          <span class="font-mono">{result.asset.assetCode}</span>
          — {result.asset.name}
          {#if result.asset.modelName}
            <span class="text-slate-400">({result.asset.modelName})</span>
          {/if}
        </p>
      </div>
    </div>
  {:else if state === 'nomatch'}
    <div class="mt-1.5 flex items-start gap-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2">
      <span class="text-error mt-0.5 shrink-0">✗</span>
      <div>
        <p class="text-sm font-medium text-error">Không khớp</p>
        <p class="text-xs text-slate-500">{result?.message ?? 'Thiết bị không có trong phiếu yêu cầu'}</p>
        {#if result?.asset}
          <p class="text-xs text-slate-500 font-mono">{result.asset.assetCode} — {result.asset.name}</p>
        {/if}
      </div>
    </div>
  {:else if state === 'error'}
    <p class="mt-1.5 text-xs text-error">{errorMsg}</p>
  {/if}
</div>
