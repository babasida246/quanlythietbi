<script lang="ts">
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { 
    createRelationshipType, 
    listRelationshipTypes, 
    updateRelationshipType,
    deleteRelationshipType,
    listCmdbTypes,
    type RelationshipTypeRecord,
    type CmdbType 
  } from '$lib/api/cmdb';
  import DataTable from '$lib/components/DataTable.svelte';

  let relationshipTypes = $state<RelationshipTypeRecord[]>([]);
  let ciTypes = $state<CmdbType[]>([]);
  let loading = $state(true);
  let error = $state('');

  let showModal = $state(false);
  let saving = $state(false);
  let editingId = $state<string | null>(null);
  
  let code = $state('');
  let name = $state('');
  let reverseName = $state('');
  let allowedFromTypeId = $state('');
  let allowedToTypeId = $state('');

  async function loadRelationshipTypes() {
    try {
      loading = true;
      error = '';
      const response = await listRelationshipTypes();
      relationshipTypes = response.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load relationship types';
    } finally {
      loading = false;
    }
  }

  async function loadCiTypes() {
    try {
      const response = await listCmdbTypes();
      ciTypes = response.data ?? [];
    } catch (err) {
      console.error('Failed to load CI types:', err);
    }
  }

  function openCreate() {
    editingId = null;
    code = '';
    name = '';
    reverseName = '';
    allowedFromTypeId = '';
    allowedToTypeId = '';
    showModal = true;
  }

  async function handleEdit(row: RelationshipTypeRecord) {
    editingId = row.id;
    code = row.code;
    name = row.name;
    reverseName = row.reverseName ?? '';
    allowedFromTypeId = row.allowedFromTypeId ?? '';
    allowedToTypeId = row.allowedToTypeId ?? '';
    showModal = true;
  }

  async function handleDelete(rows: RelationshipTypeRecord[]) {
    if (!confirm($_('cmdb.relTypePanel.deleteConfirm', { values: { count: rows.length } }))) return;
    
    try {
      for (const row of rows) {
        await deleteRelationshipType(row.id);
      }
      await loadRelationshipTypes();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete relationship type';
    }
  }

  async function saveRelationshipType() {
    if (!code || !name) return;
    
    try {
      saving = true;
      error = '';
      
      const input = {
        code,
        name,
        reverseName: reverseName || null,
        allowedFromTypeId: allowedFromTypeId || null,
        allowedToTypeId: allowedToTypeId || null
      };

      if (editingId) {
        await updateRelationshipType(editingId, input);
      } else {
        await createRelationshipType(input);
      }
      
      showModal = false;
      await loadRelationshipTypes();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save relationship type';
    } finally {
      saving = false;
    }
  }

  function getCiTypeName(typeId: string | null | undefined): string {
    if (!typeId) return $isLoading ? 'Any' : $_('cmdb.relTypePanel.any');
    return ciTypes.find(t => t.id === typeId)?.name ?? typeId;
  }

  const columns = [
    { 
      key: 'code' as const, 
      label: $isLoading ? 'Code' : $_('common.code'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: RelationshipTypeRecord) => `<span class="font-medium font-mono text-sm">${row.code}</span>`
    },
    { 
      key: 'name' as const, 
      label: $isLoading ? 'Name' : $_('common.name'), 
      sortable: true, 
      filterable: true
    },
    { 
      key: 'reverseName' as const, 
      label: $isLoading ? 'Reverse Name' : $_('cmdb.reverseName'), 
      sortable: true,
      render: (_value: unknown, row: RelationshipTypeRecord) => row.reverseName ?? '-'
    },
    { 
      key: 'allowedFromTypeId' as const, 
      label: $isLoading ? 'From Type' : $_('cmdb.fromType'), 
      sortable: true,
      render: (_value: unknown, row: RelationshipTypeRecord) => getCiTypeName(row.allowedFromTypeId)
    },
    { 
      key: 'allowedToTypeId' as const, 
      label: $isLoading ? 'To Type' : $_('cmdb.toType'), 
      sortable: true,
      render: (_value: unknown, row: RelationshipTypeRecord) => getCiTypeName(row.allowedToTypeId)
    }
  ];

  $effect(() => {
    void loadCiTypes();
    void loadRelationshipTypes();
  });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Relationship Types' : $_('cmdb.relationshipTypes')}</h2>
      <p class="text-sm text-slate-500">
        {relationshipTypes.length} {$isLoading ? 'relationship types' : $_('cmdb.relationshipTypes').toLowerCase()}
      </p>
    </div>
    <Button onclick={openCreate}>
      <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Type' : $_('cmdb.newRelationshipType')}
    </Button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <div class="bg-surface-2 border border-slate-700 rounded-lg overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center py-10">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    {:else}
      <DataTable
        data={relationshipTypes}
        {columns}
        rowKey="id"
        selectable={true}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    {/if}
  </div>
