<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui';
  import { Plus, RefreshCw, Trash2 } from 'lucide-svelte';
  import {
    importRelationships,
    listCis,
    listRelationshipTypes,
    type CiRecord,
    type CmdbRelationshipImportResult,
    type RelationshipRecord,
    type RelationshipTypeRecord
  } from '$lib/api/cmdb';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';

  type ImportRow = {
    localId: string;
    relTypeId: string;
    fromCiId: string;
    toCiId: string;
    sinceDate: string;
    note: string;
  };

  let optionLoading = $state(true);
  let submitting = $state(false);
  let submitMode = $state<'dry-run' | 'apply' | ''>('');
  let allowCycles = $state(false);
  let submitError = $state('');
  let rows = $state<ImportRow[]>([]);
  let cis = $state<CiRecord[]>([]);
  let relationshipTypes = $state<RelationshipTypeRecord[]>([]);
  let rowErrors = $state<Record<string, string>>({});
  let result = $state<CmdbRelationshipImportResult | null>(null);
  let seq = 0;

  const ciOptions = $derived(cis.map((ci) => ({ value: ci.id, label: `${ci.name} (${ci.ciCode})` })));
  const relTypeOptions = $derived(
    relationshipTypes.map((item) => ({
      value: item.id,
      label: `${item.code} - ${item.name}${item.reverseName ? ` / ${item.reverseName}` : ''}`
    }))
  );

  function nextId(): string {
    seq += 1;
    return `row-${seq}`;
  }

  function createRow(seed?: Partial<ImportRow>): ImportRow {
    return {
      localId: nextId(),
      relTypeId: seed?.relTypeId ?? '',
      fromCiId: seed?.fromCiId ?? '',
      toCiId: seed?.toCiId ?? '',
      sinceDate: seed?.sinceDate ?? '',
      note: seed?.note ?? ''
    };
  }

  async function loadOptions() {
    try {
      optionLoading = true;
      const [cisRes, relTypesRes] = await Promise.all([listCis({ limit: 1000 }), listRelationshipTypes()]);
      cis = cisRes.data ?? [];
      relationshipTypes = relTypesRes.data ?? [];
    } catch (err) {
      toast.error(err instanceof Error ? err.message : $_('cmdb.import.loadFailed'));
    } finally {
      optionLoading = false;
    }
  }

  function prefillFromQuery() {
    const fromCiId = page.url.searchParams.get('fromCiId') ?? '';
    rows = [createRow({ fromCiId })];
  }

  function addRow() {
    const last = rows[rows.length - 1];
    rows = [...rows, createRow({ relTypeId: last?.relTypeId, fromCiId: last?.fromCiId })];
  }

  function updateRow(localId: string, patch: Partial<ImportRow>) {
    rows = rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row));
    if (rowErrors[localId]) {
      const next = { ...rowErrors };
      delete next[localId];
      rowErrors = next;
    }
  }

  function removeRow(localId: string) {
    if (rows.length === 1) {
      rows = [createRow()];
      rowErrors = {};
      return;
    }
    rows = rows.filter((row) => row.localId !== localId);
    if (rowErrors[localId]) {
      const next = { ...rowErrors };
      delete next[localId];
      rowErrors = next;
    }
  }

  function fillAllFromCi(value: string) {
    rows = rows.map((row) => ({ ...row, fromCiId: value }));
    rowErrors = {};
  }

  function fillAllRelType(value: string) {
    rows = rows.map((row) => ({ ...row, relTypeId: value }));
    rowErrors = {};
  }

  function validateRows(): Array<{ relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null }> {
    const errors: Record<string, string> = {};
    const items: Array<{ relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null }> = [];

    for (const row of rows) {
      const relTypeId = row.relTypeId.trim();
      const fromCiId = row.fromCiId.trim();
      const toCiId = row.toCiId.trim();
      const note = row.note.trim();
      const sinceDate = row.sinceDate.trim();
      const isBlank = !relTypeId && !fromCiId && !toCiId && !note && !sinceDate;
      if (isBlank) continue;

      if (!relTypeId || !fromCiId || !toCiId) {
        errors[row.localId] = $_('cmdb.import.selectRelTypeRequired');
        continue;
      }
      if (fromCiId === toCiId) {
        errors[row.localId] = $_('cmdb.import.sameFromTo');
        continue;
      }

      items.push({
        relTypeId,
        fromCiId,
        toCiId,
        sinceDate: sinceDate || null,
        note: note || null
      });
    }

    if (items.length === 0) {
      throw new Error($_('cmdb.import.noValidRows'));
    }

    rowErrors = errors;
    if (Object.keys(errors).length > 0) {
      throw new Error($_('cmdb.import.fixErrorsFirst'));
    }
    return items;
  }

  function ciName(id: string): string {
    const item = cis.find((ci) => ci.id === id);
    return item ? `${item.name} (${item.ciCode})` : id;
  }

  function relTypeName(id: string): string {
    const item = relationshipTypes.find((type) => type.id === id);
    return item ? item.name : id;
  }

  function parseImportError(err: unknown): { message: string; parsed: CmdbRelationshipImportResult | null } {
    if (!(err instanceof Error)) return { message: $_('cmdb.import.importFailed'), parsed: null };
    const message = err.message || $_('cmdb.import.importFailed');
    try {
      const payload = JSON.parse(message) as { data?: unknown; error?: { message?: string }; message?: string };
      const data = payload?.data as Partial<CmdbRelationshipImportResult> | undefined;
      if (data && typeof data.total === 'number' && Array.isArray(data.errors) && Array.isArray(data.created)) {
        return { message: payload.error?.message ?? payload.message ?? $_('cmdb.import.importErrors'), parsed: data as CmdbRelationshipImportResult };
      }
    } catch {
      // ignore
    }
    return { message, parsed: null };
  }

  async function runImport(dryRun: boolean) {
    try {
      submitting = true;
      submitMode = dryRun ? 'dry-run' : 'apply';
      submitError = '';
      result = null;

      const items = validateRows();
      const res = await importRelationships({ dryRun, allowCycles, items });
      result = res.data ?? null;
      toast.success(dryRun ? $_('cmdb.import.dryRunComplete') : $_('cmdb.import.importSuccess'));
    } catch (err) {
      const parsed = parseImportError(err);
      submitError = parsed.message;
      if (parsed.parsed) {
        result = parsed.parsed;
      }
      toast.error(parsed.message);
    } finally {
      submitting = false;
      submitMode = '';
    }
  }

  onMount(() => {
    prefillFromQuery();
    void loadOptions();
  });
