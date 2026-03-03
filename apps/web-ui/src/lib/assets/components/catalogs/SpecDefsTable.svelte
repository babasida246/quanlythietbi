<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import type { CategorySpecDef } from '$lib/api/assetCatalogs';
  import { _, isLoading } from '$lib/i18n';

  let { specDefs = [], disabled = false, onedit, onremove } = $props<{
    specDefs?: CategorySpecDef[];
    disabled?: boolean;
    onedit?: (def: CategorySpecDef) => void;
    onremove?: (def: CategorySpecDef) => void;
  }>();

  const columns = $derived([
    { key: 'label' as const, label: $isLoading ? 'Label' : $_('specField.columnLabel'), sortable: true, filterable: true },
    { key: 'key' as const, label: 'Key', sortable: true, filterable: true },
    { key: 'fieldType' as const, label: $isLoading ? 'Data Type' : $_('specField.columnDataType'), sortable: true, filterable: true },
    { key: 'required' as const, label: $isLoading ? 'Required' : $_('specField.columnRequired'), sortable: true, render: (_value: unknown, row: CategorySpecDef) => row.required ? ($isLoading ? 'Yes' : $_('common.yes')) : ($isLoading ? 'No' : $_('common.no')) }
  ]);

  async function handleEdit(row: CategorySpecDef) {
    onedit?.(row);
  }

  async function handleDelete(rows: CategorySpecDef[]) {
    for (const row of rows) {
      onremove?.(row);
    }
  }
</script>

<DataTable
  data={specDefs}
  {columns}
  rowKey="id"
  selectable={!disabled}
  loading={false}
  onEdit={disabled ? undefined : handleEdit}
  onDelete={disabled ? undefined : handleDelete}
/>

