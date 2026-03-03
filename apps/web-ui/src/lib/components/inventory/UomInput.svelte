<script module lang="ts">
	let uomInputId = 0;
	const nextUomInputId = () => `uom-input-${++uomInputId}`;
</script>

<script lang="ts">
	import type { UOM } from '$lib/types/inventory';

	let {
		id,
		label = 'Quantity',
		quantity = $bindable<number | null>(null),
		uom = $bindable<UOM | null>(null),
		uomCode = null,
		placeholder = '0',
		required = false,
		disabled = false,
		error = null,
		min = null,
		max = null,
		onchange
	} = $props<{
		id?: string;
		label?: string;
		quantity?: number | null;
		uom?: UOM | null;
		uomCode?: string | null;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string | null;
		min?: number | null;
		max?: number | null;
		onchange?: (data: { quantity: number | null; uom: UOM | null }) => void;
	}>();

	const fallbackId = nextUomInputId();
	const inputId = $derived(id ?? fallbackId);
	const labelText = $derived((label ?? '').trim());
	const labelId = $derived(`${inputId}-label`);
	const errorId = $derived(`${inputId}-error`);

	const displayUOM = $derived(uom?.code || uomCode || '');
	const precision = $derived(uom?.precision ?? 0);
	const step = $derived(precision > 0 ? Math.pow(10, -precision) : 1);

	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const numValue = input.value ? parseFloat(input.value) : null;
		quantity = numValue;
		onchange?.({ quantity: numValue, uom });
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
		<input
			id={inputId}
			type="number"
			aria-label={labelText ? undefined : 'Quantity'}
			aria-labelledby={labelText ? labelId : undefined}
			aria-invalid={!!error}
			aria-describedby={error ? errorId : undefined}
			class="bg-gray-50 border {error ? 'border-red-500' : 'border-gray-300'} text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full {displayUOM ? 'pr-16' : 'pr-2.5'} p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			{placeholder}
			{disabled}
			{required}
			min={min !== null ? min : undefined}
			max={max !== null ? max : undefined}
			{step}
			value={quantity !== null ? quantity : ''}
			oninput={handleInput}
		/>

		<!-- UOM Code Suffix -->
		{#if displayUOM}
			<div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
				<span class="text-gray-500 dark:text-gray-400 font-medium text-xs">{displayUOM}</span>
			</div>
		{/if}
	</div>

	{#if error}
		<p id={errorId} class="mt-2 text-sm text-red-600 dark:text-red-500">{error}</p>
	{/if}
</div>