</script>

<div class="page-shell page-content">
  <PageHeader title={$_('cmdb.import.title')} subtitle={$_('cmdb.import.rowCount', { values: { count: rows.length } })}>
    {#snippet actions()}
      <Button variant="secondary" onclick={addRow}>
        <Plus class="mr-2 h-4 w-4" /> {$_('cmdb.import.addRow')}
      </Button>
      <Button variant="secondary" onclick={loadOptions}>
        <RefreshCw class="h-4 w-4" />
      </Button>
      <a href="/cmdb" class="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{$_('cmdb.import.backToCmdb')}</a>
    {/snippet}
  </PageHeader>

  <div class="mb-4 rounded-xl border border-slate-800 bg-surface-1 p-4">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="space-y-1">
        <label for="bulk-reltype" class="block text-sm font-medium text-slate-700 dark:text-slate-300">{$_('cmdb.import.applyRelType')}</label>
        <select id="bulk-reltype" class="w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm" onchange={(e) => fillAllRelType((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">{$_('cmdb.import.selectDefault')}</option>
          {#each relTypeOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1">
        <label for="bulk-from-ci" class="block text-sm font-medium text-slate-700 dark:text-slate-300">{$_('cmdb.import.applyFromCi')}</label>
        <select id="bulk-from-ci" class="w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm" onchange={(e) => fillAllFromCi((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">{$_('cmdb.import.selectDefault')}</option>
          {#each ciOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <label class="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input type="checkbox" bind:checked={allowCycles} class="rounded border-slate-300" />
        {$_('cmdb.import.allowCycles')}
      </label>
      <div class="flex items-end gap-2">
        <Button variant="secondary" class="flex-1" disabled={submitting} onclick={() => runImport(true)}>
          {submitMode === 'dry-run' ? $_('cmdb.import.running') : $_('cmdb.import.dryRun')}
        </Button>
        <Button class="flex-1" disabled={submitting} onclick={() => runImport(false)}>
          {submitMode === 'apply' ? $_('cmdb.import.importing') : $_('cmdb.import.import')}
        </Button>
      </div>
    </div>
    {#if submitError}
      <div class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>
    {/if}
  </div>

  <div class="overflow-hidden rounded-xl border border-slate-800 bg-surface-1">
    {#if optionLoading}
      <div class="flex items-center justify-center p-8"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-left text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th class="px-3 py-2">#</th>
              <th class="px-3 py-2">{$_('cmdb.import.relType')}</th>
              <th class="px-3 py-2">{$_('cmdb.import.fromCi')}</th>
              <th class="px-3 py-2">{$_('cmdb.import.toCi')}</th>
              <th class="px-3 py-2">{$_('cmdb.import.sinceDate')}</th>
              <th class="px-3 py-2">{$_('cmdb.import.note')}</th>
              <th class="px-3 py-2 text-right">{$_('cmdb.import.action')}</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, index}
              <tr class="border-t border-slate-100 align-top dark:border-slate-800">
                <td class="px-3 py-2 text-xs text-slate-500">{index + 1}</td>
                <td class="px-3 py-2">
                  <select class="w-56 rounded-lg border border-slate-700 bg-surface-1 px-2 py-1.5 text-sm" value={row.relTypeId} onchange={(e) => updateRow(row.localId, { relTypeId: (e.currentTarget as HTMLSelectElement).value })}>
                    <option value="">{$_('cmdb.import.selectType')}</option>
                    {#each relTypeOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-3 py-2">
                  <select class="w-56 rounded-lg border border-slate-700 bg-surface-1 px-2 py-1.5 text-sm" value={row.fromCiId} onchange={(e) => updateRow(row.localId, { fromCiId: (e.currentTarget as HTMLSelectElement).value })}>
                    <option value="">{$_('cmdb.import.selectCi')}</option>
                    {#each ciOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-3 py-2">
                  <select class="w-56 rounded-lg border border-slate-700 bg-surface-1 px-2 py-1.5 text-sm" value={row.toCiId} onchange={(e) => updateRow(row.localId, { toCiId: (e.currentTarget as HTMLSelectElement).value })}>
                    <option value="">{$_('cmdb.import.selectCi')}</option>
                    {#each ciOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-3 py-2">
                  <input type="date" class="w-36 rounded-lg border border-slate-700 bg-surface-1 px-2 py-1.5 text-sm" value={row.sinceDate} onchange={(e) => updateRow(row.localId, { sinceDate: (e.currentTarget as HTMLInputElement).value })} />
                </td>
                <td class="px-3 py-2">
                  <input type="text" class="w-64 rounded-lg border border-slate-700 bg-surface-1 px-2 py-1.5 text-sm" value={row.note} placeholder={$_('cmdb.import.optionalNote')} oninput={(e) => updateRow(row.localId, { note: (e.currentTarget as HTMLInputElement).value })} />
                  {#if rowErrors[row.localId]}
                    <div class="mt-1 text-xs text-red-600">{rowErrors[row.localId]}</div>
                  {/if}
                </td>
                <td class="px-3 py-2 text-right">
                  <Button size="sm" variant="danger" onclick={() => removeRow(row.localId)} aria-label={`remove-row-${index + 1}`}>
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  {#if result}
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-800 bg-surface-1 p-4">
        <div class="mb-3 flex items-center gap-2">
          <h2 class="text-lg font-semibold">{$_('cmdb.import.result')}</h2>
          <span class={result.dryRun ? 'badge-info' : 'badge-success'}>{result.dryRun ? $_('cmdb.import.dryRunBadge') : $_('cmdb.import.importedBadge')}</span>
        </div>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div><dt class="text-xs uppercase text-slate-500">{$_('cmdb.import.total')}</dt><dd class="mt-1 text-sm">{result.total}</dd></div>
          <div><dt class="text-xs uppercase text-slate-500">{$_('cmdb.import.created')}</dt><dd class="mt-1 text-sm">{result.created.length}</dd></div>
          <div><dt class="text-xs uppercase text-slate-500">{$_('cmdb.import.errors')}</dt><dd class="mt-1 text-sm">{result.errors.length}</dd></div>
          <div><dt class="text-xs uppercase text-slate-500">{$_('cmdb.import.mode')}</dt><dd class="mt-1 text-sm">{result.dryRun ? $_('cmdb.import.dryRunMode') : $_('cmdb.import.applyMode')}</dd></div>
        </dl>

        {#if result.errors.length > 0}
          <div class="mt-4">
            <h3 class="mb-2 text-sm font-semibold">{$_('cmdb.import.errors')}</h3>
            <div class="max-h-56 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2">
              {#each result.errors as item}
                <div class="border-b border-red-100 px-2 py-1 text-sm text-red-700 last:border-b-0">
                  <span class="font-semibold">{$_('cmdb.import.rowLabel', { values: { index: item.index + 1 } })}</span> {item.message}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-xl border border-slate-800 bg-surface-1 p-4">
        <h2 class="mb-3 text-lg font-semibold">{$_('cmdb.import.createdRelationships')}</h2>
        {#if result.created.length === 0}
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/70">
            {$_('cmdb.import.noRows')}
          </div>
        {:else}
          <div class="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-100 text-left text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th class="px-3 py-2">{$_('cmdb.import.type')}</th>
                  <th class="px-3 py-2">{$_('cmdb.import.from')}</th>
                  <th class="px-3 py-2">{$_('cmdb.import.to')}</th>
                  <th class="px-3 py-2">{$_('cmdb.import.note')}</th>
                </tr>
              </thead>
              <tbody>
                {#each result.created as rel}
                  <tr class="border-t border-slate-100 dark:border-slate-800">
                    <td class="px-3 py-2">{relTypeName((rel as RelationshipRecord).relTypeId)}</td>
                    <td class="px-3 py-2">{ciName((rel as RelationshipRecord).fromCiId)}</td>
                    <td class="px-3 py-2">{ciName((rel as RelationshipRecord).toCiId)}</td>
                    <td class="px-3 py-2 text-xs">{(rel as RelationshipRecord).note ?? '-'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
