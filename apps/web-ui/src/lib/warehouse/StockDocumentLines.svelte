<script lang="ts">
  import type { SparePartRecord, StockDocumentLine } from '$lib/api/warehouse';
  import { getStockAvailable } from '$lib/api/warehouse';
  import { _, isLoading } from '$lib/i18n';

  let {
    lines = $bindable<StockDocumentLine[]>([]),
    parts = [],
    docType,
    warehouseId = '',
    readonly = false
  } = $props<{
    lines?: StockDocumentLine[];
    parts?: SparePartRecord[];
    docType: 'receipt' | 'issue' | 'adjust' | 'transfer';
    warehouseId?: string;
    readonly?: boolean;
  }>();

  type StockInfo = { onHand: number; reserved: number; available: number };
  let stockCache    = $state<Record<string, StockInfo>>({});
  let expandedSpec  = $state<Record<number, boolean>>({});

  const partOptions = $derived(
    parts.map((p: SparePartRecord) => ({
      id: p.id,
      label: `${p.partCode} – ${p.name}`,
      uom: p.uom ?? '—',
      spec: p.spec
    }))
  );

  const needsStockCheck = $derived(docType === 'issue' || docType === 'transfer');
  const showPrice       = $derived(docType !== 'issue');
  const showAdjDir      = $derived(docType === 'adjust');

  const totalAmount = $derived(
    lines.reduce((sum: number, l: StockDocumentLine) => sum + (l.qty ?? 0) * (l.unitCost ?? 0), 0)
  );

  // colspan for empty-state row
  const colCount = $derived(
    3 + (showPrice ? 2 : 0) + (showAdjDir ? 1 : 0) + (readonly ? 0 : 1)
  );

  async function checkStock(partId: string) {
    if (!needsStockCheck || !warehouseId || !partId || stockCache[partId]) return;
    try {
      const info = await getStockAvailable(warehouseId, partId);
      stockCache = { ...stockCache, [partId]: info };
    } catch { /* server validates on submit */ }
  }

  function getPartUom(partId: string) {
    return partOptions.find((p: { id: string }) => p.id === partId)?.uom ?? '—';
  }

  function getPartLabel(partId: string) {
    return partOptions.find((p: { id: string }) => p.id === partId)?.label ?? partId;
  }

  function getSpecForPart(partId: string): Record<string, unknown> {
    const p = parts.find((pt: SparePartRecord) => pt.id === partId);
    return (p?.spec ?? {}) as Record<string, unknown>;
  }

  function isOverStock(partId: string, qty: number): boolean {
    const av = stockCache[partId]?.available;
    return av !== undefined && qty > av;
  }

  function toggleSpec(i: number) {
    expandedSpec = { ...expandedSpec, [i]: !expandedSpec[i] };
  }

  function addLine() {
    lines = [...lines, {
      partId: '',
      qty: 1,
      unitCost: showPrice ? 0 : undefined,
      adjustDirection: showAdjDir ? 'plus' : undefined,
      specFields: null
    }];
  }

  function removeLine(i: number) {
    lines = lines.filter((_: StockDocumentLine, idx: number) => idx !== i);
  }

  function updateLine<K extends keyof StockDocumentLine>(i: number, k: K, v: StockDocumentLine[K]) {
    const n = [...lines];
    n[i] = { ...n[i], [k]: v };
    lines = n;
  }

  function updateSpecField(i: number, key: string, value: string) {
    const n = [...lines];
    n[i] = { ...n[i], specFields: { ...(n[i].specFields ?? {}), [key]: value } };
    lines = n;
  }
</script>

