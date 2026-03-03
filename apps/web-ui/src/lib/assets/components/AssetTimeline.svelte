<script lang="ts">
  import type { AssetEvent } from '$lib/api/assets';

  let { events = [] } = $props<{ events?: AssetEvent[] }>();
</script>

<div class="space-y-3">
  {#if events.length === 0}
    <p class="text-sm text-slate-500">No events yet.</p>
  {:else}
    {#each events as event}
      <div class="flex gap-3">
        <div class="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">{event.eventType}</span>
            <span class="text-xs text-slate-500">
              {new Date(event.createdAt).toLocaleString()}
            </span>
          </div>
          <pre class="text-xs text-slate-500 bg-surface-1 rounded p-2 mt-2 overflow-auto">{JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      </div>
    {/each}
  {/if}
</div>
