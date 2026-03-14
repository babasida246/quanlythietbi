<script lang="ts">
	import type { InventoryDocument, InventoryReservation } from '$lib/types/inventory';

	type SizeOption = 'sm' | 'md' | 'lg';

	let { status, size = 'md' }: {
		status: InventoryDocument['status'] | InventoryReservation['status'];
		size?: SizeOption;
	} = $props();

	const colorMap: Record<string, string> = {
		draft:     'badge badge-gray',
		approved:  'badge badge-blue',
		active:    'badge badge-blue',
		posted:    'badge badge-green',
		committed: 'badge badge-green',
		released:  'badge badge-yellow',
		void:      'badge badge-red'
	};

	const sizeMap: Record<SizeOption, string> = {
		sm: 'text-xs px-2 py-0.5',
		md: 'text-sm px-2.5 py-0.5',
		lg: 'text-base px-3 py-1'
	};

	const colorClass = $derived(colorMap[status] || 'badge badge-gray');
	const sizeClass = $derived(sizeMap[size ?? 'md']);
</script>

<span class="inline-flex items-center font-medium rounded {colorClass} {sizeClass}">
	{status.toUpperCase()}
</span>
