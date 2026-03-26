<script lang="ts">
  /**
   * QrCameraScanner — camera-based QR/barcode scanner using jsQR (bundled inline via dataURL-free approach)
   * Uses HTMLVideoElement + canvas sampling to detect QR codes without any external dependencies.
   * Falls back gracefully when camera is unavailable.
   */

  import { buildCameraConstraintCandidates, resolveScannedPayload, type ResolvedScanPayload } from './QrCameraScanner.utils';

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

  let videoEl = $state<HTMLVideoElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let stream = $state<MediaStream | null>(null);
  let scanTimerId = $state<number | null>(null);

  // Dynamically import jsQR for fallback decoding when BarcodeDetector is not available.
  let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let barcodeDetector: any = null;

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
      // jsQR ships as a commonjs module; we use the bundled version via dynamic import
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – jsqr types are declared in the package but TypeScript may not resolve them in all setups
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
    if (!window.isSecureContext) {
      cameraError = 'Camera chỉ hoạt động trên HTTPS hoặc localhost. Hãy chuyển sang kết nối an toàn.';
      return;
    }

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
        } catch {
          // Try next camera profile.
        }
      }
      if (!opened) {
        opened = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      stream = opened;
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
        cameraError = 'Quyền truy cập camera bị từ chối. Vui lòng cho phép camera trong cài đặt trình duyệt.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        cameraError = 'Camera đang được sử dụng bởi ứng dụng khác. Hãy đóng ứng dụng đó và thử lại.';
      } else if (name === 'OverconstrainedError') {
        cameraError = 'Camera không đáp ứng được yêu cầu. Hãy thử lại.';
      } else if (name === 'SecurityError') {
        cameraError = 'Truy cập camera bị chặn bởi chính sách bảo mật. Cần HTTPS hoặc localhost.';
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
          setTimeout(() => {
            cooldown = false;
            lastScanned = '';
          }, 1500);
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
      } catch {
        // Fall through to jsQR.
      }
    }

    if (!jsQR) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    return result?.data ?? null;
  }

  function handleDetected(code: string) {
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
    return () => stopCamera();
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
    <button
      type="button"
      class="btn btn-secondary btn-sm px-3 flex items-center gap-1.5"
      title={cameraActive ? 'Tắt camera' : 'Mở camera QR'}
      onclick={() => cameraActive ? stopCamera() : startCamera()}
      disabled={disabled}
    >
      <!-- Camera icon inline SVG -->
      {#if cameraActive}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg>
        Tắt
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        QR
      {/if}
    </button>
  </div>

  <!-- Camera error -->
  {#if cameraError}
    <div class="text-xs text-red-400 bg-red-900/20 rounded-md px-3 py-2">{cameraError}</div>
  {/if}

  <!-- Camera viewfinder — always in DOM so bind:this is available immediately -->
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
    <div class="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70 select-none">
      Hướng camera vào mã QR
    </div>
  </div>
  <!-- Hidden canvas for image processing -->
  <canvas bind:this={canvasEl} class="hidden" aria-hidden="true"></canvas>
</div>
