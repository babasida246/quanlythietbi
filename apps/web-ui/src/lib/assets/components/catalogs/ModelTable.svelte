<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Edit, Trash2 } from 'lucide-svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import type { AssetCategory, AssetModel, Vendor } from '$lib/api/assetCatalogs';

  let {
    models = [],
    categories = [],
    vendors = [],
    disabled = false,
    onedit,
    onremove
  } = $props<{
    models?: AssetModel[];
    categories?: AssetCategory[];
    vendors?: Vendor[];
    disabled?: boolean;
    onedit?: (model: AssetModel) => void;
    onremove?: (id: string) => void;
  }>();

  // Ensure all props are always arrays
  const safeModels = $derived(Array.isArray(models) ? models.filter((item): item is AssetModel => Boolean(item)) : []);
  const safeCategories = $derived(Array.isArray(categories) ? categories.filter((item): item is AssetCategory => Boolean(item)) : []);
  const safeVendors = $derived(Array.isArray(vendors) ? vendors.filter((item): item is Vendor => Boolean(item)) : []);

  const columns = [
    { key: 'model' as const, label: $isLoading ? 'Model' : $_('assets.model'), sortable: true, filterable: true },
    { key: 'brand' as const, label: $isLoading ? 'Brand' : $_('assets.brand'), sortable: true, filterable: true, render: (_value: unknown, row: AssetModel) => row?.brand || '-' },
    { 
      key: 'categoryId' as const, 
      label: $isLoading ? 'Category' : $_('assets.category'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: AssetModel) => safeCategories.find((cat: AssetCategory) => cat.id === row.categoryId)?.name || '-'
    },
    { 
      key: 'vendorId' as const, 
      label: $isLoading ? 'Vendor' : $_('assets.vendor'), 
      sortable: true, 
      filterable: true,
      render: (_value: unknown, row: AssetModel) => safeVendors.find((vendor: Vendor) => vendor.id === row.vendorId)?.name || '-'
    }
  ];

  // Use customActions so clicking "Sửa" immediately fires onedit without
  // going through DataTable's inline-edit flow (which only fires onEdit on save).
  const customActions = $derived(
    disabled
      ? []
      : [
          {
            label: $isLoading ? 'Edit' : $_('common.edit'),
            icon: Edit,
            color: 'secondary' as const,
            onClick: (row: AssetModel) => onedit?.(row)
          },
          {
            label: $isLoading ? 'Delete' : $_('common.delete'),
            icon: Trash2,
            color: 'danger' as const,
            onClick: (row: AssetModel) => onremove?.(row.id)
          }
        ]
  );
</script>

<DataTable
  data={safeModels}
  {columns}
  rowKey="id"
  selectable={!disabled}
  loading={false}
  customActions={customActions}
/>

