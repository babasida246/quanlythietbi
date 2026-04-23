<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { _, isLoading } from '$lib/i18n'
  import { listAssets, type Asset } from '$lib/api/assets'
  import Button from '$lib/components/ui/Button.svelte'
  import PrintDialog from '$lib/components/print/PrintDialog.svelte'
  import { Printer } from 'lucide-svelte'

  // ─── Receiver form ───────────────────────────────────────────────────────
  let receiverName = $state('')
  let department = $state('')
  let allocateDate = $state(new Date().toISOString().slice(0, 10))
  let purpose = $state('')

  // ─── Scanner ─────────────────────────────────────────────────────────────
  let scanInput = $state('')
  let scanLoading = $state(false)
  let scanError = $state('')

  async function handleScanKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && scanInput.trim()) {
      await lookupByCode(scanInput.trim())
      scanInput = ''
    }
  }

  async function lookupByCode(code: string) {
    if (!code) return
    scanLoading = true
    scanError = ''
    try {
      const res = await listAssets({ query: code, limit: 5 })
      const assets = res.data ?? []
      const found = assets.find((a) => a.assetCode === code) ?? assets[0]
      if (!found) {
        scanError = `Không tìm thấy tài sản với mã: ${code}`
        return
      }
      addAsset(found)
    } catch (err) {
      scanError = err instanceof Error ? err.message : String(err)
    } finally {
      scanLoading = false
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────
  let searchQuery = $state('')
  let searchResults = $state<Asset[]>([])
  let searching = $state(false)

  async function runSearch() {
    if (!searchQuery.trim()) return
    searching = true
    try {
      const res = await listAssets({ query: searchQuery.trim(), limit: 10 })
      searchResults = res.data ?? []
    } catch {
      searchResults = []
    } finally {
      searching = false
    }
  }

  // ─── Allocated list ───────────────────────────────────────────────────────
  let allocatedAssets = $state<Asset[]>([])

  function addAsset(asset: Asset) {
    if (allocatedAssets.some((a) => a.id === asset.id)) {
      scanError = `Thiết bị ${asset.assetCode} đã có trong danh sách`
      return
    }
    allocatedAssets = [...allocatedAssets, asset]
    scanError = ''
  }

  function removeAsset(id: string) {
    allocatedAssets = allocatedAssets.filter((a) => a.id !== id)
  }

  // ─── Camera scanning ──────────────────────────────────────────────────────
  let cameraActive = $state(false)
  let videoEl = $state<HTMLVideoElement | null>(null)
  let cameraError = $state('')
  let mediaStream = $state<MediaStream | null>(null)
  let detectorTimer: ReturnType<typeof setInterval> | null = null

  async function startCamera() {
    cameraError = ''
    if (!('BarcodeDetector' in window)) {
      cameraError = 'Trình duyệt không hỗ trợ camera scan. Dùng Chrome/Edge 83+ hoặc nhập mã thủ công.'
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      mediaStream = stream
      cameraActive = true
    } catch (err) {
      cameraError = err instanceof Error ? err.message : 'Không thể truy cập camera'
    }
  }

  $effect(() => {
    if (cameraActive && videoEl && mediaStream) {
      videoEl.srcObject = mediaStream
      void videoEl.play()
      startDetection()
    }
  })

  function startDetection() {
    if (detectorTimer) clearInterval(detectorTimer)
    // @ts-expect-error BarcodeDetector not in TS lib yet
    const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'code_93'] })
    detectorTimer = setInterval(async () => {
      if (!videoEl || !cameraActive) return
      try {
        const results: Array<{ rawValue: string }> = await detector.detect(videoEl)
        if (results.length > 0) {
          stopCamera()
          await lookupByCode(results[0].rawValue)
        }
      } catch { /* ignore */ }
    }, 400)
  }

  function stopCamera() {
    cameraActive = false
    if (detectorTimer) { clearInterval(detectorTimer); detectorTimer = null }
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null }
    if (videoEl) videoEl.srcObject = null
  }

  onDestroy(() => stopCamera())

  // ─── Print ────────────────────────────────────────────────────────────────
  let printOpen = $state(false)

  const printSourceData = $derived({
    receiverName,
    department,
    allocateDate,
    purpose,
    items: allocatedAssets.map((a, i) => ({
      stt: i + 1,
      assetCode: a.assetCode,
      modelName: a.modelName ?? '',
      serialNo: a.serialNo ?? '',
      notes: ''
    }))
  })
</script>

