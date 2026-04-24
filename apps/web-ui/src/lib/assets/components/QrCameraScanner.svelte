<script lang="ts">
  import { buildCameraConstraintCandidates, resolveScannedPayload, type ResolvedScanPayload } from './QrCameraScanner.utils';
  import type { PluginListenerHandle } from '@capacitor/core';

  let {
    onscanned,
    disabled = false,
    placeholder = 'Quét QR hoặc nhập thủ công...'
  } = $props<{
    onscanned?: (scan: ResolvedScanPayload) => void
    disabled?: boolean
    placeholder?: string
  }>();

  let manualCode = $state('');
  let scanning = $state(false);
  let cameraActive = $state(false);
  let cameraError = $state('');
  let lastScanned = $state('');
  let cooldown = $state(false);

  // Web camera elements
  let videoEl = $state<HTMLVideoElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let stream = $state<MediaStream | null>(null);
  let scanTimerId = $state<number | null>(null);

  // Web torch support
  let torchOn = $state(false);
  let webTorchSupported = $state(false);
  let activeVideoTrack = $state<MediaStreamTrack | null>(null);

  // Native Capacitor state
  let isNative = $state(false);
  let nativeScannerReady = $state(false);
  let nativeScanListener = $state<PluginListenerHandle | null>(null);
  let nativeScanning = $state(false);
  let nativeTorchAvailable = $state(false);
  let nativeTorchOn = $state(false);

  // Web QR decoder libs (lazy-loaded)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let barcodeDetector: any = null;

  // ── Native Capacitor detection ────────────────────────────────────────────

  $effect(() => {
    void detectNativeEnvironment();
  });

  async function detectNativeEnvironment() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      isNative = true;
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const { supported } = await BarcodeScanner.isSupported();
      nativeScannerReady = supported;
    } catch {
      // Not on Capacitor; stay in web mode
    }
  }

  async function startNativeScan() {
    cameraError = '';
    nativeScanning = true;
    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

      // Request permission if needed
      const perms = await BarcodeScanner.checkPermissions();
      if (perms.camera !== 'granted') {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== 'granted') {
          await BarcodeScanner.openSettings();
          nativeScanning = false;
          return;
        }
      }

      // Check torch availability for the scanning session
      const torchAvail = await BarcodeScanner.isTorchAvailable();
      nativeTorchAvailable = torchAvail.available;
      nativeTorchOn = false;

      // Set up continuous scan listener
      nativeScanListener = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        const barcode = event.barcodes[0];
        if (!barcode) return;
        const code = barcode.rawValue ?? barcode.displayValue;
        if (!code || code === lastScanned || cooldown) return;

        lastScanned = code;
        cooldown = true;

        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch { /* haptics unavailable */ }

        handleDetected(code);

        setTimeout(() => { cooldown = false; lastScanned = ''; }, 1500);
      });

      await BarcodeScanner.startScan({
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Code93,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.DataMatrix,
          BarcodeFormat.Pdf417,
          BarcodeFormat.Aztec,
          BarcodeFormat.Itf,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
        ]
      });

      // Make WebView background transparent so native camera shows through
      document.body.style.setProperty('--cap-scanner-active', '1');
      document.documentElement.classList.add('cap-scanning');

    } catch (err) {
      nativeScanning = false;
      cameraError = err instanceof Error ? `Lỗi scanner: ${err.message}` : 'Không thể khởi động scanner.';
    }
  }

  async function stopNativeScan() {
    try {
      document.documentElement.classList.remove('cap-scanning');
      document.body.style.removeProperty('--cap-scanner-active');
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.stopScan();
      if (nativeScanListener) {
        await nativeScanListener.remove();
        nativeScanListener = null;
      }
    } catch { /* ignore cleanup errors */ }
    nativeScanning = false;
    nativeTorchOn = false;
    nativeTorchAvailable = false;
  }

  async function toggleNativeTorch() {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.toggleTorch();
      const { enabled } = await BarcodeScanner.isTorchEnabled();
      nativeTorchOn = enabled;
    } catch { /* torch unavailable */ }
  }

  // ── Web camera (existing behavior + torch + web vibration) ───────────────

  async function initBarcodeDetector() {
    if (barcodeDetector) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Detector = (globalThis as any).BarcodeDetector;
    if (!Detector) return false;
    try {
      if (typeof Detector.getSupportedFormats === 'function') {
        const formats: string[] = await Detector.getSupportedFormats();
        if (!formats.includes('qr_code')) return false;
      }
      barcodeDetector = new Detector({ formats: ['qr_code'] });
      return true;
    } catch {
      return false;
    }
  }

  async function loadJsQR() {
    if (jsQR) return true;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import('jsqr');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jsQR = (mod as any).default ?? mod;
      return !!jsQR;
    } catch {
      return false;
    }
  }

  async function ensureScannerReady() {
    const detectorReady = await initBarcodeDetector();
    if (detectorReady) return true;
    return loadJsQR();
  }

  async function startCamera() {
    cameraError = '';

    const loaded = await ensureScannerReady();
    if (!loaded) {
      cameraError = 'Không thể tải thư viện quét QR. Hãy nhập mã thủ công.';
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraError = 'Trình duyệt không hỗ trợ camera.';
      return;
    }

    try {
      let opened: MediaStream | null = null;
      const candidates = buildCameraConstraintCandidates(navigator.userAgent);

      for (const candidate of candidates) {
        try {
          opened = await navigator.mediaDevices.getUserMedia({ video: candidate, audio: false });
          break;
        } catch { /* try next profile */ }
      }
      if (!opened) {
        opened = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      stream = opened;

      // Check web torch support on the active video track
      const vTrack = opened.getVideoTracks()[0];
      if (vTrack) {
        activeVideoTrack = vTrack;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = (vTrack as any).getCapabilities?.();
        webTorchSupported = Boolean(caps?.torch);
      }

      if (!videoEl) return;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.setAttribute('muted', 'true');
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraActive = true;
      scheduleScan();
    } catch (err) {
      const name = err instanceof Error ? (err as { name?: string }).name ?? '' : '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        cameraError = 'Không tìm thấy camera trên thiết bị này. Hãy nhập mã thủ công.';
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        cameraError = window.isSecureContext
          ? 'Quyền truy cập camera bị từ chối. Vui lòng cho phép camera trong cài đặt trình duyệt.'
          : 'Trình duyệt chặn camera trên HTTP. Hãy dùng HTTPS hoặc localhost, hoặc nhập mã thủ công.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        cameraError = 'Camera đang được sử dụng bởi ứng dụng khác. Hãy đóng ứng dụng đó và thử lại.';
      } else if (name === 'OverconstrainedError') {
        cameraError = 'Camera không đáp ứng được yêu cầu. Hãy thử lại.';
      } else if (name === 'SecurityError') {
        cameraError = 'Truy cập camera bị chặn bởi chính sách bảo mật. Trên HTTP đa số trình duyệt sẽ không cho phép.';
      } else {
        cameraError = `Không thể mở camera: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`;
      }
    }
  }

  function stopCamera() {
    if (scanTimerId !== null) {
      clearTimeout(scanTimerId);
      scanTimerId = null;
    }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (videoEl) { videoEl.srcObject = null; }
    cameraActive = false;
    torchOn = false;
    webTorchSupported = false;
    activeVideoTrack = null;
  }

  async function toggleWebTorch() {
    if (!activeVideoTrack || !webTorchSupported) return;
    torchOn = !torchOn;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (activeVideoTrack as any).applyConstraints({ advanced: [{ torch: torchOn }] });
    } catch {
      torchOn = !torchOn; // revert on failure
    }
  }

  function scheduleScan(delayMs = 140) {
    if (!cameraActive) return;
    scanTimerId = window.setTimeout(() => {
      void processScanFrame();
    }, delayMs);
  }

  async function processScanFrame() {
    if (!cameraActive || !videoEl || !canvasEl) return;
    const video = videoEl;
    const canvas = canvasEl;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detectedCode = await detectCode(video, canvas, ctx);
        if (detectedCode && detectedCode !== lastScanned && !cooldown) {
          lastScanned = detectedCode;
          cooldown = true;
          handleDetected(detectedCode);
          setTimeout(() => { cooldown = false; lastScanned = ''; }, 1500);
          scheduleScan(450);
          return;
        }
      }
    }
    scheduleScan();
  }

  async function detectCode(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<string | null> {
    if (barcodeDetector) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detected = await (barcodeDetector as any).detect(video);
        if (Array.isArray(detected) && detected.length > 0) {
          const raw = detected[0]?.rawValue;
          if (typeof raw === 'string' && raw.trim()) return raw;
        }
      } catch { /* fall through to jsQR */ }
    }

    if (!jsQR) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    return result?.data ?? null;
  }

  // ── Shared detection handler ──────────────────────────────────────────────

  function handleDetected(code: string) {
    // Web fallback vibration (no-op on desktop/unsupported)
    try { navigator.vibrate?.(200); } catch { /* ignore */ }
    const resolved = resolveScannedPayload(code);
    onscanned?.(resolved);
  }

  function handleManualSubmit(e: Event) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || scanning || disabled) return;
    onscanned?.(resolveScannedPayload(code));
    manualCode = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSubmit(e as unknown as Event);
    }
  }

  $effect(() => {
    return () => {
      stopCamera();
      if (nativeScanning) void stopNativeScan();
    };
  });
