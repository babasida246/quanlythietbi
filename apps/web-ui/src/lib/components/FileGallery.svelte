<script lang="ts">
  import { Upload, Trash2, Download, FileText, ImageIcon, Loader2, X, ZoomIn } from 'lucide-svelte'
  import { _, isLoading } from '$lib/i18n'
  import type { OpsAttachment } from '$lib/api/warehouse'

  interface Props {
    attachments?: OpsAttachment[]
    loading?: boolean
    uploading?: boolean
    readonly?: boolean
    accept?: string
    maxFileMb?: number
    onUpload?: (file: File) => Promise<void>
    onDelete?: (id: string) => Promise<void>
    getDownloadUrl: (attachmentId: string) => string
  }

  let {
    attachments = [],
    loading = false,
    uploading = false,
    readonly = false,
    accept = 'image/*,application/pdf',
    maxFileMb = 20,
    onUpload,
    onDelete,
    getDownloadUrl
  }: Props = $props()

  let fileInputEl = $state<HTMLInputElement | null>(null)
  let localUploading = $state(false)
  let localError = $state('')
  let lightboxSrc = $state<string | null>(null)
  let deletingIds = $state<Set<string>>(new Set())

  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'])

  function isImage(att: OpsAttachment): boolean {
    if (att.mimeType && IMAGE_TYPES.has(att.mimeType)) return true
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName)
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !onUpload) return

    if (file.size > maxFileMb * 1024 * 1024) {
      localError = `File quá lớn (tối đa ${maxFileMb} MB)`
      input.value = ''
      return
    }

    localError = ''
    localUploading = true
    try {
      await onUpload(file)
    } catch (err) {
      localError = err instanceof Error ? err.message : 'Upload thất bại'
    } finally {
      localUploading = false
      input.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!onDelete) return
    deletingIds = new Set([...deletingIds, id])
    try {
      await onDelete(id)
    } catch (err) {
      localError = err instanceof Error ? err.message : 'Xóa thất bại'
    } finally {
      const next = new Set(deletingIds)
      next.delete(id)
      deletingIds = next
    }
  }

  const images = $derived(attachments.filter(isImage))
  const docs = $derived(attachments.filter(a => !isImage(a)))
  const busy = $derived(loading || uploading || localUploading)
</script>

<!-- Lightbox overlay -->
{#if lightboxSrc}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    onclick={() => (lightboxSrc = null)}
    onkeydown={(e) => e.key === 'Escape' && (lightboxSrc = null)}
  >
    <button
      type="button"
      class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
      onclick={() => (lightboxSrc = null)}
      aria-label="Đóng"
    >
      <X class="h-5 w-5" />
    </button>
    <img
      src={lightboxSrc}
      alt="Preview"
      class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      onclick={(e) => e.stopPropagation()}
    />
  </div>
{/if}

<div class="space-y-4">
  <!-- Upload button -->
  {#if !readonly && onUpload}
    <div class="flex items-center gap-3 flex-wrap">
      <input
        bind:this={fileInputEl}
        type="file"
        {accept}
        class="sr-only"
        id="file-gallery-input"
        onchange={handleFileChange}
        disabled={busy}
      />
      <label
        for="file-gallery-input"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed
               border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300
               hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-colors
               {busy ? 'pointer-events-none opacity-50' : ''}"
      >
        {#if localUploading || uploading}
          <Loader2 class="h-4 w-4 animate-spin" />
          {$isLoading ? 'Đang tải lên...' : $_('fileGallery.uploading')}
        {:else}
          <Upload class="h-4 w-4" />
          {$isLoading ? 'Tải lên file / ảnh' : $_('fileGallery.uploadBtn')}
        {/if}
      </label>
      <span class="text-xs text-slate-600">
        {$isLoading ? `Tối đa ${maxFileMb} MB · Hình ảnh, PDF` : $_('fileGallery.acceptHint', { values: { mb: maxFileMb } })}
      </span>
    </div>

    {#if localError}
      <p class="text-xs text-red-400">{localError}</p>
    {/if}
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {#each [1,2,3] as _}
        <div class="aspect-square rounded-lg bg-slate-800 animate-pulse"></div>
      {/each}
    </div>

  {:else if attachments.length === 0}
    <div class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-slate-600">
      <ImageIcon class="h-8 w-8" />
      <p class="text-sm">{$isLoading ? 'Chưa có file đính kèm.' : $_('fileGallery.empty')}</p>
    </div>

  {:else}
    <!-- Image thumbnail grid -->
    {#if images.length > 0}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {#each images as att (att.id)}
          {@const downloadUrl = getDownloadUrl(att.id)}
          <div class="group relative aspect-square overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <img
              src={downloadUrl}
              alt={att.fileName}
              class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
            <!-- Hover overlay -->
            <div class="absolute inset-0 flex flex-col items-end justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <!-- Top-right: delete -->
              {#if !readonly && onDelete}
                <button
                  type="button"
                  class="rounded-full bg-black/50 p-1 text-white hover:bg-red-600 transition-colors"
                  onclick={() => handleDelete(att.id)}
                  disabled={deletingIds.has(att.id)}
                  aria-label="Xóa"
                >
                  {#if deletingIds.has(att.id)}
                    <Loader2 class="h-3.5 w-3.5 animate-spin" />
                  {:else}
                    <Trash2 class="h-3.5 w-3.5" />
                  {/if}
                </button>
              {/if}
              <!-- Bottom: zoom + download -->
              <div class="flex gap-1.5 w-full justify-between items-end">
                <p class="text-[10px] text-white/80 truncate max-w-[60%]">{att.fileName}</p>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="rounded-full bg-black/50 p-1 text-white hover:bg-white/20 transition-colors"
                    onclick={() => (lightboxSrc = downloadUrl)}
                    aria-label="Xem ảnh"
                  >
                    <ZoomIn class="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={downloadUrl}
                    download={att.fileName}
                    class="rounded-full bg-black/50 p-1 text-white hover:bg-white/20 transition-colors"
                    aria-label="Tải xuống"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <Download class="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Document / PDF list -->
    {#if docs.length > 0}
      <div class="space-y-1.5">
        {#each docs as att (att.id)}
          {@const downloadUrl = getDownloadUrl(att.id)}
          <div class="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-sm">
            <FileText class="h-5 w-5 shrink-0 text-slate-400" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-slate-200">{att.fileName}</p>
              <p class="text-xs text-slate-500">
                v{att.version}{att.sizeBytes ? ` · ${formatSize(att.sizeBytes)}` : ''}
              </p>
            </div>
            <div class="flex items-center gap-1.5">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                class="rounded p-1 text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Xem / tải xuống"
              >
                <Download class="h-4 w-4" />
              </a>
              {#if !readonly && onDelete}
                <button
                  type="button"
                  class="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  onclick={() => handleDelete(att.id)}
                  disabled={deletingIds.has(att.id)}
                  aria-label="Xóa"
                >
                  {#if deletingIds.has(att.id)}
                    <Loader2 class="h-4 w-4 animate-spin" />
                  {:else}
                    <Trash2 class="h-4 w-4" />
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
