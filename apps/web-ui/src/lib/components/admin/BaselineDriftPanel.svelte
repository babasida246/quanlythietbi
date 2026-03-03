<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { governanceApi, type Baseline, type DriftEvent } from '$lib/netops/api/governanceApi';

  let baselines = $state<Baseline[]>([]);
  let drifts = $state<DriftEvent[]>([]);
  let deviceId = $state('');
  let name = $state('');
  let config = $state('');
  let status = $state('');

  async function loadBaselines() {
    baselines = await governanceApi.listBaselines();
    drifts = await governanceApi.listDrifts();
  }

  async function createBaseline() {
    status = '';
    const baseline = await governanceApi.createBaseline({ deviceId, name, config });
    baselines = [baseline, ...baselines];
    status = 'Baseline saved.';
    name = '';
    config = '';
  }

  onMount(() => {
    void loadBaselines();
  });
</script>

<div class="card space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold text-white">Baseline & Drift</h3>
      <p class="text-sm text-slate-500">Define baseline configs and review drift events.</p>
    </div>
    <span class="badge-primary">Ops</span>
  </div>

  <div class="grid lg:grid-cols-2 gap-3">
    <div class="space-y-2">
      <input class="input-base" bind:value={deviceId} placeholder="Device ID"  />
      <input class="input-base" bind:value={name} placeholder="Baseline name"  />
    </div>
    <div class="space-y-2">
      <textarea class="textarea-base" rows={3} bind:value={config} placeholder="Paste baseline config" ></textarea>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <Button size="sm" onclick={createBaseline} disabled={!deviceId.trim() || !name.trim()}>Save baseline</Button>
    {#if status}
      <span class="text-xs text-slate-500">{status}</span>
    {/if}
  </div>

  <div class="space-y-2">
    <h4 class="text-sm font-semibold text-white">Baselines</h4>
    {#if baselines.length === 0}
      <p class="text-sm text-slate-500">No baselines defined.</p>
    {:else}
      {#each baselines as baseline}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="text-sm font-semibold">{baseline.name}</div>
          <div class="text-xs text-slate-500">Device {baseline.deviceId}</div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="space-y-2">
    <h4 class="text-sm font-semibold text-white">Drift Events</h4>
    {#if drifts.length === 0}
      <p class="text-sm text-slate-500">No drift events detected.</p>
    {:else}
      {#each drifts as drift}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="text-sm font-semibold">Device {drift.deviceId}</div>
          <div class="text-xs text-slate-500">Severity {drift.severity}</div>
          <pre class="text-xs bg-slate-900 text-slate-100 rounded-md p-2 whitespace-pre-wrap">{drift.diff}</pre>
        </div>
      {/each}
    {/if}
  </div>
</div>
