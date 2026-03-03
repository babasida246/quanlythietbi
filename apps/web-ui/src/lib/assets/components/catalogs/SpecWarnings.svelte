<script lang="ts">
  type Warning = { modelId: string; modelName: string; missingKeys: string[] };
  let { warnings = [] }: { warnings?: Warning[] } = $props();
</script>

{#if warnings.length > 0}
  <div class="alert alert-warning mb-4">
    <div class="space-y-1">
      <p class="font-medium">Publish warnings:</p>
      {#each warnings as warning}
        <p class="text-sm">Model {warning.modelName}: missing {warning.missingKeys.join(', ')}</p>
      {/each}
    </div>
  </div>
{/if}
