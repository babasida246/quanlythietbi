<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import HelpPage from '$lib/components/help/HelpPage.svelte';
</script>

<svelte:head>
  <title>{$isLoading ? 'Guide' : $_('help.title')}</title>
</svelte:head>

<div class="p-4 sm:p-6 max-w-7xl mx-auto">
  <HelpPage />
</div>
