<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import { Settings } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { createCategory, deleteCategory, updateCategory } from '$lib/api/assetCatalogs';
  import CategorySpecPanel from './CategorySpecPanel.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

  let { categories = [], onupdated, onerror } = $props<{ categories?: Array<{ id: string; name: string }>; onupdated?: () => void; onerror?: (msg: string) => void }>();

  // Ensure categories is always an array
  const safeCategories = $derived(Array.isArray(categories) ? categories : []);

  let name = $state('');
  let editingId = $state<string | null>(null);
  let saving = $state(false);
  let showSpecPanel = $state(false);
  let selectedCategory = $state<{ id: string; name: string } | null>(null);

  function reset() {
    name = '';
    editingId = null;
  }

  async function save() {
    if (!name.trim()) return;
    try {
      saving = true;
      if (editingId) {
        await updateCategory(editingId, { name: name.trim() });
      } else {
        await createCategory({ name: name.trim() });
      }
      reset();
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      saving = false;
    }
  }

  function edit(id: string, value: string) {
    editingId = id;
    name = value;
  }

  async function handleEdit(category: { id: string; name: string }, changes: Partial<{ name: string }>) {
    try {
      await updateCategory(category.id, { name: changes.name || category.name });
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  async function handleDelete(rows: Array<{ id: string; name: string }>) {
    try {
      for (const row of rows) {
        await deleteCategory(row.id);
        if (selectedCategory?.id === row.id) {
          showSpecPanel = false;
          selectedCategory = null;
        }
      }
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }

  function openSpecs(category: { id: string; name: string }) {
    selectedCategory = category;
    showSpecPanel = true;
  }
</script>

<div class="py-4 space-y-4">
  <div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      <div>
        <label for="category-name" class="label-base mb-2">{$isLoading ? 'Category name' : $_('assets.categoryName')}</label>
        <input id="category-name" class="input-base" bind:value={name} placeholder={$isLoading ? 'Laptop' : $_('assets.placeholders.categoryName')} />
      </div>
      <div class="flex gap-2">
        <Button onclick={save} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
        </Button>
        {#if editingId}
          <Button variant="secondary" onclick={reset}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        {/if}
      </div>
    </div>
  </div>

  <DataTable
    data={safeCategories}
    columns={[
      { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true }
    ]}
    selectable={true}
    rowKey="id"
    loading={false}
    customActions={[
      { 
        label: 'Specs', 
        icon: Settings, 
        color: 'secondary', 
        onClick: (category) => openSpecs(category) 
      }
    ]}
    onEdit={handleEdit}
    onDelete={handleDelete}
  />
</div>

<CategorySpecPanel
  bind:open={showSpecPanel}
  category={selectedCategory}
  onerror={onerror}
/>
