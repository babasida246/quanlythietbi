<script lang="ts">
  import { goto } from '$app/navigation';
  import { _, isLoading } from '$lib/i18n';
  import { defaultLandingPath, getCapabilities } from '$lib/auth/capabilities';

  $effect(() => {
    if (typeof window === 'undefined') return;

    const role = localStorage.getItem('userRole');
    const caps = getCapabilities(role);
    goto(defaultLandingPath(caps), { replaceState: true });
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="text-center">
    <div class="text-gray-500">{$isLoading ? 'Redirecting...' : $_('common.redirecting')}</div>
  </div>
</div>
