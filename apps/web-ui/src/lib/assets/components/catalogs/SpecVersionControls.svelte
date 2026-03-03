<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import { _, isLoading } from '$lib/i18n';
  import type { CategorySpecVersion } from '$lib/api/assetCatalogs';

  let {
    versions = [],
    selectedVersionId = $bindable(''),
    saving = false,
    onselect,
    oncreatedraft,
    onpublish
  } = $props<{
    versions?: CategorySpecVersion[];
    selectedVersionId?: string;
    saving?: boolean;
    onselect?: (id: string) => void;
    oncreatedraft?: () => void;
    onpublish?: () => void;
  }>();

  const selectedVersion = $derived(versions.find((version: CategorySpecVersion) => version.id === selectedVersionId) ?? null);

  function handleSelect(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    selectedVersionId = value;
    onselect?.(value);
  }
</script>

<div class="flex flex-wrap gap-3 items-center">
  <div class="min-w-[220px]">
    <div class="label-base mb-2">{$isLoading ? 'Spec Version' : $_('specField.version')}</div>
    <select class="select-base" bind:value={selectedVersionId} onchange={handleSelect}>
      <option value="" disabled>{$isLoading ? 'Select version' : $_('specField.selectVersion')}</option>
      {#each versions as version}
        <option value={version.id}>
          v{version.version} ({version.status})
        </option>
      {/each}
    </select>
  </div>
  <div class="flex gap-2 items-end">
    <Button size="sm" variant="secondary" onclick={oncreatedraft} disabled={saving}>
      {$isLoading ? 'New Draft' : $_('specField.newDraft')}
    </Button>
    {#if selectedVersion?.status === 'draft'}
      <Button size="sm" onclick={onpublish} disabled={saving}>
        {$isLoading ? 'Publish' : $_('specField.publish')}
      </Button>
    {/if}
  </div>
</div>
