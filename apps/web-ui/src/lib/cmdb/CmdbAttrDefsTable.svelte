<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import DataTable from '$lib/components/DataTable.svelte';
  import type { CmdbAttrDef } from '$lib/api/cmdb';

  let {
    defs = [],
    onEdit = () => {},
    onRemove = () => {}
  } = $props<{
    defs?: CmdbAttrDef[];
    onEdit?: (def: CmdbAttrDef) => void;
    onRemove?: (def: CmdbAttrDef) => void;
  }>();

  const columns = [
    { key: 'key' as const, label: $isLoading ? 'Key' : $_('cmdb.type.key'), sortable: true, filterable: true, render: (_value: unknown, row: CmdbAttrDef) => `<span class="font-medium">${row.key}</span>` },
    { key: 'label' as const, label: $isLoading ? 'Label' : $_('cmdb.type.label'), sortable: true, filterable: true },
    { key: 'fieldType' as const, label: $isLoading ? 'Type' : $_('cmdb.type.type'), sortable: true, filterable: true },
    { key: 'required' as const, label: $isLoading ? 'Required' : $_('cmdb.type.required'), sortable: true, render: (_value: unknown, row: CmdbAttrDef) => row.required ? ($isLoading ? 'Yes' : $_('common.yes')) : ($isLoading ? 'No' : $_('common.no')) }
  ];

  async function handleEdit(row: CmdbAttrDef) {
    onEdit(row);
  }

  async function handleDelete(rows: CmdbAttrDef[]) {
    for (const row of rows) {
      onRemove(row);
    }
  }
</script>

<div class="space-y-2">
  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{$isLoading ? 'Attributes' : $_('cmdb.type.attributes')}</h3>
  <DataTable
    data={defs}
    {columns}
    rowKey="id"
    selectable={true}
    loading={false}
    onEdit={handleEdit}
    onDelete={handleDelete}
  />
</div>

