<script lang="ts">
  import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-svelte';
  import { dismissToast, toasts } from './toast';

  const levelClasses = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  } as const;
</script>

<div class="pointer-events-none fixed right-4 top-16 z-[999] flex w-full max-w-sm flex-col gap-2">
  {#each $toasts as item (item.id)}
    <div
      class={`pointer-events-auto rounded-lg border px-3 py-2 shadow-sm ${levelClasses[item.level]}`}
      data-testid="toast-item"
    >
      <div class="flex items-start gap-2">
        {#if item.level === 'success'}
          <CheckCircle2 class="mt-0.5 h-4 w-4" />
        {:else if item.level === 'error'}
          <AlertTriangle class="mt-0.5 h-4 w-4" />
        {:else}
          <Info class="mt-0.5 h-4 w-4" />
        {/if}
        <p class="flex-1 text-sm font-medium">{item.message}</p>
        <button
          type="button"
          class="rounded p-0.5 opacity-80 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          onclick={() => dismissToast(item.id)}
          aria-label="Dismiss notification"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
  {/each}
</div>
