<script lang="ts">
  import type { SparePartRecord, SparePartSearchResult, StockDocumentLine, WarehouseAssetOption } from '$lib/api/warehouse';
  import { getStockAvailable } from '$lib/api/warehouse';
  import { _, isLoading } from '$lib/i18n';
  import OcrScanModal from '$lib/components/OcrScanModal.svelte';
  import { ScanLine } from 'lucide-svelte';

  type ModelOption = { id: string; name: string; categoryName?: string | null };

  let {
    lines = $bindable<StockDocumentLine[]>([]),
    parts = [],
    models = [],
    warehouseAssets = [],
    docType,
    warehouseId = '',
    readonly = false
  } = $props<{
    lines?: StockDocumentLine[];
    parts?: SparePartRecord[];
    models?: ModelOption[];
    warehouseAssets?: WarehouseAssetOption[];
    docType: 'receipt' | 'issue' | 'adjust' | 'transfer';
    warehouseId?: string;
    readonly?: boolean;
  }>();

  type StockInfo = { onHand: number; reserved: number; available: number };
  let stockCache   = $state<Record<string, StockInfo>>({});
  let expandedSpec = $state<Record<number, boolean>>({});

  const partOptions = $derived(
    parts.map((p: SparePartRecord) => ({
      id: p.id,
      label: `${p.partCode} – ${p.name}`,
      uom: p.uom ?? '—',
      category: p.category ?? '—',
      spec: p.spec
    }))
  );

  const needsStockCheck = $derived(docType === 'issue' || docType === 'transfer');
  const showPrice       = $derived(docType !== 'issue');
  const showAdjDir      = $derived(docType === 'adjust');

  const totalAmount = $derived(
    lines.reduce((sum: number, l: StockDocumentLine) => sum + (l.qty ?? 0) * (l.unitCost ?? 0), 0)
  );

  const colCount = $derived(
    5 + (showPrice ? 2 : 0) + (showAdjDir ? 1 : 0) + (readonly ? 0 : 1)
  );

  async function checkStock(partId: string) {
    if (!needsStockCheck || !warehouseId || !partId || stockCache[partId]) return;
    try {
      const info = await getStockAvailable(warehouseId, partId);
      stockCache = { ...stockCache, [partId]: info };
    } catch { /* server validates on submit */ }
  }

  type PartOption = { id: string; label: string; uom: string; category: string; spec: unknown }
  function getPartUom(partId: string)      { return partOptions.find((p: PartOption) => p.id === partId)?.uom ?? '—'; }
  function getPartCategory(partId: string) { return partOptions.find((p: PartOption) => p.id === partId)?.category ?? '—'; }
  function getPartLabel(partId: string)    { return partOptions.find((p: PartOption) => p.id === partId)?.label ?? partId; }
  function getSpecForPart(partId: string): Record<string, unknown> {
    return (parts.find((pt: SparePartRecord) => pt.id === partId)?.spec ?? {}) as Record<string, unknown>;
  }
  function isOverStock(partId: string, qty: number): boolean {
    const av = stockCache[partId]?.available;
    return av !== undefined && qty > av;
  }
  function toggleSpec(i: number) { expandedSpec = { ...expandedSpec, [i]: !expandedSpec[i] }; }

  let ocrOpen = $state(false)

  function handleOcrSelect(part: SparePartSearchResult) {
    lines = [...lines, {
      lineType: 'spare_part',
      partId: part.id,
      qty: 1,
      unitCost: showPrice ? (part.unitCost ?? 0) : undefined,
      adjustDirection: showAdjDir ? 'plus' : undefined,
      specFields: null
    }]
  }

  function addSparePartLine() {
    lines = [...lines, {
      lineType: 'spare_part',
      partId: '',
      qty: 1,
      unitCost: showPrice ? 0 : undefined,
      adjustDirection: showAdjDir ? 'plus' : undefined,
      specFields: null
    }];
  }

  function addAssetLine() {
    lines = [...lines, {
      lineType: 'asset',
      partId: undefined,
      assetModelId: '',
      assetName: '',
      assetCode: '',
      assetId: '',
      qty: 1,
      unitCost: showPrice ? 0 : undefined,
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

  function getAssetLabel(assetId: string | null | undefined) {
    if (!assetId) return '—';
    const a = warehouseAssets.find((a: WarehouseAssetOption) => a.id === assetId);
    if (!a) return assetId;
    return `${a.assetCode}${a.serialNo ? ' · ' + a.serialNo : ''}${a.modelName ? ' · ' + a.modelName : ''}`;
  }

  function getModelCategory(modelId: string | null | undefined) {
    return models.find((m: ModelOption) => m.id === modelId)?.categoryName ?? '—';
  }
</script>

<!-- toolbar -->
{#if !readonly}
  <div class="mb-2 flex items-center gap-3 flex-wrap">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      onclick={addSparePartLine}
    >
      {$isLoading ? '+ Add Part Line' : $_('stockDoc.addLine')}
    </button>
    {#if docType !== 'adjust'}
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        onclick={addAssetLine}
      >
        {$isLoading ? '+ Add Asset Line' : $_('stockDoc.addAssetLine')}
      </button>
    {/if}
    <!-- OCR scan button: available for spare part scanning on any doc type -->
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
      onclick={() => (ocrOpen = true)}
      title={$isLoading ? 'Quét tem sản phẩm bằng OCR' : $_('ocr.scanBtnTitle')}
    >
      <ScanLine class="h-4 w-4" />
      {$isLoading ? 'Quét tem' : $_('ocr.scanBtn')}
    </button>
    {#if lines.length > 0}
      <span class="text-xs text-slate-500">{$isLoading ? lines.length + ' lines' : $_('stockDoc.lineCount', { values: { count: lines.length } })}</span>
    {/if}
  </div>
{/if}

<OcrScanModal bind:open={ocrOpen} onSelect={handleOcrSelect} />

<div class="overflow-x-auto rounded-xl border border-slate-700">
  <table class="w-full border-collapse text-sm">
    <thead class="bg-slate-800 text-xs uppercase tracking-wide text-slate-400 select-none">
      <tr>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-9">#</th>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-24">{$isLoading ? 'Type' : $_('stockDoc.header.lineType')}</th>
        <th class="border-b border-slate-700 px-3 py-2.5 text-left">{$isLoading ? 'Item' : $_('stockDoc.header.partName')}</th>
        <th class="border-b border-slate-700 px-2 py-2.5 text-left w-28">{$isLoading ? 'Category' : $_('stockDoc.header.category')}</th>
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-14">{$isLoading ? 'Unit' : $_('stockDoc.header.unit')}</th>
        {#if showAdjDir}
          <th class="border-b border-slate-700 px-2 py-2.5 text-center w-28">{$isLoading ? 'Direction' : $_('stockDoc.header.direction')}</th>
        {/if}
        <th class="border-b border-slate-700 px-2 py-2.5 text-center w-20">{$isLoading ? 'Qty' : $_('stockDoc.header.qty')}</th>
        {#if showPrice}
          <th class="border-b border-slate-700 px-2 py-2.5 text-right w-32">{$isLoading ? 'Unit Price' : $_('stockDoc.header.unitPrice')}</th>
          <th class="border-b border-slate-700 px-2 py-2.5 text-right w-32">{$isLoading ? 'Amount' : $_('stockDoc.header.amount')}</th>
        {/if}
        <th class="border-b border-slate-700 px-2 py-2.5 text-left">{$isLoading ? 'Notes / S/N' : $_('stockDoc.header.notes')}</th>
        {#if !readonly}
          <th class="border-b border-slate-700 px-2 py-2.5 w-10"></th>
        {/if}
      </tr>
    </thead>

    <tbody>
      {#if lines.length === 0}
        <tr>
          <td colspan={colCount} class="py-10 text-center text-slate-500 text-xs">
            {$isLoading ? 'No lines yet.' : $_('stockDoc.emptyState')}{#if !readonly} {$isLoading ? 'Click "+ Add" to start.' : $_('stockDoc.emptyHint')}{/if}
          </td>
        </tr>
      {:else}
        {#each lines as line, i}
          {@const isAssetLine  = line.lineType === 'asset'}
          {@const stock        = stockCache[line.partId ?? '']}
          {@const over         = !isAssetLine && isOverStock(line.partId ?? '', line.qty)}
          {@const partSpec     = !isAssetLine ? getSpecForPart(line.partId ?? '') : {}}
          {@const hasSpec      = !readonly && docType === 'receipt' && !isAssetLine && (line.partId ?? '') !== '' && Object.keys(partSpec).length > 0}
          {@const lineTotal    = (line.qty ?? 0) * (line.unitCost ?? 0)}

          <tr class="border-t border-slate-800 hover:bg-slate-800/30 transition-colors {over ? 'bg-red-950/20' : ''} {isAssetLine ? 'bg-amber-950/10' : ''}">

            <td class="px-2 py-2 text-center text-slate-500 text-xs tabular-nums">{i + 1}</td>

            <!-- Line type indicator/toggle -->
            <td class="px-2 py-1.5 text-center">
              {#if readonly}
                <span class="rounded-full px-2 py-0.5 text-xs font-medium {isAssetLine ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-700 text-slate-300'}">
                  {isAssetLine ? ($isLoading ? 'Asset' : $_('stockDoc.lineTypeAsset')) : ($isLoading ? 'Part' : $_('stockDoc.lineTypeSparePart'))}
                </span>
              {:else}
                <select
                  aria-label="Loai dong {i + 1}"
                  class="w-full rounded-md border border-slate-600 bg-slate-900 px-1.5 py-1 text-xs focus:border-primary focus:outline-none"
                  value={line.lineType ?? 'spare_part'}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as 'spare_part' | 'asset';
                    const n = [...lines];
                    n[i] = { qty: line.qty, lineType: v, partId: v === 'spare_part' ? '' : undefined,
                              assetModelId: v === 'asset' ? '' : undefined,
                              assetId: v === 'asset' ? '' : undefined,
                              unitCost: showPrice ? (line.unitCost ?? 0) : undefined,
                              adjustDirection: showAdjDir ? 'plus' : undefined, specFields: null };
                    lines = n;
                  }}
                >
                  <option value="spare_part">{$isLoading ? 'Part' : $_('stockDoc.lineTypeSparePart')}</option>
                  <option value="asset">{$isLoading ? 'Asset' : $_('stockDoc.lineTypeAsset')}</option>
                </select>
              {/if}
            </td>

            <!-- Item selector -->
            <td class="px-3 py-1.5 min-w-[200px]">
              {#if isAssetLine}
                <!-- ── Asset line ──────────────────────────────────── -->
                {#if docType === 'issue' || docType === 'transfer'}
                  <!-- Issue: pick existing asset from warehouse -->
                  {#if readonly}
                    <span class="text-slate-200">{getAssetLabel(line.assetId)}</span>
                  {:else}
                    <select
                      aria-label="Chon tai san dong {i + 1}"
                      class="w-full rounded-md border border-amber-600/50 bg-slate-900 px-2 py-1 text-sm focus:border-amber-400 focus:outline-none"
                      value={line.assetId ?? ''}
                      onchange={(e) => updateLine(i, 'assetId', (e.currentTarget as HTMLSelectElement).value)}
                    >
                      <option value="">-- {$isLoading ? 'Select Asset' : $_('stockDoc.selectAsset')} --</option>
                      {#each warehouseAssets as a}
                        <option value={a.id}>{a.assetCode}{a.serialNo ? ' · ' + a.serialNo : ''}{a.modelName ? ' · ' + a.modelName : ''}</option>
                      {/each}
                    </select>
                    {#if warehouseAssets.length === 0 && warehouseId}
                      <p class="mt-0.5 text-xs text-amber-500">{$isLoading ? 'No assets in stock' : $_('stockDoc.noAssetsInStock')}</p>
                    {/if}
                  {/if}
                {:else}
                  <!-- Receipt: identify new asset to create -->
                  {#if readonly}
                    <div>
                      <span class="text-slate-200">{line.assetName || line.assetCode || '—'}</span>
                      {#if line.assetId}
                        <span class="ml-2 text-xs text-amber-400 font-mono">{line.assetCode}</span>
                      {/if}
                    </div>
                  {:else}
                    <div class="space-y-1">
                      <select
                        aria-label="Model thiet bi dong {i + 1}"
                        class="w-full rounded-md border border-amber-600/50 bg-slate-900 px-2 py-1 text-sm focus:border-amber-400 focus:outline-none"
                        value={line.assetModelId ?? ''}
                        onchange={(e) => updateLine(i, 'assetModelId', (e.currentTarget as HTMLSelectElement).value)}
                      >
                        <option value="">-- {$isLoading ? 'Select Model' : $_('stockDoc.selectModel')} --</option>
                        {#each models as m}
                          <option value={m.id}>{m.name}{m.categoryName ? ' · ' + m.categoryName : ''}</option>
                        {/each}
                      </select>
                      <input
                        aria-label="Ten tai san dong {i + 1}"
                        class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        value={line.assetName ?? ''}
                        placeholder={$isLoading ? 'Asset name (optional)' : $_('stockDoc.assetNamePlaceholder')}
                        oninput={(e) => updateLine(i, 'assetName', (e.currentTarget as HTMLInputElement).value)}
                      />
                      <input
                        aria-label="Ma tai san dong {i + 1}"
                        class="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-mono focus:border-primary focus:outline-none"
                        value={line.assetCode ?? ''}
                        placeholder={$isLoading ? 'Asset code (auto if blank)' : $_('stockDoc.assetCodePlaceholder')}
                        oninput={(e) => updateLine(i, 'assetCode', (e.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  {/if}
                {/if}

              {:else}
                <!-- ── Spare-part line ──────────────────────────────── -->
                {#if readonly}
                  <span class="text-slate-200">{getPartLabel(line.partId ?? '')}</span>
                {:else}
                  <select
                    aria-label="Hang hoa vat tu dong {i + 1}"
                    class="w-full rounded-md border {over ? 'border-red-500 bg-red-900/10' : 'border-slate-600 bg-slate-900'} px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    value={line.partId ?? ''}
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

                <!-- stock badge (spare-part) -->
                {#if needsStockCheck && (line.partId ?? '') && warehouseId}
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
                  >{expandedSpec[i] ? ($isLoading ? '▲ Hide Specs' : $_('stockDoc.hideSpecs')) : ($isLoading ? '▼ Show Specs' : $_('stockDoc.showSpecs'))}</button>
                {/if}

                {#if readonly && line.specFields && Object.keys(line.specFields).length > 0}
                  <div class="mt-1 flex flex-wrap gap-1">
                    {#each Object.entries(line.specFields) as [k, v]}
                      <span class="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{k}: <strong>{String(v)}</strong></span>
                    {/each}
                  </div>
                {/if}
              {/if}
            </td>

            <!-- Category -->
            <td class="px-2 py-1.5 text-xs text-slate-400">
              {#if isAssetLine}
                {getModelCategory(line.assetModelId)}
              {:else}
                {getPartCategory(line.partId ?? '')}
              {/if}
            </td>

            <!-- Unit -->
            <td class="px-2 py-1.5 text-center text-slate-400 text-xs">
              {#if isAssetLine}—{:else}{getPartUom(line.partId ?? '')}{/if}
            </td>

            <!-- Adjust direction -->
            {#if showAdjDir}
              <td class="px-2 py-1.5">
                {#if isAssetLine || readonly}
                  <span class="text-xs text-slate-500">—</span>
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

            <!-- Qty (always 1 for asset lines on issue; editable on receipt) -->
            <td class="px-2 py-1.5 text-center">
              {#if readonly || (isAssetLine && (docType === 'issue' || docType === 'transfer'))}
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
                    class="w-28 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-mono focus:border-primary focus:outline-none"
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

          <!-- Spec expansion row (spare-part only) -->
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

    {#if showPrice && lines.length > 0}
      <tfoot>
        <tr class="border-t-2 border-slate-600 bg-slate-800/70">
          <td
            colspan={showAdjDir ? 7 : 6}
            class="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {$isLoading ? `Total (${lines.length}):` : $_('stockDoc.total', { values: { count: lines.length } })}
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
