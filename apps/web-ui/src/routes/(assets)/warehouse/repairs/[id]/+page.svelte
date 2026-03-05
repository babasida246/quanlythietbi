<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  onMount(() => { void goto('/maintenance/repairs/' + page.params.id, { replaceState: true }); });
</script>