</script>

<div class="qr-scanner-wrap space-y-3">
  <!-- Manual input row -->
  <div class="flex gap-2">
    <input
      class="input-base flex-1 font-mono text-sm"
      bind:value={manualCode}
      {placeholder}
      {disabled}
      autocomplete="off"
      onkeydown={handleKeydown}
    />
    <button
      type="button"
      class="btn btn-primary btn-sm px-3"
      disabled={disabled || !manualCode.trim()}
      onclick={handleManualSubmit}
    >
      Nhập
    </button>

    {#if isNative && nativeScannerReady}
      <!-- Native Capacitor scanner button -->
      <button
        type="button"
        class="btn btn-secondary btn-sm px-3 flex items-center gap-1.5"
        title={nativeScanning ? 'Dừng quét' : 'Quét mã (Camera native)'}
        onclick={() => nativeScanning ? stopNativeScan() : startNativeScan()}
        {disabled}
      >
        {#if nativeScanning}
          <!-- Stop icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          Dừng
        {:else}
          <!-- Barcode scan icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>
          Quét
        {/if}
      </button>
    {:else}
      <!-- Web camera toggle button -->
      <button
        type="button"
        class="btn btn-secondary btn-sm px-3 flex items-center gap-1.5"
        title={cameraActive ? 'Tắt camera' : 'Mở camera QR'}
        onclick={() => cameraActive ? stopCamera() : startCamera()}
        {disabled}
      >
        {#if cameraActive}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg>
          Tắt
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          QR
        {/if}
      </button>
    {/if}
  </div>

  <!-- Camera error -->
  {#if cameraError}
    <div class="text-xs text-red-400 bg-red-900/20 rounded-md px-3 py-2">{cameraError}</div>
  {/if}

  <!-- Native scanning overlay controls -->
  {#if nativeScanning}
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 pointer-events-none">
      <!-- Top bar: stop + torch buttons -->
      <div class="pointer-events-auto flex gap-3 pt-10">
        <button
          type="button"
          class="btn btn-secondary flex items-center gap-2 shadow-lg"
          onclick={stopNativeScan}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Dừng quét
        </button>
        {#if nativeTorchAvailable}
          <button
            type="button"
            class="btn flex items-center gap-2 shadow-lg {nativeTorchOn ? 'btn-primary' : 'btn-secondary'}"
            onclick={toggleNativeTorch}
            title={nativeTorchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
          >
            <!-- Flash/torch icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {nativeTorchOn ? 'Tắt đèn' : 'Đèn flash'}
          </button>
        {/if}
      </div>
      <!-- Bottom hint -->
      <p class="text-white text-sm drop-shadow-md pb-16 select-none">Hướng camera vào mã QR / barcode</p>
    </div>
  {/if}

  <!-- Web camera viewfinder — always in DOM so bind:this works immediately -->
  <div class:hidden={!cameraActive} class="relative rounded-xl overflow-hidden border border-primary/40 bg-black" style="max-height: 280px;">
    <video
      bind:this={videoEl}
      class="w-full object-cover"
      style="max-height: 280px;"
      playsinline
      muted
    ></video>
    <!-- Overlay crosshair -->
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="border-2 border-primary rounded-lg w-40 h-40 opacity-70"></div>
    </div>
    <!-- Web torch toggle (shown when supported) -->
    {#if webTorchSupported}
      <button
        type="button"
        class="absolute top-2 right-2 pointer-events-auto rounded-lg p-1.5 shadow {torchOn ? 'bg-yellow-400 text-black' : 'bg-black/60 text-white'}"
        onclick={toggleWebTorch}
        title={torchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </button>
    {/if}
    <div class="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70 select-none">
      Hướng camera vào mã QR
    </div>
  </div>
  <!-- Hidden canvas for image processing -->
  <canvas bind:this={canvasEl} class="hidden" aria-hidden="true"></canvas>
</div>
