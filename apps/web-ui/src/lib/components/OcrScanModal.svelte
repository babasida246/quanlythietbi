<script lang="ts">
  import Modal from './Modal.svelte'
  import { searchSpareParts, type SparePartSearchResult } from '$lib/api/warehouse'
  import { _, isLoading } from '$lib/i18n'
  import { Camera, Search, Loader2, X, AlertTriangle } from 'lucide-svelte'

  interface Props {
    open?: boolean
    onSelect: (part: SparePartSearchResult) => void
  }

  let { open = $bindable(false), onSelect }: Props = $props()

  type OcrStatus = 'idle' | 'processing' | 'done' | 'error'
  let imageDataUrl = $state<string | null>(null)
  let ocrText = $state('')
  let ocrStatus = $state<OcrStatus>('idle')
  let ocrError = $state('')
  let searchQuery = $state('')
  let searchResults = $state<SparePartSearchResult[]>([])
  let searching = $state(false)
  let fileInputEl = $state<HTMLInputElement | null>(null)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // When OCR finishes, auto-fill search query with extracted product code
  $effect(() => {
    if (ocrStatus === 'done' && ocrText) {
      searchQuery = extractProductCode(ocrText)
    }
  })

  // Debounced search on query change
  $effect(() => {
    const q = searchQuery.trim()
    if (debounceTimer) clearTimeout(debounceTimer)
    if (q.length < 2) { searchResults = []; return }
    debounceTimer = setTimeout(() => doSearch(q), 350)
  })

  // Reset when modal closes
  $effect(() => {
    if (!open) reset()
  })

  /**
   * Extract the most likely product model code from raw OCR text.
   * Targets patterns like TN-2385, 76A, CF400X, CRG070, etc.
   */
  function extractProductCode(text: string): string {
    const cleaned = text.replace(/\s+/g, ' ')
    const patterns = [
      /\b([A-Z]{1,3}-?\d{3,6}[A-Z]{0,2})\b/g,  // TN-2385, CF400X, CRG070
      /\b(\d{2,3}[A-Z]{1,2})\b/g,                // 76A, 80A
    ]
    for (const p of patterns) {
      const matches = [...cleaned.matchAll(p)]
      if (matches.length) return matches[0][1]
    }
    // Fallback: first non-trivial word that looks like a code
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && /[A-Z0-9]/.test(w))
    return words[0] ?? cleaned.slice(0, 50).trim()
  }

  async function doSearch(q: string) {
    searching = true
    try {
      searchResults = await searchSpareParts(q, 15)
    } catch {
      searchResults = []
    } finally {
      searching = false
    }
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // Preview image
    const reader = new FileReader()
    reader.onload = (ev) => { imageDataUrl = ev.target?.result as string }
    reader.readAsDataURL(file)

    await runOcr(file)
  }

  async function runOcr(file: File) {
    ocrStatus = 'processing'
    ocrError = ''
    ocrText = ''
    try {
      // Dynamic import — Vite will code-split this into a separate chunk.
      // Tesseract.js runs OCR in a Web Worker so UI stays responsive.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(['eng', 'vie'], 1, {
        // Suppress console noise from tesseract worker
        logger: () => {}
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      ocrText = data.text.trim()
      ocrStatus = 'done'
    } catch (err) {
      ocrStatus = 'error'
      ocrError = err instanceof Error ? err.message : String(err)
    }
  }

  function selectPart(part: SparePartSearchResult) {
    onSelect(part)
    open = false
  }

  function reset() {
    imageDataUrl = null
    ocrText = ''
    ocrStatus = 'idle'
    ocrError = ''
    searchQuery = ''
    searchResults = []
    if (fileInputEl) fileInputEl.value = ''
  }
</script>