</div>

<Modal bind:open={showModal} title={editingId ? ($isLoading ? 'Edit Relationship Type' : $_('cmdb.editRelationshipType')) : ($isLoading ? 'New Relationship Type' : $_('cmdb.newRelationshipType'))} size="lg">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="rel-code" class="label-base block mb-2">
          {$isLoading ? 'Code' : $_('common.code')} *
        </label>
        <input
          id="rel-code"
          class="input-base"
          bind:value={code}
          placeholder={$isLoading ? 'depends_on' : $_('cmdb.relTypePanel.codePlaceholder')}
          disabled={!!editingId}
        />
        <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Unique identifier (lowercase, underscores)' : $_('cmdb.relTypePanel.codeHint')}</p>
      </div>

      <div>
        <label for="rel-name" class="label-base block mb-2">
          {$isLoading ? 'Name' : $_('common.name')} *
        </label>
        <input
          id="rel-name"
          class="input-base"
          bind:value={name}
          placeholder={$isLoading ? 'Depends on' : $_('cmdb.relTypePanel.namePlaceholder')}
        />
        <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Display name (e.g., "Depends on")' : $_('cmdb.relTypePanel.nameHint')}</p>
      </div>
    </div>

    <div>
      <label for="rel-reverse" class="label-base block mb-2">
        {$isLoading ? 'Reverse Name' : $_('cmdb.reverseName')}
      </label>
      <input
        id="rel-reverse"
        class="input-base"
        bind:value={reverseName}
        placeholder={$isLoading ? 'Required by' : $_('cmdb.relTypePanel.reversePlaceholder')}
      />
      <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Optional: How relationship appears from opposite direction' : $_('cmdb.relTypePanel.reverseHint')}</p>
    </div>

    <div class="border-t border-slate-700 pt-4">
      <h4 class="text-sm font-semibold text-slate-300 mb-3">
        {$isLoading ? 'Type Constraints (Optional)' : $_('cmdb.typeConstraints')}
      </h4>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="from-type" class="label-base block mb-2">
            {$isLoading ? 'Allowed From Type' : $_('cmdb.allowedFromType')}
          </label>
          <select
            id="from-type"
            bind:value={allowedFromTypeId}
            class="select-base"
          >
            <option value="">{$isLoading ? 'Any CI Type' : $_('cmdb.anyCiType')}</option>
            {#each ciTypes as ciType}
              <option value={ciType.id}>{ciType.name}</option>
            {/each}
          </select>
          <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Leave empty to allow any type' : $_('cmdb.relTypePanel.leaveEmpty')}</p>
        </div>

        <div>
          <label for="to-type" class="label-base block mb-2">
            {$isLoading ? 'Allowed To Type' : $_('cmdb.allowedToType')}
          </label>
          <select
            id="to-type"
            bind:value={allowedToTypeId}
            class="select-base"
          >
            <option value="">{$isLoading ? 'Any CI Type' : $_('cmdb.anyCiType')}</option>
            {#each ciTypes as ciType}
              <option value={ciType.id}>{ciType.name}</option>
            {/each}
          </select>
          <p class="text-xs text-slate-500 mt-1">{$isLoading ? 'Leave empty to allow any type' : $_('cmdb.relTypePanel.leaveEmpty')}</p>
        </div>
      </div>
    </div>

    <div class="bg-blue-900/20 rounded-lg p-3 text-sm">
      <p class="font-medium text-blue-200 mb-1">
        {$isLoading ? 'Examples:' : $_('cmdb.examples')}
      </p>
      <ul class="text-blue-300 space-y-1 text-xs">
        <li>• <code class="bg-blue-800 px-1 rounded">depends_on</code> → {$isLoading ? 'App depends on Database' : $_('cmdb.relTypePanel.example1')}</li>
        <li>• <code class="bg-blue-800 px-1 rounded">hosts</code> → {$isLoading ? 'Server hosts Application' : $_('cmdb.relTypePanel.example2')}</li>
        <li>• <code class="bg-blue-800 px-1 rounded">connects_to</code> → {$isLoading ? 'Switch connects to Router' : $_('cmdb.relTypePanel.example3')}</li>
      </ul>
    </div>
  </div>

  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={() => showModal = false}>
        {$isLoading ? 'Cancel' : $_('common.cancel')}
      </Button>
      <Button disabled={saving || !code || !name} onclick={saveRelationshipType}>
        {saving ? ($isLoading ? 'Saving...' : $_('common.saving')) : (editingId ? ($isLoading ? 'Update' : $_('common.update')) : ($isLoading ? 'Create' : $_('common.create')))}
      </Button>
    </div>
  {/snippet}
</Modal>


