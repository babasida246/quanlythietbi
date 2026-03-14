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
  let criticality = $state('normal');
  let owner = $state('');
  let slaUptime = $state('');
  let slaResponseTime = $state('');
  let slaResolutionTime = $state('');
  let status = $state('active');
  let description = $state('');

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
      // Parse SLA JSONB into structured fields
      const rawSla = service?.sla;
      const parsedSla = rawSla && typeof rawSla === 'object' ? rawSla as Record<string, string>
        : (rawSla ? (() => { try { return JSON.parse(rawSla as string) as Record<string, string> } catch { return {} } })() : {});
      slaUptime = parsedSla.uptime ?? '';
      slaResponseTime = parsedSla.response_time ?? '';
      slaResolutionTime = parsedSla.resolution_time ?? '';
      status = service?.status ?? 'active';
      description = (service as any)?.description ?? '';
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
        sla: (slaUptime || slaResponseTime || slaResolutionTime)
          ? JSON.stringify({ uptime: slaUptime || null, response_time: slaResponseTime || null, resolution_time: slaResolutionTime || null })
          : null,
        status: status || null,
        description: description || null
      } as any);
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

  const membersColumns = $derived([
    { key: 'ciId' as const, label: $isLoading ? 'CI' : $_('cmdb.svc.ci'), sortable: true, filterable: true,
      render: (_value: unknown, row: CmdbServiceMember) => {
        const ci = cis.find(c => c.id === row.ciId)
        return ci ? `${ci.ciCode} — ${ci.name}` : row.ciId
      }
    },
    { key: 'role' as const, label: $isLoading ? 'Role' : $_('cmdb.role'), sortable: true, filterable: true, render: (_value: unknown, row: CmdbServiceMember) => row.role ?? '-' }
  ]);

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
          <select id="service-criticality" class="select-base" bind:value={criticality}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label for="service-status" class="label-base">{$isLoading ? 'Status' : $_('cmdb.svc.status')}</label>
          <select id="service-status" class="select-base" bind:value={status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div>
          <label for="service-owner" class="label-base">{$isLoading ? 'Owner' : $_('cmdb.svc.owner')}</label>
          <input id="service-owner" class="input-base" bind:value={owner} placeholder={$isLoading ? 'Team / person' : $_('cmdb.svc.ownerPlaceholder')} />
        </div>
        <div class="md:col-span-2">
          <label for="service-description" class="label-base">Description</label>
          <textarea id="service-description" class="input-base min-h-[56px] resize-y" bind:value={description} placeholder="Brief description of this service…"></textarea>
        </div>
        <div>
          <label for="service-sla-uptime" class="label-base">{$isLoading ? 'SLA Uptime' : $_('cmdb.svc.slaUptime')}</label>
          <input id="service-sla-uptime" class="input-base" bind:value={slaUptime} placeholder="99.9%" />
        </div>
        <div>
          <label for="service-sla-response" class="label-base">{$isLoading ? 'SLA Response Time' : $_('cmdb.svc.slaResponseTime')}</label>
          <input id="service-sla-response" class="input-base" bind:value={slaResponseTime} placeholder="1h" />
        </div>
        <div>
          <label for="service-sla-resolution" class="label-base">{$isLoading ? 'SLA Resolution Time' : $_('cmdb.svc.slaResolutionTime')}</label>
          <input id="service-sla-resolution" class="input-base" bind:value={slaResolutionTime} placeholder="4h" />
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

