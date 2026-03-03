<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { governanceApi, type ApprovalRequest } from '$lib/netops/api/governanceApi';

  let approvals = $state<ApprovalRequest[]>([]);
  let status = $state('');

  async function loadApprovals() {
    approvals = await governanceApi.listApprovals();
  }

  async function resolve(id: string, next: 'approved' | 'rejected') {
    status = '';
    const updated = await governanceApi.resolveApproval(id, next);
    approvals = approvals.map((item) => (item.id === id ? updated : item));
    status = `Approval ${next}: ${updated.ticketId}`;
  }

  onMount(() => {
    void loadApprovals();
  });
</script>

<div class="card space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold text-white">Approval Workflow</h3>
      <p class="text-sm text-slate-500">Gate high-risk actions before execution.</p>
    </div>
    <span class="badge-primary">Core</span>
  </div>

  {#if status}
    <div class="alert alert-info">{status}</div>
  {/if}

  <div class="space-y-2">
    {#if approvals.length === 0}
      <p class="text-sm text-slate-500">No approvals pending.</p>
    {:else}
      {#each approvals as approval}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold">{approval.reason}</div>
              <div class="text-xs text-slate-500">
                Device {approval.deviceId} · Ticket {approval.ticketId}
              </div>
              <div class="text-xs text-slate-500">{approval.requestedBy}</div>
            </div>
            <span class={approval.status === 'approved' ? 'badge-success' : approval.status === 'rejected' ? 'badge-error' : 'badge-warning'}>
              {approval.status}
            </span>
          </div>
          {#if approval.status === 'pending'}
            <div class="flex gap-2 mt-2">
              <Button size="sm" onclick={() => resolve(approval.id, 'approved')}>Approve</Button>
              <Button size="sm" variant="secondary" onclick={() => resolve(approval.id, 'rejected')}>Reject</Button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
