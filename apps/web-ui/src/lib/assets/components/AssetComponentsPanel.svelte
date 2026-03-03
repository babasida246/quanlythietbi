<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import {
    Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell
  } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { PackagePlus, Trash2 } from 'lucide-svelte';
  import {
    listComponents,
    installComponent,
    removeComponent,
    type ComponentWithDetails,
    type ComponentAssignmentWithDetails,
    type ComponentType,
    type RemovalReason,
    type PostRemovalAction
  } from '$lib/api/components';

  let { assetId, components = $bindable([]), canManage = false } = $props<{
    assetId: string;
    components?: ComponentAssignmentWithDetails[];
    canManage?: boolean;
  }>();

  // Install modal state
  let showInstallModal = $state(false);
  let availableComponents = $state<ComponentWithDetails[]>([]);
  let installComponentId = $state('');
  let installQuantity = $state(1);
  let installSerials = $state('');
  let installNotes = $state('');
  let installing = $state(false);
  let installError = $state('');

  // Remove modal state
  let showRemoveModal = $state(false);
  let removingAssignment = $state<ComponentAssignmentWithDetails | null>(null);
  let removalReason = $state<RemovalReason>('upgrade');
  let postRemovalAction = $state<PostRemovalAction>('restock');
  let removalNotes = $state('');
  let removing = $state(false);
  let removeError = $state('');

  const componentTypeLabels: Record<ComponentType, string> = {
    ram: 'RAM',
    ssd: 'SSD',
    hdd: 'HDD',
    cpu: 'CPU',
    gpu: 'GPU',
    psu: 'PSU',
    motherboard: 'Mainboard',
    network_card: 'Card mạng',
    other: 'Khác'
  };

  const installed = $derived((components as ComponentAssignmentWithDetails[]).filter((c: ComponentAssignmentWithDetails) => c.status === 'installed'));

  async function openInstallModal() {
    installError = '';
    installComponentId = '';
    installQuantity = 1;
    installSerials = '';
    installNotes = '';
    try {
      const resp = await listComponents({ status: 'active', limit: 200 });
      availableComponents = resp.data;
    } catch {
      availableComponents = [];
    }
    showInstallModal = true;
  }

  async function handleInstall() {
    if (!installComponentId) return;
    installing = true;
    installError = '';
    try {
      const serialNumbers = installSerials
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const resp = await installComponent(installComponentId, {
        assetId,
        quantity: installQuantity,
        serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
        installationNotes: installNotes || undefined
      });
      components = [...components, resp.data];
      showInstallModal = false;
    } catch (e) {
      installError = e instanceof Error ? e.message : 'Lỗi không xác định';
    } finally {
      installing = false;
    }
  }

  function openRemoveModal(assignment: ComponentAssignmentWithDetails) {
    removingAssignment = assignment;
    removalReason = 'upgrade';
    postRemovalAction = 'restock';
    removalNotes = '';
    removeError = '';
    showRemoveModal = true;
  }

  async function handleRemove() {
    if (!removingAssignment) return;
    removing = true;
    removeError = '';
    try {
      const resp = await removeComponent(removingAssignment.id, {
        removalReason,
        postRemovalAction,
        removalNotes: removalNotes || undefined
      });
      components = (components as ComponentAssignmentWithDetails[]).map((c: ComponentAssignmentWithDetails) => c.id === resp.data.id ? resp.data : c);
      showRemoveModal = false;
    } catch (e) {
      removeError = e instanceof Error ? e.message : 'Lỗi không xác định';
    } finally {
      removing = false;
    }
  }
</script>

