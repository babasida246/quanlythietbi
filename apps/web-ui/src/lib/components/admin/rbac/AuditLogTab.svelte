<script lang="ts">
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { _ } from '$lib/i18n';
  import type { AuditEvent, Group, Role, User } from '$lib/rbac/types';

  type Props = {
    events: AuditEvent[];
    roles: Role[];
    groups: Group[];
    users: User[];
  };

  let { events, roles, groups, users }: Props = $props();

  let query = $state('');
  let dangerousOnly = $state(false);
  let selected = $state<AuditEvent | null>(null);
  let openDetail = $state(false);

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((event) => (dangerousOnly ? event.dangerous : true))
      .filter((event) => {
        if (!q) return true;
        const haystack = `${event.actorEmail} ${event.action} ${event.target.type}:${event.target.id} ${event.reason ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.time.localeCompare(a.time));
  });

  function openEvent(event: AuditEvent) {
    selected = event;
    openDetail = true;
  }

  function prettyJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div class="text-lg font-semibold text-slate-200">{$_('adminRbac.audit.title')}</div>
      <div class="text-sm text-slate-400">{$_('adminRbac.audit.subtitle')}</div>
    </div>
    <div class="flex items-center gap-2">
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={dangerousOnly} />
        <span class="text-xs text-slate-300">{$_('adminRbac.audit.filters.dangerousOnly')}</span>
      </label>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <div class="lg:col-span-2">
      <label class="text-xs font-semibold text-slate-300" for="rbac-audit-search">
        {$_('adminRbac.audit.filters.search')}
      </label>
      <input id="rbac-audit-search" class="input-base" bind:value={query} placeholder={$_('adminRbac.audit.filters.searchPlaceholder')} />
    </div>
    <div class="flex items-end gap-2">
      <span class="badge-info">{filtered.length} {$_('adminRbac.audit.count')}</span>
    </div>
  </div>

  <div class="card min-w-0">
    {#if filtered.length === 0}
      <div class="alert alert-info">{$_('adminRbac.audit.empty')}</div>
    {:else}
      <div class="overflow-auto border border-slate-700 rounded-xl">
        <Table>
          <TableHeader>
            <TableHeaderCell>{$_('adminRbac.audit.columns.time')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.audit.columns.actor')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.audit.columns.target')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.audit.columns.action')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.audit.columns.reason')}</TableHeaderCell>
          </TableHeader>
          <tbody>
            {#each filtered as event (event.id)}
              <TableRow class="cursor-pointer" onclick={() => openEvent(event)}>
                <TableCell class="text-xs font-mono whitespace-nowrap">{new Date(event.time).toLocaleString()}</TableCell>
                <TableCell>
                  <div class="font-semibold text-slate-200">{event.actorEmail}</div>
                  <div class="text-xs text-slate-500 font-mono">{event.actorId}</div>
                </TableCell>
                <TableCell class="text-xs font-mono">
                  {event.target.type}:{event.target.name ?? event.target.id}
                </TableCell>
                <TableCell>
                  <div class="text-xs font-mono">{event.action}</div>
                  {#if event.dangerous}
                    <div class="mt-1">
                      <span class="badge-error">{$_('adminRbac.common.danger')}</span>
                    </div>
                  {/if}
                </TableCell>
                <TableCell class="text-xs text-slate-300">{event.reason ?? ''}</TableCell>
              </TableRow>
            {/each}
          </tbody>
        </Table>
      </div>
    {/if}
  </div>

  <Modal bind:open={openDetail} size="xl" title={$_('adminRbac.audit.detailTitle')}>
    {#if selected}
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge-primary">{selected.action}</span>
          <span class="badge-info">{selected.target.type}:{selected.target.name ?? selected.target.id}</span>
          {#if selected.dangerous}
            <span class="badge-error">{$_('adminRbac.common.danger')}</span>
          {/if}
        </div>
        {#if selected.reason}
          <div class="text-sm text-slate-200">
            <span class="font-semibold">{$_('adminRbac.audit.columns.reason')}:</span> {selected.reason}
          </div>
        {/if}
        <pre class="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto max-h-[55vh]">{prettyJson(selected.diff)}</pre>
      </div>
    {/if}
    {#snippet footer()}
      <div class="flex justify-end">
        <Button variant="secondary" onclick={() => (openDetail = false)}>{$_('common.close')}</Button>
      </div>
    {/snippet}
  </Modal>
</div>
