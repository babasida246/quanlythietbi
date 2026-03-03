<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	import type { InventoryDocumentLine, InventoryItem, WarehouseLocation, UOM, InventoryLot, ItemUOMConversion } from '$lib/types/inventory';
	import EntitySelect from './EntitySelect.svelte';
	import UomInput from './UomInput.svelte';
	import MoneyInput from './MoneyInput.svelte';

	let {
		lines = $bindable<Partial<InventoryDocumentLine>[]>([]),
		items = [],
		locations = [],
		uoms = [],
		lots = [],
		docType,
		readonly = false,
		onupdate,
		onstockcheck
	} = $props<{
		lines?: Partial<InventoryDocumentLine>[];
		items?: InventoryItem[];
		locations?: WarehouseLocation[];
		uoms?: UOM[];
		lots?: InventoryLot[];
		docType: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUST' | 'STOCKTAKE';
		readonly?: boolean;
		onupdate?: (lines: Partial<InventoryDocumentLine>[]) => void;
		onstockcheck?: (data: { lineNo: number; itemId: string; locationId?: string; quantity: number }) => void;
	}>();

	function addLine() {
		const newLine: Partial<InventoryDocumentLine> = {
			lineNo: lines.length + 1,
			itemId: '',
			quantity: 0
		};
		
		if (docType === 'TRANSFER') {
			newLine.sourceLocationId = '';
			newLine.targetLocationId = '';
		} else if (docType === 'RECEIPT' || docType === 'STOCKTAKE') {
			newLine.targetLocationId = '';
		} else if (docType === 'ISSUE') {
			newLine.sourceLocationId = '';
		}
		
		lines = [...lines, newLine];
		onupdate?.(lines);
	}

	function removeLine(index: number) {
		lines = lines.filter((_: Partial<InventoryDocumentLine>, i: number) => i !== index);
		// Renumber lines
		lines = lines.map((line: Partial<InventoryDocumentLine>, i: number) => ({ ...line, lineNo: i + 1 }));
		onupdate?.(lines);
	}

	function updateLine<K extends keyof InventoryDocumentLine>(
		index: number,
		field: K,
		value: InventoryDocumentLine[K]
	) {
		lines[index] = { ...lines[index], [field]: value };
		lines = [...lines];
		onupdate?.(lines);
		
		// Trigger stock check for quantity changes
		if (field === 'quantity' && lines[index].itemId) {
			onstockcheck?.({
				lineNo: lines[index].lineNo || index + 1,
				itemId: lines[index].itemId!,
				locationId: lines[index].sourceLocationId,
				quantity: value as number
			});
		}
	}

	const itemOptions = $derived(items.map((item: InventoryItem) => ({
		id: item.id,
		label: item.name,
		sublabel: `${item.sku} • ${item.baseUom?.code || ''}`
	})));

	const locationOptions = $derived(locations.map((loc: WarehouseLocation) => ({
		id: loc.id,
		label: loc.name,
		sublabel: `${loc.code} • ${loc.locationType}`
	})));

	function getItemUoms(itemId: string): UOM[] {
		const item = items.find((i: InventoryItem) => i.id === itemId);
		if (!item) return uoms;
		return uoms.filter((u: UOM) => u.id === item.baseUomId || item.conversions?.some((c: ItemUOMConversion) => c.toUomId === u.id || c.fromUomId === u.id));
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
		<thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
			<tr>
				<th scope="col" class="px-3 py-3 w-12">#</th>
				<th scope="col" class="px-3 py-3">Item</th>
				{#if docType === 'TRANSFER' || docType === 'ISSUE'}
					<th scope="col" class="px-3 py-3">From Location</th>
				{/if}
				{#if docType === 'TRANSFER' || docType === 'RECEIPT' || docType === 'STOCKTAKE'}
					<th scope="col" class="px-3 py-3">To Location</th>
				{/if}
				<th scope="col" class="px-3 py-3">Lot</th>
				<th scope="col" class="px-3 py-3">Quantity</th>
				<th scope="col" class="px-3 py-3">UOM</th>
				{#if docType === 'RECEIPT' || docType === 'ADJUST'}
					<th scope="col" class="px-3 py-3">Unit Cost</th>
				{/if}
				{#if docType === 'ADJUST'}
					<th scope="col" class="px-3 py-3">Direction</th>
				{/if}
				<th scope="col" class="px-3 py-3">Note</th>
				{#if !readonly}
					<th scope="col" class="px-3 py-3">Actions</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each lines as line, index}
				<tr class="bg-slate-800 border-b border-slate-700">
					<td class="px-3 py-2 font-medium text-slate-100">
						{line.lineNo || index + 1}
					</td>
					<td class="px-3 py-2">
						{#if readonly}
							{line.item?.name || '-'}
						{:else}
							<EntitySelect
								label=""
								bind:value={line.itemId}
								options={itemOptions}
								placeholder={$isLoading ? 'Select item...' : $_('assets.placeholders.selectItem')}
							onselect={(id) => updateLine(index, 'itemId', id || '')}
							/>
						{/if}
					</td>
					{#if docType === 'TRANSFER' || docType === 'ISSUE'}
						<td class="px-3 py-2">
							{#if readonly}
								{line.sourceLocation?.name || '-'}
							{:else}
								<EntitySelect
									label=""
									bind:value={line.sourceLocationId}
									options={locationOptions}
									placeholder={$isLoading ? 'Select...' : $_('assets.placeholders.select')}
									onselect={(id) => updateLine(index, 'sourceLocationId', id ?? undefined)}
								/>
							{/if}
						</td>
					{/if}
					{#if docType === 'TRANSFER' || docType === 'RECEIPT' || docType === 'STOCKTAKE'}
						<td class="px-3 py-2">
							{#if readonly}
								{line.targetLocation?.name || '-'}
							{:else}
								<EntitySelect
									label=""
									bind:value={line.targetLocationId}
									options={locationOptions}
									placeholder={$isLoading ? 'Select...' : $_('assets.placeholders.select')}
									onselect={(id) => updateLine(index, 'targetLocationId', id ?? undefined)}
								/>
							{/if}
						</td>
					{/if}
					<td class="px-3 py-2">
						{#if readonly}
							{line.lot?.lotCode || '-'}
						{:else}
							<select
								class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
								bind:value={line.lotId}
								onchange={(e) => updateLine(index, 'lotId', e.currentTarget.value)}
							>
								<option value="">-- None --</option>
								{#each lots.filter((l: InventoryLot) => l.itemId === line.itemId) as lot}
									<option value={lot.id}>{lot.lotCode} {lot.expiryDate ? `(Exp: ${new Date(lot.expiryDate).toLocaleDateString()})` : ''}</option>
								{/each}
							</select>
						{/if}
					</td>
					<td class="px-3 py-2">
						{#if readonly}
							{line.quantity}
						{:else}
							<input
								type="number"
								class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
								bind:value={line.quantity}
								oninput={(e) => updateLine(index, 'quantity', parseFloat(e.currentTarget.value))}
								step="0.01"
								min="0"
							/>
						{/if}
					</td>
					<td class="px-3 py-2">
						{#if readonly}
							{line.uom?.code || '-'}
						{:else}
							<select
								class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
								bind:value={line.uomId}
								onchange={(e) => updateLine(index, 'uomId', e.currentTarget.value)}
							>
								<option value="">-- Base UOM --</option>
								{#each getItemUoms(line.itemId || '') as uom}
									<option value={uom.id}>{uom.code}</option>
								{/each}
							</select>
						{/if}
					</td>
					{#if docType === 'RECEIPT' || docType === 'ADJUST'}
						<td class="px-3 py-2">
							{#if readonly}
								{line.unitCost ?? '-'}
							{:else}
								<input
									type="number"
									class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									bind:value={line.unitCost}
									oninput={(e) => updateLine(index, 'unitCost', parseFloat(e.currentTarget.value))}
									step="0.01"
									min="0"
								/>
							{/if}
						</td>
					{/if}
					{#if docType === 'ADJUST'}
						<td class="px-3 py-2">
							{#if readonly}
								{line.adjustDirection || '-'}
							{:else}
								<select
									class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									bind:value={line.adjustDirection}
									onchange={(e) => updateLine(index, 'adjustDirection', e.currentTarget.value as 'plus' | 'minus')}
								>
									<option value="plus">Plus (+)</option>
									<option value="minus">Minus (-)</option>
								</select>
							{/if}
						</td>
					{/if}
					<td class="px-3 py-2">
						{#if readonly}
							{line.note || '-'}
						{:else}
							<input
								type="text"
								class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
								bind:value={line.note}
								oninput={(e) => updateLine(index, 'note', e.currentTarget.value)}
								placeholder={$isLoading ? 'Optional note...' : $_('assets.placeholders.optionalNote')}
							/>
						{/if}
					</td>
					{#if !readonly}
						<td class="px-3 py-2">
							<button
								type="button"
								class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
								aria-label={$_('common.remove')}
								onclick={() => removeLine(index)}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
								</svg>
							</button>
						</td>
					{/if}
				</tr>
			{/each}
			{#if lines.length === 0}
				<tr>
					<td colspan="20" class="px-6 py-8 text-center text-gray-500">
						No lines added yet
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
	
	{#if !readonly}
		<div class="p-4 border-t border-gray-200 dark:border-gray-700">
			<button
				type="button"
				class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
				onclick={addLine}
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Add Line
			</button>
		</div>
	{/if}
</div>
