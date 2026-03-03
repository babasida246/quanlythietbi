<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	import { reportsAPI } from '$lib/api/inventory';
	import type { StockAvailable } from '$lib/types/inventory';

	let {
		itemId,
		warehouseId = null,
		locationId = null,
		requiredQuantity = 0
	} = $props<{
		itemId: string;
		warehouseId?: string | null;
		locationId?: string | null;
		requiredQuantity?: number;
	}>();

	let stockData = $state<StockAvailable[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const totalAvailable = $derived(stockData.reduce((sum, s) => sum + s.availableBase, 0));
	const isSufficient = $derived(totalAvailable >= requiredQuantity);
	const reservedTotal = $derived(stockData.reduce((sum, s) => sum + s.reservedBase, 0));
	const hasReserved = $derived(stockData.some((s) => s.reservedBase > 0));

	async function checkStock() {
		if (!itemId) return;
		
		try {
			loading = true;
			error = null;
			stockData = await reportsAPI.stockAvailable({
				itemId,
				warehouseId: warehouseId || undefined,
				locationId: locationId || undefined
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to check stock';
			console.error('Failed to check stock:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (itemId) {
			void checkStock();
		}
	});
</script>

<div class="bg-slate-800 border border-slate-700 rounded-lg p-4">
	<h3 class="text-sm font-medium text-slate-100 mb-3 flex items-center gap-2">
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
		</svg>
		Stock Availability Check
	</h3>

	{#if loading}
		<div class="text-sm text-gray-500">{$isLoading ? 'Checking stock...' : $_('warehouse.checkingStock')}</div>
	{:else if error}
		<div class="text-sm text-red-600 dark:text-red-400">{$isLoading ? 'Error' : $_('common.error')}: {error}</div>
	{:else if stockData.length === 0}
		<div class="text-sm text-gray-500">{$isLoading ? 'No stock information available' : $_('warehouse.noStockInfo')}</div>
	{:else}
		<div class="space-y-3">
			<!-- Summary -->
			<div class="flex items-center justify-between p-3 {isSufficient ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'} rounded-lg">
				<div>
					<div class="text-xs {isSufficient ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
						{$isLoading ? 'Total Available' : $_('warehouse.totalAvailable')}
					</div>
					<div class="text-lg font-bold {isSufficient ? 'text-green-900 dark:text-green-300' : 'text-red-900 dark:text-red-300'}">
						{totalAvailable.toLocaleString()}
					</div>
				</div>
				<div>
					<div class="text-xs text-gray-600 dark:text-gray-400">{$isLoading ? 'Required' : $_('common.required')}</div>
					<div class="text-lg font-medium text-gray-900 dark:text-white">
						{requiredQuantity.toLocaleString()}
					</div>
				</div>
				<div class="text-2xl">
					{#if isSufficient}
						<svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					{:else}
						<svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					{/if}
				</div>
			</div>

			<!-- Details by Location/Lot -->
			{#if stockData.length > 1}
				<div class="border-t border-gray-200 dark:border-gray-700 pt-3">
					<div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">By Location:</div>
					<div class="space-y-1">
						{#each stockData as stock}
							<div class="flex items-center justify-between text-sm">
								<span class="text-gray-600 dark:text-gray-400">
									{stock.locationCode || 'Default'} {stock.lotCode ? `• Lot: ${stock.lotCode}` : ''}
								</span>
								<span class="font-medium text-gray-900 dark:text-white">
									{stock.availableBase.toLocaleString()} {stock.baseUomCode}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Reservation Info -->
			{#if hasReserved}
				<div class="text-xs text-gray-500 dark:text-gray-400">
					{reservedTotal.toLocaleString()} units currently reserved
				</div>
			{/if}
		</div>
	{/if}
</div>
