<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	import type { Currency, FxRate } from '$lib/types/inventory';
	import { fxRatesAPI } from '$lib/api/inventory';

	let {
		fromCurrency = null,
		toCurrency = null,
		amount = 0,
		asOf = null,
		onrateloaded
	} = $props<{
		fromCurrency?: Currency | null;
		toCurrency?: Currency | null;
		amount?: number;
		asOf?: string | null;
		onrateloaded?: (rate: FxRate | null) => void;
	}>();

	let rate = $state<FxRate | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const convertedAmount = $derived(rate && amount ? amount * rate.rate : null);

	async function loadRate() {
		if (!fromCurrency || !toCurrency) return;
		
		try {
			loading = true;
			error = null;
			rate = await fxRatesAPI.getLatest(fromCurrency.id, toCurrency.id, asOf || undefined);
		onrateloaded?.(rate);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load FX rate';
			console.error('Failed to load FX rate:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (fromCurrency && toCurrency && fromCurrency.id !== toCurrency.id) {
			void loadRate();
		} else {
			rate = null;
		}
	});
</script>

{#if fromCurrency && toCurrency && fromCurrency.id !== toCurrency.id}
	<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0">
				<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
				</svg>
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
					{$isLoading ? 'Currency Conversion Preview' : $_('warehouse.currencyConversion')}
				</h3>
				
				{#if loading}
					<p class="text-sm text-blue-700 dark:text-blue-400">Loading exchange rate...</p>
				{:else if error}
					<p class="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
				{:else if rate}
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span class="text-blue-700 dark:text-blue-400">Exchange Rate:</span>
							<span class="font-medium text-blue-900 dark:text-blue-300">
								1 {fromCurrency.code} = {rate.rate.toFixed(4)} {toCurrency.code}
							</span>
						</div>
						{#if rate.asOf}
							<div class="flex items-center justify-between text-xs">
								<span class="text-blue-600 dark:text-blue-500">As of:</span>
								<span class="text-blue-800 dark:text-blue-400">
									{new Date(rate.asOf).toLocaleString()}
								</span>
							</div>
						{/if}
						{#if amount > 0 && convertedAmount}
							<div class="pt-2 mt-2 border-t border-blue-200 dark:border-blue-700">
								<div class="flex items-center justify-between">
									<span class="text-sm text-blue-700 dark:text-blue-400">
										{amount.toLocaleString()} {fromCurrency.code}
									</span>
									<svg class="w-4 h-4 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
									</svg>
									<span class="text-sm font-bold text-blue-900 dark:text-blue-300">
										{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency.code}
									</span>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-blue-700 dark:text-blue-400">{$isLoading ? 'No exchange rate available' : $_('warehouse.noExchangeRate')}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
