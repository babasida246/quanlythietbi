<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Plus, Search } from 'lucide-svelte';
  import { createService, deleteService, listServices, updateService, type CmdbServiceRecord } from '$lib/api/cmdb';
  import CmdbServiceDetail from './CmdbServiceDetail.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

  let services = $state<CmdbServiceRecord[]>([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let selectedServiceId = $state<string | null>(null);
  let meta = $state({ total: 0, page: 1, limit: 20 });

  let showModal = $state(false);
  let saving = $state(false);
  let code = $state('');
  let name = $state('');
  let criticality = $state('');

  async function loadServices(page = 1) {
    try {
      loading = true;
      error = '';
      const response = await listServices({ q: query || undefined, page, limit: meta.limit });
      services = response.data ?? [];
      meta = {
        total: response.meta?.total ?? services.length,
        page: response.meta?.page ?? page,
        limit: response.meta?.limit ?? meta.limit
      };
      if (selectedServiceId && !services.some((svc) => svc.id === selectedServiceId)) {
        selectedServiceId = null;
      }
      if (!selectedServiceId && services.length > 0) {
        selectedServiceId = services[0].id;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load services';
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    code = '';
    name = '';
    criticality = '';
    showModal = true;
  }

  async function saveService() {
    if (!code || !name) return;
    try {
      saving = true;
      error = '';
      await createService({ code, name, criticality: criticality || null });
      showModal = false;
      await loadServices(1);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create service';
    } finally {
      saving = false;
    }
  }

  async function handleEdit(service: CmdbServiceRecord, changes: Partial<CmdbServiceRecord>) {
    try {
      await updateService(service.id, {
        code: changes.code,
        name: changes.name,
        criticality: changes.criticality
      });
      await loadServices(meta.page);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update service';
    }
  }

  async function handleDelete(rows: CmdbServiceRecord[]) {
    try {
      for (const row of rows) {
        await deleteService(row.id);
      }
      await loadServices(meta.page);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete service';
    }
  }

  $effect(() => {
    void loadServices(1);
  });
</script>

<div class="space-y-4">
  <div class="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
    <div>
      <h2 class="text-lg font-semibold">{$isLoading ? 'Services' : $_('cmdb.services')}</h2>
      <p class="text-sm text-slate-500">{meta.total} {$isLoading ? 'services' : $_('cmdb.services').toLowerCase()}</p>
    </div>
    <div class="flex flex-wrap gap-2 items-center">
      <div class="relative">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input class="input-base pl-9" bind:value={query} placeholder={$isLoading ? 'Search services...' : $_('cmdb.searchServices')} />
      </div>
      <Button variant="secondary" onclick={() => loadServices(1)}>{$isLoading ? 'Search' : $_('common.search')}</Button>
      <Button onclick={openCreate}>
        <Plus class="w-4 h-4 mr-2" /> {$isLoading ? 'New Service' : $_('cmdb.newService')}
      </Button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
    <DataTable
      data={services}
      columns={[
        { key: 'code', label: $isLoading ? 'Code' : $_('cmdb.code'), sortable: true, filterable: true, editable: true, width: 'w-32' },
        { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true }
      ]}
      selectable={true}
      rowKey="id"
      loading={loading}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />

    <div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
      <CmdbServiceDetail serviceId={selectedServiceId} />
    </div>
  </div>
</div>

<Modal bind:open={showModal} title={$isLoading ? 'New Service' : $_('cmdb.newService')}>
  <div class="space-y-3">
    <div>
      <label for="service-code" class="label-base">Code</label>
      <input id="service-code" class="input-base" bind:value={code} placeholder={$isLoading ? 'SVC-APP' : $_('cmdb.type.placeholders.serviceCode')} />
    </div>
    <div>
      <label for="service-name" class="label-base">Name</label>
      <input id="service-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Hospital App' : $_('cmdb.type.placeholders.serviceName')} />
    </div>
    <div>
      <label for="service-criticality" class="label-base">Criticality</label>
      <input id="service-criticality" class="input-base" bind:value={criticality} placeholder="low / medium / high" />
    </div>
  </div>
  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={() => showModal = false}>Cancel</Button>
      <Button disabled={saving || !code || !name} onclick={saveService}>
        {saving ? 'Saving...' : 'Create'}
      </Button>
    </div>
  {/snippet}
</Modal>

