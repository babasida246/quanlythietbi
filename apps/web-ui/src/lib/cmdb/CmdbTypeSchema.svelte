<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';
  import CmdbAttrDefForm, { type CmdbFieldDraft } from './CmdbAttrDefForm.svelte';
  import CmdbAttrDefsTable from './CmdbAttrDefsTable.svelte';
  import {
    createAttrDef,
    createTypeDraftVersion,
    deleteAttrDef,
    listAttrDefs,
    listTypeVersions,
    publishTypeVersion,
    updateAttrDef,
    type CmdbAttrDef,
    type CmdbType,
    type CmdbVersion
  } from '$lib/api/cmdb';
  const fieldTypes = [
    'string',
    'number',
    'boolean',
    'enum',
    'date',
    'ip',
    'mac',
    'cidr',
    'hostname',
    'port',
    'regex',
    'json',
    'multi_enum'
  ];

  let { type } = $props<{ type: CmdbType | null }>();

  let versions = $state<CmdbVersion[]>([]);
  let selectedVersionId = $state('');
  let defs = $state<CmdbAttrDef[]>([]);
  let loading = $state(false);
  let error = $state('');
  let warnings = $state<unknown[] | null>(null);

  let editingId = $state<string | null>(null);
  let draft = $state<CmdbFieldDraft>({
    key: '',
    label: '',
    fieldType: 'string',
    required: false,
    isSearchable: false,
    isFilterable: false,
    enumValues: ''
  });

  function resetDraft() {
    editingId = null;
    draft = {
      key: '',
      label: '',
      fieldType: 'string',
      required: false,
      isSearchable: false,
      isFilterable: false,
      enumValues: ''
    };
  }

  async function loadVersions(typeId: string) {
    try {
      loading = true;
      error = '';
      const response = await listTypeVersions(typeId);
      versions = response.data ?? [];
      const active = versions.find((item) => item.status === 'active') ?? versions[0];
      selectedVersionId = active?.id ?? '';
      warnings = null;
      if (selectedVersionId) {
        await loadDefs(selectedVersionId);
      } else {
        defs = [];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load versions';
    } finally {
      loading = false;
    }
  }

  async function loadDefs(versionId: string) {
    try {
      const response = await listAttrDefs(versionId);
      defs = response.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load attribute defs';
    }
  }

  async function createDraft() {
    if (!type) return;
    try {
      loading = true;
      const response = await createTypeDraftVersion(type.id);
      await loadVersions(type.id);
      selectedVersionId = response.data?.version?.id ?? selectedVersionId;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create draft version';
    } finally {
      loading = false;
    }
  }

  async function publishVersion() {
    if (!selectedVersionId) return;
    try {
      loading = true;
      const response = await publishTypeVersion(selectedVersionId);
      warnings = response.data?.warnings ?? null;
      if (type) {
        await loadVersions(type.id);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to publish version';
    } finally {
      loading = false;
    }
  }

  function parseEnumValues(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function saveDef() {
    if (!selectedVersionId || !draft.key || !draft.label) return;
    const isEnum = draft.fieldType === 'enum' || draft.fieldType === 'multi_enum';
    const payload: Partial<CmdbAttrDef> & { key: string; label: string; fieldType: string } = {
      key: draft.key.trim(),
      label: draft.label.trim(),
      fieldType: draft.fieldType,
      required: draft.required,
      isSearchable: draft.isSearchable,
      isFilterable: draft.isFilterable
    };
    if (isEnum) {
      const parsed = parseEnumValues(draft.enumValues);
      if (parsed.length) {
        payload.enumValues = parsed;
      }
    }
    try {
      loading = true;
      if (editingId) {
        await updateAttrDef(editingId, payload);
      } else {
        await createAttrDef(selectedVersionId, payload);
      }
      resetDraft();
      await loadDefs(selectedVersionId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save attribute';
    } finally {
      loading = false;
    }
  }

  function editDef(def: CmdbAttrDef) {
    editingId = def.id;
    draft = {
      key: def.key,
      label: def.label,
      fieldType: def.fieldType,
      required: def.required,
      isSearchable: def.isSearchable,
      isFilterable: def.isFilterable,
      enumValues: def.enumValues?.join(', ') ?? ''
    };
  }

  async function removeDef(def: CmdbAttrDef) {
    if (!selectedVersionId) return;
    try {
      loading = true;
      await deleteAttrDef(def.id);
      await loadDefs(selectedVersionId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete attribute';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (type) {
      void loadVersions(type.id);
    } else {
      versions = [];
      defs = [];
      selectedVersionId = '';
      warnings = null;
    }
  });
</script>

{#if !type}
  <div class="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-6 text-slate-500">
    Select a CI type to manage its schema.
  </div>
{:else}
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex-1 min-w-[220px]">
        <label for="cmdb-version" class="label-base">{$isLoading ? 'Schema Version' : $_('cmdb.type.schemaVersion')}</label>
        <select id="cmdb-version" bind:value={selectedVersionId} onchange={() => selectedVersionId && loadDefs(selectedVersionId)} class="select-base">
          {#each versions as version}
            <option value={version.id}>v{version.version} ({version.status})</option>
          {/each}
        </select>
      </div>
      <Button variant="secondary" onclick={createDraft} disabled={loading}>{$isLoading ? 'New Draft' : $_('cmdb.type.newDraft')}</Button>
      <Button onclick={publishVersion} disabled={loading || !selectedVersionId}>{$isLoading ? 'Publish' : $_('cmdb.type.publish')}</Button>
    </div>

    {#if warnings && warnings.length > 0}
      <div class="alert alert-warning">{$isLoading ? 'Published with warnings. Review required fields compatibility.' : $_('cmdb.type.published')}</div>
    {/if}

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-6">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CmdbAttrDefForm
        bind:draft
        fieldTypes={fieldTypes}
        disabled={!selectedVersionId}
        saving={loading}
        onSave={saveDef}
        onClear={resetDraft}
      />

      <CmdbAttrDefsTable defs={defs} onEdit={editDef} onRemove={removeDef} />
    </div>
  </div>
{/if}
