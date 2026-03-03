<script lang="ts">
	import type { InventoryDocument, InventoryReservation } from '$lib/types/inventory';

	type SizeOption = 'sm' | 'md' | 'lg';

	let { status, size = 'md' }: {
		status: InventoryDocument['status'] | InventoryReservation['status'];
		size?: SizeOption;
	} = $props();

	const colorMap: Record<string, string> = {
		draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
		approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
		active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
		posted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
		committed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
		released: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
		void: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
	};

	const sizeMap: Record<SizeOption, string> = {
		sm: 'text-xs px-2 py-0.5',
		md: 'text-sm px-2.5 py-0.5',
		lg: 'text-base px-3 py-1'
	};

	const colorClass = $derived(colorMap[status] || 'bg-gray-100 text-gray-800');
	const sizeClass = $derived(sizeMap[size ?? 'md']);
</script>

<span class="inline-flex items-center font-medium rounded {colorClass} {sizeClass}">
	{status.toUpperCase()}
</span>
