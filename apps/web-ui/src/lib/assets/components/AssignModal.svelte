<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { AssigneeType } from '$lib/api/assets';
  import { _, isLoading } from '$lib/i18n';
  import { getAssetCatalogs, type Location } from '$lib/api/assetCatalogs';
  import { listOrganizations, type OrganizationDto } from '$lib/api/organizations';
  import { listAdUsers, listUsers, type AdRbacUser, type AdminUser } from '$lib/api/admin';

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
  let users = $state<AdminUser[]>([]);
  let remoteUsers = $state<AdRbacUser[]>([]);
  let personSearchLoading = $state(false);
  let personSearchTimer: ReturnType<typeof setTimeout> | null = null;
  let assigneeError = $state('');

  type AssigneeHint = {
    id: string;
    name: string;
    email?: string | null;
  };

  let combinedPersonHints = $derived.by<AssigneeHint[]>(() => {
    const byId = new Map<string, AssigneeHint>();
    for (const user of users) {
      byId.set(user.id, { id: user.id, name: user.name, email: user.email });
    }
    for (const user of remoteUsers) {
      if (!byId.has(user.id)) {
        byId.set(user.id, {
          id: user.id,
          name: user.displayName || user.username,
          email: user.email
        });
      }
    }
    return Array.from(byId.values());
  });

  let assigneeHints = $derived.by(() => {
    const q = assigneeName.trim().toLowerCase();
    if (assigneeType !== 'person' || !q) return combinedPersonHints.slice(0, 8);
    return combinedPersonHints
      .filter((user) => `${user.name} ${user.email ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  });

  onMount(async () => {
    try {
      const [catalogRes, orgRes, userRes] = await Promise.all([
        getAssetCatalogs().catch(() => ({ data: { locations: [] as Location[] } })),
        listOrganizations({ flat: true, limit: 200 }).catch(() => ({ data: [] as OrganizationDto[] })),
        listUsers().catch(() => ({ data: [] as AdminUser[] }))
      ]);
      locations = catalogRes.data?.locations ?? [];
      organizations = orgRes.data ?? [];
      users = userRes.data ?? [];
    } catch {
      // silently ignore — these are optional dropdowns
      users = [];
    }
  });

  function validateForm(): string {
    if (!assigneeName.trim()) return $_('assets.assignModal.validation.assigneeNameRequired');
    if (!assigneeId.trim()) return $_('assets.assignModal.validation.assigneeIdRequired');

    if (assigneeType === 'department') {
      if (!organizationId) return $_('assets.assignModal.validation.departmentOrganizationRequired');
      if (!locationId) return $_('assets.assignModal.validation.departmentLocationRequired');
    }

    if (assigneeType === 'person' && assigneeId.length < 3) {
      return $_('assets.assignModal.validation.personIdMinLength');
    }

    if (assigneeType === 'system' && !/^[a-zA-Z0-9_.:-]+$/.test(assigneeId)) {
      return $_('assets.assignModal.validation.systemIdInvalid');
    }

    return '';
  }

  function onOrganizationChange(nextOrgId: string) {
    organizationId = nextOrgId;
    if (!nextOrgId) return;
    const selected = organizations.find((org) => org.id === nextOrgId);
    if (!selected) return;
    if (assigneeType === 'department') {
      assigneeId = selected.id;
      if (!assigneeName.trim()) assigneeName = selected.name;
    }
  }

  function onAssigneeNameBlur() {
    if (assigneeType !== 'person' || !assigneeName.trim()) return;
    const matched = combinedPersonHints.find((user) => user.name.toLowerCase() === assigneeName.trim().toLowerCase());
    if (matched) {
      assigneeId = matched.id;
    }
  }

  function searchPersonHints() {
    if (assigneeType !== 'person') return;
    const query = assigneeName.trim();
    if (query.length < 2) {
      remoteUsers = [];
      return;
    }

    if (personSearchTimer) clearTimeout(personSearchTimer);
    personSearchTimer = setTimeout(async () => {
      personSearchLoading = true;
      try {
        const res = await listAdUsers({ search: query });
        remoteUsers = res.data ?? [];
      } catch {
        remoteUsers = [];
      } finally {
        personSearchLoading = false;
      }
    }, 250);
  }

  function submit() {
    assigneeError = '';
    const invalid = validateForm();
    if (invalid) {
      assigneeError = invalid;
      return;
    }
    onassign?.({
      assigneeType,
      assigneeName: assigneeName.trim(),
      assigneeId: assigneeId.trim(),
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
    assigneeError = '';
    remoteUsers = [];
    personSearchLoading = false;
    if (personSearchTimer) {
      clearTimeout(personSearchTimer);
      personSearchTimer = null;
    }
  }

  $effect(() => {
    if (!open) reset();
  });
</script>

<Modal bind:open title={($isLoading ? 'Assign Asset' : $_('assets.assignAsset')) + (assetCode ? ` (${assetCode})` : '')}>

  <div class="space-y-4">
    {#if assigneeError}
      <div class="alert alert-error">{assigneeError}</div>
    {/if}
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
      <input
        id="assign-name"
        class="input-base"
        bind:value={assigneeName}
        placeholder={$isLoading ? 'e.g. Nguyen Van A' : $_('assets.assignModal.placeholders.assigneeName')}
        list={assigneeType === 'person' ? 'assign-person-hints' : undefined}
        oninput={searchPersonHints}
        onblur={onAssigneeNameBlur}
      />
      {#if assigneeType === 'person' && personSearchLoading}
        <div class="mt-1 text-xs text-slate-500">{$isLoading ? 'Searching users...' : $_('assets.assignModal.searchingUsers')}</div>
      {/if}
      {#if assigneeType === 'person'}
        <datalist id="assign-person-hints">
          {#each assigneeHints as user}
            <option value={user.name}>{user.email ?? user.id}</option>
          {/each}
        </datalist>
      {/if}
    </div>
    <div>
      <label for="assign-id" class="label-base mb-2">{$isLoading ? 'Assignee ID' : $_('assets.assigneeId')}</label>
      <input id="assign-id" class="input-base" bind:value={assigneeId} placeholder={$isLoading ? 'Employee ID / Dept ID' : $_('assets.assignModal.placeholders.assigneeId')} />
    </div>
    {#if locations.length > 0}
    <div>
      <label for="assign-location" class="label-base mb-2">{$isLoading ? 'Location' : $_('assets.location')}</label>
      <select id="assign-location" class="select-base" bind:value={locationId}>
        <option value="">{$isLoading ? '— No location —' : $_('assets.assignModal.placeholders.noLocation')}</option>
        {#each locations as loc}
          <option value={loc.id}>{loc.name}</option>
        {/each}
      </select>
    </div>
    {/if}
    {#if organizations.length > 0}
    <div>
      <label for="assign-org" class="label-base mb-2">{$isLoading ? 'Organization (OU)' : $_('assets.organization')}</label>
      <select id="assign-org" class="select-base" bind:value={organizationId} onchange={(e) => onOrganizationChange((e.target as HTMLSelectElement).value)}>
        <option value="">{$isLoading ? '— No organization —' : $_('assets.assignModal.placeholders.noOrganization')}</option>
        {#each organizations as org}
          <option value={org.id}>{org.path || org.name}</option>
        {/each}
      </select>
    </div>
    {/if}
    <div>
      <label for="assign-note" class="label-base mb-2">{$isLoading ? 'Note' : $_('assets.note')}</label>
      <input id="assign-note" class="input-base" bind:value={note} placeholder={$isLoading ? 'Optional note' : $_('assets.assignModal.placeholders.note')} />
    </div>
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => { open = false; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={submit} disabled={!assigneeName || !assigneeId}>{$isLoading ? 'Assign' : $_('assets.assign')}</Button>
      </div>
  {/snippet}
</Modal>
