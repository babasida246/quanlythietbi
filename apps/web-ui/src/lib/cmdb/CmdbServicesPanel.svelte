<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Button } from '$lib/components/ui';
  import { Plus, Search, X } from 'lucide-svelte';
  import { createService, deleteService, listServices, updateService, type CmdbServiceRecord } from '$lib/api/cmdb';
  import CmdbServiceDetail from './CmdbServiceDetail.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

  let services = $state<CmdbServiceRecord[]>([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let selectedServiceId = $state<string | null>(null);
  let meta = $state({ total: 0, page: 1, limit: 20 });

  // Inline create form state (replaces modal)
  let createMode = $state(false);
  let saving = $state(false);
  let code = $state('');
  let name = $state('');
  let criticality = $state('normal');
  let svcStatus = $state('active');
  let owner = $state('');
  let slaUptime = $state('');
  let slaResponseTime = $state('');
  let slaResolutionTime = $state('');
  let description = $state('');

  // Use a fixed page size constant to avoid reactive reads inside loadServices
  const PAGE_LIMIT = 20;

  async function loadServices(page = 1) {
    try {
      loading = true;
      error = '';
      const q = query || undefined;
      const response = await listServices({ q, page, limit: PAGE_LIMIT });
      services = response.data ?? [];
      meta = {
        total: response.meta?.total ?? services.length,
        page: response.meta?.page ?? page,
        limit: PAGE_LIMIT
      };
      if (selectedServiceId && !services.some((svc) => svc.id === selectedServiceId)) {
        selectedServiceId = null;
      }
      if (!createMode && !selectedServiceId && services.length > 0) {
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
    criticality = 'normal';
    svcStatus = 'active';
    owner = '';
    slaUptime = '';
    slaResponseTime = '';
    slaResolutionTime = '';
    description = '';
    selectedServiceId = null;
    createMode = true;
  }

  function cancelCreate() {
    createMode = false;
    if (!selectedServiceId && services.length > 0) {
      selectedServiceId = services[0].id;
    }
  }

  async function saveService() {
    if (!code || !name) return;
    try {
      saving = true;
      error = '';
      const slaJson = (slaUptime || slaResponseTime || slaResolutionTime)
        ? JSON.stringify({ uptime: slaUptime || null, response_time: slaResponseTime || null, resolution_time: slaResolutionTime || null })
        : null;
      const created = await createService({
        code,
        name,
        criticality: criticality || null,
        owner: owner || null,
        sla: slaJson,
        status: svcStatus || null,
        description: description || null
      });
      createMode = false;
      await loadServices(1);
      selectedServiceId = created.data?.id ?? null;
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

  onMount(() => {
    void loadServices(1);
  });
</script>

<div class="w-full space-y-4">
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

  <!-- Quick stats bar -->
  {#if services.length > 0}
    <div class="flex flex-wrap gap-3 text-xs">
      <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        Critical: {services.filter(s => s.criticality === 'critical').length}
      </span>
      <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
        High: {services.filter(s => s.criticality === 'high').length}
      </span>
      <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
        Normal: {services.filter(s => s.criticality === 'normal' || !s.criticality).length}
      </span>
      <span class="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
        Active: {services.filter(s => s.status === 'active' || !s.status).length}
      </span>
    </div>
  {/if}

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start min-h-0">
    <div class="min-w-0 overflow-hidden">
    <DataTable
      data={services}
      columns={[
        { key: 'code', label: $isLoading ? 'Code' : $_('cmdb.code'), sortable: true, filterable: true, editable: true, width: 'w-28' },
        { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true },
        { key: 'criticality', label: $isLoading ? 'Priority' : 'Priority', sortable: true, width: 'w-24',
          render: (v: unknown) => {
            const val = (v as string) ?? 'normal';
            const colors: Record<string, string> = { critical: 'bg-red-500/20 text-red-400', high: 'bg-orange-500/20 text-orange-400', normal: 'bg-blue-500/20 text-blue-400', low: 'bg-slate-500/20 text-slate-400' };
            const cls = colors[val] ?? colors.normal;
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}">${val}</span>`;
          }
        },
        { key: 'status', label: $isLoading ? 'Status' : 'Status', sortable: true, width: 'w-20',
          render: (v: unknown) => {
            const val = (v as string) ?? 'active';
            const colors: Record<string, string> = { active: 'bg-emerald-500/20 text-emerald-400', inactive: 'bg-slate-500/20 text-slate-400', retired: 'bg-red-500/20 text-red-400' };
            const cls = colors[val] ?? colors.active;
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}">${val}</span>`;
          }
        }
      ]}
      selectable={true}
      rowKey="id"
      loading={loading}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onRowClick={(row) => { selectedServiceId = row.id; createMode = false; }}
    />
    </div>

    <div class="min-w-0 bg-surface-2 border border-slate-700 rounded-lg p-4">
      {#if createMode}
        <!-- Inline create form -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold">{$isLoading ? 'New Service' : $_('cmdb.newService')}</h3>
          <button type="button" class="text-slate-400 hover:text-slate-200" onclick={cancelCreate}>
            <X class="w-4 h-4" />
          </button>
        </div>
        {#if error}
          <div class="alert alert-error mb-3">{error}</div>
        {/if}
        <div class="grid grid-cols-1 gap-3">
          <!-- Row 1: Code + Status -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="svc-code" class="label-base">{$isLoading ? 'Code' : $_('cmdb.svc.code')} <span class="text-red-400">*</span></label>
              <input id="svc-code" class="input-base" bind:value={code} placeholder="SVC-APP" />
            </div>
            <div>
              <label for="svc-status" class="label-base">{$isLoading ? 'Status' : $_('cmdb.svc.status')}</label>
              <select id="svc-status" class="select-base" bind:value={svcStatus}>
                <option value="active">{$isLoading ? 'Active' : 'Active'}</option>
                <option value="inactive">{$isLoading ? 'Inactive' : 'Inactive'}</option>
                <option value="retired">{$isLoading ? 'Retired' : 'Retired'}</option>
              </select>
            </div>
          </div>
          <!-- Row 2: Name (full width) -->
          <div>
            <label for="svc-name" class="label-base">{$isLoading ? 'Name' : $_('cmdb.svc.name')} <span class="text-red-400">*</span></label>
            <input id="svc-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Hospital App' : $_('cmdb.type.placeholders.serviceName')} />
          </div>
          <!-- Row 2b: Description (full width) -->
          <div>
            <label for="svc-description" class="label-base">Description</label>
            <textarea id="svc-description" class="input-base min-h-[60px] resize-y" bind:value={description} placeholder="Brief description of this service…"></textarea>
          </div>
          <!-- Row 3: Criticality + Owner -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="svc-criticality" class="label-base">{$isLoading ? 'Criticality' : $_('cmdb.svc.criticality')}</label>
              <select id="svc-criticality" class="select-base" bind:value={criticality}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label for="svc-owner" class="label-base">{$isLoading ? 'Owner' : $_('cmdb.svc.owner')}</label>
              <input id="svc-owner" class="input-base" bind:value={owner} placeholder={$isLoading ? 'Responsible team' : $_('cmdb.svc.ownerPlaceholder')} />
            </div>
          </div>
          <!-- Row 4: SLA fields -->
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{$isLoading ? 'SLA' : $_('cmdb.svc.sla')}</p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="svc-uptime" class="label-base text-xs">{$isLoading ? 'Uptime' : $_('cmdb.svc.slaUptime')}</label>
                <input id="svc-uptime" class="input-base" bind:value={slaUptime} placeholder="99.9%" />
              </div>
              <div>
                <label for="svc-response" class="label-base text-xs">{$isLoading ? 'Response time' : $_('cmdb.svc.slaResponseTime')}</label>
                <input id="svc-response" class="input-base" bind:value={slaResponseTime} placeholder="4h" />
              </div>
              <div>
                <label for="svc-resolution" class="label-base text-xs">{$isLoading ? 'Resolution time' : $_('cmdb.svc.slaResolutionTime')}</label>
                <input id="svc-resolution" class="input-base" bind:value={slaResolutionTime} placeholder="8h" />
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onclick={cancelCreate}>{$isLoading ? 'Cancel' : $_('cmdb.svc.cancel')}</Button>
          <Button disabled={saving || !code || !name} onclick={saveService}>
            {saving ? ($isLoading ? 'Saving...' : $_('cmdb.svc.saving')) : ($isLoading ? 'Create' : $_('cmdb.svc.create'))}
          </Button>
        </div>
      {:else}
        <CmdbServiceDetail serviceId={selectedServiceId} />
      {/if}
    </div>
  </div>
</div>

