<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { AssigneeType } from '$lib/api/assets';
  import { _, isLoading } from '$lib/i18n';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';
  import { listOrganizations, type OrganizationDto } from '$lib/api/organizations';

  let { open = $bindable(false), assetCode = '', onassign } = $props<{
    open?: boolean;
    assetCode?: string;
    onassign?: (data: {
      assigneeType: AssigneeType;
      assigneeName: string;
      assigneeId: string;
      note?: string;
      locationId?: string | null;
      organizationId?: string | null;
    }) => void;
  }>();

  let assigneeType = $state<AssigneeType>('person');
  let assigneeName = $state('');
  let assigneeId = $state('');
  let note = $state('');
  let locationId = $state('');
  let organizationId = $state('');

  let locations = $state<Location[]>([]);
  let organizations = $state<OrganizationDto[]>([]);

  onMount(async () => {
    try {
      const [catalogRes, orgRes] = await Promise.all([
        getAssetCatalogs().catch(() => ({ data: { locations: [] as Location[] } })),
        listOrganizations({ flat: true, limit: 200 }).catch(() => ({ data: [] as OrganizationDto[] }))
      ]);
      locations = catalogRes.data?.locations ?? [];
      organizations = orgRes.data ?? [];
    } catch {
      // silently ignore — these are optional dropdowns
    }
  });

  function submit() {
    onassign?.({
      assigneeType,
      assigneeName,
      assigneeId,
      note: note || undefined,
      locationId: locationId || null,
      organizationId: organizationId || null
    });
  }

  function reset() {
    assigneeType = 'person';
    assigneeName = '';
    assigneeId = '';
    note = '';
    locationId = '';
    organizationId = '';
  }

  $effect(() => {
    if (!open) reset();
  });
</script>

<Modal bind:open title={($isLoading ? 'Assign Asset' : $_('assets.assignAsset')) + (assetCode ? ` (${assetCode})` : '')}>

  <div class="space-y-4">
    <div>
      <label for="assign-type" class="label-base mb-2">{$isLoading ? 'Assignee Type' : $_('assets.assigneeType')}</label>
      <select id="assign-type" class="select-base" bind:value={assigneeType}>
        <option value="person">{$isLoading ? 'Person' : $_('assets.person')}</option>
        <option value="department">{$isLoading ? 'Department' : $_('assets.department')}</option>
        <option value="system">{$isLoading ? 'System' : $_('assets.system')}</option>
      </select>
    </div>
    <div>
      <label for="assign-name" class="label-base mb-2">{$isLoading ? 'Assignee Name' : $_('assets.assigneeName')}</label>
      <input id="assign-name" class="input-base" bind:value={assigneeName} placeholder={$isLoading ? 'e.g. Nguyen Van A' : $_('assets.placeholders.assigneeName')} />
    </div>
    <div>
      <label for="assign-id" class="label-base mb-2">{$isLoading ? 'Assignee ID' : $_('assets.assigneeId')}</label>
      <input id="assign-id" class="input-base" bind:value={assigneeId} placeholder={$isLoading ? 'Employee ID / Dept ID' : $_('assets.placeholders.assigneeId')} />
    </div>
    {#if locations.length > 0}
    <div>
      <label for="assign-location" class="label-base mb-2">{$isLoading ? 'Location' : $_('assets.location')}</label>
      <select id="assign-location" class="select-base" bind:value={locationId}>
        <option value="">{$isLoading ? '— No location —' : $_('assets.placeholders.noLocation')}</option>
        {#each locations as loc}
          <option value={loc.id}>{loc.name}</option>
        {/each}
      </select>
    </div>
    {/if}
    {#if organizations.length > 0}
    <div>
      <label for="assign-org" class="label-base mb-2">{$isLoading ? 'Organization (OU)' : $_('assets.organization')}</label>
      <select id="assign-org" class="select-base" bind:value={organizationId}>
        <option value="">{$isLoading ? '— No organization —' : $_('assets.placeholders.noOrganization')}</option>
        {#each organizations as org}
          <option value={org.id}>{org.path || org.name}</option>
        {/each}
      </select>
    </div>
    {/if}
    <div>
      <label for="assign-note" class="label-base mb-2">{$isLoading ? 'Note' : $_('assets.note')}</label>
      <input id="assign-note" class="input-base" bind:value={note} placeholder={$isLoading ? 'Optional note' : $_('assets.placeholders.note')} />
    </div>
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => { open = false; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={submit} disabled={!assigneeName || !assigneeId}>{$isLoading ? 'Assign' : $_('assets.assign')}</Button>
      </div>
  {/snippet}
</Modal>
