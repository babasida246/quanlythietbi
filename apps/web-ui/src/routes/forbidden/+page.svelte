<script lang="ts">
  import { page } from '$app/state';

  const from = $derived.by(() => page.url.searchParams.get('from') ?? '');
  const home = $derived.by(() => page.url.searchParams.get('home') ?? '/me/assets');
</script>

<div class="page-shell page-content py-10 text-center">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-white">403</h1>
  <p class="mt-2 text-slate-500">You do not have access to this route.</p>
  {#if from}
    <p class="mt-1 text-xs text-slate-400">Requested: {from}</p>
  {/if}
  <div class="mt-6">
    <a href={home} class="inline-flex items-center justify-center rounded border border-slate-600 bg-surface-3 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-surface-3/80">Go to allowed home</a>
  </div>
</div>
