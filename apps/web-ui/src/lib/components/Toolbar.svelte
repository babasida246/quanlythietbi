<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { Search, RotateCcw } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  type Props = {
    searchValue?: string;
    searchPlaceholder?: string;
    showReset?: boolean;
    onSearch?: (value: string) => void;
    onReset?: () => void;
  };

  let {
    searchValue = '',
    searchPlaceholder = '',
    showReset = true,
    onSearch,
    onReset
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    searchValue = target.value;
    onSearch?.(searchValue);
  }
</script>

<div class="toolbar">
  <div class="relative flex-1">
    <Search class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
    <input
      type="text"
      class="search-input !pl-8"
      value={searchValue}
      placeholder={searchPlaceholder || ($isLoading ? 'Search' : $_('common.search'))}
      oninput={handleInput}
    />
  </div>
  {#if showReset}
    <Button variant="secondary" size="sm" onclick={() => onReset?.()}>
      {#snippet leftIcon()}<RotateCcw class="h-3.5 w-3.5" />{/snippet}
      {$isLoading ? 'Reset' : $_('common.clearFilters')}
    </Button>
  {/if}
</div>
