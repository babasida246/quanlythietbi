<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { _, isLoading } from '$lib/i18n'
  import { listAssets, type Asset } from '$lib/api/assets'
  import Button from '$lib/components/ui/Button.svelte'
  import PrintDialog from '$lib/components/print/PrintDialog.svelte'
  import { Printer } from 'lucide-svelte'

  // ─── Recall form ──────────────────────────────────────────────────────────
  let recallerName = $state('')
  let department = $state('')
  let recallDate = $state(new Date().toISOString().slice(0, 10))
  let reason = $state('')

  // ─── Scanner ──────────────────────────────────────────────────────────────
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

  // ─── Search ───────────────────────────────────────────────────────────────
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

  // ─── Recalled list ────────────────────────────────────────────────────────
  let recalledAssets = $state<Asset[]>([])
  let confirmed = $state<Set<string>>(new Set())

  function addAsset(asset: Asset) {
    if (recalledAssets.some((a) => a.id === asset.id)) {
      scanError = `Thiết bị ${asset.assetCode} đã có trong danh sách`
      return
    }
    recalledAssets = [...recalledAssets, asset]
    scanError = ''
  }

  function removeAsset(id: string) {
    recalledAssets = recalledAssets.filter((a) => a.id !== id)
    confirmed.delete(id)
    confirmed = new Set(confirmed)
  }

  function toggleConfirm(id: string) {
    const next = new Set(confirmed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    confirmed = next
  }

  const allConfirmed = $derived(
    recalledAssets.length > 0 && recalledAssets.every((a) => confirmed.has(a.id))
  )

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

  // ─── Print ─────────────────────────────────────────────────────────────────
  let printOpen = $state(false)

  const printSourceData = $derived({
    recallerName,
    department,
    recallDate,
    reason,
    items: recalledAssets.map((a, i) => ({
      stt: i + 1,
      assetCode: a.assetCode,
      modelName: a.modelName ?? '',
      serialNo: a.serialNo ?? '',
      confirmed: confirmed.has(a.id),
      notes: ''
    }))
  })
</script>

<div class="page-shell page-content space-y-4">
  <!-- ── Page header ──────────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Thu hồi thiết bị' : $_('nav.recall')}</h2>
      <p class="text-sm text-slate-500">Biên bản thu hồi thiết bị</p>
    </div>
    <div class="flex gap-2">
      <Button onclick={() => (printOpen = true)} disabled={recalledAssets.length === 0 || !allConfirmed}>
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

  <!-- ── Recall form ────────────────────────────────────────────────────── -->
  <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
      <div>
        <label for="rc-handler" class="mb-1 block text-xs font-medium text-slate-400">Người thu hồi</label>
        <input id="rc-handler" class="input-base text-sm w-full" type="text" bind:value={recallerName} placeholder="Họ tên người thu hồi" />
      </div>
      <div>
        <label for="rc-dept" class="mb-1 block text-xs font-medium text-slate-400">Phòng ban / Bộ phận</label>
        <input id="rc-dept" class="input-base text-sm w-full" type="text" bind:value={department} placeholder="Phòng / Ban" />
      </div>
      <div>
        <label for="rc-date" class="mb-1 block text-xs font-medium text-slate-400">Ngày thu hồi</label>
        <input id="rc-date" class="input-base text-sm w-full" type="date" bind:value={recallDate} />
      </div>
      <div>
        <label for="rc-reason" class="mb-1 block text-xs font-medium text-slate-400">Lý do thu hồi</label>
        <input id="rc-reason" class="input-base text-sm w-full" type="text" bind:value={reason} placeholder="Lý do thu hồi thiết bị" />
      </div>
    </div>
  </div>

  <!-- ── Scanner / Search ──────────────────────────────────────────────── -->
  <div class="border-x border-slate-700 bg-slate-900/60 px-5 py-4 space-y-3">
    <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Thêm thiết bị cần thu hồi</p>

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

  <!-- ── Danh sách thu hồi ──────────────────────────────────────────────── -->
  <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
    <div class="mb-3 flex items-center gap-3">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Chi tiết thiết bị thu hồi</h3>
      {#if recalledAssets.length > 0}
        <span class="text-xs text-slate-500">{recalledAssets.length} thiết bị</span>
        {#if allConfirmed}
          <span class="text-xs text-success px-1.5 py-0.5 rounded bg-success/10">Đã xác nhận tất cả</span>
        {:else}
          <span class="text-xs text-warning px-1.5 py-0.5 rounded bg-warning/10">
            {confirmed.size}/{recalledAssets.length} đã xác nhận
          </span>
        {/if}
      {/if}
    </div>

    {#if recalledAssets.length === 0}
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
              <th class="w-28 text-center">Xác nhận</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {#each recalledAssets as asset, i}
              <tr class:opacity-60={!confirmed.has(asset.id)}>
                <td class="text-center text-slate-400">{i + 1}</td>
                <td class="font-mono text-xs">{asset.assetCode}</td>
                <td>{asset.modelName ?? '—'}</td>
                <td class="text-slate-400">{asset.serialNo ?? '—'}</td>
                <td>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{asset.status}</span>
                </td>
                <td class="text-slate-400">{asset.categoryName ?? '—'}</td>
                <td class="text-center">
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded transition-colors {confirmed.has(asset.id)
                      ? 'bg-success/20 text-success hover:bg-success/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
                    onclick={() => toggleConfirm(asset.id)}
                  >
                    {confirmed.has(asset.id) ? 'Đã xác nhận ✓' : 'Xác nhận'}
                  </button>
                </td>
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

      {#if !allConfirmed}
        <p class="mt-3 text-xs text-warning">
          Vui lòng xác nhận từng thiết bị trước khi in biên bản thu hồi.
        </p>
      {/if}
    {/if}
  </div>

  <!-- ── Footer actions ──────────────────────────────────────────────────── -->
  {#if recalledAssets.length > 0 && allConfirmed}
    <div class="flex justify-end gap-2">
      <Button onclick={() => (printOpen = true)}>
        <Printer class="h-4 w-4 mr-1" />
        In biên bản thu hồi
      </Button>
    </div>
  {/if}
</div>

<PrintDialog
  bind:isOpen={printOpen}
  docType="bien_ban_thu_hoi"
  sourceData={printSourceData}
  onClose={() => (printOpen = false)}
/>
