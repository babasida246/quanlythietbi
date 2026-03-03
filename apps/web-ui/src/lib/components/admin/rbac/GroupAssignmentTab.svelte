<script lang="ts">
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { UserPlus, Users } from 'lucide-svelte';
  import { _ } from '$lib/i18n';
  import type { AuditEvent, Group, Role, User } from '$lib/rbac/types';

  type Props = {
    roles: Role[];
    groups: Group[];
    users: User[];
    actorId: string;
    actorEmail: string;
    onUpdate: (nextUsers: User[], auditEvent: AuditEvent | null) => void;
  };

  let { roles, groups, users, actorId, actorEmail, onUpdate }: Props = $props();

  type SubTabId = 'group' | 'user';
  let active = $state<SubTabId>('group');

  function clone<T>(value: T): T {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  function makeAuditId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return Math.random().toString(16).slice(2);
  }

  // Group view
  let groupQuery = $state('');
  let selectedGroupId = $state('');

  const filteredGroups = $derived.by(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => `${group.name} ${group.id}`.toLowerCase().includes(q));
  });

  const selectedGroup = $derived.by(() => groups.find((group) => group.id === selectedGroupId) ?? null);

  function membershipRole(user: User, groupId: string): string | null {
    return user.memberships.find((m) => m.groupId === groupId)?.roleId ?? null;
  }

  const groupMembers = $derived.by(() => {
    if (!selectedGroupId) return [];
    return users
      .map((user) => ({
        user,
        roleId: membershipRole(user, selectedGroupId)
      }))
      .filter((entry) => Boolean(entry.roleId));
  });

  const groupMemberCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const group of groups) counts.set(group.id, 0);
    for (const user of users) {
      for (const membership of user.memberships) {
        counts.set(membership.groupId, (counts.get(membership.groupId) ?? 0) + 1);
      }
    }
    return counts;
  });

  let memberSelection = $state<Set<string>>(new Set());
  let bulkRoleId = $state('');

  // Add members modal
  let showAddModal = $state(false);
  let addUserIds = $state<string[]>([]);
  let addRoleId = $state('');

  function setMembership(nextUsers: User[], userId: string, groupId: string, roleId: string): User[] {
    return nextUsers.map((user) => {
      if (user.id !== userId) return user;
      const existing = user.memberships.find((m) => m.groupId === groupId);
      if (existing) {
        return {
          ...user,
          memberships: user.memberships.map((m) => (m.groupId === groupId ? { ...m, roleId } : m))
        };
      }
      return {
        ...user,
        memberships: [...user.memberships, { groupId, roleId }]
      };
    });
  }

  function removeMembership(nextUsers: User[], userId: string, groupId: string): User[] {
    return nextUsers.map((user) => {
      if (user.id !== userId) return user;
      return { ...user, memberships: user.memberships.filter((m) => m.groupId !== groupId) };
    });
  }

  function auditEvent(target: AuditEvent['target'], action: string, diff: unknown, reason?: string): AuditEvent {
    return {
      id: makeAuditId(),
      time: nowIso(),
      actorId,
      actorEmail,
      target,
      action,
      reason: reason?.trim() ? reason.trim() : undefined,
      diff,
      dangerous: false
    };
  }

  function confirmAddMembers() {
    if (!selectedGroupId || addUserIds.length === 0) return;
    let next = clone(users);
    for (const userId of addUserIds) {
      next = setMembership(next, userId, selectedGroupId, addRoleId);
    }
    const group = selectedGroup;
    const event = auditEvent(
      { type: 'group', id: selectedGroupId, name: group?.name ?? selectedGroupId },
      'rbac.groupMembers.patch',
      { changes: addUserIds.map((userId) => ({ userId, op: 'setRole', roleId: addRoleId })) },
      'Add members'
    );
    showAddModal = false;
    addUserIds = [];
    onUpdate(next, event);
  }

  function applyBulkRole() {
    if (!selectedGroupId || memberSelection.size === 0) return;
    let next = clone(users);
    for (const userId of memberSelection) {
      next = setMembership(next, userId, selectedGroupId, bulkRoleId);
    }
    const group = selectedGroup;
    const event = auditEvent(
      { type: 'group', id: selectedGroupId, name: group?.name ?? selectedGroupId },
      'rbac.groupMembers.patch',
      { changes: Array.from(memberSelection).map((userId) => ({ userId, op: 'setRole', roleId: bulkRoleId })) },
      'Bulk assign role'
    );
    memberSelection = new Set();
    onUpdate(next, event);
  }

  function removeMember(userId: string) {
    if (!selectedGroupId) return;
    const next = removeMembership(clone(users), userId, selectedGroupId);
    const group = selectedGroup;
    const event = auditEvent(
      { type: 'group', id: selectedGroupId, name: group?.name ?? selectedGroupId },
      'rbac.groupMembers.patch',
      { changes: [{ userId, op: 'remove' }] },
      'Remove member'
    );
    onUpdate(next, event);
  }

  // User view
  let userQuery = $state('');
  let selectedUserId = $state('');
  let newMembershipGroupId = $state('');
  let newMembershipRoleId = $state('');

  $effect(() => {
    if (!selectedGroupId && groups.length > 0) {
      selectedGroupId = groups[0]!.id;
    }
    if (selectedGroupId && !groups.some((g) => g.id === selectedGroupId) && groups.length > 0) {
      selectedGroupId = groups[0]!.id;
    }

    if (!bulkRoleId && roles.length > 0) {
      bulkRoleId = roles[0]!.id;
    }
    if (bulkRoleId && !roles.some((r) => r.id === bulkRoleId) && roles.length > 0) {
      bulkRoleId = roles[0]!.id;
    }

    if (!addRoleId && roles.length > 0) {
      addRoleId = roles[0]!.id;
    }
    if (addRoleId && !roles.some((r) => r.id === addRoleId) && roles.length > 0) {
      addRoleId = roles[0]!.id;
    }

    if (!selectedUserId && users.length > 0) {
      selectedUserId = users[0]!.id;
    }
    if (selectedUserId && !users.some((u) => u.id === selectedUserId) && users.length > 0) {
      selectedUserId = users[0]!.id;
    }

    if (!newMembershipGroupId && groups.length > 0) {
      newMembershipGroupId = groups[0]!.id;
    }
    if (newMembershipGroupId && !groups.some((g) => g.id === newMembershipGroupId) && groups.length > 0) {
      newMembershipGroupId = groups[0]!.id;
    }

    if (!newMembershipRoleId && roles.length > 0) {
      newMembershipRoleId = roles[0]!.id;
    }
    if (newMembershipRoleId && !roles.some((r) => r.id === newMembershipRoleId) && roles.length > 0) {
      newMembershipRoleId = roles[0]!.id;
    }
  });

  const filteredUsers = $derived.by(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => `${user.email} ${user.id}`.toLowerCase().includes(q));
  });

  const selectedUser = $derived.by(() => users.find((user) => user.id === selectedUserId) ?? null);

  function setGlobalRole(userId: string, roleId: string) {
    const next = clone(users).map((user) => (user.id === userId ? { ...user, globalRoleId: roleId } : user));
    const user = users.find((item) => item.id === userId);
    const event = auditEvent(
      { type: 'user', id: userId, name: user?.email ?? userId },
      'rbac.user.patch',
      { globalRoleId: roleId },
      'Update global role'
    );
    onUpdate(next, event);
  }

  function addMembership() {
    if (!selectedUserId || !newMembershipGroupId) return;
    const next = setMembership(clone(users), selectedUserId, newMembershipGroupId, newMembershipRoleId);
    const group = groups.find((g) => g.id === newMembershipGroupId);
    const user = users.find((u) => u.id === selectedUserId);
    const event = auditEvent(
      { type: 'user', id: selectedUserId, name: user?.email ?? selectedUserId },
      'rbac.groupMembers.patch',
      { changes: [{ userId: selectedUserId, op: 'setRole', groupId: newMembershipGroupId, roleId: newMembershipRoleId }] },
      `Add membership to ${group?.name ?? newMembershipGroupId}`
    );
    onUpdate(next, event);
  }

  function removeMembershipFromUser(groupId: string) {
    if (!selectedUserId) return;
    const next = removeMembership(clone(users), selectedUserId, groupId);
    const group = groups.find((g) => g.id === groupId);
    const user = users.find((u) => u.id === selectedUserId);
    const event = auditEvent(
      { type: 'user', id: selectedUserId, name: user?.email ?? selectedUserId },
      'rbac.groupMembers.patch',
      { changes: [{ userId: selectedUserId, op: 'remove', groupId }] },
      `Remove membership from ${group?.name ?? groupId}`
    );
    onUpdate(next, event);
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div class="text-lg font-semibold text-slate-200">{$_('adminRbac.groups.title')}</div>
      <div class="text-sm text-slate-400">{$_('adminRbac.groups.subtitle')}</div>
    </div>
    <div class="flex gap-2">
      <Button size="sm" variant={active === 'group' ? 'primary' : 'secondary'} onclick={() => (active = 'group')}>
        {#snippet leftIcon()}<Users class="w-4 h-4" />{/snippet}
        {$_('adminRbac.groups.tabs.byGroup')}
      </Button>
      <Button size="sm" variant={active === 'user' ? 'primary' : 'secondary'} onclick={() => (active = 'user')}>
        {#snippet leftIcon()}<UserPlus class="w-4 h-4" />{/snippet}
        {$_('adminRbac.groups.tabs.byUser')}
      </Button>
    </div>
  </div>

  {#if active === 'group'}
    <div class="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <div class="card min-w-0">
        <div class="space-y-3">
          <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.groups.groupList')}</div>
          <input class="input-base" bind:value={groupQuery} placeholder={$_('adminRbac.groups.searchGroups')} />
          <div class="space-y-1">
            {#each filteredGroups as group (group.id)}
              <button
                type="button"
                class={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  group.id === selectedGroupId
                    ? 'bg-blue-900/40 text-blue-100'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                onclick={() => {
                  selectedGroupId = group.id;
                  memberSelection = new Set();
                }}
              >
                <div class="flex items-center justify-between gap-2">
                  <span>{group.name}</span>
                  <span class="badge-info">{groupMemberCounts.get(group.id) ?? 0}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="card min-w-0">
        {#if !selectedGroup}
          <div class="alert alert-info">{$_('adminRbac.groups.noGroupSelected')}</div>
        {:else}
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-sm font-semibold text-slate-200">{selectedGroup.name}</div>
                <div class="text-xs text-slate-500">{selectedGroup.description}</div>
              </div>
              <Button size="sm" onclick={() => (showAddModal = true)}>{$_('adminRbac.groups.actions.addMembers')}</Button>
            </div>

            <div class="flex flex-wrap items-end gap-2">
              <div class="w-56">
                <label class="text-xs font-semibold text-slate-300" for="rbac-bulk-role">
                  {$_('adminRbac.groups.bulk.role')}
                </label>
                <select id="rbac-bulk-role" class="select-base" bind:value={bulkRoleId}>
                  {#each roles as role (role.id)}
                    <option value={role.id}>{role.name}</option>
                  {/each}
                </select>
                {$_('adminRbac.groups.bulk.apply')}
              </Button>
              <div class="text-xs text-slate-500">{$_('adminRbac.groups.bulk.selected', { values: { count: memberSelection.size } })}</div>
            </div>

            <div class="overflow-auto border border-slate-700 rounded-xl">
              <Table>
                <TableHeader>
                  <TableHeaderCell class="w-10"></TableHeaderCell>
                  <TableHeaderCell>{$_('adminRbac.groups.members.user')}</TableHeaderCell>
                  <TableHeaderCell>{$_('adminRbac.groups.members.role')}</TableHeaderCell>
                  <TableHeaderCell class="w-32">{$_('common.actions')}</TableHeaderCell>
                </TableHeader>
                <tbody>
                  {#each groupMembers as member (member.user.id)}
                    <TableRow>
                      <TableCell>
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
                          checked={memberSelection.has(member.user.id)}
                          onclick={() => {
                            const next = new Set(memberSelection);
                            if (next.has(member.user.id)) next.delete(member.user.id);
                            else next.add(member.user.id);
                            memberSelection = next;
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div class="font-semibold text-slate-200">{member.user.email}</div>
                        <div class="text-xs text-slate-500">{member.user.id}</div>
                      </TableCell>
                      <TableCell class="font-mono text-xs">{member.roleId}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="secondary" onclick={() => removeMember(member.user.id)}>
                          {$_('common.remove')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  {/each}
                  {#if groupMembers.length === 0}
                    <TableRow>
                      <TableCell colspan={4} class="text-center text-sm text-slate-500">
                        {$_('adminRbac.groups.members.empty')}
                      </TableCell>
                    </TableRow>
                  {/if}
                </tbody>
              </Table>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <Modal bind:open={showAddModal} size="lg" title={$_('adminRbac.groups.add.title')}>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-300" for="rbac-add-users">
            {$_('adminRbac.groups.add.users')}
          </label>
          <select
            id="rbac-add-users"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            multiple
            size={6}
            bind:value={addUserIds}
          >
            {#each users as user (user.id)}
              <option value={user.id}>{user.email}</option>
            {/each}
          </select>
          <div class="mt-1 text-[11px] text-slate-500">{$_('adminRbac.groups.add.usersHint')}</div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-300" for="rbac-add-role">
            {$_('adminRbac.groups.add.role')}
          </label>
          <select id="rbac-add-role" class="select-base" bind:value={addRoleId}>
            {#each roles as role (role.id)}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
        </div>
      </div>
      {#snippet footer()}
        <div class="flex justify-end gap-2">
          <Button variant="secondary" onclick={() => (showAddModal = false)}>{$_('common.cancel')}</Button>
          <Button variant="primary" onclick={confirmAddMembers} disabled={addUserIds.length === 0}>{$_('common.add')}</Button>
        </div>
      {/snippet}
    </Modal>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
      <div class="card min-w-0">
        <div class="space-y-3">
          <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.groups.userPicker')}</div>
          <input class="input-base" bind:value={userQuery} placeholder={$_('adminRbac.groups.searchUsers')} />
          <select
            id="rbac-user-list"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            size={8}
            bind:value={selectedUserId}
          >
            {#each filteredUsers as user (user.id)}
              <option value={user.id}>{user.email}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="card min-w-0">
        {#if !selectedUser}
          <div class="alert alert-info">{$_('adminRbac.groups.noUserSelected')}</div>
        {:else}
          <div class="space-y-4">
            <div>
              <div class="text-sm font-semibold text-slate-200">{selectedUser.email}</div>
              <div class="text-xs text-slate-500">{selectedUser.id}</div>
            </div>

            <div>
              <label class="text-xs font-semibold text-slate-300" for="rbac-global-role">
                {$_('adminRbac.groups.user.globalRole')}
              </label>
              <select id="rbac-global-role" class="select-base" value={selectedUser.globalRoleId} onchange={(e) => setGlobalRole(selectedUser.id, (e.currentTarget as HTMLSelectElement).value)}>
                {#each roles as role (role.id)}
                  <option value={role.id}>{role.name}</option>
                {/each}
              </select>
            </div>

            <div class="space-y-2">
              <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.groups.user.memberships')}</div>
              <div class="space-y-2">
                {#each selectedUser.memberships as membership (membership.groupId)}
                  <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2">
                    <div class="text-sm">
                      <div class="font-semibold text-slate-200">{groups.find((g) => g.id === membership.groupId)?.name ?? membership.groupId}</div>
                      <div class="text-xs text-slate-500">{membership.roleId}</div>
                    </div>
                    <Button size="sm" variant="secondary" onclick={() => removeMembershipFromUser(membership.groupId)}>{$_('common.remove')}</Button>
                  </div>
                {/each}
                {#if selectedUser.memberships.length === 0}
                  <div class="alert alert-info">{$_('adminRbac.groups.user.noMemberships')}</div>
                {/if}
              </div>
            </div>

            <div class="rounded-xl border border-slate-700 p-3 space-y-2">
              <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.groups.user.addMembership')}</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-semibold text-slate-300" for="rbac-user-group">
                    {$_('adminRbac.groups.user.group')}
                  </label>
                  <select id="rbac-user-group" class="select-base" bind:value={newMembershipGroupId}>
                    {#each groups as group (group.id)}
                      <option value={group.id}>{group.name}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold text-slate-300" for="rbac-user-role">
                    {$_('adminRbac.groups.user.role')}
                  </label>
                  <select id="rbac-user-role" class="select-base" bind:value={newMembershipRoleId}>
                    {#each roles as role (role.id)}
                      <option value={role.id}>{role.name}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="primary" onclick={addMembership}>{$_('common.add')}</Button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
