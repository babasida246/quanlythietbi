<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	import { hasPermission, type Permission } from '$lib/stores/permissionStore';
	
	let { children,
		permission,
		orgId = undefined,
		warehouseId = undefined,
		fallback = 'hide'
	} = $props<{
		permission: Permission;
		orgId?: string | undefined;
		warehouseId?: string | undefined;
		fallback?: 'hide' | 'disable' | 'show';
	}>();

	const allowed = $derived(hasPermission(permission, orgId, warehouseId));
</script>

{#if allowed}
	{@render children?.()}
{:else if fallback === 'disable'}
	<div class="pointer-events-none opacity-50">
		{@render children?.()}
	</div>
{:else if fallback === 'show'}
	<div class="opacity-50" title={$isLoading ? "You don't have permission for this action" : $_('warehouse.permissionDenied')}>
		{@render children?.()}
	</div>
{/if}
