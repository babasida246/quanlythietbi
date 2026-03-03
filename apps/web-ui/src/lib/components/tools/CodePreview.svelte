<script lang="ts">
  import { Button } from '$lib/components/ui';

  const {
    title,
    code = '',
    copyLabel = 'Copy',
    emptyMessage = 'Generate CLI to preview.'
  } = $props<{
    title: string;
    code?: string;
    copyLabel?: string;
    emptyMessage?: string;
  }>();

  let copied = $state(false);

  async function copyCode() {
    if (!code || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(code);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <div class="text-sm font-semibold text-slate-200">{title}</div>
    <Button size="sm" variant="secondary" onclick={copyCode} disabled={!code}>
      {copied ? 'Copied' : copyLabel}
    </Button>
  </div>
  {#if code}
    <pre class="text-xs bg-slate-900 text-slate-100 rounded-md p-3 whitespace-pre-wrap max-h-72 overflow-y-auto">{code}</pre>
  {:else}
    <div class="text-xs text-slate-500 border border-dashed border-slate-600 rounded-md p-3">{emptyMessage}</div>
  {/if}
</div>
