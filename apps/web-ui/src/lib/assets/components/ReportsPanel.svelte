<script lang="ts">
  let { title = '', rows = [] } = $props<{
    title?: string;
    rows?: Array<{ label: string; value: number }>;
  }>();
</script>

<div class="rounded-lg border p-4" style="background: rgb(var(--color-surface)); border-color: var(--color-border)">
  <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--color-text-muted)">{title}</h3>
  {#if rows.length === 0}
    <p class="text-sm" style="color: var(--color-text-muted)">No data available.</p>
  {:else}
    <div class="space-y-2 text-sm">
      {#each rows as row}
        <div class="flex items-center justify-between rounded-md px-2 py-1.5" style="background: rgb(var(--color-surface-2) / 0.5)">
          <span style="color: var(--color-text)">{row.label}</span>
          <span class="font-semibold tabular-nums" style="color: var(--color-text)">{row.value.toLocaleString('vi-VN')}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
