<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import SpecWarnings from './SpecWarnings.svelte';
  import SpecVersionControls from './SpecVersionControls.svelte';
  import SpecDefsManager from './SpecDefsManager.svelte';
  import {
    createCategorySpecVersion,
    getCategorySpecVersions,
    getSpecDefsByVersion,
    publishSpecVersion,
    type CategorySpecDef,
    type CategorySpecVersion,
    type SpecPublishSyncSummary
  } from '$lib/api/assetCatalogs';

  type CategoryRef = { id: string; name: string };

  let {
    open = $bindable(false),
    category = null,
    onupdated,
    onerror
  } = $props<{
    open?: boolean;
    category?: CategoryRef | null;
    onupdated?: () => void;
    onerror?: (message: string) => void;
  }>();

  let specDefs = $state<CategorySpecDef[]>([]);
  let versions = $state<CategorySpecVersion[]>([]);
  let selectedVersionId = $state('');
  let publishWarnings = $state<Array<{ modelId: string; modelName: string; missingKeys: string[] }>>([]);
  let publishSync = $state<SpecPublishSyncSummary | null>(null);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let lastCategoryId = $state<string | null>(null);

  const selectedVersion = $derived(versions.find((version) => version.id === selectedVersionId) ?? null);
  const canEdit = $derived(selectedVersion?.status === 'draft');
  const canApplyTemplate = $derived(selectedVersion?.status === 'active');

  $effect(() => {
    if (!open || !category) return;
    if (category.id === lastCategoryId && versions.length > 0) return;
    lastCategoryId = category.id;
    loadVersions();
  });

  async function loadVersions(resetPublishState = true) {
    if (!category) return;
    try {
      loading = true;
      error = '';
      if (resetPublishState) {
        publishWarnings = [];
        publishSync = null;
      }
      const response = await getCategorySpecVersions(category.id);
      versions = response.data;
      const draft = versions.find((version) => version.status === 'draft');
      const active = versions.find((version) => version.status === 'active');
      selectedVersionId = draft?.id ?? active?.id ?? versions[0]?.id ?? '';
      if (selectedVersionId) {
        await loadDefs(selectedVersionId);
      } else {
        specDefs = [];
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ($isLoading ? 'Failed to load spec versions' : $_('categorySpec.loadVersionsFailed'));
      error = message;
      onerror?.(message);
    } finally {
      loading = false;
    }
  }

  async function loadDefs(versionId: string) {
    try {
      loading = true;
      error = '';
      const response = await getSpecDefsByVersion(versionId);
      specDefs = response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : ($isLoading ? 'Failed to load spec fields' : $_('categorySpec.loadFieldsFailed'));
      error = message;
      onerror?.(message);
    } finally {
      loading = false;
    }
  }

  async function handleSelect(versionId: string) {
    if (!versionId) return;
    selectedVersionId = versionId;
    await loadDefs(versionId);
  }

  async function handleUpdated() {
    if (selectedVersionId) {
      await loadDefs(selectedVersionId);
    }
    onupdated?.();
  }

  async function createDraft() {
    if (!category) return;
    try {
      saving = true;
      error = '';
      const response = await createCategorySpecVersion(category.id);
      versions = [response.data.version, ...versions];
      selectedVersionId = response.data.version.id;
      specDefs = response.data.specDefs ?? [];
      onupdated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : ($isLoading ? 'Failed to create draft' : $_('categorySpec.createDraftFailed'));
      error = message;
      onerror?.(message);
    } finally {
      saving = false;
    }
  }

  async function publishVersion() {
    if (!selectedVersionId) return;
    try {
      saving = true;
      error = '';
      const response = await publishSpecVersion(selectedVersionId);
      await loadVersions(false);
      publishWarnings = response.data.warnings ?? [];
      publishSync = response.data.sync ?? null;
      onupdated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : ($isLoading ? 'Failed to publish version' : $_('categorySpec.publishFailed'));
      error = message;
      onerror?.(message);
    } finally {
      saving = false;
    }
  }

  function closePanel() {
    open = false;
    error = '';
    specDefs = [];
    versions = [];
    selectedVersionId = '';
    publishWarnings = [];
    publishSync = null;
    lastCategoryId = null;
  }
</script>

<Modal bind:open title="{$isLoading ? 'Manage Spec Fields' : $_('categorySpec.title')}{category ? ` — ${category.name}` : ''}" size="xl" dismissable={true}>
  {#snippet children()}
    {#if error}
      <div class="alert alert-error mb-4">{error}</div>
    {/if}
    <SpecWarnings warnings={publishWarnings} sync={publishSync} />

    <div class="space-y-4">
      <SpecVersionControls
        versions={versions}
        bind:selectedVersionId
        saving={saving}
        onselect={(versionId) => handleSelect(versionId)}
        oncreatedraft={createDraft}
        onpublish={publishVersion}
      />

      {#if selectedVersion && !canEdit}
        <div class="alert alert-info mb-4">
          {$isLoading ? 'This version is read-only' : $_('categorySpec.readOnlyNote')}
        </div>
      {/if}

      {#if loading}
        <Skeleton rows={4} />
      {:else}
        <SpecDefsManager
          specDefs={specDefs}
          categoryId={category?.id ?? ''}
          selectedVersionId={selectedVersionId}
          disabled={!canEdit}
          canApplyTemplate={canApplyTemplate}
          onupdated={handleUpdated}
          onerror={(message) => onerror?.(message)}
        />
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end">
      <Button variant="secondary" onclick={closePanel}>{$isLoading ? 'Close' : $_('categorySpec.close')}</Button>
    </div>
  {/snippet}
</Modal>