<div class="card">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold">{$isLoading ? 'Components' : $_('components.title')}</h2>
    {#if canManage}
      <Button size="sm" onclick={openInstallModal}>
        <PackagePlus class="w-4 h-4 mr-1" />
        {$isLoading ? 'Install Component' : $_('components.installBtn')}
      </Button>
    {/if}
  </div>

  {#if installed.length === 0}
    <p class="text-sm text-slate-500">{$isLoading ? 'No components installed.' : $_('components.emptyState')}</p>
  {:else}
    <Table>
      <TableHeader>
        <tr>
          <TableHeaderCell>{$isLoading ? 'Type' : $_('components.type')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Code' : $_('components.code')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Name' : $_('components.name')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Qty' : $_('components.quantity')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Serial(s)' : $_('components.serials')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Installed At' : $_('components.installedAt')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'By' : $_('components.installedBy')}</TableHeaderCell>
          <TableHeaderCell>{$isLoading ? 'Notes' : $_('components.notes')}</TableHeaderCell>
          {#if canManage}
            <TableHeaderCell>{$isLoading ? 'Actions' : $_('common.actions')}</TableHeaderCell>
          {/if}
        </tr>
      </TableHeader>
      <tbody>
        {#each installed as assignment}
          <TableRow>
            <TableCell>
              <span class="badge-primary text-xs">
                {componentTypeLabels[assignment.componentType as ComponentType] ?? assignment.componentType}
              </span>
            </TableCell>
            <TableCell class="font-mono text-xs">{assignment.componentCode}</TableCell>
            <TableCell>{assignment.componentName}</TableCell>
            <TableCell>{assignment.quantity}</TableCell>
            <TableCell class="text-xs">
              {#if assignment.serialNumbers && assignment.serialNumbers.length > 0}
                {assignment.serialNumbers.join(', ')}
              {:else}
                -
              {/if}
            </TableCell>
            <TableCell class="text-xs">{new Date(assignment.installedAt).toLocaleString('vi-VN')}</TableCell>
            <TableCell class="text-xs">{assignment.installedByName ?? assignment.installedBy}</TableCell>
            <TableCell class="text-xs">{assignment.installationNotes ?? '-'}</TableCell>
            {#if canManage}
              <TableCell>
                <Button size="sm" variant="danger" onclick={() => openRemoveModal(assignment)}>
                  <Trash2 class="w-3 h-3 mr-1" />
                  {$isLoading ? 'Remove' : $_('components.removeBtn')}
                </Button>
              </TableCell>
            {/if}
          </TableRow>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>

<!-- Install modal -->
<Modal bind:open={showInstallModal} title={$isLoading ? 'Install Component' : $_('components.install.title')}>
  <div class="space-y-4">
    <div>
      <label class="label-base mb-2" for="install-component-id">{$isLoading ? 'Component' : $_('components.install.selectComponent')}</label>
      <select class="select-base" id="install-component-id" bind:value={installComponentId}>
        <option value="">{$isLoading ? '-- Select --' : $_('components.install.placeholder')}</option>
        {#each availableComponents as c}
          <option value={c.id} disabled={c.availableQuantity < 1}>
            [{componentTypeLabels[c.componentType]}] {c.name} ({c.componentCode}) — {$isLoading ? 'available' : $_('components.available')}: {c.availableQuantity}
          </option>
        {/each}
      </select>
    </div>
    <div>
      <label class="label-base mb-2" for="install-quantity">{$isLoading ? 'Quantity' : $_('components.install.quantity')}</label>
      <input class="input-base" id="install-quantity" type="number" min="1" bind:value={installQuantity} />
    </div>
    <div>
      <label class="label-base mb-2" for="install-serials">{$isLoading ? 'Serial Numbers (comma-separated)' : $_('components.install.serials')}</label>
      <input class="input-base" id="install-serials" bind:value={installSerials} placeholder="SN001, SN002" />
    </div>
    <div>
      <label class="label-base mb-2" for="install-notes">{$isLoading ? 'Notes' : $_('components.install.notes')}</label>
      <input class="input-base" id="install-notes" bind:value={installNotes} placeholder={$isLoading ? 'Optional notes' : $_('components.install.notesPlaceholder')} />
    </div>
    {#if installError}
      <p class="text-sm text-red-500">{installError}</p>
    {/if}
  </div>
  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={() => (showInstallModal = false)}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button onclick={handleInstall} disabled={!installComponentId || installing}>
        {installing ? $_('common.saving') : $_('components.install.confirm')}
      </Button>
    </div>
  {/snippet}
</Modal>

<!-- Remove modal -->
<Modal bind:open={showRemoveModal} title={$isLoading ? 'Remove Component' : $_('components.remove.title')}>
  {#if removingAssignment}
    <div class="space-y-4">
      <p class="text-sm">
        <span class="font-medium">{removingAssignment.componentName}</span>
        ({removingAssignment.componentCode}) — {$isLoading ? 'Qty' : $_('components.quantity')}: {removingAssignment.quantity}
      </p>
      <div>
        <label class="label-base mb-2" for="removal-reason">{$isLoading ? 'Removal Reason' : $_('components.remove.reason')}</label>
        <select class="select-base" id="removal-reason" bind:value={removalReason}>
          <option value="upgrade">{$isLoading ? 'Upgrade' : $_('components.removalReason.upgrade')}</option>
          <option value="repair">{$isLoading ? 'Repair' : $_('components.removalReason.repair')}</option>
          <option value="decommission">{$isLoading ? 'Decommission' : $_('components.removalReason.decommission')}</option>
        </select>
      </div>
      <div>
        <label class="label-base mb-2" for="post-removal-action">{$isLoading ? 'After Removal' : $_('components.remove.postAction')}</label>
        <select class="select-base" id="post-removal-action" bind:value={postRemovalAction}>
          <option value="restock">{$isLoading ? 'Return to stock' : $_('components.postRemovalAction.restock')}</option>
          <option value="dispose">{$isLoading ? 'Dispose' : $_('components.postRemovalAction.dispose')}</option>
        </select>
      </div>
      <div>
        <label class="label-base mb-2" for="removal-notes">{$isLoading ? 'Notes' : $_('components.remove.notes')}</label>
        <input class="input-base" id="removal-notes" bind:value={removalNotes} placeholder={$isLoading ? 'Optional notes' : $_('components.remove.notesPlaceholder')} />
      </div>
      {#if removeError}
        <p class="text-sm text-red-500">{removeError}</p>
      {/if}
    </div>
  {/if}
  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={() => (showRemoveModal = false)}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button variant="danger" onclick={handleRemove} disabled={removing}>
        {removing ? $_('common.saving') : $_('components.remove.confirm')}
      </Button>
    </div>
  {/snippet}
</Modal>
