<script lang="ts">
  import { goto } from '$app/navigation';

  $effect(() => {
    goto('/cmdb?tab=services', { replaceState: true });
  });
</script>
