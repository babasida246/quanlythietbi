<script lang="ts">
  import { goto } from '$app/navigation';

  $effect(() => {
    goto('/cmdb?tab=cis', { replaceState: true });
  });
</script>
