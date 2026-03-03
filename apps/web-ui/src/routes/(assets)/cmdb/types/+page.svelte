<script lang="ts">
  import { goto } from '$app/navigation';

  $effect(() => {
    goto('/cmdb?tab=types', { replaceState: true });
  });
</script>
