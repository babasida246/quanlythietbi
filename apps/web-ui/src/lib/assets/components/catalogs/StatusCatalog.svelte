<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import DataTable from '$lib/components/DataTable.svelte';
  import type { AssetStatus } from '$lib/api/assets';

  const statusRows: Array<{ value: AssetStatus; label: string; description: string }> = [
    { value: 'in_stock', label: 'In stock', description: 'Available in storage.' },
    { value: 'in_use', label: 'In use', description: 'Assigned to a person or system.' },
    { value: 'in_repair', label: 'In repair', description: 'Under maintenance or repair.' },
    { value: 'lost', label: 'Lost', description: 'Missing or lost asset.' },
    { value: 'retired', label: 'Retired', description: 'Retired from active usage.' },
    { value: 'disposed', label: 'Disposed', description: 'Disposed or decommissioned.' }
  ];

  const columns = [
    { key: 'value' as const, label: $isLoading ? 'Value' : $_('assets.value'), sortable: true, filterable: true, render: (_value: unknown, row: typeof statusRows[0]) => `<span class="font-mono text-xs">${row.value}</span>` },
    { key: 'label' as const, label: $isLoading ? 'Label' : $_('assets.label'), sortable: true, filterable: true },
    { key: 'description' as const, label: $isLoading ? 'Description' : $_('assets.description'), sortable: true, filterable: true, render: (_value: unknown, row: typeof statusRows[0]) => `<span class="text-sm text-slate-500">${row.description}</span>` }
  ];
</script>

<div class="py-4 space-y-4">
  <div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
    <p class="text-sm text-slate-500">
      Status values are fixed by the asset workflow and can be updated per asset.
    </p>
  </div>

  <DataTable
    data={statusRows}
    {columns}
    rowKey="value"
    selectable={false}
    loading={false}
  />
</div>

