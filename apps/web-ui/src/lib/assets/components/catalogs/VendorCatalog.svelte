<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import { createVendor, deleteVendor, updateVendor } from '$lib/api/assetCatalogs';
  import DataTable from '$lib/components/DataTable.svelte';

  let { vendors = [], onupdated, onerror } = $props<{
    vendors?: Array<{ id: string; name: string; taxCode?: string | null; phone?: string | null; email?: string | null; address?: string | null }>;
    onupdated?: () => void;
    onerror?: (msg: string) => void;
  }>();

  // Ensure vendors is always an array
  const safeVendors = $derived(Array.isArray(vendors) ? vendors : []);

  let form = $state({ name: '', taxCode: '', phone: '', email: '', address: '' });
  let editingId = $state<string | null>(null);
  let saving = $state(false);

  function reset() {
    form = { name: '', taxCode: '', phone: '', email: '', address: '' };
    editingId = null;
  }

  async function save() {
    if (!form.name.trim()) return;
    try {
      saving = true;
      const payload = {
        name: form.name.trim(),
        taxCode: form.taxCode.trim() ? form.taxCode.trim() : null,
        phone: form.phone.trim() ? form.phone.trim() : null,
        email: form.email.trim() ? form.email.trim() : null,
        address: form.address.trim() ? form.address.trim() : null
      };
      if (editingId) {
        await updateVendor(editingId, payload);
      } else {
        await createVendor(payload);
      }
      reset();
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      saving = false;
    }
  }

  function edit(vendor: { id: string; name: string; taxCode?: string | null; phone?: string | null; email?: string | null; address?: string | null }) {
    form = {
      name: vendor.name,
      taxCode: vendor.taxCode ?? '',
      phone: vendor.phone ?? '',
      email: vendor.email ?? '',
      address: vendor.address ?? ''
    };
    editingId = vendor.id;
  }

  async function handleEdit(vendor: any, changes: Partial<any>) {
    try {
      await updateVendor(vendor.id, {
        name: changes.name || vendor.name,
        taxCode: changes.taxCode !== undefined ? changes.taxCode : vendor.taxCode,
        phone: changes.phone !== undefined ? changes.phone : vendor.phone,
        email: changes.email !== undefined ? changes.email : vendor.email,
        address: changes.address !== undefined ? changes.address : vendor.address
      });
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to update vendor');
    }
  }

  async function handleDelete(rows: any[]) {
    try {
      for (const row of rows) {
        await deleteVendor(row.id);
      }
      onupdated?.();
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : 'Failed to delete vendor');
    }
  }
</script>

<div class="py-4 space-y-4">
  <div class="bg-surface-2 border border-slate-700 rounded-lg p-4 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Vendor name' : $_('assets.vendorName')}</label>
        <input class="input-base" bind:value={form.name} placeholder={$isLoading ? 'Dell' : $_('assets.placeholders.vendorName')} />
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Tax code' : $_('assets.taxCode')}</label>
        <input class="input-base" bind:value={form.taxCode} placeholder={$isLoading ? 'Optional' : $_('assets.placeholders.taxCode')} />
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Phone' : $_('assets.phone')}</label>
        <input class="input-base" bind:value={form.phone} placeholder={$isLoading ? 'Optional' : $_('assets.placeholders.phone')} />
      </div>
      <div>
        <label class="label-base mb-2">{$isLoading ? 'Email' : $_('assets.email')}</label>
        <input class="input-base" bind:value={form.email} placeholder={$isLoading ? 'Optional' : $_('assets.placeholders.email')} />
      </div>
      <div class="md:col-span-2">
        <label class="label-base mb-2">{$isLoading ? 'Address' : $_('assets.address')}</label>
        <input class="input-base" bind:value={form.address} placeholder={$isLoading ? 'Optional' : $_('assets.placeholders.address')} />
      </div>
    </div>
    <div class="flex gap-2">
      <Button onclick={save} disabled={saving || !form.name.trim()}>
        {saving ? ($isLoading ? 'Saving...' : $_('common.saving')) : editingId ? ($isLoading ? 'Update' : $_('common.update')) : ($isLoading ? 'Add' : $_('common.add'))}
      </Button>
      {#if editingId}
        <Button variant="secondary" onclick={reset}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      {/if}
    </div>
  </div>

  <DataTable
    data={safeVendors}
    columns={[
      { key: 'name', label: $isLoading ? 'Name' : $_('common.name'), sortable: true, filterable: true, editable: true },
      { key: 'taxCode', label: $isLoading ? 'Tax code' : $_('assets.taxCode'), sortable: true, filterable: true, editable: true, render: (val) => val || '-' },
      { key: 'phone', label: $isLoading ? 'Phone' : $_('assets.phone'), sortable: true, filterable: true, editable: true, render: (val) => val || '-' },
      { key: 'email', label: $isLoading ? 'Email' : $_('assets.email'), sortable: true, filterable: true, editable: true, render: (val) => val || '-' }
    ]}
    selectable={true}
    rowKey="id"
    loading={false}
    onEdit={handleEdit}
    onDelete={handleDelete}
  />
</div>
