<script lang="ts">
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { createCmdbType, listCmdbTypes, type CmdbType } from '$lib/api/cmdb';
  import CmdbTypeSchema from './CmdbTypeSchema.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

  let types = $state<CmdbType[]>([]);
  let loading = $state(true);
  let error = $state('');
  let selectedType = $state<CmdbType | null>(null);

  let showModal = $state(false);
  let saving = $state(false);
  let code = $state('');
  let name = $state('');
  let description = $state('');

  async function loadTypes() {
    try {
      loading = true;
      error = '';
      const response = await listCmdbTypes();
      types = response.data ?? [];
      if (selectedType) {
        selectedType = types.find((type) => type.id === selectedType?.id) ?? null;
      }
      if (!selectedType && types.length > 0) {
        selectedType = types[0];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load CMDB types';
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    code = '';
    name = '';
    description = '';
    showModal = true;
  }

  async function saveType() {
    if (!code || !name) return;
    try {
      saving = true;
      error = '';
      await createCmdbType({ code, name, description: description || null });
      showModal = false;
      await loadTypes();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create type';
    } finally {
      saving = false;
    }
  }

  async function handleRowClick(row: CmdbType) {
    selectedType = row;
  }

  const columns = [
    { key: 'code' as const, label: $isLoading ? 'Code' : $_('common.code'), sortable: true, filterable: true, render: (_value: unknown, row: CmdbType) => `<span class="font-medium">${row.code}</span>` },
    { key: 'name' as const, label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true }
  ];

  $effect(() => {
    void loadTypes();
  });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Types' : $_('cmdb.types')}</h2>
      <p class="text-sm text-slate-500">{types.length} {$isLoading ? 'types' : $_('cmdb.types').toLowerCase()}</p>
    </div>
    <Button onclick={openCreate}>
      <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Type' : $_('cmdb.newType')}
    </Button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
    <div class="bg-surface-2 border border-slate-700 rounded-lg overflow-hidden">
      {#if loading}
        <div class="flex items-center justify-center py-10">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      {:else}
        <DataTable
          data={types}
          {columns}
          rowKey="id"
          selectable={false}
        />
      {/if}
    </div>

    <div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
      <CmdbTypeSchema type={selectedType} />
    </div>
  </div>
</div>

<Modal bind:open={showModal} title={$isLoading ? 'New CMDB Type' : $_('cmdb.newType')}>
  <div class="space-y-3">
    <div>
      <label for="type-code" class="label-base">{$isLoading ? 'Code' : $_('common.code')}</label>
      <input id="type-code" class="input-base" bind:value={code} placeholder={$isLoading ? 'APP' : $_('cmdb.type.placeholders.code')} />
    </div>
    <div>
      <label for="type-name" class="label-base">{$isLoading ? 'Name' : $_('common.name')}</label>
      <input id="type-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Application' : $_('cmdb.type.placeholders.typeName')} />
    </div>
    <div>
      <label for="type-desc" class="label-base">{$isLoading ? 'Description' : $_('models.description')}</label>
      <input id="type-desc" class="input-base" bind:value={description} placeholder={$isLoading ? 'Optional description' : $_('cmdb.type.placeholders.typeDescription')} />
    </div>
  </div>
  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={() => showModal = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button disabled={saving || !code || !name} onclick={saveType}>
        {saving ? ($isLoading ? 'Saving...' : $_('common.saving')) : ($isLoading ? 'Create' : $_('common.create'))}
      </Button>
    </div>
  {/snippet}
</Modal>