<Modal bind:open title={$isLoading ? 'Quét tem sản phẩm (OCR)' : $_('ocr.modalTitle')} size="lg">
  {#snippet children()}
    <div class="space-y-4">

      <!-- Capture button + file input -->
      <div class="flex gap-2 items-center flex-wrap">
        <input
          bind:this={fileInputEl}
          id="ocr-file-input"
          type="file"
          accept="image/*"
          class="sr-only"
          onchange={handleFileSelect}
        />
        <!-- Mobile: capture="environment" points to rear camera -->
        <label
          for="ocr-file-input"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Camera class="h-4 w-4" />
          {$isLoading ? 'Chụp ảnh / Chọn file' : $_('ocr.captureBtn')}
        </label>

        {#if ocrStatus === 'processing'}
          <span class="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            {$isLoading ? 'Đang nhận dạng văn bản...' : $_('ocr.processing')}
          </span>
        {/if}

        {#if imageDataUrl}
          <button type="button" class="ml-auto text-slate-500 hover:text-slate-300" onclick={reset} aria-label="Xóa ảnh">
            <X class="h-4 w-4" />
          </button>
        {/if}
      </div>

      <!-- Image preview with overlay when processing -->
      {#if imageDataUrl}
        <div class="relative max-h-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <img src={imageDataUrl} alt="Product label preview" class="w-full object-contain max-h-52" />
          {#if ocrStatus === 'processing'}
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/75 rounded-xl backdrop-blur-sm">
              <Loader2 class="h-8 w-8 animate-spin text-primary" />
              <p class="text-sm text-slate-300">{$isLoading ? 'Đang nhận dạng...' : $_('ocr.processing')}</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- OCR error banner -->
      {#if ocrStatus === 'error'}
        <div class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p class="font-medium">{$isLoading ? 'OCR gặp lỗi — hãy nhập thủ công bên dưới.' : $_('ocr.ocrError')}</p>
            {#if ocrError}<p class="text-xs mt-0.5 opacity-70">{ocrError}</p>{/if}
          </div>
        </div>
      {/if}

      <!-- Raw OCR text (collapsible, for debugging) -->
      {#if ocrText && ocrStatus === 'done'}
        <details class="group">
          <summary class="cursor-pointer text-xs text-slate-500 select-none hover:text-slate-400">
            {$isLoading ? 'Văn bản OCR thô' : $_('ocr.rawText')}
          </summary>
          <pre class="mt-1 max-h-24 overflow-y-auto rounded bg-slate-800 p-2 text-xs text-slate-400 whitespace-pre-wrap">{ocrText}</pre>
        </details>
      {/if}

      <!-- Search box (auto-populated from OCR, editable) -->
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-400">
          {$isLoading ? 'Tìm sản phẩm tương tự' : $_('ocr.searchLabel')}
        </label>
        <div class="relative">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            class="input-base w-full pl-9 pr-8"
            placeholder={$isLoading ? 'Nhập mã / tên sản phẩm...' : $_('ocr.searchPlaceholder')}
            bind:value={searchQuery}
          />
          {#if searching}
            <Loader2 class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
          {/if}
        </div>
      </div>

      <!-- Search results -->
      {#if searchResults.length > 0}
        <div class="overflow-hidden rounded-xl border border-slate-700 divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
          {#each searchResults as part (part.id)}
            <button
              type="button"
              class="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition-colors focus:outline-none focus:bg-slate-700/40"
              onclick={() => selectPart(part)}
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="shrink-0 font-mono text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                  {part.partCode}
                </span>
                <span class="font-medium text-slate-100 truncate">{part.name}</span>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                {#if part.manufacturer}<span>{part.manufacturer}</span>{/if}
                {#if part.model}<span>· {part.model}</span>{/if}
                {#if part.category}<span>· {part.category}</span>{/if}
                {#if part.uom}<span class="ml-auto text-slate-400">{part.uom}</span>{/if}
              </div>
            </button>
          {/each}
        </div>
      {:else if searchQuery.trim().length >= 2 && !searching}
        <p class="py-6 text-center text-sm text-slate-500">
          {$isLoading ? 'Không tìm thấy sản phẩm phù hợp.' : $_('ocr.noResults')}
        </p>
      {:else if !imageDataUrl && ocrStatus === 'idle'}
        <p class="py-6 text-center text-sm text-slate-500">
          {$isLoading ? 'Chụp ảnh tem sản phẩm hoặc nhập tên vào ô tìm kiếm.' : $_('ocr.hint')}
        </p>
      {/if}

    </div>
  {/snippet}
</Modal>
