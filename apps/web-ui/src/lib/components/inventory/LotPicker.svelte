<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	import { lotsAPI } from '$lib/api/inventory';
	import type { InventoryLot } from '$lib/types/inventory';

	let {
		itemId,
		warehouseId = null,
		selectedLots = $bindable<string[]>([]),
		requiredQuantity = 0,
		fefoMode = true,
		onselect
	} = $props<{
		itemId: string;
		warehouseId?: string | null;
		selectedLots?: string[];
		requiredQuantity?: number;
		fefoMode?: boolean;
		onselect?: (lots: string[]) => void;
	}>();

	let lots = $state<InventoryLot[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function loadLots() {
		if (!itemId) return;
		
		try {
			loading = true;
			error = null;
			const response = await lotsAPI.list({ itemId, pageSize: 100 });
			lots = response.data;
			
			// Sort by expiry date (FEFO) if enabled
			if (fefoMode) {
				lots.sort((a, b) => {
					if (!a.expiryDate) return 1;
					if (!b.expiryDate) return -1;
					return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
				});
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load lots';
			console.error('Failed to load lots:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void loadLots();
	});

	function toggleLot(lotId: string) {
		if (selectedLots.includes(lotId)) {
			selectedLots = selectedLots.filter((id: string) => id !== lotId);
		} else {
			selectedLots = [...selectedLots, lotId];
		}
		onselect?.(selectedLots);
	}

	function isExpired(lot: InventoryLot): boolean {
		if (!lot.expiryDate) return false;
		return new Date(lot.expiryDate) < new Date();
	}

	function isExpiringSoon(lot: InventoryLot): boolean {
		if (!lot.expiryDate) return false;
		const expiryDate = new Date(lot.expiryDate);
		const now = new Date();
		const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-gray-900 dark:text-white">
			Select Lots {#if fefoMode}<span class="text-xs text-blue-600 dark:text-blue-400">(FEFO Order)</span>{/if}
		</h3>
		{#if requiredQuantity > 0}
			<span class="text-xs text-gray-500 dark:text-gray-400">
				Required: {requiredQuantity}
			</span>
		{/if}
	</div>

	{#if loading}
		<div class="text-sm text-gray-500">Loading lots...</div>
	{:else if error}
		<div class="text-sm text-red-600 dark:text-red-400">Error: {error}</div>
	{:else if lots.length === 0}
		<div class="text-sm text-gray-500">{$isLoading ? 'No lots available for this item' : $_('warehouse.noLotsAvailable')}</div>
	{:else}
		<div class="space-y-2 max-h-96 overflow-y-auto">
			{#each lots as lot}
				{@const expired = isExpired(lot)}
				{@const expiringSoon = isExpiringSoon(lot)}
				{@const selected = selectedLots.includes(lot.id)}
				
				<button
					type="button"
					class="w-full text-left p-3 rounded-lg border {selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'} transition"
					onclick={() => toggleLot(lot.id)}
					disabled={expired}
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900 dark:text-white">
									{lot.lotCode}
								</span>
								{#if expired}
									<span class="text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full font-medium">
										EXPIRED
									</span>
								{:else if expiringSoon}
									<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 rounded-full font-medium">
										{$isLoading ? 'EXPIRING SOON' : $_('warehouse.expiringSoon')}
									</span>
								{/if}
							</div>
							<div class="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
								{#if lot.mfgDate}
									<div>Mfg: {new Date(lot.mfgDate).toLocaleDateString()}</div>
								{/if}
								{#if lot.expiryDate}
									<div class={expired ? 'text-red-600 dark:text-red-400' : expiringSoon ? 'text-orange-600 dark:text-orange-400' : ''}>
										Exp: {new Date(lot.expiryDate).toLocaleDateString()}
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-shrink-0 ml-3">
							{#if selected}
								<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
								</svg>
							{:else}
								<svg class="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<circle cx="12" cy="12" r="10" stroke-width="2" />
								</svg>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
