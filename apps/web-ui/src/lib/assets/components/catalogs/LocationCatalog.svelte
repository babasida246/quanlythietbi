<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import { _, isLoading } from '$lib/i18n';
  import { createLocation, deleteLocation, updateLocation } from '$lib/api/assetCatalogs';
  import DataTable from '$lib/components/DataTable.svelte';

  let { locations = [], onupdated, onerror } = $props<{
    locations?: Array<{ id: string; name: string; parentId?: string | null; path: string }>;
    onupdated?: () => void;
    onerror?: (msg: string) => void;
  }>();

  // Ensure locations is always an array
  const safeLocations = $derived(Array.isArray(locations) ? locations : []);

  let form = $state({ name: '', parentId: '' });
  let editingId = $state<string | null>(null);
  let saving = $state(false);

  function reset() {
    form = { name: '', parentId: '' };
    editingId = null;
  }

  async function save() {
    if (!form.name.trim()) return;
    try {
      saving = true;
      const payload = { name: form.name.trim(), parentId: form.parentId || null };
      if (editingId) {
        await updateLocation(editingId, payload);
      } else {
        await createLocation(payload);
      }
      reset();
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      saving = false;
    }
  }

  function edit(location: { id: string; name: string; parentId?: string | null }) {
    form = { name: location.name, parentId: location.parentId ?? '' };
    editingId = location.id;
  }

  async function handleEdit(location: any, changes: Partial<any>) {
    try {
      await updateLocation(location.id, {
        name: changes.name || location.name,
        parentId: changes.parentId !== undefined ? changes.parentId : location.parentId
      });
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to update location');
    }
  }

  async function handleDelete(rows: any[]) {
    try {
      for (const row of rows) {
        await deleteLocation(row.id);
      }
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to delete location');
    }
  }
</script>

<div class="py-4 space-y-4">
  <div class="bg-surface-2 border border-slate-700 rounded-lg p-4 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="location-name" class="label-base mb-2">{$isLoading ? 'Location name' : $_('assets.locationName')}</label>
        <input id="location-name" class="input-base" bind:value={form.name} placeholder="HQ / Floor 2" />
      </div>
      <div>
        <label for="location-parent" class="label-base mb-2">{$isLoading ? 'Parent location' : $_('assets.parentLocation')}</label>
        <select id="location-parent" class="select-base" bind:value={form.parentId}>
          <option value="">{$isLoading ? 'No parent' : $_('assets.noParent')}</option>
          {#each safeLocations as location}
            <option value={location.id}>{location.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="flex gap-2">
      <Button onclick={save} disabled={saving || !form.name.trim()}>
        {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
      </Button>
      {#if editingId}
        <Button variant="secondary" onclick={reset}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      {/if}
    </div>
  </div>

  <DataTable
    data={safeLocations}
    columns={[
      { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true },
      { key: 'parentId', label: $isLoading ? 'Parent' : $_('assets.parent'), sortable: true, filterable: false, editable: false, render: (val) => safeLocations.find((loc: { id: string; name: string; parentId?: string | null; path: string }) => loc.id === val)?.name || '-' },
      { key: 'path', label: $isLoading ? 'Path' : $_('assets.path'), sortable: true, filterable: true, editable: false }
    ]}
    selectable={true}
    rowKey="id"
    loading={false}
    onEdit={handleEdit}
    onDelete={handleDelete}
  />
</div>
