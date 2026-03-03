<script lang="ts">
  let { title = '', rows = [] } = $props<{
    title?: string;
    rows?: Array<{ label: string; value: number }>;
  }>();
</script>

<div class="bg-surface-2 border border-slate-700 rounded-lg p-4">
  <h3 class="text-sm font-semibold mb-3">{title}</h3>
  {#if rows.length === 0}
    <p class="text-sm text-slate-500">No data available.</p>
  {:else}
    <div class="space-y-2 text-sm">
      {#each rows as row}
        <div class="flex items-center justify-between">
          <span>{row.label}</span>
          <span class="font-semibold">{row.value}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
