<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { AssigneeType } from '$lib/api/assets';
  import { _, isLoading } from '$lib/i18n';

  let { open = $bindable(false), assetCode = '', onassign } = $props<{
    open?: boolean;
    assetCode?: string;
    onassign?: (data: { assigneeType: AssigneeType; assigneeName: string; assigneeId: string; note?: string }) => void;
  }>();

  let assigneeType = $state<AssigneeType>('person');
  let assigneeName = $state('');
  let assigneeId = $state('');
  let note = $state('');

  function submit() {
    onassign?.({
      assigneeType,
      assigneeName,
      assigneeId,
      note: note || undefined
    });
  }

  function reset() {
    assigneeType = 'person';
    assigneeName = '';
    assigneeId = '';
    note = '';
  }

  $effect(() => {
    if (!open) reset();
  });
</script>

<Modal bind:open title="{$isLoading ? 'Assign Asset' : $_('assets.assignAsset')} {assetCode ? `(${assetCode})` : ''}">

  <div class="space-y-4">
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Assignee Type' : $_('assets.assigneeType')}</label>
      <select class="select-base" bind:value={assigneeType}>
        <option value="person">{$isLoading ? 'Person' : $_('assets.person')}</option>
        <option value="department">{$isLoading ? 'Department' : $_('assets.department')}</option>
        <option value="system">{$isLoading ? 'System' : $_('assets.system')}</option>
      </select>
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Assignee Name' : $_('assets.assigneeName')}</label>
      <input class="input-base" bind:value={assigneeName} placeholder={$isLoading ? 'e.g. Nguyen Van A' : $_('assets.placeholders.assigneeName')} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Assignee ID' : $_('assets.assigneeId')}</label>
      <input class="input-base" bind:value={assigneeId} placeholder={$isLoading ? 'Employee ID / Dept ID' : $_('assets.placeholders.assigneeId')} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Note' : $_('assets.note')}</label>
      <input class="input-base" bind:value={note} placeholder={$isLoading ? 'Optional note' : $_('assets.placeholders.note')} />
    </div>
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => { open = false; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={submit} disabled={!assigneeName || !assigneeId}>{$isLoading ? 'Assign' : $_('assets.assign')}</Button>
      </div>
  {/snippet}
</Modal>

