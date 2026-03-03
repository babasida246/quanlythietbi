<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { governanceApi, type MaintenanceWindow } from '$lib/netops/api/governanceApi';

  let windows = $state<MaintenanceWindow[]>([]);
  let title = $state('');
  let environment = $state<'dev' | 'staging' | 'prod' | 'all'>('all');
  let startAt = $state('');
  let endAt = $state('');
  let status = $state('');

  async function loadWindows() {
    windows = await governanceApi.listMaintenanceWindows();
  }

  async function createWindow() {
    status = '';
    const window = await governanceApi.createMaintenanceWindow({
      title,
      environment,
      startAt,
      endAt
    });
    windows = [window, ...windows];
    title = '';
    status = 'Maintenance window created.';
  }

  onMount(() => {
    void loadWindows();
  });
</script>

<div class="card space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold text-white">Change Calendar</h3>
      <p class="text-sm text-slate-500">Schedule maintenance windows to control change timing.</p>
    </div>
    <span class="badge-primary">Ops</span>
  </div>

  <div class="grid lg:grid-cols-2 gap-3">
    <div class="space-y-2">
      <label class="label-base">Title</label>
      <input class="input-base" bind:value={title} placeholder="Monthly maintenance"  />
      <label class="label-base">Environment</label>
      <select class="select-base" bind:value={environment}>
        <option value="all">All</option>
        <option value="dev">Dev</option>
        <option value="staging">Staging</option>
        <option value="prod">Prod</option>
      </select>
    </div>
    <div class="space-y-2">
      <label class="label-base">Start</label>
      <input class="input-base" type="datetime-local" bind:value={startAt}  />
      <label class="label-base">End</label>
      <input class="input-base" type="datetime-local" bind:value={endAt}  />
    </div>
  </div>

  <div class="flex items-center gap-2">
    <Button size="sm" onclick={createWindow} disabled={!title.trim() || !startAt || !endAt}>Create window</Button>
    {#if status}
      <span class="text-xs text-slate-500">{status}</span>
    {/if}
  </div>

  <div class="space-y-2">
    {#if windows.length === 0}
      <p class="text-sm text-slate-500">No maintenance windows scheduled.</p>
    {:else}
      {#each windows as window}
        <div class="border border-slate-700 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold">{window.title}</div>
              <div class="text-xs text-slate-500">{new Date(window.startAt).toLocaleString()} → {new Date(window.endAt).toLocaleString()}</div>
            </div>
            <span class="badge-primary">{window.environment.toUpperCase()}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
