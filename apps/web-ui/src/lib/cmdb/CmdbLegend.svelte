<script lang="ts">
  import { STATUS_LEGEND, TYPE_LEGEND } from '$lib/utils/graph';
  import { X } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  interface Props {
    open?: boolean;
    onclose?: () => void;
  }

  let { open = $bindable(false), onclose }: Props = $props();

  const SHAPE_SVG: Record<string, string> = {
    rect:       `<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor"/>`,
    diamond:    `<polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/>`,
    hex:        `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="currentColor"/>`,
    vee:        `<polyline points="3,6 12,20 21,6" stroke="currentColor" stroke-width="2.5" fill="none"/>`,
    'round-rect': `<rect x="3" y="6" width="18" height="12" rx="4" fill="currentColor"/>`,
    ellipse:    `<ellipse cx="12" cy="12" rx="9" ry="7" fill="currentColor"/>`,
  };
</script>

{#if open}
<div class="pointer-events-auto rounded-lg border border-slate-700/60
            bg-[#0F172A]/95 shadow-2xl backdrop-blur-md w-52">

  <!-- Header -->
  <div class="flex items-center justify-between border-b border-slate-700/50 px-3 py-2">
    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{$isLoading ? 'Legend' : $_('cmdb.topology.legend')}</span>
    <button onclick={onclose}
      class="flex h-5 w-5 items-center justify-center rounded text-slate-500
             hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
      <X size={11} />
    </button>
  </div>

  <div class="px-3 py-2 space-y-3">

    <!-- Status -->
    <div>
      <div class="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-600">{$isLoading ? 'Status' : $_('common.status')}</div>
      <ul class="space-y-1.5">
        {#each STATUS_LEGEND as s}
        {@const statusI18n: Record<string, string> = { active: $_('cmdb.topology.statusActive'), warning: $_('cmdb.topology.statusWarning'), critical: $_('cmdb.topology.statusCritical'), inactive: $_('cmdb.topology.statusInactive') }}
        <li class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full"
                style="background:{s.color}; box-shadow:0 0 4px {s.color}80"></span>
          <span class="text-[11px] text-slate-300">{statusI18n[s.status] ?? s.label}</span>
        </li>
        {/each}
      </ul>
    </div>

    <!-- Shapes -->
    <div>
      <div class="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-600">{$isLoading ? 'Node type' : $_('cmdb.topology.nodeType')}</div>
      <ul class="space-y-1.5">
        {#each TYPE_LEGEND as t}
        <li class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-slate-400" fill="none"
               xmlns="http://www.w3.org/2000/svg">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html SHAPE_SVG[t.shapeClass] ?? SHAPE_SVG['ellipse']}
          </svg>
          <span class="text-[11px] text-slate-300">{t.label}</span>
        </li>
        {/each}
      </ul>
    </div>

    <!-- Edge -->
    <div>
      <div class="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-600">{$isLoading ? 'Edges' : $_('cmdb.topology.edges')}</div>
      <ul class="space-y-1.5">
        <li class="flex items-center gap-2">
          <span class="flex h-4 w-6 items-center justify-center">
            <svg viewBox="0 0 24 6" class="w-6" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#94A3B8" stroke-width="1.5"/>
              <polygon points="20,0 24,3 20,6" fill="#94A3B8"/>
            </svg>
          </span>
          <span class="text-[11px] text-slate-300">{$isLoading ? 'Directed relationship' : $_('cmdb.topology.directedRel')}</span>
        </li>
        <li class="flex items-center gap-2">
          <span class="flex h-4 w-6 items-center justify-center">
            <svg viewBox="0 0 24 6" class="w-6" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="3" x2="24" y2="3" stroke="#06B6D4" stroke-width="2"
                    stroke-dasharray="4 2"/>
            </svg>
          </span>
          <span class="text-[11px] text-slate-300">{$isLoading ? 'Highlighted path' : $_('cmdb.topology.highlightedPath')}</span>
        </li>
        <li class="flex items-center gap-2">
          <span class="flex h-4 w-6 items-center justify-center">
            <svg viewBox="0 0 24 6" class="w-6" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="3" x2="24" y2="3" stroke="#475569" stroke-width="1.5" opacity="0.3"/>
            </svg>
          </span>
          <span class="text-[11px] text-slate-300">{$isLoading ? 'Dimmed' : $_('cmdb.topology.dimmed')}</span>
        </li>
      </ul>
    </div>
  </div>
</div>
{/if}
