<script module lang="ts">
	let moneyInputId = 0;
	const nextMoneyInputId = () => `money-input-${++moneyInputId}`;
</script>

<script lang="ts">
	import type { Currency } from '$lib/types/inventory';

	let {
		id,
		label = 'Amount',
		value = $bindable<number | null>(null),
		currency = null,
		currencyCode = null,
		placeholder = '0.00',
		required = false,
		disabled = false,
		error = null,
		min = null,
		max = null,
		onchange
	} = $props<{
		id?: string;
		label?: string;
		value?: number | null;
		currency?: Currency | null;
		currencyCode?: string | null;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string | null;
		min?: number | null;
		max?: number | null;
		onchange?: (value: number | null) => void;
	}>();

	const fallbackId = nextMoneyInputId();
	const inputId = $derived(id ?? fallbackId);
	const labelText = $derived((label ?? '').trim());
	const labelId = $derived(`${inputId}-label`);
	const errorId = $derived(`${inputId}-error`);

	const displayCurrency = $derived(currency?.code || currencyCode || '');
	const symbol = $derived(currency?.symbol || '');

	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const numValue = input.value ? parseFloat(input.value) : null;
		value = numValue;
		onchange?.(numValue);
	}
</script>

<div>
	{#if labelText}
		<label
			id={labelId}
			for={inputId}
			class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
		>
			{labelText}
			{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}

	<div class="relative">
		<!-- Currency Symbol Prefix -->
		{#if symbol}
			<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
				<span class="text-gray-500 dark:text-gray-400">{symbol}</span>
			</div>
		{/if}

		<input
			id={inputId}
			type="number"
			aria-label={labelText ? undefined : 'Amount'}
			aria-labelledby={labelText ? labelId : undefined}
			aria-invalid={!!error}
			aria-describedby={error ? errorId : undefined}
			class="bg-gray-50 border {error ? 'border-red-500' : 'border-gray-300'} text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full {symbol ? 'pl-8' : 'pl-2.5'} {displayCurrency ? 'pr-16' : 'pr-2.5'} p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			{placeholder}
			{disabled}
			{required}
			min={min !== null ? min : undefined}
			max={max !== null ? max : undefined}
			step="0.01"
			value={value !== null ? value : ''}
			oninput={handleInput}
		/>

		<!-- Currency Code Suffix -->
		{#if displayCurrency}
			<div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
				<span class="text-gray-500 dark:text-gray-400 font-medium text-xs">{displayCurrency}</span>
			</div>
		{/if}
	</div>

	{#if error}
		<p id={errorId} class="mt-2 text-sm text-red-600 dark:text-red-500">{error}</p>
	{/if}
</div>
