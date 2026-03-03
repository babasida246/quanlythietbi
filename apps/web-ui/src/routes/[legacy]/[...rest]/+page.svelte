<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  const legacyRoutes = new Set([
    'chat',
    'stats',
    'models',
    'devices',
    'changes',
    'rulepacks',
    'field-kit',
    'field',
    'tools',
    'profile',
    'help',
    'admin',
    'netops'
  ]);

  const legacyKey = $derived.by(() => page.params.legacy ?? '');
  const shouldRedirect = $derived.by(() => legacyRoutes.has(legacyKey));

  $effect(() => {
    if (!shouldRedirect) return;
    goto('/me/assets', { replaceState: true });
  });
</script>

{#if !shouldRedirect}
  <div class="page-shell page-content py-10 text-center">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-white">404</h1>
    <p class="mt-2 text-slate-500">Not Found</p>
    <div class="mt-6">
      <a href="/me/assets" class="inline-flex items-center justify-center rounded border border-slate-600 bg-surface-3 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-surface-3/80">Back to My assets</a>
    </div>
  </div>
{/if}
