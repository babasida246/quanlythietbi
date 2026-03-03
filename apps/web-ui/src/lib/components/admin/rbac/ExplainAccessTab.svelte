<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { ArrowRight, Search } from 'lucide-svelte';
  import { _ } from '$lib/i18n';
  import { explainEffectiveScope, indexRbacData } from '$lib/rbac/engine';
  import type { Department, ExplainResult, Group, PermissionDef, Role, RolePermissionOverride, User } from '$lib/rbac/types';

  type Props = {
    roles: Role[];
    permissionDefs: PermissionDef[];
    groups: Group[];
    departments: Department[];
    users: User[];
    overrides: RolePermissionOverride[];
    onOpenMatrix: (payload: { permKey: string; roleId?: string }) => void;
  };

  let { roles, permissionDefs, groups, departments, users, overrides, onOpenMatrix }: Props = $props();

  let userQuery = $state('');
  let permQuery = $state('');

  let selectedUserId = $state('');
  let selectedPermKey = $state('');
  let contextGroupId = $state('');
  let contextDepartmentId = $state('');
  let contextOwnerUserId = $state('');

  let result = $state<ExplainResult | null>(null);

  $effect(() => {
    if (!selectedUserId && users.length > 0) {
      selectedUserId = users[0]!.id;
    }
  });

  $effect(() => {
    if (!selectedPermKey && permissionDefs.length > 0) {
      selectedPermKey = permissionDefs[0]!.key;
    }
  });

  const filteredUsers = $derived.by(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => `${user.email} ${user.id}`.toLowerCase().includes(q));
  });

  const filteredPermissions = $derived.by(() => {
    const q = permQuery.trim().toLowerCase();
    if (!q) return permissionDefs;
    return permissionDefs.filter((perm) => `${perm.key} ${perm.title} ${perm.description}`.toLowerCase().includes(q));
  });

  const selectedUser = $derived.by(() => users.find((user) => user.id === selectedUserId) ?? null);
  const selectedPerm = $derived.by(() => permissionDefs.find((perm) => perm.key === selectedPermKey) ?? null);

  function explain() {
    if (!selectedUser || !selectedPerm) return;
    const index = indexRbacData(roles, overrides);
    result = explainEffectiveScope({
      user: selectedUser,
      permKey: selectedPerm.key,
      context: {
        groupId: contextGroupId || undefined,
        departmentId: contextDepartmentId || undefined,
        ownerUserId: contextOwnerUserId || undefined
      },
      index
    });
  }

  function computeContextRoleId(): string | undefined {
    if (!selectedUser) return undefined;
    if (contextGroupId) {
      const membership = selectedUser.memberships.find((m) => m.groupId === contextGroupId);
      if (membership) return membership.roleId;
    }
    return selectedUser.globalRoleId;
  }
</script>

<div class="space-y-4">
  <div>
    <div class="text-lg font-semibold text-slate-200">{$_('adminRbac.explain.title')}</div>
    <div class="text-sm text-slate-400">{$_('adminRbac.explain.subtitle')}</div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4">
    <div class="card min-w-0">
      <div class="space-y-4">
        <div>
          <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.explain.inputs')}</div>
          <div class="text-xs text-slate-500">{$_('adminRbac.explain.inputsHelp')}</div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold text-slate-300" for="rbac-explain-user-search">
            {$_('adminRbac.explain.user')}
          </label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input id="rbac-explain-user-search" class="input-base pl-9" bind:value={userQuery} placeholder={$_('adminRbac.explain.userSearch')} />
          </div>
          <select
            id="rbac-explain-user"
            class="w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm text-slate-100"
            size={6}
            bind:value={selectedUserId}
          >
            {#each filteredUsers as user (user.id)}
              <option value={user.id}>{user.email}</option>
            {/each}
          </select>
          {#if selectedUser}
            <div class="text-[11px] text-slate-500">
              {$_('adminRbac.explain.globalRole')}: <span class="font-mono">{selectedUser.globalRoleId}</span>
            </div>
          {/if}
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold text-slate-300" for="rbac-explain-perm-search">
            {$_('adminRbac.explain.permission')}
          </label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input id="rbac-explain-perm-search" class="input-base pl-9" bind:value={permQuery} placeholder={$_('adminRbac.explain.permissionSearch')} />
          </div>
          <select
            id="rbac-explain-perm"
            class="w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm text-slate-100"
            size={6}
            bind:value={selectedPermKey}
          >
            {#each filteredPermissions as perm (perm.key)}
              <option value={perm.key}>{perm.key} — {perm.title}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300" for="rbac-explain-group">
              {$_('adminRbac.explain.contextGroup')}
            </label>
            <select id="rbac-explain-group" class="select-base" bind:value={contextGroupId}>
              <option value="">{$_('common.optional')}</option>
              {#each groups as group (group.id)}
                <option value={group.id}>{group.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300" for="rbac-explain-department">
              {$_('adminRbac.explain.contextDepartment')}
            </label>
            <select id="rbac-explain-department" class="select-base" bind:value={contextDepartmentId}>
              <option value="">{$_('common.optional')}</option>
              {#each departments as department (department.id)}
                <option value={department.id}>{department.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-300" for="rbac-explain-owner">
            {$_('adminRbac.explain.ownerUserId')}
          </label>
          <input id="rbac-explain-owner" class="input-base" bind:value={contextOwnerUserId} placeholder={$_('adminRbac.explain.ownerPlaceholder')} />
        </div>

        <div class="flex justify-end gap-2">
          <Button variant="secondary" onclick={() => (result = null)}>{$_('common.reset')}</Button>
          <Button onclick={explain} disabled={!selectedUserId || !selectedPermKey}>{$_('adminRbac.explain.actions.explain')}</Button>
        </div>
      </div>
    </div>

    <div class="card min-w-0">
      {#if !result}
        <div class="alert alert-info">{$_('adminRbac.explain.empty')}</div>
      {:else}
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-semibold text-slate-200">{$_('adminRbac.explain.result')}</div>
              <div class="text-xs text-slate-500">{selectedPerm?.title}</div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onclick={() =>
                onOpenMatrix({
                  permKey: selectedPermKey,
                  roleId: computeContextRoleId()
                })}
            >
              {$_('adminRbac.explain.actions.openMatrix')}
              <ArrowRight class="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="badge-primary">{$_('adminRbac.explain.effective')}: <span class="font-mono">{result.effectiveScope}</span></span>
            <span class="badge-info">{$_('adminRbac.explain.source')}: <span class="font-mono">{result.source.sourceType}</span></span>
            {#if result.source.roleId}
              <span class="badge-info">{$_('adminRbac.explain.role')}: <span class="font-mono">{result.source.roleId}</span></span>
            {/if}
          </div>

          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">{$_('adminRbac.explain.trace')}</div>
            <ol class="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {#each result.steps as step, idx (idx)}
                <li class="flex gap-2">
                  <span class="font-mono text-xs text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              {/each}
            </ol>
          </div>

          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">{$_('adminRbac.explain.inheritChain')}</div>
            <div class="mt-2 text-sm text-slate-700 dark:text-slate-200 font-mono break-words">
              {result.source.inheritChain.join(' → ')}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
