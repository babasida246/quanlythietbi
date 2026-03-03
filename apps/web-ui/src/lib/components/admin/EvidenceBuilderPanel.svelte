<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { governanceApi, type EvidenceCase } from '$lib/netops/api/governanceApi';

  let evidence = $state<EvidenceCase[]>([]);
  let deviceId = $state('');
  let ticketId = $state('');
  let summary = $state('');
  let snapshotIds = $state('');
  let status = $state('');

  async function loadEvidence() {
    evidence = await governanceApi.listEvidenceCases();
  }

  async function createEvidence() {
    status = '';
    const record = await governanceApi.createEvidenceCase({
      deviceId,
      ticketId,
      summary,
      snapshotIds: snapshotIds.split(',').map((item) => item.trim()).filter(Boolean)
    });
    evidence = [record, ...evidence];
    status = 'Evidence case created.';
    deviceId = '';
    ticketId = '';
    summary = '';
    snapshotIds = '';
  }

  onMount(() => {
    void loadEvidence();
  });
</script>

<div class="card space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold text-white">Evidence Builder</h3>
      <p class="text-sm text-slate-500">Collect snapshots and notes for compliance reviews.</p>
    </div>
    <span class="badge-primary">Compliance</span>
  </div>

  <div class="grid lg:grid-cols-2 gap-3">
    <div class="space-y-2">
      <input class="input-base" bind:value={deviceId} placeholder="Device ID"  />
      <input class="input-base" bind:value={ticketId} placeholder="Ticket ID"  />
      <input class="input-base" bind:value={snapshotIds} placeholder="Snapshot IDs (comma separated)"  />
    </div>
    <div class="space-y-2">
      <textarea class="textarea-base" rows={3} bind:value={summary} placeholder="Summary and findings" ></textarea>
      <Button size="sm" onclick={createEvidence} disabled={!deviceId.trim() || !ticketId.trim()}>Create evidence</Button>
      {#if status}
        <span class="text-xs text-slate-500">{status}</span>
      {/if}
    </div>
  </div>

  <div class="space-y-2">
    {#if evidence.length === 0}
      <p class="text-sm text-slate-500">No evidence cases yet.</p>
    {:else}
      {#each evidence as item}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="text-sm font-semibold">{item.summary}</div>
          <div class="text-xs text-slate-500">Device {item.deviceId} · Ticket {item.ticketId}</div>
          <div class="text-xs text-slate-500">Snapshots: {item.snapshotIds.join(', ') || 'none'}</div>
        </div>
      {/each}
    {/if}
  </div>
</div>
