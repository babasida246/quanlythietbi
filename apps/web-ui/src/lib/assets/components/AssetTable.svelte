<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  import type { Asset } from '$lib/api/assets';
  import { _, isLoading } from '$lib/i18n';
  import DataTable from '$lib/components/DataTable.svelte';
  import { deleteAsset, updateAsset } from '$lib/api/assets';

  let {
    assets = [],
    onupdated,
    onselect,
    selectionResetKey
  } = $props<{
    assets?: Asset[];
    onupdated?: () => void;
    onselect?: (rows: Asset[]) => void;
    selectionResetKey?: number;
  }>();

  async function handleEdit(asset: Asset, changes: Partial<Asset>) {
    // Convert null values to undefined for API compatibility
    const sanitizedChanges: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      sanitizedChanges[key] = value === null ? undefined : value;
    }
    await updateAsset(asset.id, sanitizedChanges);
    onupdated?.();
  }

  async function handleDelete(rows: Asset[]) {
    for (const row of rows) {
      await deleteAsset(row.id);
    }
    onupdated?.();
  }
</script>

<DataTable
  data={assets}
  columns={[
    { key: 'assetCode', label: $isLoading ? 'Asset Code' : $_('assets.assetCode'), sortable: true, filterable: true, editable: true, width: 'w-40', render: (val, row) => `<a href="/assets/${row.id}" class="font-medium text-primary-600 hover:underline">${val}</a>` },
    { key: 'status', label: $isLoading ? 'Status' : $_('assets.status'), sortable: true, filterable: true, editable: false, width: 'w-32' },
    { key: 'modelName', label: $isLoading ? 'Model' : $_('assets.model'), sortable: true, filterable: true, editable: false, render: (val) => val || '-' },
    { key: 'vendorName', label: $isLoading ? 'Vendor' : $_('assets.vendor'), sortable: true, filterable: true, editable: false, render: (val) => val || '-' },
    { key: 'locationName', label: $isLoading ? 'Location' : $_('assets.location'), sortable: true, filterable: true, editable: false, render: (val) => val || '-' },
    { key: 'mgmtIp', label: $isLoading ? 'Mgmt IP' : $_('assets.mgmtIp'), sortable: true, filterable: true, editable: true, width: 'w-32', render: (val) => val ? `<span class="font-mono text-xs">${val}</span>` : '-' }
  ]}
  selectable={true}
  rowKey="id"
  loading={false}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onSelect={onselect}
  hideBulkToolbar={true}
  {selectionResetKey}
/>
