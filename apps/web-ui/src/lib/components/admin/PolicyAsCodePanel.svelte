<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { governanceApi, type GovernancePolicy } from '$lib/netops/api/governanceApi';

  let policies = $state<GovernancePolicy[]>([]);
  let name = $state('');
  let environment = $state<'dev' | 'staging' | 'prod' | 'all'>('all');
  let allowList = $state('');
  let denyList = $state('reload\nerase');
  let dangerousList = $state('reload\nwrite erase');
  let requireApproval = $state(false);
  let status = $state('');

  async function loadPolicies() {
    policies = await governanceApi.listPolicies();
  }

  async function createPolicy() {
    status = '';
    const policy = await governanceApi.createPolicy({
      name,
      environment,
      allowList: allowList.split('\n').map((item) => item.trim()).filter(Boolean),
      denyList: denyList.split('\n').map((item) => item.trim()).filter(Boolean),
      dangerousList: dangerousList.split('\n').map((item) => item.trim()).filter(Boolean),
      requireApproval
    });
    policies = [policy, ...policies];
    status = `Policy created: ${policy.name}`;
    name = '';
  }

  onMount(() => {
    void loadPolicies();
  });
</script>

<div class="card space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold text-white">Policy as Code</h3>
      <p class="text-sm text-slate-500">Define allow/deny/dangerous rules per environment.</p>
    </div>
    <span class="badge-primary">Governance</span>
  </div>

  <div class="grid lg:grid-cols-2 gap-4">
    <div class="space-y-2">
      <label class="label-base">Name</label>
      <input class="input-base" bind:value={name} placeholder="Prod Guardrails"  />
      <label class="label-base">Environment</label>
      <select class="select-base" bind:value={environment}>
        <option value="all">All</option>
        <option value="dev">Dev</option>
        <option value="staging">Staging</option>
        <option value="prod">Prod</option>
      </select>
      <div class="flex items-center gap-2">
        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={requireApproval}  />
        <span class="text-sm">Require approval for risky actions</span>
      </div>
    </div>
    <div class="space-y-2">
      <label class="label-base">Allowlist (one per line)</label>
      <textarea class="textarea-base" rows={2} bind:value={allowList} placeholder="show\nprint" ></textarea>
      <label class="label-base">Denylist (one per line)</label>
      <textarea class="textarea-base" rows={2} bind:value={denyList} ></textarea>
      <label class="label-base">Dangerous (one per line)</label>
      <textarea class="textarea-base" rows={2} bind:value={dangerousList} ></textarea>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <Button size="sm" onclick={createPolicy} disabled={!name.trim()}>Create policy</Button>
    {#if status}
      <span class="text-xs text-slate-500">{status}</span>
    {/if}
  </div>

  <div class="space-y-2">
    {#if policies.length === 0}
      <p class="text-sm text-slate-500">No policies configured.</p>
    {:else}
      {#each policies as policy}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold">{policy.name}</div>
              <div class="text-xs text-slate-500">{policy.environment.toUpperCase()}</div>
            </div>
            <span class={policy.requireApproval ? 'badge-warning' : 'badge-success'}>
              {policy.requireApproval ? 'Approval' : 'Auto'}
            </span>
          </div>
          <div class="text-xs text-slate-500 mt-2">Allow: {policy.allowList.join(', ') || 'none'}</div>
          <div class="text-xs text-slate-500">Deny: {policy.denyList.join(', ') || 'none'}</div>
          <div class="text-xs text-slate-500">Danger: {policy.dangerousList.join(', ') || 'none'}</div>
        </div>
      {/each}
    {/if}
  </div>
</div>