<!-- toolbar -->
{#if !readonly}
  <div class="mb-2 flex items-center gap-3">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      onclick={addLine}
    >
      + {$isLoading ? 'Add Line' : $_('stockDoc.addLine')}
    </button>
    {#if lines.length > 0}
      <span class="text-xs text-slate-500">{$isLoading ? lines.length + ' lines' : $_('stockDoc.lineCount', { values: { count: lines.length } })}</span>
    {/if}
  </div>
{/if}

<div class="overflow-x-auto rounded-xl border border-slate-700">
  <table class="w-full border-collapse text-sm">
    <!-- ── Head ─────────────────────────────────────────────────────────── -->
    <thead class="bg-slate-800 text-xs uppercase tracking-wide text-slate-400 select-none">
      <tr>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-9">#</th>
        <th class="border-b border-slate-700 px-3 py-2.5 text-left">{$isLoading ? 'Part Name' : $_('stockDoc.header.partName')}</th>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-14">{$isLoading ? 'Unit' : $_('stockDoc.header.unit')}</th>
        {#if showAdjDir}
          <th class="border-b border-slate-700 px-2 py-2.5 text-center w-28">{$isLoading ? 'Direction' : $_('stockDoc.header.direction')}</th>
        {/if}
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-24">{$isLoading ? 'Qty' : $_('stockDoc.header.qty')}</th>
        {#if showPrice}
          <th class="border-b border-slate-700 px-2 py-2.5 text-right w-32">{$isLoading ? 'Unit Price' : $_('stockDoc.header.unitPrice')}</th>
          <th class="border-b border-slate-700 px-2 py-2.5 text-right w-32">{$isLoading ? 'Amount' : $_('stockDoc.header.amount')}</th>
        {/if}
        <th class="border-b border-slate-700 px-2 py-2.5 text-left">{$isLoading ? 'Notes' : $_('stockDoc.header.notes')}</th>
        {#if !readonly}
          <th class="border-b border-slate-700 px-2 py-2.5 w-10"></th>
        {/if}
      </tr>
    </thead>

    <!-- ── Body ──────────────────────────────────────────────────────────── -->
    <tbody>
      {#if lines.length === 0}
        <tr>
          <td colspan={colCount} class="py-10 text-center text-slate-500 text-xs">
            {$isLoading ? 'No lines yet.' : $_('stockDoc.emptyState')}{#if !readonly} {$isLoading ? 'Click "Add Line" to start.' : $_('stockDoc.emptyHint')}{/if}
          </td>
        </tr>
      {:else}
        {#each lines as line, i}
          {@const stock    = stockCache[line.partId]}
          {@const over     = isOverStock(line.partId, line.qty)}
          {@const partSpec = getSpecForPart(line.partId)}
          {@const hasSpec  = !readonly && docType === 'receipt' && line.partId !== '' && Object.keys(partSpec).length > 0}
          {@const lineTotal = (line.qty ?? 0) * (line.unitCost ?? 0)}

          <!-- main data row -->
          <tr class="border-t border-slate-800 hover:bg-slate-800/30 transition-colors {over ? 'bg-red-950/20' : ''}">

            <td class="px-2 py-2 text-center text-slate-500 text-xs tabular-nums">{i + 1}</td>

            <!-- Part selector / display -->
            <td class="px-3 py-1.5 min-w-[200px]">
              {#if readonly}
                <span class="text-slate-200">{getPartLabel(line.partId)}</span>
              {:else}
                <select
                  aria-label="Hang hoa vat tu dong {i + 1}"
                  class="w-full rounded-md border {over ? 'border-red-500 bg-red-900/10' : 'border-slate-600 bg-slate-900'} px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  value={line.partId}
                  onchange={async (e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value;
                    updateLine(i, 'partId', v);
                    await checkStock(v);
                  }}
                >
                  <option value="">-- {$isLoading ? 'Select Part' : $_('stockDoc.selectPart')} --</option>
                  {#each partOptions as p}
                    <option value={p.id}>{p.label}</option>
                  {/each}
                </select>
              {/if}

              <!-- stock badge -->
              {#if needsStockCheck && line.partId && warehouseId}
                {#if stock}
                  <div class="mt-0.5 text-xs {over ? 'text-red-400 font-semibold' : 'text-green-400'}">
                    {$isLoading ? 'Available: ' : $_('stockDoc.available')}<strong>{stock.available}</strong>{over ? ' — ' + ($isLoading ? 'Over stock!' : $_('stockDoc.overStock')) : ''}
                  </div>
                {:else if line.partId}
                  <div class="mt-0.5 text-xs text-slate-500 animate-pulse">{$isLoading ? 'Checking...' : $_('stockDoc.checking')}</div>
                {/if}
              {/if}

              <!-- spec toggle link -->
              {#if hasSpec}
                <button
                  type="button"
                  class="mt-0.5 text-xs text-primary/70 hover:text-primary underline"
                  onclick={() => toggleSpec(i)}
                >{expandedSpec[i] ? '▲ ' + ($isLoading ? 'Hide Specs' : $_('stockDoc.hideSpecs')) : '▼ ' + ($isLoading ? 'Show Specs' : $_('stockDoc.showSpecs'))}</button>
              {/if}

              <!-- readonly spec badges -->
              {#if readonly && line.specFields && Object.keys(line.specFields).length > 0}
                <div class="mt-1 flex flex-wrap gap-1">
                  {#each Object.entries(line.specFields) as [k, v]}
                    <span class="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{k}: <strong>{String(v)}</strong></span>
                  {/each}
                </div>
              {/if}
            </td>

            <!-- ĐVT -->
            <td class="px-2 py-1.5 text-center text-slate-400 text-xs">{getPartUom(line.partId)}</td>

            <!-- Adjust direction -->
            {#if showAdjDir}
              <td class="px-2 py-1.5">
                {#if readonly}
                  <span class="text-xs">{line.adjustDirection === 'minus' ? ($isLoading ? '− Decrease' : $_('stockDoc.adjustMinus')) : ($isLoading ? '+ Increase' : $_('stockDoc.adjustPlus'))}</span>
                {:else}
                  <select
                    aria-label="Huong dieu chinh dong {i + 1}"
                    class="w-full rounded-md border border-slate-600 bg-slate-900 px-1.5 py-1 text-xs focus:border-primary focus:outline-none"
                    value={line.adjustDirection ?? 'plus'}
                    onchange={(e) => updateLine(i, 'adjustDirection', (e.currentTarget as HTMLSelectElement).value as 'plus' | 'minus')}
                  >
                    <option value="plus">{$isLoading ? '+ Increase' : $_('stockDoc.adjustPlus')}</option>
                    <option value="minus">{$isLoading ? '− Decrease' : $_('stockDoc.adjustMinus')}</option>
                  </select>
                {/if}
              </td>
            {/if}

            <!-- Qty -->
            <td class="px-2 py-1.5 text-center">
              {#if readonly}
                <span class="tabular-nums">{line.qty}</span>
              {:else}
                <input
                  type="number"
                  aria-label="So luong dong {i + 1}"
                  min="1"
                  max={needsStockCheck && stock ? stock.available : undefined}
                  class="w-full rounded-md border {over ? 'border-red-500 bg-red-900/10' : 'border-slate-600 bg-slate-900'} px-2 py-1 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                  value={line.qty}
                  oninput={(e) => updateLine(i, 'qty', Math.max(1, Number((e.currentTarget as HTMLInputElement).value)))}
                />
              {/if}
            </td>

            <!-- Unit cost -->
            {#if showPrice}
              <td class="px-2 py-1.5">
                {#if readonly}
                  <span class="tabular-nums float-right">{line.unitCost != null ? line.unitCost.toLocaleString('vi-VN') : '—'}</span>
                {:else}
                  <input
                    type="number"
                    aria-label="Don gia dong {i + 1}"
                    min="0"
                    step="1000"
                    class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-right text-sm tabular-nums focus:border-primary focus:outline-none"
                    value={line.unitCost ?? ''}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value;
                      updateLine(i, 'unitCost', v === '' ? null : Number(v));
                    }}
                  />
                {/if}
              </td>

              <!-- Line total -->
              <td class="px-2 py-1.5 text-right tabular-nums text-slate-300 font-medium">
                {line.unitCost != null ? lineTotal.toLocaleString('vi-VN') : '—'}
              </td>
            {/if}

            <!-- Serial / note -->
            <td class="px-2 py-1.5">
              {#if readonly}
                <div class="text-xs text-slate-400">
                  {#if line.serialNo}<span class="mr-2 font-mono text-slate-300">S/N: {line.serialNo}</span>{/if}
                  {line.note ?? ''}
                </div>
              {:else}
                <div class="flex gap-1.5">
                  <input
                    aria-label="Serial dong {i + 1}"
                    class="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-mono focus:border-primary focus:outline-none"
                    value={line.serialNo ?? ''}
                    placeholder="S/N..."
                    oninput={(e) => updateLine(i, 'serialNo', (e.currentTarget as HTMLInputElement).value)}
                  />
                  <input
                    aria-label="Ghi chu dong {i + 1}"
                    class="flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                    value={line.note ?? ''}
                    placeholder={$isLoading ? 'Notes...' : $_('common.notePlaceholder')}
                    oninput={(e) => updateLine(i, 'note', (e.currentTarget as HTMLInputElement).value)}
                  />
                </div>
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

          <!-- Spec fields expansion row -->
          {#if hasSpec && expandedSpec[i]}
            <tr class="border-t border-slate-800 bg-slate-900/60">
              <td colspan={colCount} class="px-4 pb-3 pt-2">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {$isLoading ? 'Specs from Catalog' : $_('stockDoc.specFromCatalog')}
                </p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {#each Object.entries(partSpec) as [key, defVal]}
                    <div>
                      <p class="mb-0.5 text-xs capitalize text-slate-500">{key.replace(/_/g, ' ')}</p>
                      <input
                        aria-label={key}
                        class="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-primary focus:outline-none"
                        value={String((line.specFields ?? {})[key] ?? defVal ?? '')}
                        placeholder={String(defVal ?? '')}
                        oninput={(e) => updateSpecField(i, key, (e.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  {/each}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      {/if}
    </tbody>

    <!-- ── Totals footer ──────────────────────────────────────────────────── -->
    {#if showPrice && lines.length > 0}
      <tfoot>
        <tr class="border-t-2 border-slate-600 bg-slate-800/70">
          <td
            colspan={showAdjDir ? 5 : 4}
            class="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {$isLoading ? 'Total' : $_('stockDoc.total')} ({lines.length}):
          </td>
          <td class="px-2 py-2.5 text-right text-sm font-bold text-primary tabular-nums">
            {totalAmount.toLocaleString('vi-VN')} ₫
          </td>
          <td colspan={readonly ? 1 : 2}></td>
        </tr>
      </tfoot>
    {/if}
  </table>
</div>
