<script lang="ts">
	import { contextStore, selectedOrganization, selectedWarehouse, filteredWarehouses, syncContextToURL } from '$lib/stores/contextStore';
	import { organizationsAPI, warehousesAPI } from '$lib/api/inventory';

	let loading = $state(false);
	let error = $state<string | null>(null);

	async function loadContext() {
		try {
			loading = true;
			
			// Load organizations
			const orgsResponse = await organizationsAPI.list({ pageSize: 1000 });
			contextStore.setOrganizations(orgsResponse.data);
			
			// Load warehouses
			const whsResponse = await warehousesAPI.list({ pageSize: 1000 });
			contextStore.setWarehouses(whsResponse.data);
			
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load context data';
			console.error('Failed to load context data:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void loadContext();
	});

	function handleOrgChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		contextStore.selectOrganization(select.value || null);
		syncContextToURL();
	}

	function handleWarehouseChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		contextStore.selectWarehouse(select.value || null);
		syncContextToURL();
	}
</script>

<div class="flex items-center gap-3">
	{#if loading}
		<div class="text-sm text-gray-500">Loading...</div>
	{:else if error}
		<div class="text-sm text-red-600">Error: {error}</div>
	{:else}
		<!-- Organization Selector -->
		<div class="flex items-center gap-2">
			<label for="org-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Organization:
			</label>
			<select
				id="org-select"
				class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
				value={$contextStore.selectedOrgId || ''}
				onchange={handleOrgChange}
			>
				<option value="">-- All Organizations --</option>
				{#each $contextStore.organizations as org}
					<option value={org.id}>{org.name} ({org.code})</option>
				{/each}
			</select>
		</div>

		<!-- Warehouse Selector -->
		<div class="flex items-center gap-2">
			<label for="warehouse-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Warehouse:
			</label>
			<select
				id="warehouse-select"
				class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
				value={$contextStore.selectedWarehouseId || ''}
				onchange={handleWarehouseChange}
				disabled={$filteredWarehouses.length === 0}
			>
				<option value="">-- All Warehouses --</option>
				{#each $filteredWarehouses as warehouse}
					<option value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>
				{/each}
			</select>
		</div>

		<!-- Current Selection Display -->
		{#if $selectedOrganization || $selectedWarehouse}
			<div class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
				</svg>
				<span>
					{#if $selectedWarehouse}
						{$selectedWarehouse.name}
					{:else if $selectedOrganization}
						{$selectedOrganization.name}
					{/if}
				</span>
			</div>
		{/if}
	{/if}
</div>
