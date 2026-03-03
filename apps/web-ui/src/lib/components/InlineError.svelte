<script lang="ts">
  type Props = {
    message?: string;
  };

  let { message = '' }: Props = $props();
</script>

{#if message}
  <p class="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{message}</p>
{/if}
