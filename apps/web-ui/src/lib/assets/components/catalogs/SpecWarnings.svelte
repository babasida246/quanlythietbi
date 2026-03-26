<script lang="ts">
  import { _, isLoading } from '$lib/i18n';

  type Warning = { modelId: string; modelName: string; missingKeys: string[] };
  type SyncSummary = { totalModels: number; syncedModels: number; modelsMissingRequired: number };
  let { warnings = [], sync = null }: { warnings?: Warning[]; sync?: SyncSummary | null } = $props();
</script>

{#if sync}
  <div class="alert alert-info mb-4">
    <p class="font-medium">
      {$isLoading
        ? `Synced ${sync.syncedModels}/${sync.totalModels} models`
        : $_('categorySpec.syncSummary', { values: { synced: sync.syncedModels, total: sync.totalModels } })}
    </p>
    <p class="text-sm mt-1">
      {$isLoading
        ? `${sync.modelsMissingRequired} models still missing required fields`
        : $_('categorySpec.syncMissingRequired', { values: { count: sync.modelsMissingRequired } })}
    </p>
  </div>
{/if}

{#if warnings.length > 0}
  <div class="alert alert-warning mb-4">
    <div class="space-y-1">
      <p class="font-medium">{$isLoading ? 'Publish warnings:' : $_('categorySpec.publishWarningsTitle')}</p>
      {#each warnings as warning}
        <p class="text-sm">
          {$isLoading
            ? `Model ${warning.modelName}: missing ${warning.missingKeys.join(', ')}`
            : $_('categorySpec.publishWarningItem', { values: { model: warning.modelName, keys: warning.missingKeys.join(', ') } })}
        </p>
      {/each}
    </div>
  </div>
{/if}
