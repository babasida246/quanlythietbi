<script lang="ts">
  type Props = {
    rows?: number;
    className?: string;
  };

  let { rows = 5, className = '' }: Props = $props();
</script>

<div class={`space-y-1.5 ${className}`}>
  {#each Array.from({ length: rows }) as _, index (index)}
    <div class="skeleton-row"></div>
  {/each}
</div>
