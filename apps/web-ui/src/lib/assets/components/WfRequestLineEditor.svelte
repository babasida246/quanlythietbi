<script lang="ts">
  import type { SparePartRecord } from '$lib/api/warehouse';
  import type { Asset } from '$lib/api/assets';
  import type { WfRequestLineItemType, CreateWfRequestLineInput } from '$lib/api/wf';
  import { _, isLoading } from '$lib/i18n';

  /**
   * Bi-directionally bound array of request line drafts.
   * The parent passes this as `bind:lines={myLines}` and reads it on submit.
   */
  let {
    lines = $bindable<CreateWfRequestLineInput[]>([]),
    parts   = [] as SparePartRecord[],
    assets  = [] as Asset[],
    readonly = false,
  } = $props<{
    lines?: CreateWfRequestLineInput[];
    parts?: SparePartRecord[];
    assets?: Asset[];
    readonly?: boolean;
  }>();

  // ── Derived option lists ─────────────────────────────────────────────────

  const partOptions = $derived(
    parts.map((p: SparePartRecord) => ({ id: p.id, label: `${p.partCode} – ${p.name}`, uom: p.uom ?? '—' }))
  );

  const assetOptions = $derived(
    assets.map((a: Asset) => ({
      id:    a.id,
      label: `${a.assetCode} – ${a.modelName ?? a.modelId ?? '?'}`,
    }))
  );

  // Column count for empty-state row colspan
  const colCount = $derived(4 + (readonly ? 0 : 1));

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getPartLabel(partId: string): string {
    return partOptions.find((p: { id: string }) => p.id === partId)?.label ?? partId;
  }

  function getAssetLabel(assetId: string): string {
    return assetOptions.find((a: { id: string }) => a.id === assetId)?.label ?? assetId;
  }

  function getPartUom(partId: string): string {
    return partOptions.find((p: { id: string }) => p.id === partId)?.uom ?? '—';
  }

  function itemLabel(line: CreateWfRequestLineInput): string {
    if (line.itemType === 'part')    return line.partId  ? getPartLabel(line.partId)   : '—';
    if (line.itemType === 'asset')   return line.assetId ? getAssetLabel(line.assetId) : '—';
    return line.note ?? $_('wfRequest.service');
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function addLine() {
    lines = [
      ...lines,
      { itemType: 'part', partId: undefined, assetId: undefined, requestedQty: 1, note: '' },
    ];
  }

  function removeLine(i: number) {
    lines = lines.filter((_: CreateWfRequestLineInput, idx: number) => idx !== i);
  }

  function updateLine<K extends keyof CreateWfRequestLineInput>(
    i: number,
    k: K,
    v: CreateWfRequestLineInput[K]
  ) {
    const n = [...lines];
    n[i] = { ...n[i], [k]: v };
    lines = n;
  }

  function changeItemType(i: number, type: WfRequestLineItemType) {
    const n = [...lines];
    // Clear the previous item id when switching types
    n[i] = { ...n[i], itemType: type, partId: undefined, assetId: undefined };
    lines = n;
  }
</script>

<!-- ── Toolbar ────────────────────────────────────────────────────────────── -->
{#if !readonly}
  <div class="mb-2 flex items-center gap-3">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      onclick={addLine}
    >
      + {$isLoading ? 'Add Line' : $_('wfRequest.addLine')}
    </button>
    {#if lines.length > 0}
      <span class="text-xs text-slate-500">{$isLoading ? lines.length + ' lines' : $_('wfRequest.lineCount', { values: { count: lines.length } })}</span>
    {/if}
  </div>
{/if}

<!-- ── Table ──────────────────────────────────────────────────────────────── -->
<div class="overflow-x-auto rounded-xl border border-slate-700">
  <table class="w-full border-collapse text-sm">

    <!-- Head -->
    <thead class="bg-slate-800 text-xs uppercase tracking-wide text-slate-400 select-none">
      <tr>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-9">#</th>
        <th class="border-b border-slate-700 px-3 py-2.5 text-left w-28">{$isLoading ? 'Type' : $_('wfRequest.header.type')}</th>
        <th class="border-b border-slate-700 px-3 py-2.5 text-left">{$isLoading ? 'Part / Asset / Service' : $_('wfRequest.header.partName')}</th>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-24">{$isLoading ? 'Qty' : $_('wfRequest.header.qty')}</th>
        <th class="border-b border-slate-700 px-3 py-2.5 text-left">{$isLoading ? 'Notes' : $_('wfRequest.header.notes')}</th>
        {#if !readonly}
          <th class="border-b border-slate-700 px-2 py-2.5 w-10"></th>
        {/if}
      </tr>
    </thead>

    <!-- Body -->
    <tbody>
      {#if lines.length === 0}
        <tr>
          <td colspan={colCount} class="py-10 text-center text-slate-500 text-xs">
            {$isLoading ? 'No lines yet.' : $_('wfRequest.emptyState')}{#if !readonly} {$isLoading ? 'Click "Add Line" to start.' : $_('wfRequest.emptyHint')}{/if}
          </td>
        </tr>
      {:else}
        {#each lines as line, i}
          <tr class="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">

            <!-- # -->
            <td class="px-2 py-2 text-center text-slate-500 text-xs tabular-nums">{i + 1}</td>

            <!-- Item type -->
            <td class="px-3 py-1.5">
              {#if readonly}
                <span class="badge badge-blue text-xs">
                  {line.itemType === 'part' ? ($isLoading ? 'Part' : $_('wfRequest.part')) : line.itemType === 'asset' ? ($isLoading ? 'Asset' : $_('wfRequest.asset')) : ($isLoading ? 'Service' : $_('wfRequest.service'))}
                </span>
              {:else}
                <select
                  aria-label="Loai dong {i + 1}"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  value={line.itemType}
                  onchange={(e) => changeItemType(i, (e.currentTarget as HTMLSelectElement).value as WfRequestLineItemType)}
                >
                  <option value="part">{$isLoading ? 'Part' : $_('wfRequest.part')}</option>
                  <option value="asset">{$isLoading ? 'Asset' : $_('wfRequest.asset')}</option>
                  <option value="service">{$isLoading ? 'Service' : $_('wfRequest.service')}</option>
                </select>
              {/if}
            </td>

            <!-- Item selector / display -->
            <td class="px-3 py-1.5 min-w-[220px]">
              {#if readonly}
                <span class="text-slate-200">{itemLabel(line)}</span>
              {:else if line.itemType === 'part'}
                <select
                  aria-label="Vat tu dong {i + 1}"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  value={line.partId ?? ''}
                  onchange={(e) => updateLine(i, 'partId', (e.currentTarget as HTMLSelectElement).value || undefined)}
                >
                  <option value="">-- {$isLoading ? 'Select Part' : $_('wfRequest.selectPart')} --</option>
                  {#each partOptions as p}
                    <option value={p.id}>{p.label}</option>
                  {/each}
                </select>
                {#if line.partId}
                  <div class="mt-0.5 text-xs text-slate-500">{$isLoading ? 'Unit: ' : $_('wfRequest.header.unit') + ': '}{getPartUom(line.partId)}</div>
                {/if}
              {:else if line.itemType === 'asset'}
                <select
                  aria-label="Thiet bi dong {i + 1}"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  value={line.assetId ?? ''}
                  onchange={(e) => updateLine(i, 'assetId', (e.currentTarget as HTMLSelectElement).value || undefined)}
                >
                  <option value="">-- {$isLoading ? 'Select Asset' : $_('wfRequest.selectAsset')} --</option>
                  {#each assetOptions as a}
                    <option value={a.id}>{a.label}</option>
                  {/each}
                </select>
              {:else}
                <!-- service: description goes in note -->
                <span class="text-xs text-slate-500 italic">{$isLoading ? 'Description in note column →' : $_('wfRequest.serviceNote')}</span>
              {/if}
            </td>

            <!-- Qty -->
            <td class="px-2 py-1.5 text-center">
              {#if readonly}
                <span class="tabular-nums">{line.requestedQty}</span>
              {:else}
                <input
                  type="number"
                  aria-label="So luong dong {i + 1}"
                  min="1"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                  value={line.requestedQty}
                  oninput={(e) => updateLine(i, 'requestedQty', Math.max(1, Number((e.currentTarget as HTMLInputElement).value)))}
                />
              {/if}
            </td>

            <!-- Note -->
            <td class="px-2 py-1.5">
              {#if readonly}
                <span class="text-xs text-slate-400">{line.note ?? ''}</span>
              {:else}
                <input
                  aria-label="Ghi chu dong {i + 1}"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  value={line.note ?? ''}
                  placeholder={$isLoading ? 'Notes...' : $_('common.notePlaceholder')}
                  oninput={(e) => updateLine(i, 'note', (e.currentTarget as HTMLInputElement).value)}
                />
              {/if}
            </td>

            <!-- Delete -->
            {#if !readonly}
              <td class="px-2 py-1.5 text-center">
                <button
                  type="button"
                  aria-label="Xoa dong {i + 1}"
                  class="rounded-md p-1 text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-colors"
                  onclick={() => removeLine(i)}
                >✕</button>
              </td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
