<script lang="ts">
  import { Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { _ } from '$lib/i18n';
  import type { Scope } from '$lib/rbac/types';

  export type ChangeRow = {
    roleId: string;
    roleName: string;
    permKey: string;
    permTitle: string;
    beforeScope: Scope;
    afterScope: Scope;
    beforeSource: string;
    afterSource: string;
    isDangerous: boolean;
  };

  type Props = {
    open: boolean;
    changes: ChangeRow[];
    onCancel: () => void;
    onConfirm: (payload: { reason: string }) => void;
  };

  let { open, changes, onCancel, onConfirm }: Props = $props();

  let acknowledgeDanger = $state(false);
  let reason = $state('');

  const hasDangerousEscalation = $derived.by(() =>
    changes.some((change) => change.isDangerous && change.afterScope !== 'none')
  );

  const reasonRequired = $derived.by(() => hasDangerousEscalation);

  const canConfirm = $derived.by(() => {
    if (changes.length === 0) return false;
    if (!reasonRequired) return true;
    return acknowledgeDanger && reason.trim().length >= 10;
  });

  $effect(() => {
    if (!open) {
      acknowledgeDanger = false;
      reason = '';
    }
  });
</script>

<Modal bind:open size="xl" title={$_('adminRbac.review.title')}>
  {#if changes.length === 0}
    <div class="alert alert-info">{$_('adminRbac.review.empty')}</div>
  {:else}
    <div class="space-y-4">
      <div class="text-sm text-slate-300">{$_('adminRbac.review.subtitle')}</div>

      <div class="max-h-[55vh] overflow-auto border border-slate-700 rounded-lg">
        <Table>
          <TableHeader>
            <TableHeaderCell>{$_('adminRbac.review.columns.role')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.review.columns.permission')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.review.columns.before')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.review.columns.after')}</TableHeaderCell>
            <TableHeaderCell>{$_('adminRbac.review.columns.source')}</TableHeaderCell>
          </TableHeader>
          <tbody>
            {#each changes as change (change.roleId + change.permKey)}
              <TableRow>
                <TableCell class="font-semibold text-slate-200">{change.roleName}</TableCell>
                <TableCell>
                  <div class="font-semibold text-slate-200">{change.permTitle}</div>
                  <div class="text-xs text-slate-500">{change.permKey}</div>
                  {#if change.isDangerous}
                    <div class="mt-1 inline-flex items-center rounded-full bg-red-900/30 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                      {$_('adminRbac.common.danger')}
                    </div>
                  {/if}
                </TableCell>
                <TableCell class="font-mono text-xs">{change.beforeScope}</TableCell>
                <TableCell class="font-mono text-xs">{change.afterScope}</TableCell>
                <TableCell class="text-xs text-slate-500">
                  <div>{change.beforeSource} → {change.afterSource}</div>
                </TableCell>
              </TableRow>
            {/each}
          </tbody>
        </Table>
      </div>

      {#if reasonRequired}
        <div class="alert alert-warning">
          <div class="space-y-3">
            <div class="font-semibold">{$_('adminRbac.review.dangerTitle')}</div>
            <div class="text-sm">{$_('adminRbac.review.dangerHelp')}</div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={acknowledgeDanger} />
              <span>{$_('adminRbac.review.acknowledge')}</span>
            </label>
            <div>
              <div class="text-xs font-semibold text-slate-200">{$_('adminRbac.review.reason')}</div>
              <textarea class="textarea-base" rows="3" bind:value={reason} placeholder={$_('adminRbac.review.reasonPlaceholder')}></textarea>
              <div class="mt-1 text-[11px] text-slate-500">{$_('adminRbac.review.reasonHint')}</div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onclick={onCancel}>{$_('common.cancel')}</Button>
      <Button onclick={() => onConfirm({ reason })} disabled={!canConfirm}>{$_('common.confirm')}</Button>
    </div>
  {/snippet}
</Modal>
