<script lang="ts">
  /**
   * QrCameraScanner — camera-based QR/barcode scanner using jsQR (bundled inline via dataURL-free approach)
   * Uses HTMLVideoElement + canvas sampling to detect QR codes without any external dependencies.
   * Falls back gracefully when camera is unavailable.
   */

  let {
    onscanned,
    disabled = false,
    placeholder = 'Quét QR hoặc nhập thủ công...'
  } = $props<{
    onscanned?: (code: string) => void
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
  let rafId = $state<number | null>(null);

  // Dynamically import jsQR (available as a CDN ESM module via skypack or local)
  let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null;

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

  async function startCamera() {
    cameraError = '';
    const loaded = await loadJsQR();
    if (!loaded) {
      cameraError = 'Không thể tải thư viện quét QR. Hãy nhập mã thủ công.';
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraError = 'Trình duyệt không hỗ trợ camera.';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (!videoEl) return;
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraActive = true;
      scanLoop();
    } catch (err) {
      cameraError = `Không thể mở camera: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`;
    }
  }

  function stopCamera() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (videoEl) { videoEl.srcObject = null; }
    cameraActive = false;
  }

  function scanLoop() {
    if (!cameraActive || !videoEl || !canvasEl || !jsQR) return;
    const video = videoEl;
    const canvas = canvasEl;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data && result.data !== lastScanned && !cooldown) {
          lastScanned = result.data;
          cooldown = true;
          handleDetected(result.data);
          setTimeout(() => {
            cooldown = false;
            lastScanned = '';
          }, 1500);
        }
      }
    }
    rafId = requestAnimationFrame(scanLoop);
  }

  function handleDetected(code: string) {
    // If it looks like a URL (QR contains URL asset), extract the last path segment
    let resolved = code;
    try {
      const url = new URL(code);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        resolved = parts[parts.length - 1];
      }
    } catch {
      // not a URL — use code as-is
    }
    onscanned?.(resolved);
  }

  function handleManualSubmit(e: Event) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || scanning || disabled) return;
    onscanned?.(code);
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

  <!-- Camera viewfinder -->
  {#if cameraActive}
    <div class="relative rounded-xl overflow-hidden border border-primary/40 bg-black" style="max-height: 280px;">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <video
        bind:this={videoEl}
        class="w-full object-cover"
        style="max-height: 280px;"
        playsinline
        muted
        autoplay
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
  {/if}
</div>