<div class="page-shell page-content space-y-4">
  <!-- ── Page header ─────────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Cấp phát thiết bị' : $_('nav.allocate')}</h2>
      <p class="text-sm text-slate-500">Biên bản bàn giao thiết bị</p>
    </div>
    <div class="flex gap-2">
      <Button onclick={() => (printOpen = true)} disabled={allocatedAssets.length === 0}>
        <Printer class="h-4 w-4 mr-1" />
        In biên bản
      </Button>
      <Button variant="secondary" onclick={() => goto('/warehouse/documents')}>
        {$isLoading ? 'Back' : $_('common.back')}
      </Button>
    </div>
  </div>

  {#if scanError}
    <div class="alert alert-error">{scanError}</div>
  {/if}
  {#if cameraError}
    <div class="alert alert-error">{cameraError}</div>
  {/if}

  <!-- ── Receiver form ───────────────────────────────────────────────────── -->
  <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
      <div>
        <label for="al-receiver" class="mb-1 block text-xs font-medium text-slate-400">Người nhận</label>
        <input id="al-receiver" class="input-base text-sm w-full" type="text" bind:value={receiverName} placeholder="Họ tên người nhận" />
      </div>
      <div>
        <label for="al-dept" class="mb-1 block text-xs font-medium text-slate-400">Phòng ban / Bộ phận</label>
        <input id="al-dept" class="input-base text-sm w-full" type="text" bind:value={department} placeholder="Phòng / Ban" />
      </div>
      <div>
        <label for="al-date" class="mb-1 block text-xs font-medium text-slate-400">Ngày cấp phát</label>
        <input id="al-date" class="input-base text-sm w-full" type="date" bind:value={allocateDate} />
      </div>
      <div>
        <label for="al-purpose" class="mb-1 block text-xs font-medium text-slate-400">Mục đích sử dụng</label>
        <input id="al-purpose" class="input-base text-sm w-full" type="text" bind:value={purpose} placeholder="Mục đích sử dụng" />
      </div>
    </div>
  </div>

  <!-- ── Scanner / Search ────────────────────────────────────────────────── -->
  <div class="border-x border-slate-700 bg-slate-900/60 px-5 py-4 space-y-3">
    <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Thêm thiết bị</p>

    <!-- Barcode input -->
    <div class="flex gap-2">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="input-base flex-1 text-sm font-mono"
        type="text"
        bind:value={scanInput}
        onkeydown={handleScanKeydown}
        placeholder="Nhập hoặc quét mã vạch, nhấn Enter..."
        disabled={scanLoading}
        autofocus
      />
      <Button onclick={() => { void lookupByCode(scanInput.trim()) }} disabled={!scanInput.trim() || scanLoading}>
        {scanLoading ? 'Đang tìm...' : 'Thêm'}
      </Button>
      <Button variant="secondary" onclick={cameraActive ? stopCamera : startCamera}>
        {cameraActive ? 'Dừng camera' : 'Camera'}
      </Button>
    </div>

    <!-- Camera preview -->
    {#if cameraActive}
      <div class="relative rounded-lg overflow-hidden bg-black" style="max-height: 240px">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoEl} class="w-full object-cover" autoplay playsinline muted></video>
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="border-2 border-primary w-48 h-28 rounded-md opacity-70"></div>
        </div>
        <button
          type="button"
          class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center"
          onclick={stopCamera}
          aria-label="Dừng camera"
        >✕</button>
      </div>
    {/if}

    <!-- Search -->
    <div class="flex gap-2">
      <input
        class="input-base flex-1 text-sm"
        type="text"
        bind:value={searchQuery}
        onkeydown={(e) => { if (e.key === 'Enter') void runSearch() }}
        placeholder="Tìm tài sản theo tên model, serial, mã..."
      />
      <Button variant="secondary" onclick={() => void runSearch()} disabled={searching}>
        {searching ? 'Đang tìm...' : 'Tìm kiếm'}
      </Button>
    </div>

    {#if searchResults.length > 0}
      <div class="rounded-md border border-slate-700 divide-y divide-slate-700/60">
        {#each searchResults as asset}
          <button
            type="button"
            class="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-slate-700/40 transition-colors"
            onclick={() => { addAsset(asset); searchResults = []; searchQuery = '' }}
          >
            <span class="font-mono text-xs text-slate-400 shrink-0 w-28">{asset.assetCode}</span>
            <span class="flex-1 text-slate-200 truncate">{asset.modelName ?? asset.assetCode}</span>
            <span class="text-xs text-slate-500 shrink-0">{asset.serialNo ?? ''}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">{asset.status}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Danh sách thiết bị ──────────────────────────────────────────────── -->
  <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
    <div class="mb-3 flex items-center gap-3">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Chi tiết thiết bị cấp phát</h3>
      {#if allocatedAssets.length > 0}
        <span class="text-xs text-slate-500">{allocatedAssets.length} thiết bị</span>
      {/if}
    </div>

    {#if allocatedAssets.length === 0}
      <p class="py-6 text-center text-sm text-slate-500">
        Chưa có thiết bị nào. Quét mã vạch hoặc tìm kiếm để thêm.
      </p>
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th class="w-10 text-center">#</th>
              <th>Mã thiết bị</th>
              <th>Model</th>
              <th>Serial No.</th>
              <th>Trạng thái</th>
              <th>Danh mục</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {#each allocatedAssets as asset, i}
              <tr>
                <td class="text-center text-slate-400">{i + 1}</td>
                <td class="font-mono text-xs">{asset.assetCode}</td>
                <td>{asset.modelName ?? '—'}</td>
                <td class="text-slate-400">{asset.serialNo ?? '—'}</td>
                <td>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{asset.status}</span>
                </td>
                <td class="text-slate-400">{asset.categoryName ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    class="text-red-400 hover:text-red-300 transition-colors text-xs"
                    onclick={() => removeAsset(asset.id)}
                    aria-label="Xóa khỏi danh sách"
                  >✕</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- ── Footer actions ─────────────────────────────────────────────────── -->
  {#if allocatedAssets.length > 0}
    <div class="flex justify-end gap-2">
      <Button onclick={() => (printOpen = true)}>
        <Printer class="h-4 w-4 mr-1" />
        In biên bản bàn giao
      </Button>
    </div>
  {/if}
</div>

<PrintDialog
  bind:isOpen={printOpen}
  docType="bien_ban_ban_giao"
  sourceData={printSourceData}
  onClose={() => (printOpen = false)}
/>
