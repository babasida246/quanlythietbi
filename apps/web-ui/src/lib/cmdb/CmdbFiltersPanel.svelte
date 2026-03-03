<script lang="ts">
  import type { CmdbType, RelationshipTypeRecord } from '$lib/api/cmdb';
  import { DEFAULT_FILTERS, type GraphFilters } from '$lib/utils/graph';
  import { ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  interface Props {
    filters: GraphFilters;
    open: boolean;
    ciTypes?: CmdbType[];
    relTypes?: RelationshipTypeRecord[];
    onchange?: (f: GraphFilters) => void;
    onreset?: () => void;
  }

  let {
    filters = $bindable({ ...DEFAULT_FILTERS }),
    open = $bindable(true),
    ciTypes = [],
    relTypes = [],
    onchange,
    onreset,
  }: Props = $props();

  const CI_STATUSES = ['active', 'warning', 'critical', 'inactive', 'retired'];
  const CI_ENVS     = ['production', 'staging', 'dev', 'test', 'dr'];

  function toggle(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  function toggleType(id: string)     { filters = { ...filters, typeIds: toggle(filters.typeIds, id) }; onchange?.(filters); }
  function toggleStatus(s: string)    { filters = { ...filters, statuses: toggle(filters.statuses, s) }; onchange?.(filters); }
  function toggleEnv(e: string)       { filters = { ...filters, envs: toggle(filters.envs, e) }; onchange?.(filters); }
  function toggleRelType(id: string)  { filters = { ...filters, relTypeIds: toggle(filters.relTypeIds, id) }; onchange?.(filters); }
  function setHideIsolated(v: boolean){ filters = { ...filters, hideIsolated: v }; onchange?.(filters); }
  function setDepth(v: number)        { filters = { ...filters, depth: v }; onchange?.(filters); }

  function reset() {
    filters = { ...DEFAULT_FILTERS };
    onreset?.();
  }

  const activeCount = $derived(
    filters.typeIds.length + filters.statuses.length + filters.envs.length +
    filters.relTypeIds.length + (filters.hideIsolated ? 1 : 0)
  );

  const STATUS_COLORS: Record<string, string> = {
    active: '#10B981', warning: '#F59E0B', critical: '#EF4444',
    inactive: '#64748B', retired: '#475569',
  };
</script>

<!-- Collapse/expand rail -->
<div class="relative flex shrink-0" class:w-56={open} class:w-0={!open}
     style="transition: width 200ms ease">
  
  <!-- Toggle button (always visible) -->
  <button
    onclick={() => (open = !open)}
    class="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full
           border border-slate-700 bg-[#121B2E] text-slate-400 shadow-lg
           hover:border-slate-500 hover:text-slate-200 transition-colors"
    title={open ? ($isLoading ? 'Hide filters' : $_('cmdb.topology.hideFilters')) : ($isLoading ? 'Show filters' : $_('cmdb.topology.showFilters'))}
  >
    {#if open}
      <ChevronLeft size={12} />
    {:else}
      <ChevronRight size={12} />
    {/if}
  </button>

  {#if open}
  <aside class="flex h-full w-56 flex-col overflow-y-auto overflow-x-hidden
                border-r border-slate-700/50 bg-[#0F172A]">

    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50">
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">{$isLoading ? 'Filters' : $_('cmdb.topology.filters')}</span>
      {#if activeCount > 0}
        <button onclick={reset}
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]
                 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
          <RotateCcw size={10} />
          {$isLoading ? `Reset (${activeCount})` : $_('cmdb.topology.resetCount', { values: { count: activeCount } })}
        </button>
      {/if}
    </div>

    <div class="flex flex-col gap-0 flex-1 py-1">

      <!-- CI Type -->
      {#if ciTypes.length > 0}
      <section>
        <div class="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{$isLoading ? 'CI Type' : $_('cmdb.topology.ciType')}</div>
        <ul class="space-y-0.5 px-2">
          {#each ciTypes as t}
          <li>
            <button
              onclick={() => toggleType(t.id)}
              class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs
                     text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              <span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm
                           border transition-colors
                           {filters.typeIds.includes(t.id)
                             ? 'border-blue-500 bg-blue-500'
                             : 'border-slate-600'}">
                {#if filters.typeIds.includes(t.id)}
                  <Check size={9} class="text-white" />
                {/if}
              </span>
              <span class="truncate">{t.name}</span>
            </button>
          </li>
          {/each}
        </ul>
      </section>
      {/if}

      <!-- Status -->
      <section>
        <div class="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{$isLoading ? 'Status' : $_('common.status')}</div>
        <ul class="space-y-0.5 px-2">
          {#each CI_STATUSES as s}
          <li>
            <button
              onclick={() => toggleStatus(s)}
              class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs
                     text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              <span class="h-2 w-2 shrink-0 rounded-full"
                    style="background:{STATUS_COLORS[s] ?? '#64748B'}"></span>
              <span class="flex-1 capitalize">{s}</span>
              {#if filters.statuses.includes(s)}
                <Check size={10} class="text-blue-400" />
              {/if}
            </button>
          </li>
          {/each}
        </ul>
      </section>

      <!-- Environment -->
      <section>
        <div class="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{$isLoading ? 'Environment' : $_('cmdb.environment')}</div>
        <ul class="space-y-0.5 px-2">
          {#each CI_ENVS as e}
          <li>
            <button
              onclick={() => toggleEnv(e)}
              class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs
                     text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              <span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm
                           border transition-colors
                           {filters.envs.includes(e)
                             ? 'border-blue-500 bg-blue-500'
                             : 'border-slate-600'}">
                {#if filters.envs.includes(e)}
                  <Check size={9} class="text-white" />
                {/if}
              </span>
              <span class="capitalize">{e}</span>
            </button>
          </li>
          {/each}
        </ul>
      </section>

      <!-- Relationship type -->
      {#if relTypes.length > 0}
      <section>
        <div class="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{$isLoading ? 'Relationship' : $_('cmdb.relationships')}</div>
        <ul class="space-y-0.5 px-2">
          {#each relTypes as r}
          <li>
            <button
              onclick={() => toggleRelType(r.id)}
              class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs
                     text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              <span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm
                           border transition-colors
                           {filters.relTypeIds.includes(r.id)
                             ? 'border-blue-500 bg-blue-500'
                             : 'border-slate-600'}">
                {#if filters.relTypeIds.includes(r.id)}
                  <Check size={9} class="text-white" />
                {/if}
              </span>
              <span class="truncate">{r.name}</span>
            </button>
          </li>
          {/each}
        </ul>
      </section>
      {/if}

      <!-- Options -->
      <section class="border-t border-slate-700/50 mt-2 pt-2">
        <div class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{$isLoading ? 'Options' : $_('cmdb.topology.options')}</div>
        <div class="px-2 space-y-1">

          <!-- Hide isolated toggle -->
          <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1
                        text-xs text-slate-300 hover:bg-slate-700/40 transition-colors">
            <span class="relative inline-flex h-4 w-7 shrink-0">
              <input type="checkbox" checked={filters.hideIsolated}
                     onchange={e => setHideIsolated((e.target as HTMLInputElement).checked)}
                     class="sr-only">
              <span class="absolute inset-0 rounded-full transition-colors
                           {filters.hideIsolated ? 'bg-blue-600' : 'bg-slate-600'}"></span>
              <span class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform
                           {filters.hideIsolated ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
            </span>
            {$isLoading ? 'Hide isolated nodes' : $_('cmdb.topology.hideIsolated')}
          </label>

          <!-- Depth slider -->
          <div class="px-2 py-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-400">{$isLoading ? 'Depth limit' : $_('cmdb.topology.depthLimit')}</span>
              <span class="text-xs text-slate-300 font-mono">
                {filters.depth === 0 ? ($isLoading ? 'None' : $_('common.none')) : filters.depth}
              </span>
            </div>
            <input
              type="range" min="0" max="6" step="1"
              value={filters.depth}
              oninput={e => setDepth(Number((e.target as HTMLInputElement).value))}
              class="w-full h-1 cursor-pointer appearance-none rounded-full
                     bg-slate-600 accent-blue-500"
            />
            <div class="flex justify-between text-[9px] text-slate-600 mt-0.5">
              <span>∞</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </aside>
  {/if}
</div>
