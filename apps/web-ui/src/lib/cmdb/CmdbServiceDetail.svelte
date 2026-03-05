<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Button } from '$lib/components/ui';
  import { addServiceMember, getServiceDetail, listCis, removeServiceMember, updateService, type CiRecord, type CmdbServiceMember, type CmdbServiceRecord } from '$lib/api/cmdb';
  import DataTable from '$lib/components/DataTable.svelte';

  let { serviceId } = $props<{ serviceId: string | null }>();

  let service = $state<CmdbServiceRecord | null>(null);
  let members = $state<CmdbServiceMember[]>([]);
  let cis = $state<CiRecord[]>([]);
  let loading = $state(false);
  let error = $state('');
  let saving = $state(false);

  let name = $state('');
  let criticality = $state('');
  let owner = $state('');
  let sla = $state('');
  let status = $state('');

  let memberCiId = $state('');
  let memberRole = $state('');

  async function loadDetail() {
    if (!serviceId) return;
    try {
      loading = true;
      error = '';
      const response = await getServiceDetail(serviceId);
      service = response.data.service;
      members = response.data.members ?? [];
      name = service?.name ?? '';
      criticality = service?.criticality ?? '';
      owner = service?.owner ?? '';
      // sla is stored as JSONB — display as JSON string if object
      const rawSla = service?.sla;
      sla = rawSla && typeof rawSla === 'object' ? JSON.stringify(rawSla) : (rawSla ?? '');
      status = service?.status ?? '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load service';
    } finally {
      loading = false;
    }
  }

  async function loadCis() {
    try {
      const response = await listCis({ page: 1, limit: 200 });
      cis = response.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load CIs';
    }
  }

  async function saveService() {
    if (!serviceId) return;
    try {
      saving = true;
      error = '';
      const response = await updateService(serviceId, {
        name,
        criticality: criticality || null,
        owner: owner || null,
        sla: sla || null,
        status: status || null
      });
      service = response.data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update service';
    } finally {
      saving = false;
    }
  }

  async function addMember() {
    if (!serviceId || !memberCiId) return;
    try {
      saving = true;
      error = '';
      await addServiceMember(serviceId, { ciId: memberCiId, role: memberRole || null });
      memberCiId = '';
      memberRole = '';
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add member';
    } finally {
      saving = false;
    }
  }

  async function removeMember(memberId: string) {
    if (!serviceId) return;
    try {
      saving = true;
      error = '';
      await removeServiceMember(serviceId, memberId);
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to remove member';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteMember(rows: CmdbServiceMember[]) {
    for (const row of rows) {
      await removeMember(row.id);
    }
  }

  const membersColumns = [
    { key: 'ciId' as const, label: $isLoading ? 'CI' : $_('cmdb.svc.ci'), sortable: true, filterable: true },
    { key: 'role' as const, label: $isLoading ? 'Role' : $_('cmdb.role'), sortable: true, filterable: true, render: (_value: unknown, row: CmdbServiceMember) => row.role ?? '-' }
  ];

  $effect(() => {
    if (serviceId) {
      void loadDetail();
      void loadCis();
    } else {
      service = null;
      members = [];
    }
  });
</script>

{#if !serviceId}
  <div class="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-6 text-slate-500">
    {$isLoading ? 'Select a service to view details.' : $_('cmdb.selectService')}
  </div>
{:else if loading}
  <div class="flex items-center justify-center py-10">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
{:else}
  <div class="space-y-4">
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Service Details' : $_('cmdb.serviceDetails')}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label for="service-code" class="label-base">{$isLoading ? 'Code' : $_('cmdb.svc.code')}</label>
          <input id="service-code" class="input-base" value={service?.code ?? ''} disabled />
        </div>
        <div>
          <label for="service-name" class="label-base">{$isLoading ? 'Name' : $_('cmdb.svc.name')}</label>
          <input id="service-name" class="input-base" bind:value={name} />
        </div>
        <div>
          <label for="service-criticality" class="label-base">{$isLoading ? 'Criticality' : $_('cmdb.svc.criticality')}</label>
          <input id="service-criticality" class="input-base" bind:value={criticality} placeholder={$isLoading ? 'low / medium / high' : $_('cmdb.svc.criticalityPlaceholder')} />
        </div>
        <div>
          <label for="service-status" class="label-base">{$isLoading ? 'Status' : $_('cmdb.svc.status')}</label>
          <input id="service-status" class="input-base" bind:value={status} placeholder={$isLoading ? 'active' : $_('cmdb.svc.statusPlaceholder')} />
        </div>
        <div>
          <label for="service-owner" class="label-base">{$isLoading ? 'Owner' : $_('cmdb.svc.owner')}</label>
          <input id="service-owner" class="input-base" bind:value={owner} placeholder={$isLoading ? 'Team / person' : $_('cmdb.svc.ownerPlaceholder')} />
        </div>
        <div>
          <label for="service-sla" class="label-base">{$isLoading ? 'SLA' : $_('cmdb.svc.sla')}</label>
          <input id="service-sla" class="input-base" bind:value={sla} placeholder={$isLoading ? '99.9%' : $_('cmdb.svc.slaPlaceholder')} />
        </div>
      </div>
      <Button disabled={saving} onclick={saveService}>{saving ? ($isLoading ? 'Saving...' : $_('cmdb.svc.saving')) : ($isLoading ? 'Save' : $_('cmdb.svc.save'))}</Button>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-300">{$isLoading ? 'Members' : $_('cmdb.members')}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <div>
          <label for="member-ci" class="label-base">CI</label>
          <select id="member-ci" bind:value={memberCiId} class="select-base">
            <option value="">{$isLoading ? 'Select CI' : $_('cmdb.selectCi')}</option>
            {#each cis as ci}
              <option value={ci.id}>{ci.ciCode} - {ci.name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="member-role" class="label-base">{$isLoading ? 'Role' : $_('cmdb.role')}</label>
          <input id="member-role" class="input-base" bind:value={memberRole} placeholder={$isLoading ? 'primary / dependency' : $_('cmdb.svc.dependencyPlaceholder')} />
        </div>
        <div>
          <Button disabled={!memberCiId || saving} onclick={addMember}>{$isLoading ? 'Add Member' : $_('cmdb.addMember')}</Button>
        </div>
      </div>

      <div class="bg-surface-2 border border-slate-700 rounded-lg overflow-hidden">
        <DataTable
          data={members}
          columns={membersColumns}
          rowKey="id"
          selectable={false}
          onDelete={handleDeleteMember}
        />
      </div>
    </div>
  </div>
{/if}

