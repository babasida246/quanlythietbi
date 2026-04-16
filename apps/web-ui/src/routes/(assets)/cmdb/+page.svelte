<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Plus, RefreshCw, Edit, Trash2, FileCode } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { z } from 'zod';
  import {
    createCi,
    createCmdbType,
    createRelationship,
    createRelationshipType,
    deleteCi,
    deleteCmdbType,
    deleteRelationship,
    listCis,
    listCmdbTypes,
    listRelationships,
    listRelationshipTypes,
    updateCi,
    updateCmdbType,
    updateRelationship,
    type CiRecord,
    type CmdbType,
    type RelationshipRecord,
    type RelationshipTypeRecord
  } from '$lib/api/cmdb';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import { Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui';
  import CmdbServicesPanel from '$lib/cmdb/CmdbServicesPanel.svelte';
  import CmdbConfigFilesPanel from '$lib/cmdb/CmdbConfigFilesPanel.svelte';
  import TopologyGraph from '$lib/cmdb/TopologyGraph.svelte';
  import { _, isLoading } from '$lib/i18n';

  const allTabs = ['types', 'cis', 'relationships', 'services', 'config-files', 'topology'] as const;
  type CmdbTab = (typeof allTabs)[number];

  const tabLabels: Record<CmdbTab, string> = $derived({
    types: $isLoading ? 'CI Types' : $_('cmdb.tabs.ciTypes'),
    cis: $isLoading ? 'CIs' : $_('cmdb.tabs.ci'),
    relationships: $isLoading ? 'Relationships' : $_('cmdb.tabs.rel'),
    services: $isLoading ? 'Services' : $_('cmdb.tabs.svc'),
    'config-files': $isLoading ? 'Config Files' : $_('cmdb.configFiles.tab'),
    topology: $isLoading ? 'Topology' : $_('cmdb.tabs.topology')
  });

  // Tabs that use the inline CRUD table (not panel components)
  const crudTabs = ['types', 'cis', 'relationships'] as const;
  type CrudTab = (typeof crudTabs)[number];

  const typeSchema = $derived(z.object({
    name: z.string().trim().min(1, $isLoading ? 'CI type name is required' : $_('cmdb.errors.typeNameRequired')),
    code: z.string().trim().min(1, $isLoading ? 'Code is required' : $_('cmdb.errors.codeRequired'))
  }));

  const ciSchema = $derived(z.object({
    name: z.string().trim().min(1, $isLoading ? 'CI name is required' : $_('cmdb.errors.ciNameRequired')),
    typeId: z.string().trim().min(1, $isLoading ? 'CI type is required' : $_('cmdb.errors.ciTypeRequired')),
    owner: z.string().optional(),
    env: z.enum(['dev', 'test', 'prod'] as const),
    criticality: z.enum(['low', 'med', 'high'] as const),
    tags: z.string().optional()
  }));

  const relationshipSchema = $derived(z.object({
    fromCiId: z.string().trim().min(1, $isLoading ? 'Source CI is required' : $_('cmdb.errors.fromRequired')),
    toCiId: z.string().trim().min(1, $isLoading ? 'Target CI is required' : $_('cmdb.errors.toRequired')),
    relationType: z.string().trim().min(1, $isLoading ? 'Relationship type is required' : $_('cmdb.errors.relTypeRequired'))
  }));

  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<CmdbTab>('types');
  const isCrudTab = $derived(crudTabs.includes(activeTab as CrudTab));

  // ── Pagination ──────────────────────────────────────────────────────────────
  const PAGE_SIZE = 20;
  let typesPage = $state(1);
  let cisPage = $state(1);
  let cisTotal = $state(0);
  let relPage = $state(1);

  function goToPage(nextPage: number) {
    if (activeTab === 'cis') { void loadCisPage(nextPage); }
    else if (activeTab === 'types') { typesPage = nextPage; }
    else if (activeTab === 'relationships') { relPage = nextPage; }
  }

  let ciTypes = $state<CmdbType[]>([]);
  let cis = $state<CiRecord[]>([]);  // paginated CIs for table display
  let allCis = $state<CiRecord[]>([]);  // all CIs for dropdown options
  let relationships = $state<RelationshipRecord[]>([]);
  let relationshipTypes = $state<RelationshipTypeRecord[]>([]);

  // Pagination counts — declared after state arrays to avoid TDZ errors
  const typesTotalPages = $derived(Math.max(1, Math.ceil(ciTypes.length / PAGE_SIZE)));
  const cisTotalPages = $derived(Math.max(1, Math.ceil(cisTotal / PAGE_SIZE)));
  const relTotalPages = $derived(Math.max(1, Math.ceil(relationships.length / PAGE_SIZE)));
  const currentTabPage = $derived(activeTab === 'types' ? typesPage : activeTab === 'cis' ? cisPage : relPage);
  const currentTabTotalPages = $derived(activeTab === 'types' ? typesTotalPages : activeTab === 'cis' ? cisTotalPages : relTotalPages);
  const currentTabTotal = $derived(activeTab === 'types' ? ciTypes.length : activeTab === 'cis' ? cisTotal : relationships.length);

  let createOpen = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let editingItem = $state<Record<string, unknown> | null>(null);
  let deletingItem = $state<Record<string, unknown> | null>(null);

  const currentRows = $derived.by(() => {
    if (activeTab === 'types') return ciTypes.slice((typesPage - 1) * PAGE_SIZE, typesPage * PAGE_SIZE);
    if (activeTab === 'cis') return cis;
    if (activeTab === 'relationships') return relationships.slice((relPage - 1) * PAGE_SIZE, relPage * PAGE_SIZE);
    return [];
  });

  const currentSchema = $derived.by(() => {
    if (activeTab === 'types') return typeSchema;
    if (activeTab === 'cis') return ciSchema;
    return relationshipSchema;
  });

  const ciTypeOptions = $derived(ciTypes.map((item) => ({ value: item.id, label: item.name })));
  const ciOptions = $derived(allCis.map((item) => ({ value: item.id, label: item.name })));

  function sanitizeCode(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'REL';
  }

  function buildCiNotes(criticality: string, tags: string): string {
    return `criticality:${criticality};tags:${tags}`;
  }

  function parseCiNotes(note?: string | null): { criticality: 'low' | 'med' | 'high'; tags: string } {
    const fallback = { criticality: 'low' as const, tags: '' };
    if (!note) return fallback;
    const critMatch = note.match(/criticality:([^;]+)/i);
    const tagMatch = note.match(/tags:(.+)$/i);
    const critValue = (critMatch?.[1]?.trim().toLowerCase() ?? 'low') as 'low' | 'med' | 'high';
    return {
      criticality: critValue === 'high' || critValue === 'med' || critValue === 'low' ? critValue : 'low',
      tags: tagMatch?.[1]?.trim() ?? ''
    };
  }

  async function ensureRelationshipTypeId(relationType: string): Promise<string> {
    const normalized = relationType.trim().toLowerCase();
    const existing = relationshipTypes.find((item) => item.name.toLowerCase() === normalized || item.code.toLowerCase() === normalized);
    if (existing) return existing.id;

    const created = await createRelationshipType({
      code: sanitizeCode(relationType),
      name: relationType.trim()
    });
    relationshipTypes = [created.data, ...relationshipTypes];
    return created.data.id;
  }

  function getCreateValues(tab: CmdbTab): Record<string, unknown> {
    if (tab === 'types') return { name: '', code: '' };
    if (tab === 'cis') return { name: '', typeId: '', owner: '', env: 'dev', criticality: 'low', tags: '' };
    return { fromCiId: '', toCiId: '', relationType: '' };
  }

  function getEditValues(tab: CmdbTab, item: Record<string, unknown> | null): Record<string, unknown> {
    if (!item) return getCreateValues(tab);
    if (tab === 'types') {
      return { name: String(item.name ?? ''), code: String(item.code ?? '') };
    }
    if (tab === 'cis') {
      const parsedNotes = parseCiNotes(String(item.notes ?? ''));
      return {
        name: String(item.name ?? ''),
        typeId: String(item.typeId ?? ''),
        owner: String(item.ownerTeam ?? ''),
        env: String(item.environment ?? 'dev'),
        criticality: parsedNotes.criticality,
        tags: parsedNotes.tags
      };
    }
    return {
      fromCiId: String(item.fromCiId ?? ''),
      toCiId: String(item.toCiId ?? ''),
      relationType: relationshipTypes.find((type) => type.id === item.relTypeId)?.name ?? ''
    };
  }

  function getRowId(row: Record<string, unknown>): string {
    return String(row.id ?? '');
  }

  function getRowName(row: Record<string, unknown>): string {
    if (activeTab === 'types') return String(row.name ?? '');
    if (activeTab === 'cis') return String(row.name ?? '');
    // Resolve CI names and relationship type name for delete confirmation
    const fromName = allCis.find(c => c.id === row.fromCiId)?.name ?? String(row.fromCiId ?? '');
    const toName = allCis.find(c => c.id === row.toCiId)?.name ?? String(row.toCiId ?? '');
    const relTypeName = relationshipTypes.find(t => t.id === row.relTypeId)?.name ?? '';
    return relTypeName ? `${fromName} —[${relTypeName}]→ ${toName}` : `${fromName} → ${toName}`;
  }

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [typesResponse, cisResponse, allCisResponse, relationshipResponse, relationshipTypeResponse] = await Promise.all([
        listCmdbTypes(),
        listCis({ limit: PAGE_SIZE, page: 1 }),
        listCis({ limit: 500, page: 1 }),
        listRelationships(),
        listRelationshipTypes()
      ]);
      ciTypes = typesResponse.data ?? [];
      cis = cisResponse.data ?? [];
      allCis = allCisResponse.data ?? [];
      cisTotal = cisResponse.meta?.total ?? cis.length;
      cisPage = cisResponse.meta?.page ?? 1;
      typesPage = 1;
      relPage = 1;
      relationships = relationshipResponse.data ?? [];
      relationshipTypes = relationshipTypeResponse.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : ($isLoading ? 'Failed to load CMDB data' : $_('cmdb.errors.loadFailed'));
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadCisPage(page: number) {
    try {
      loading = true;
      error = '';
      const cisResponse = await listCis({ limit: PAGE_SIZE, page });
      cis = cisResponse.data ?? [];
      cisTotal = cisResponse.meta?.total ?? cis.length;
      cisPage = page;
    } catch (err) {
      error = err instanceof Error ? err.message : ($isLoading ? 'Failed to load CMDB data' : $_('cmdb.errors.loadFailed'));
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function createCurrent(values: Record<string, unknown>) {
    if (activeTab === 'types') {
      const parsed = typeSchema.parse(values);
      await createCmdbType({
        name: parsed.name,
        code: parsed.code
      });
    } else if (activeTab === 'cis') {
      const parsed = ciSchema.parse(values);
      await createCi({
        name: parsed.name,
        typeId: parsed.typeId,
        ciCode: `CI-${Date.now().toString().slice(-6)}`,
        environment: parsed.env,
        status: 'active',
        ownerTeam: parsed.owner?.trim() || null,
        notes: buildCiNotes(parsed.criticality, parsed.tags?.trim() || '')
      });
    } else {
      const parsed = relationshipSchema.parse(values);
      const relTypeId = await ensureRelationshipTypeId(parsed.relationType);
      await createRelationship({
        relTypeId,
        fromCiId: parsed.fromCiId,
        toCiId: parsed.toCiId
      });
    }

    toast.success($isLoading ? 'Created successfully' : $_('cmdb.createSuccess'));
    await loadData();
  }

  async function updateCurrent(values: Record<string, unknown>) {
    if (!editingItem) return;
    const id = String(editingItem.id);

    if (activeTab === 'types') {
      const parsed = typeSchema.parse(values);
      await updateCmdbType(id, {
        name: parsed.name,
        code: parsed.code
      });
    } else if (activeTab === 'cis') {
      const parsed = ciSchema.parse(values);
      await updateCi(id, {
        name: parsed.name,
        typeId: parsed.typeId,
        environment: parsed.env,
        ownerTeam: parsed.owner?.trim() || null,
        notes: buildCiNotes(parsed.criticality, parsed.tags?.trim() || '')
      });
    } else {
      const parsed = relationshipSchema.parse(values);
      const relTypeId = await ensureRelationshipTypeId(parsed.relationType);
      await updateRelationship(id, {
        relTypeId,
        fromCiId: parsed.fromCiId,
        toCiId: parsed.toCiId
      });
    }

    toast.success($isLoading ? 'Updated successfully' : $_('cmdb.updateSuccess'));
    await loadData();
  }

  async function deleteCurrent() {
    if (!deletingItem) return;
    const id = String(deletingItem.id);

    if (activeTab === 'types') {
      await deleteCmdbType(id);
    } else if (activeTab === 'cis') {
      await deleteCi(id);
    } else {
      await deleteRelationship(id);
    }

    toast.success($isLoading ? 'Deleted successfully' : $_('cmdb.deleteSuccess'));
    deleteOpen = false;
    deletingItem = null;
    await loadData();
  }

  function setTab(tab: CmdbTab) {
    activeTab = tab;
    editingItem = null;
    deletingItem = null;
    // Reset page when switching tabs
    typesPage = 1;
    cisPage = 1;
    relPage = 1;
    const params = new URLSearchParams(page.url.searchParams);
    params.set('tab', tab);
    goto(`/cmdb?${params.toString()}`, { replaceState: true, noScroll: true });
  }

  onMount(() => {
    // Read initial tab from URL
    const tabParam = page.url.searchParams.get('tab') as CmdbTab | null;
    if (tabParam && allTabs.includes(tabParam)) {
      activeTab = tabParam;
    }
    void loadData();
  });
</script>

<div class="page-shell page-content">
  <PageHeader title="Thông tin hạ tầng CNTT" subtitle={isCrudTab ? $_('cmdb.recordCount', { values: { count: currentTabTotal } }) : tabLabels[activeTab]}>
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={() => goto('/cmdb/changes')}>{$isLoading ? 'CI Changes' : $_('cmdb.changes.title')}</Button>
      <Button variant="secondary" size="sm" onclick={() => goto('/cmdb/reports')}>{$isLoading ? 'Report' : $_('cmdb.report.pageTitle')}</Button>
      {#if isCrudTab}
        <Button variant="secondary" size="sm" onclick={() => goto('/cmdb/relationships/import')}>{$isLoading ? 'Import relationships' : $_('cmdb.importRelation')}</Button>
        <Button variant="primary" size="sm" data-testid="btn-create" onclick={() => (createOpen = true)}>
          {#snippet leftIcon()}<Plus class="h-3.5 w-3.5" />{/snippet}
          {$isLoading ? 'Create' : $_('cmdb.createNew')}
        </Button>
        <Button variant="ghost" size="sm" data-testid="btn-refresh" onclick={() => loadData()}>
          <RefreshCw class="h-3.5 w-3.5" />
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <Tabs>
    <TabsList>
      {#each allTabs as tab}
        <TabsTrigger active={activeTab === tab} onclick={() => setTab(tab)}>
          {tabLabels[tab]}
        </TabsTrigger>
      {/each}
    </TabsList>
  </Tabs>

  {#if activeTab === 'services'}
    <CmdbServicesPanel />
  {:else if activeTab === 'config-files'}
    <CmdbConfigFilesPanel />
  {:else if activeTab === 'topology'}
    <TopologyGraph depth={2} direction="both" />
  {:else}

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else}
    <Table>
      <TableHeader>
        <tr>
          {#if activeTab === 'types'}
            <TableHeaderCell>{$isLoading ? 'Name' : $_('common.name')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Code' : $_('common.code')}</TableHeaderCell>
          {:else if activeTab === 'cis'}
            <TableHeaderCell>{$isLoading ? 'Name' : $_('common.name')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'CI Type' : $_('cmdb.ciType')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Owner' : $_('cmdb.owner')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Environment' : $_('cmdb.environment')}</TableHeaderCell>
          {:else}
            <TableHeaderCell>{$isLoading ? 'Source CI' : $_('cmdb.sourceCi')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Target CI' : $_('cmdb.targetCi')}</TableHeaderCell>
            <TableHeaderCell>{$isLoading ? 'Rel. type' : $_('cmdb.relType')}</TableHeaderCell>
          {/if}
          <TableHeaderCell align="right">{$isLoading ? 'Actions' : $_('common.actions')}</TableHeaderCell>
        </tr>
      </TableHeader>
      <tbody>
        {#if currentRows.length === 0}
          <TableRow>
            <TableCell class="py-6 text-center text-slate-500" colspan={5}>
              {$isLoading ? 'No data' : $_('cmdb.noData')}
            </TableCell>
          </TableRow>
        {:else}
          {#each currentRows as row}
            {@const rowAny = row as any}
            <TableRow>
              {#if activeTab === 'types'}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell><code class="code-inline">{rowAny.code}</code></TableCell>
              {:else if activeTab === 'cis'}
                <TableCell>{rowAny.name}</TableCell>
                <TableCell>{ciTypes.find((item) => item.id === rowAny.typeId)?.name ?? '-'}</TableCell>
                <TableCell>{rowAny.ownerTeam ?? '-'}</TableCell>
                <TableCell>{rowAny.environment}</TableCell>
              {:else}
                <TableCell>{allCis.find((ci) => ci.id === rowAny.fromCiId)?.name ?? rowAny.fromCiId}</TableCell>
                <TableCell>{allCis.find((ci) => ci.id === rowAny.toCiId)?.name ?? rowAny.toCiId}</TableCell>
                <TableCell>{relationshipTypes.find((item) => item.id === rowAny.relTypeId)?.name ?? rowAny.relTypeId}</TableCell>
              {/if}
              <TableCell align="right">
                <div class="cell-actions">
                  {#if activeTab === 'cis'}
                    <Button size="sm" variant="ghost" title={$isLoading ? 'Config Files' : $_('cmdb.configFiles.tab')}
                      onclick={() => goto(`/cmdb/cis/${getRowId(rowAny)}?tab=config-files`)}>
                      {#snippet leftIcon()}<FileCode class="h-3 w-3" />{/snippet}
                    </Button>
                  {/if}
                  <Button size="sm" variant="secondary" data-testid={`row-edit-${getRowId(rowAny)}`}
                    onclick={() => { editingItem = rowAny as Record<string, unknown>; editOpen = true; }}>
                    {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                    {$isLoading ? 'Edit' : $_('common.edit')}
                  </Button>
                  <Button size="sm" variant="danger" data-testid={`row-delete-${getRowId(rowAny)}`}
                    onclick={() => { deletingItem = rowAny as Record<string, unknown>; deleteOpen = true; }}>
                    {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
                    {$isLoading ? 'Delete' : $_('common.delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </tbody>
    </Table>

  <!-- ─── Pagination ────────────────────────────────────────────────────────── -->
  {#if isCrudTab && currentTabTotalPages > 1}
    <div class="flex items-center justify-between text-sm text-slate-400 mt-3">
      <span>{$isLoading ? `Page ${currentTabPage} / ${currentTabTotalPages} · ${currentTabTotal} records` : $_('cmdb.pagination.page', { values: { current: currentTabPage, total: currentTabTotalPages, count: currentTabTotal } })}</span>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" disabled={currentTabPage <= 1}
          onclick={() => goToPage(currentTabPage - 1)}>{$isLoading ? '← Previous' : $_('cmdb.pagination.prev')}</Button>
        <Button size="sm" variant="secondary" disabled={currentTabPage >= currentTabTotalPages}
          onclick={() => goToPage(currentTabPage + 1)}>{$isLoading ? 'Next →' : $_('cmdb.pagination.next')}</Button>
      </div>
    </div>
  {/if}

  {/if}
  {/if}
</div>

<CreateEditModal
  bind:open={createOpen}
  mode="create"
  title={$isLoading ? `Create ${tabLabels[activeTab]}` : $_('cmdb.createTitle', { values: { tab: tabLabels[activeTab] } })}
  schema={currentSchema}
  initialValues={getCreateValues(activeTab)}
  onSubmit={createCurrent}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    {#if activeTab === 'types'}
      <TextField id="cmdb-type-name-create" label={$isLoading ? 'Name' : $_('common.name')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="cmdb-type-code-create" label={$isLoading ? 'Code' : $_('common.code')} required value={String(values.code ?? '')} error={errors.code} onValueChange={(v) => setValue('code', v)} disabled={disabled} />
    {:else if activeTab === 'cis'}
      <TextField id="cmdb-ci-name-create" label={$isLoading ? 'CI Name' : $_('cmdb.ciName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-type-create" label={$isLoading ? 'CI Type' : $_('cmdb.ciType')} required value={String(values.typeId ?? '')} options={ciTypeOptions} placeholder={$isLoading ? 'Select CI type' : $_('cmdb.selectType')} error={errors.typeId} onValueChange={(v) => setValue('typeId', v)} disabled={disabled} />
      <TextField id="cmdb-ci-owner-create" label={$isLoading ? 'Owner' : $_('cmdb.owner')} value={String(values.owner ?? '')} onValueChange={(v) => setValue('owner', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-env-create" label={$isLoading ? 'Environment' : $_('cmdb.environment')} required value={String(values.env ?? 'dev')} options={[{ value: 'dev', label: $isLoading ? 'Dev' : $_('cmdb.dev') }, { value: 'test', label: $isLoading ? 'Test' : $_('cmdb.test') }, { value: 'prod', label: $isLoading ? 'Prod' : $_('cmdb.prod') }]} onValueChange={(v) => setValue('env', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-criticality-create" label={$isLoading ? 'Criticality' : $_('cmdb.criticality')} required value={String(values.criticality ?? 'low')} options={[{ value: 'low', label: $isLoading ? 'Low' : $_('cmdb.low') }, { value: 'med', label: $isLoading ? 'Medium' : $_('cmdb.medium') }, { value: 'high', label: $isLoading ? 'High' : $_('cmdb.high') }]} onValueChange={(v) => setValue('criticality', v)} disabled={disabled} />
      <TextField id="cmdb-ci-tags-create" label={$isLoading ? 'Tags' : $_('cmdb.tags')} value={String(values.tags ?? '')} onValueChange={(v) => setValue('tags', v)} disabled={disabled} />
    {:else}
      <SelectField id="cmdb-rel-from-create" label={$isLoading ? 'Source CI' : $_('cmdb.sourceCi')} required value={String(values.fromCiId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select source CI' : $_('cmdb.selectSourceCi')} error={errors.fromCiId} onValueChange={(v) => setValue('fromCiId', v)} disabled={disabled} />
      <SelectField id="cmdb-rel-to-create" label={$isLoading ? 'Target CI' : $_('cmdb.targetCi')} required value={String(values.toCiId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select target CI' : $_('cmdb.selectTargetCi')} error={errors.toCiId} onValueChange={(v) => setValue('toCiId', v)} disabled={disabled} />
      <TextField id="cmdb-rel-type-create" label={$isLoading ? 'Relationship type' : $_('cmdb.relType')} required value={String(values.relationType ?? '')} error={errors.relationType} onValueChange={(v) => setValue('relationType', v)} disabled={disabled} />
    {/if}
  {/snippet}
</CreateEditModal>

<CreateEditModal
  bind:open={editOpen}
  mode="edit"
  title={$isLoading ? `Edit ${tabLabels[activeTab]}` : $_('cmdb.editTitle', { values: { tab: tabLabels[activeTab] } })}
  schema={currentSchema}
  initialValues={getEditValues(activeTab, editingItem)}
  onSubmit={updateCurrent}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    {#if activeTab === 'types'}
      <TextField id="cmdb-type-name-edit" label={$isLoading ? 'Name' : $_('common.name')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <TextField id="cmdb-type-code-edit" label={$isLoading ? 'Code' : $_('common.code')} required value={String(values.code ?? '')} error={errors.code} onValueChange={(v) => setValue('code', v)} disabled={disabled} />
    {:else if activeTab === 'cis'}
      <TextField id="cmdb-ci-name-edit" label={$isLoading ? 'CI Name' : $_('cmdb.ciName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-type-edit" label={$isLoading ? 'CI Type' : $_('cmdb.ciType')} required value={String(values.typeId ?? '')} options={ciTypeOptions} placeholder={$isLoading ? 'Select CI type' : $_('cmdb.selectType')} error={errors.typeId} onValueChange={(v) => setValue('typeId', v)} disabled={disabled} />
      <TextField id="cmdb-ci-owner-edit" label={$isLoading ? 'Owner' : $_('cmdb.owner')} value={String(values.owner ?? '')} onValueChange={(v) => setValue('owner', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-env-edit" label={$isLoading ? 'Environment' : $_('cmdb.environment')} required value={String(values.env ?? 'dev')} options={[{ value: 'dev', label: $isLoading ? 'Dev' : $_('cmdb.dev') }, { value: 'test', label: $isLoading ? 'Test' : $_('cmdb.test') }, { value: 'prod', label: $isLoading ? 'Prod' : $_('cmdb.prod') }]} onValueChange={(v) => setValue('env', v)} disabled={disabled} />
      <SelectField id="cmdb-ci-criticality-edit" label={$isLoading ? 'Criticality' : $_('cmdb.criticality')} required value={String(values.criticality ?? 'low')} options={[{ value: 'low', label: $isLoading ? 'Low' : $_('cmdb.low') }, { value: 'med', label: $isLoading ? 'Medium' : $_('cmdb.medium') }, { value: 'high', label: $isLoading ? 'High' : $_('cmdb.high') }]} onValueChange={(v) => setValue('criticality', v)} disabled={disabled} />
      <TextField id="cmdb-ci-tags-edit" label={$isLoading ? 'Tags' : $_('cmdb.tags')} value={String(values.tags ?? '')} onValueChange={(v) => setValue('tags', v)} disabled={disabled} />
    {:else}
      <SelectField id="cmdb-rel-from-edit" label={$isLoading ? 'Source CI' : $_('cmdb.sourceCi')} required value={String(values.fromCiId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select source CI' : $_('cmdb.selectSourceCi')} error={errors.fromCiId} onValueChange={(v) => setValue('fromCiId', v)} disabled={disabled} />
      <SelectField id="cmdb-rel-to-edit" label={$isLoading ? 'Target CI' : $_('cmdb.targetCi')} required value={String(values.toCiId ?? '')} options={ciOptions} placeholder={$isLoading ? 'Select target CI' : $_('cmdb.selectTargetCi')} error={errors.toCiId} onValueChange={(v) => setValue('toCiId', v)} disabled={disabled} />
      <TextField id="cmdb-rel-type-edit" label={$isLoading ? 'Relationship type' : $_('cmdb.relType')} required value={String(values.relationType ?? '')} error={errors.relationType} onValueChange={(v) => setValue('relationType', v)} disabled={disabled} />
    {/if}
  {/snippet}
</CreateEditModal>

<DeleteConfirmModal bind:open={deleteOpen} entityName={getRowName(deletingItem ?? {})} onConfirm={deleteCurrent} />
