<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  onMount(() => { void goto('/maintenance/repairs', { replaceState: true }); });
</script>
