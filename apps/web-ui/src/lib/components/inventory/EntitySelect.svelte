<script module lang="ts">
	let entitySelectId = 0;
	const nextEntitySelectId = () => `entity-select-${++entitySelectId}`;
</script>

<script lang="ts">
	import { _, isLoading } from '$lib/i18n';

	let {
		id,
		label = '',
		value = $bindable<string | null>(null),
		options = [],
		placeholder = 'Search...',
		required = false,
		disabled = false,
		error = null,
		onselect
	} = $props<{
		id?: string;
		label?: string;
		value?: string | null;
		options?: Array<{ id: string; label: string; sublabel?: string }>;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string | null;
		onselect?: (id: string | null) => void;
	}>();

	const fallbackId = nextEntitySelectId();
	const inputId = $derived(id ?? fallbackId);
	const labelText = $derived(label.trim());
	const labelId = $derived(`${inputId}-label`);
	const errorId = $derived(`${inputId}-error`);
	const listboxId = $derived(`${inputId}-listbox`);
	const accessibleLabel = $derived(labelText || placeholder || 'Search');

	let searchTerm = $state('');
	let isOpen = $state(false);

	const filtered = $derived(
		searchTerm
			? options.filter((opt: { id: string; label: string; sublabel?: string }) =>
					opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
					opt.sublabel?.toLowerCase().includes(searchTerm.toLowerCase())
			  )
			: options
	);

	const selectedOption = $derived(
		value ? options.find((opt: { id: string; label: string; sublabel?: string }) => opt.id === value) || null : null
	);

	function selectOption(option: typeof options[0]) {
		value = option.id;
		isOpen = false;
		searchTerm = '';
		onselect?.(option.id);
	}

	function clear() {
		value = null;
		searchTerm = '';
		onselect?.(null);
	}

	function handleBlur(event: FocusEvent) {
		// Delay to allow click on dropdown
		setTimeout(() => {
			if (!(event.currentTarget as Element)?.contains(document.activeElement)) {
				isOpen = false;
				searchTerm = '';
			}
		}, 200);
	}
</script>

<div class="relative">
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

	<div class="relative" onblur={handleBlur}>
		<!-- Display / Search Input -->
		<div class="relative">
			<input
				id={inputId}
				type="text"
				role="combobox"
				aria-label={labelText ? undefined : accessibleLabel}
				aria-labelledby={labelText ? labelId : undefined}
				aria-autocomplete="list"
				aria-expanded={isOpen}
				aria-controls={listboxId}
				aria-invalid={!!error}
				aria-describedby={error ? errorId : undefined}
				class="bg-gray-50 border {error ? 'border-red-500' : 'border-gray-300'} text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				placeholder={selectedOption ? selectedOption.label : placeholder}
				bind:value={searchTerm}
				onfocus={() => (isOpen = true)}
				{disabled}
			/>
			
			<!-- Clear/Dropdown Icon -->
			<div class="absolute inset-y-0 right-0 flex items-center pr-3">
				{#if selectedOption && !disabled}
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600"
						aria-label={$_('common.clear')}
						onclick={clear}
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{:else}
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</div>
		</div>

		<!-- Dropdown -->
		{#if isOpen && !disabled}
			<div
				id={listboxId}
				role="listbox"
				class="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto"
			>
				{#if filtered.length === 0}
					<div class="p-4 text-sm text-gray-500 text-center">{$isLoading ? 'No results found' : $_('common.noResults')}</div>
				{:else}
					{#each filtered as option}
						<button
							type="button"
							role="option"
							aria-selected={option.id === value}
							class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex flex-col"
							onclick={() => selectOption(option)}
						>
							<span class="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
							{#if option.sublabel}
								<span class="text-xs text-gray-500 dark:text-gray-400">{option.sublabel}</span>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<p id={errorId} class="mt-2 text-sm text-red-600 dark:text-red-500">{error}</p>
	{/if}
</div>
