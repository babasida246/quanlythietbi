<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { Search, Settings2 } from 'lucide-svelte';
  import { _ } from '$lib/i18n';
  import { indexRbacData, resolveInheritedScope, resolveRolePermission } from '$lib/rbac/engine';
  import { scopeValues, type AuditEvent, type PermissionDef, type Role, type RolePermissionOverride, type Scope } from '$lib/rbac/types';
  import ReviewChangesModal, { type ChangeRow } from './ReviewChangesModal.svelte';

  type Props = {
    roles: Role[];
    permissionDefs: PermissionDef[];
    overrides: RolePermissionOverride[];
    actorId: string;
    actorEmail: string;
    focus?: { permKey: string; roleId?: string } | null;
    onSave: (nextOverrides: RolePermissionOverride[], auditEvent: AuditEvent | null) => void;
    onOpenAudit: () => void;
  };

  let { roles, permissionDefs, overrides, actorId, actorEmail, focus = null, onSave, onOpenAudit }: Props = $props();

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

  let baselineOverrides = $state<RolePermissionOverride[]>([]);
  let workingOverrides = $state<RolePermissionOverride[]>([]);

  // UI state
  let query = $state('');
  let filterResources = $state<string[]>([]);
  let filterActions = $state<string[]>([]);
  let filterTags = $state<string[]>([]);
  let showOnlyDifferences = $state(false);
  let showInherited = $state(true);
  let compactMode = $state(false);

  // Selection for bulk operations (cell keys roleId::permKey).
  let selection = $state<Set<string>>(new Set());
  let lastSelected = $state<{ roleId: string; permKey: string } | null>(null);

  // Review modal
  let reviewOpen = $state(false);
  let reviewRows = $state<ChangeRow[]>([]);

  // Sync when parent overrides change (e.g. after save).
  $effect(() => {
    baselineOverrides = overrides;
    workingOverrides = clone(overrides);
    selection = new Set();
  });

  const rolesById = $derived.by(() => new Map(roles.map((role) => [role.id, role])));
  const permissionByKey = $derived.by(() => new Map(permissionDefs.map((perm) => [perm.key, perm])));
  const resources = $derived.by(() => Array.from(new Set(permissionDefs.map((perm) => perm.resource))).sort());
  const actions = $derived.by(() => Array.from(new Set(permissionDefs.map((perm) => perm.action))).sort());
  const tags = $derived.by(() => {
    const unique = new Set<string>();
    for (const perm of permissionDefs) {
      for (const tag of perm.tags ?? []) unique.add(tag);
    }
    return Array.from(unique).sort();
  });

  function hasAnyFilter(): boolean {
    return Boolean(query.trim() || filterResources.length || filterActions.length || filterTags.length);
  }

  const visiblePermissions = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const resourcesSet = new Set(filterResources);
    const actionsSet = new Set(filterActions);
    const tagsSet = new Set(filterTags);

    return permissionDefs.filter((perm) => {
      if (resourcesSet.size > 0 && !resourcesSet.has(perm.resource)) return false;
      if (actionsSet.size > 0 && !actionsSet.has(perm.action)) return false;
      if (tagsSet.size > 0) {
        const permTags = perm.tags ?? [];
        if (!permTags.some((tag) => tagsSet.has(tag))) return false;
      }
      if (!q) return true;
      const haystack = `${perm.key} ${perm.resource} ${perm.action} ${perm.title} ${perm.description}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  type EffectiveMap = Map<string, Map<string, ReturnType<typeof resolveRolePermission>['record']>>;

  const workingIndex = $derived.by(() => indexRbacData(roles, workingOverrides));
  const baselineIndex = $derived.by(() => indexRbacData(roles, baselineOverrides));

  const effectiveWorking = $derived.by(() => {
    const map: EffectiveMap = new Map();
    for (const role of roles) {
      const roleMap = new Map<string, ReturnType<typeof resolveRolePermission>['record']>();
      for (const perm of permissionDefs) {
        roleMap.set(perm.key, resolveRolePermission(role.id, perm.key, workingIndex).record);
      }
      map.set(role.id, roleMap);
    }
    return map;
  });

  const effectiveBaseline = $derived.by(() => {
    const map: EffectiveMap = new Map();
    for (const role of roles) {
      const roleMap = new Map<string, ReturnType<typeof resolveRolePermission>['record']>();
      for (const perm of permissionDefs) {
        roleMap.set(perm.key, resolveRolePermission(role.id, perm.key, baselineIndex).record);
      }
      map.set(role.id, roleMap);
    }
    return map;
  });

  const diffs = $derived.by(() => {
    const changed = new Map<string, ChangeRow>();
    for (const role of roles) {
      for (const perm of permissionDefs) {
        const before = effectiveBaseline.get(role.id)?.get(perm.key);
        const after = effectiveWorking.get(role.id)?.get(perm.key);
        if (!before || !after) continue;

        if (before.scope === after.scope && before.source === after.source && before.isExplicit === after.isExplicit) {
          continue;
        }

        changed.set(`${role.id}::${perm.key}`, {
          roleId: role.id,
          roleName: role.name,
          permKey: perm.key,
          permTitle: perm.title,
          beforeScope: before.scope,
          afterScope: after.scope,
          beforeSource: before.source,
          afterSource: after.source,
          isDangerous: perm.isDangerous
        });
      }
    }
    return changed;
  });

  const dirtyCount = $derived.by(() => diffs.size);

  const visiblePermissionKeys = $derived.by(() => visiblePermissions.map((perm) => perm.key));

  const groupedByResource = $derived.by(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const perm of visiblePermissions) {
      const list = map.get(perm.resource) ?? [];
      list.push(perm);
      map.set(perm.resource, list);
    }
    return Array.from(map.entries()).map(([resource, perms]) => ({
      resource,
      perms: perms.sort((a, b) => a.key.localeCompare(b.key))
    }));
  });

  const differencesVisiblePermissions = $derived.by(() => {
    if (!showOnlyDifferences) return visiblePermissions;
    return visiblePermissions.filter((perm) => {
      return roles.some((role) => {
        const record = effectiveWorking.get(role.id)?.get(perm.key);
        const roleHasBase = Boolean(rolesById.get(role.id)?.baseRoleId);
        if (record?.isExplicit) return true;
        if (!roleHasBase && record && record.scope !== 'none') return true;
        return false;
      });
    });
  });

  const groupedByResourceFiltered = $derived.by(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const perm of differencesVisiblePermissions) {
      const list = map.get(perm.resource) ?? [];
      list.push(perm);
      map.set(perm.resource, list);
    }
    return Array.from(map.entries()).map(([resource, perms]) => ({
      resource,
      perms: perms.sort((a, b) => a.key.localeCompare(b.key))
    }));
  });

  function buildCellKey(roleId: string, permKey: string): string {
    return `${roleId}::${permKey}`;
  }

  function findOverride(list: RolePermissionOverride[], roleId: string, permKey: string): RolePermissionOverride | undefined {
    return list.find((item) => item.roleId === roleId && item.permKey === permKey);
  }

  function upsertOverride(list: RolePermissionOverride[], next: RolePermissionOverride): RolePermissionOverride[] {
    const remaining = list.filter((item) => !(item.roleId === next.roleId && item.permKey === next.permKey));
    return [...remaining, next];
  }

  function removeOverride(list: RolePermissionOverride[], roleId: string, permKey: string): RolePermissionOverride[] {
    return list.filter((item) => !(item.roleId === roleId && item.permKey === permKey));
  }

  function applyScope(roleId: string, permKey: string, scope: Scope) {
    const role = rolesById.get(roleId);
    const inheritedScope = resolveInheritedScope(roleId, permKey, workingIndex);

    const shouldClearOverride = Boolean(role?.baseRoleId) && scope === inheritedScope;
    const shouldClearDefault = !role?.baseRoleId && scope === (role?.defaultScopePolicy ?? 'none');

    if (shouldClearOverride || shouldClearDefault) {
      workingOverrides = removeOverride(workingOverrides, roleId, permKey);
      return;
    }

    const current = findOverride(workingOverrides, roleId, permKey);
    workingOverrides = upsertOverride(workingOverrides, {
      ...(current ?? {}),
      roleId,
      permKey,
      scope,
      updatedAt: nowIso(),
      updatedBy: actorEmail || actorId
    });
  }

  function toggleSelection(roleId: string, permKey: string, shiftKey: boolean) {
    const next = new Set(selection);
    const currentKey = buildCellKey(roleId, permKey);

    if (shiftKey && lastSelected && lastSelected.roleId === roleId) {
      const start = visiblePermissionKeys.indexOf(lastSelected.permKey);
      const end = visiblePermissionKeys.indexOf(permKey);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        for (let i = from; i <= to; i++) {
          next.add(buildCellKey(roleId, visiblePermissionKeys[i]!));
        }
        selection = next;
        return;
      }
    }

    if (next.has(currentKey)) {
      next.delete(currentKey);
    } else {
      next.add(currentKey);
    }
    selection = next;
    lastSelected = { roleId, permKey };
  }

  function clearSelection() {
    selection = new Set();
    lastSelected = null;
  }

  function bulkSet(scope: Scope) {
    for (const key of selection) {
      const [roleId, permKey] = key.split('::');
      if (!roleId || !permKey) continue;
      applyScope(roleId, permKey, scope as Scope);
    }
  }

  function bulkClearOverride() {
    for (const key of selection) {
      const [roleId, permKey] = key.split('::');
      if (!roleId || !permKey) continue;
      workingOverrides = removeOverride(workingOverrides, roleId, permKey);
    }
  }

  function setAllVisibleForRole(roleId: string, scope: Scope) {
    const keys = (showOnlyDifferences ? differencesVisiblePermissions : visiblePermissions).map((perm) => perm.key);
    for (const permKey of keys) {
      applyScope(roleId, permKey, scope);
    }
  }

  function clearOverridesVisibleForRole(roleId: string) {
    const keys = new Set((showOnlyDifferences ? differencesVisiblePermissions : visiblePermissions).map((perm) => perm.key));
    workingOverrides = workingOverrides.filter((ov) => !(ov.roleId === roleId && keys.has(ov.permKey)));
  }

  function discardChanges() {
    workingOverrides = clone(baselineOverrides);
    clearSelection();
  }

  function openReview() {
    reviewRows = Array.from(diffs.values()).sort((a, b) => {
      const role = a.roleName.localeCompare(b.roleName);
      if (role !== 0) return role;
      return a.permKey.localeCompare(b.permKey);
    });
    reviewOpen = true;
  }

  function confirmSave(payload: { reason: string }) {
    const reason = payload.reason.trim();

    const changes = reviewRows.map((row) => {
      const beforeOverride = findOverride(baselineOverrides, row.roleId, row.permKey);
      const afterOverride = findOverride(workingOverrides, row.roleId, row.permKey);
      if (beforeOverride && !afterOverride) {
        return { permKey: row.permKey, op: 'unset' as const };
      }
      if (afterOverride && (!beforeOverride || beforeOverride.scope !== afterOverride.scope)) {
        return { permKey: row.permKey, op: 'set' as const, scope: afterOverride.scope };
      }
      return { permKey: row.permKey, op: 'set' as const, scope: row.afterScope };
    });

    const auditEvent: AuditEvent = {
      id: makeAuditId(),
      time: nowIso(),
      actorId,
      actorEmail,
      target: { type: 'role', id: 'matrix', name: 'Role Matrix' },
      action: 'rbac.matrix.save',
      reason: reason || undefined,
      diff: { changes },
      dangerous: reviewRows.some((row) => row.isDangerous && row.afterScope !== 'none')
    };

    baselineOverrides = clone(workingOverrides);
    reviewOpen = false;
    clearSelection();
    onSave(clone(workingOverrides), auditEvent);
  }

  function exportCsv() {
    const lines: string[] = [];
    lines.push(['roleId', 'roleName', 'permKey', 'scope', 'source'].join(','));
    const currentPermissions = showOnlyDifferences ? differencesVisiblePermissions : visiblePermissions;

    for (const role of roles) {
      for (const perm of currentPermissions) {
        const record = effectiveWorking.get(role.id)?.get(perm.key);
        if (!record) continue;
        const fields = [
          role.id,
          role.name,
          perm.key,
          record.scope,
          record.source
        ].map((value) => `"${String(value).replaceAll('"', '""')}"`);
        lines.push(fields.join(','));
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rbac-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Focus scrolling from Explain tab.
  let highlightKey = $state<string | null>(null);

  $effect(() => {
    if (!focus) return;
    const key = buildCellKey(focus.roleId ?? roles[0]?.id ?? '', focus.permKey);
    highlightKey = key;
    queueMicrotask(() => {
      const target = document.getElementById(`perm-row-${CSS.escape(focus.permKey)}`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
      }
    });
    setTimeout(() => {
      if (highlightKey === key) highlightKey = null;
    }, 2500);
  });
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div class="text-lg font-semibold text-slate-900 dark:text-white">{$_('adminRbac.matrix.title')}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">{$_('adminRbac.matrix.subtitle')}</div>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button size="sm" onclick={openReview} disabled={dirtyCount === 0}>{$_('adminRbac.matrix.actions.save')}</Button>
      <Button size="sm" variant="secondary" onclick={discardChanges} disabled={dirtyCount === 0}>{$_('adminRbac.matrix.actions.discard')}</Button>
      <Button size="sm" variant="secondary" onclick={exportCsv} disabled={permissionDefs.length === 0}>{$_('adminRbac.matrix.actions.export')}</Button>
      <Button size="sm" variant="secondary" onclick={onOpenAudit}>{$_('adminRbac.matrix.actions.openAudit')}</Button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <div class="lg:col-span-2">
      <label class="text-xs font-semibold text-slate-600 dark:text-slate-300" for="rbac-perm-search">
        {$_('adminRbac.matrix.search')}
      </label>
      <div class="relative mt-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input id="rbac-perm-search" class="input-base pl-9" bind:value={query} placeholder={$_('adminRbac.matrix.searchPlaceholder')} />
      </div>
    </div>
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <Settings2 class="w-4 h-4" />
        <span>{dirtyCount} {$_('adminRbac.matrix.dirty')}</span>
      </div>
      <div class="flex flex-wrap gap-3">
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={showOnlyDifferences} />
          <span class="text-xs text-slate-300">{$_('adminRbac.matrix.toggles.differences')}</span>
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={showInherited} />
          <span class="text-xs text-slate-300">{$_('adminRbac.matrix.toggles.inherited')}</span>
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={compactMode} />
          <span class="text-xs text-slate-300">{$_('adminRbac.matrix.toggles.compact')}</span>
        </label>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <div>
      <label class="text-xs font-semibold text-slate-600 dark:text-slate-300" for="rbac-filter-resources">
        {$_('adminRbac.matrix.filters.resource')}
      </label>
      <select
        id="rbac-filter-resources"
        class="mt-1 w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm text-slate-100"
        multiple
        size={Math.min(6, Math.max(2, resources.length || 2))}
        bind:value={filterResources}
      >
        {#each resources as resource}
          <option value={resource}>{resource}</option>
        {/each}
      </select>
    </div>
    <div>
      <label class="text-xs font-semibold text-slate-600 dark:text-slate-300" for="rbac-filter-actions">
        {$_('adminRbac.matrix.filters.action')}
      </label>
      <select
        id="rbac-filter-actions"
        class="mt-1 w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm text-slate-100"
        multiple
        size={Math.min(6, Math.max(2, actions.length || 2))}
        bind:value={filterActions}
      >
        {#each actions as action}
          <option value={action}>{action}</option>
        {/each}
      </select>
    </div>
    <div>
      <label class="text-xs font-semibold text-slate-600 dark:text-slate-300" for="rbac-filter-tags">
        {$_('adminRbac.matrix.filters.tag')}
      </label>
      <select
        id="rbac-filter-tags"
        class="mt-1 w-full rounded-lg border border-slate-700 bg-surface-1 px-3 py-2 text-sm text-slate-100"
        multiple
        size={Math.min(6, Math.max(2, tags.length || 2))}
        bind:value={filterTags}
      >
        {#each tags as tag}
          <option value={tag}>{tag}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if selection.size > 0}
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="text-sm font-semibold text-blue-900">
        {$_('adminRbac.matrix.bulk.selected', { values: { count: selection.size } })}
      </div>
      <div class="flex flex-wrap gap-2">
        {#each scopeValues as scope}
          <Button size="sm" variant="secondary" onclick={() => bulkSet(scope)}>{scope}</Button>
        {/each}
        <Button size="sm" variant="secondary" onclick={bulkClearOverride}>{$_('adminRbac.matrix.bulk.clearOverride')}</Button>
        <Button size="sm" variant="secondary" onclick={clearSelection}>{$_('adminRbac.matrix.bulk.clearSelection')}</Button>
      </div>
    </div>
  {/if}

  <div class="rounded-xl border border-slate-800 bg-surface-1 overflow-hidden">
    <div class="overflow-auto">
      <table class={`w-full ${compactMode ? 'text-xs' : 'text-sm'} min-w-[900px]`}>
        <thead class="sticky top-0 z-10 bg-surface-1 border-b border-slate-800">
          <tr>
            <th class="sticky left-0 z-20 bg-surface-1 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 w-[360px]">
              {$_('adminRbac.matrix.columns.permission')}
            </th>
            {#each roles as role (role.id)}
              <th class="px-4 py-3 text-left">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-semibold text-slate-900 dark:text-white">{role.name}</div>
                  <details class="relative">
                    <summary class="cursor-pointer list-none rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Role actions">
                      <span class="text-slate-400">⋯</span>
                    </summary>
                    <div class="absolute right-0 mt-2 w-52 rounded-xl border border-slate-800 bg-surface-1 shadow-lg z-50">
                      <div class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{$_('adminRbac.matrix.roleMenu.title')}</div>
                      <div class="p-2 space-y-1">
                        {#each scopeValues as scope}
                          <button
                            type="button"
                            class="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onclick={() => setAllVisibleForRole(role.id, scope)}
                          >
                            {$_('adminRbac.matrix.roleMenu.setVisible', { values: { scope } })}
                          </button>
                        {/each}
                        <button
                          type="button"
                          class="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          onclick={() => clearOverridesVisibleForRole(role.id)}
                        >
                          {$_('adminRbac.matrix.roleMenu.clearVisible')}
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
                {#if role.baseRoleId}
                  <div class="text-[11px] text-slate-500">{$_('adminRbac.matrix.roleMenu.inherits', { values: { base: String(role.baseRoleId) } })}</div>
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each groupedByResourceFiltered as group (group.resource)}
            <tr class="bg-slate-50 dark:bg-slate-800/40">
              <td colspan={roles.length + 1} class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.resource}
              </td>
            </tr>
            {#each group.perms as perm (perm.key)}
              {@const rowId = `perm-row-${perm.key}`}
              <tr id={rowId} class={highlightKey?.endsWith(`::${perm.key}`) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                <td class="sticky left-0 z-10 bg-surface-1 px-4 py-3 align-top">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold text-slate-900 dark:text-white">{perm.title}</div>
                      <div class="text-xs text-slate-500">{perm.key}</div>
                      {#if !compactMode}
                        <div class="mt-1 text-xs text-slate-500">{perm.description}</div>
                      {/if}
                    </div>
                    {#if perm.isDangerous}
                      <span class="badge-error">{$_('adminRbac.common.danger')}</span>
                    {/if}
                  </div>
                </td>
                {#each roles as role (role.id)}
                  {@const key = buildCellKey(role.id, perm.key)}
                  {@const record = effectiveWorking.get(role.id)?.get(perm.key)}
                  {@const baseScope = resolveInheritedScope(role.id, perm.key, workingIndex)}
                  {@const state = record?.source ?? 'default'}
                  <td
                    class={`px-4 py-3 align-top cursor-pointer select-none ${
                      selection.has(key) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    title={`Effective: ${record?.scope ?? 'none'}\nSource: ${state}${record?.inheritedFromRoleId ? ` from ${record.inheritedFromRoleId}` : ''}\nBase: ${baseScope}`}
                    onclick={(e) => toggleSelection(role.id, perm.key, (e as MouseEvent).shiftKey)}
                  >
                    <div class="flex items-start gap-2">
                      <select
                        class={`w-full rounded-lg border px-2 py-1 text-xs font-mono bg-surface-1 ${
                          state === 'explicit'
                            ? 'border-blue-300 dark:border-blue-700'
                            : state === 'inherited'
                              ? showInherited
                                ? 'border-slate-200 dark:border-slate-700 text-slate-500'
                                : 'border-slate-200 dark:border-slate-700'
                              : 'border-slate-200 dark:border-slate-700'
                        }`}
                        value={record?.scope ?? 'none'}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => e.stopPropagation()}
                        onchange={(e) => applyScope(role.id, perm.key, (e.currentTarget as HTMLSelectElement).value as Scope)}
                      >
                        {#each scopeValues as scope}
                          <option value={scope}>{scope}</option>
                        {/each}
                      </select>
                      <div class="pt-1 text-[11px] text-slate-400 w-10 text-right">
                        {#if state === 'explicit'}
                          ●
                        {:else if state === 'inherited' && showInherited}
                          ↳
                        {:else}
                          —
                        {/if}
                      </div>
                    </div>
                  </td>
                {/each}
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <ReviewChangesModal
    open={reviewOpen}
    changes={reviewRows}
    onCancel={() => (reviewOpen = false)}
    onConfirm={confirmSave}
  />
</div>
