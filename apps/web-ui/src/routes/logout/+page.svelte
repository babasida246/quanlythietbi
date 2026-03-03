<script lang="ts">
  import { goto } from '$app/navigation';
  import { clearStoredSession } from '$lib/api/httpClient';

  $effect(() => {
    if (typeof window === 'undefined') return;
    clearStoredSession();
    goto('/login', { replaceState: true });
  });
</script>

<div class="page-shell page-content py-10 text-center text-sm text-slate-500">Signing out...</div>
