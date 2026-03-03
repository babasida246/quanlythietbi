<script lang="ts">
  import { _, isLoading } from '$lib/i18n';

  type TocItem = {
    id: string;
    label: string;
    level: number;
  };

  let { items = [], activeId = '', searchQuery = $bindable('') } = $props<{
    items: TocItem[];
    activeId?: string;
    searchQuery?: string;
  }>();

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
</script>

<aside class="hidden xl:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar w-56 shrink-0">
  <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
    <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {$isLoading ? 'Contents' : $_('help.toc')}
    </p>

    <div class="mb-3">
      <input
        type="text"
        class="input-base text-xs w-full"
        placeholder={$isLoading ? 'Search...' : $_('help.searchPlaceholder')}
        bind:value={searchQuery}
      />
    </div>

    <nav class="space-y-0.5" aria-label="Table of contents">
      {#each items as item}
        <button
          onclick={() => scrollTo(item.id)}
          class="block w-full text-left text-xs py-1 rounded px-2 transition-colors truncate
            {item.level === 2 ? 'pl-4 text-slate-400' : ''}
            {activeId === item.id ? 'bg-primary/15 text-primary font-semibold' : 'text-slate-300 hover:bg-surface-3/50 hover:text-slate-100'}"
        >
          {item.label}
        </button>
      {/each}
    </nav>
  </div>
</aside>
