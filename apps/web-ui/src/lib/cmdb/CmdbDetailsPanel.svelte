<script lang="ts">
  import type { CiRecord, RelationshipRecord, RelationshipTypeRecord } from '$lib/api/cmdb';
  import { nodeColor } from '$lib/utils/graph';
  import {
    X, Server, ExternalLink, Copy, GitBranch,
    ArrowUp, ArrowDown, ZoomIn, Unplug, Pin, PinOff
  } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  interface Props {
    node?: CiRecord | null;
    edge?: RelationshipRecord | null;
    open?: boolean;
    relTypeMap?: Map<string, string>;
    pinnedNodes?: Set<string>;
    onclose?: () => void;
    onFocus?: (id: string) => void;
    onExpand?: (id: string, depth: 1 | 2) => void;
    onTogglePin?: (id: string) => void;
    onImpact?: (id: string) => void;
    onUpstream?: (id: string) => void;
    onDownstream?: (id: string) => void;
    onOpenDetail?: (id: string) => void;
  }

  let {
    node = null,
    edge = null,
    open = $bindable(false),
    relTypeMap = new Map(),
    pinnedNodes = new Set(),
    onclose,
    onFocus,
    onExpand,
    onTogglePin,
    onImpact,
    onUpstream,
    onDownstream,
    onOpenDetail,
  }: Props = $props();

  let activeTab = $state<'overview' | 'relations' | 'history'>('overview');

  $effect(() => {
    if (node || edge) activeTab = 'overview';
  });

  const isPinned = $derived(node ? pinnedNodes.has(node.id) : false);

  const statusColor = $derived(node ? nodeColor(node.status) : '#64748B');

  function copyId() {
    if (node) navigator.clipboard.writeText(node.id).catch(() => {});
  }

  function formatDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }
</script>

<!-- Slide-in panel: 0 width when closed to avoid layout shift -->
<div class="flex shrink-0 flex-col overflow-hidden border-l border-slate-700/50 bg-[#0F172A]
            transition-[width] duration-200"
     style="width:{open && (node || edge) ? '18rem' : '0'}">

  {#if open && (node || edge)}
  <div class="flex h-full w-72 flex-col overflow-hidden">

    <!-- Panel header -->
    <div class="flex items-center gap-2 border-b border-slate-700/50 px-3 py-2.5 shrink-0">
      <div class="h-2.5 w-2.5 rounded-full shrink-0"
           style="background:{statusColor}; box-shadow:0 0 6px {statusColor}80"></div>
      <span class="flex-1 truncate text-sm font-medium text-slate-200">
        {node?.name ?? ($isLoading ? 'Relationship' : $_('cmdb.relationships'))}
      </span>
      <button onclick={onclose}
        class="flex items-center justify-center h-6 w-6 rounded text-slate-500
               hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
        <X size={13} />
      </button>
    </div>

    {#if node}
    <!-- Tabs -->
    <div class="flex border-b border-slate-700/50 shrink-0">
      {#each (['overview', 'relations', 'history'] as const) as tab}
      {@const tabLabels = { overview: $_('cmdb.topology.tabOverview'), relations: $_('cmdb.topology.tabRelations'), history: $_('cmdb.topology.tabHistory') }}
      <button
        onclick={() => (activeTab = tab)}
        class="flex-1 py-1.5 text-xs font-medium capitalize transition-colors
               {activeTab === tab
                 ? 'border-b-2 border-blue-500 text-blue-400'
                 : 'text-slate-500 hover:text-slate-300'}"
      >{tabLabels[tab]}</button>
      {/each}
    </div>

    <div class="flex-1 overflow-y-auto">

      {#if activeTab === 'overview'}
      <!-- Overview tab -->
      <div class="p-3 space-y-3">

        <!-- Code + status badges -->
        <div class="flex flex-wrap gap-1.5">
          <span class="rounded bg-slate-700/60 px-2 py-0.5 font-mono text-[10px] text-slate-300">
            {node.ciCode}
          </span>
          <span class="rounded px-2 py-0.5 text-[10px] font-medium capitalize"
                style="background:{statusColor}22; color:{statusColor}">
            {node.status}
          </span>
          {#if node.environment}
          <span class="rounded bg-blue-900/40 px-2 py-0.5 text-[10px] font-medium text-blue-300 capitalize">
            {node.environment}
          </span>
          {/if}
        </div>

        <!-- Fields -->
        <table class="w-full text-xs">
          <tbody class="divide-y divide-slate-700/30">
            {#if node.ownerTeam}
            <tr>
              <td class="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{$isLoading ? 'Owner' : $_('cmdb.owner')}</td>
              <td class="py-1.5 text-slate-300">{node.ownerTeam}</td>
            </tr>
            {/if}
            <tr>
              <td class="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{$isLoading ? 'Created' : $_('common.created')}</td>
              <td class="py-1.5 text-slate-400 font-mono text-[10px]">{formatDate(node.createdAt)}</td>
            </tr>
            {#if node.updatedAt}
            <tr>
              <td class="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{$isLoading ? 'Updated' : $_('common.updated')}</td>
              <td class="py-1.5 text-slate-400 font-mono text-[10px]">{formatDate(node.updatedAt)}</td>
            </tr>
            {/if}
            {#if node.notes}
            <tr>
              <td class="py-1.5 pr-2 align-top text-slate-500 whitespace-nowrap">{$isLoading ? 'Notes' : $_('common.notes')}</td>
              <td class="py-1.5 text-slate-400 leading-relaxed">{node.notes}</td>
            </tr>
            {/if}
          </tbody>
        </table>

        <!-- Actions -->
        <div class="grid grid-cols-2 gap-1.5 pt-1">
          <button
            onclick={() => onFocus?.(node!.id)}
            class="flex items-center justify-center gap-1.5 rounded border border-slate-600
                   px-2 py-1.5 text-[11px] text-slate-300 hover:border-blue-500/70
                   hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ZoomIn size={11} /> {$isLoading ? 'Focus' : $_('cmdb.topology.focus')}
          </button>

          <button
            onclick={() => onTogglePin?.(node!.id)}
            class="flex items-center justify-center gap-1.5 rounded border px-2 py-1.5
                   text-[11px] transition-colors
                   {isPinned
                     ? 'border-violet-500/70 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'
                     : 'border-slate-600 text-slate-300 hover:border-violet-500/70 hover:text-violet-400 hover:bg-violet-500/10'}"
          >
            {#if isPinned}<PinOff size={11} />{:else}<Pin size={11} />{/if}
            {isPinned ? ($isLoading ? 'Unpin' : $_('cmdb.topology.unpin')) : ($isLoading ? 'Pin' : $_('cmdb.topology.pin'))}
          </button>

          <button
            onclick={() => onExpand?.(node!.id, 1)}
            class="flex items-center justify-center gap-1.5 rounded border border-slate-600
                   px-2 py-1.5 text-[11px] text-slate-300 hover:border-sky-500/70
                   hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
          >
            <GitBranch size={11} /> {$isLoading ? '+1 hop' : $_('cmdb.topology.hop1')}
          </button>

          <button
            onclick={() => onExpand?.(node!.id, 2)}
            class="flex items-center justify-center gap-1.5 rounded border border-slate-600
                   px-2 py-1.5 text-[11px] text-slate-300 hover:border-sky-500/70
                   hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
          >
            <GitBranch size={11} /> {$isLoading ? '+2 hops' : $_('cmdb.topology.hop2')}
          </button>

          <button
            onclick={() => onUpstream?.(node!.id)}
            class="flex items-center justify-center gap-1.5 rounded border border-slate-600
                   px-2 py-1.5 text-[11px] text-slate-300 hover:border-emerald-500/70
                   hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <ArrowUp size={11} /> {$isLoading ? 'Upstream' : $_('cmdb.topology.upstream')}
          </button>

          <button
            onclick={() => onDownstream?.(node!.id)}
            class="flex items-center justify-center gap-1.5 rounded border border-slate-600
                   px-2 py-1.5 text-[11px] text-slate-300 hover:border-amber-500/70
                   hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            <ArrowDown size={11} /> {$isLoading ? 'Downstream' : $_('cmdb.topology.downstream')}
          </button>

          <button
            onclick={() => onImpact?.(node!.id)}
            class="col-span-2 flex items-center justify-center gap-1.5 rounded border
                   border-red-800/50 px-2 py-1.5 text-[11px] text-red-400
                   hover:border-red-500/70 hover:bg-red-500/10 transition-colors"
          >
            <Unplug size={11} /> {$isLoading ? 'Impact Analysis' : $_('cmdb.topology.impactAnalysis')}
          </button>

          <div class="col-span-2 flex gap-1.5">
            <button
              onclick={copyId}
              class="flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-600
                     px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200
                     hover:bg-slate-700/40 transition-colors"
            >
              <Copy size={11} /> {$isLoading ? 'Copy ID' : $_('cmdb.topology.copyId')}
            </button>
            <button
              onclick={() => onOpenDetail?.(node!.id)}
              class="flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-600
                     px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200
                     hover:bg-slate-700/40 transition-colors"
            >
              <ExternalLink size={11} /> {$isLoading ? 'Open Detail' : $_('cmdb.topology.openDetail')}
            </button>
          </div>
        </div>
      </div>

      {:else if activeTab === 'relations'}
      <div class="p-4 text-center text-xs text-slate-500">
        <Server size={28} class="mx-auto mb-2 opacity-30" />
        {$isLoading ? 'Relationship panel — available when selecting an edge.' : $_('cmdb.topology.selectEdgeHint')}
      </div>

      {:else}
      <div class="p-4 text-center text-xs text-slate-500">
        <Server size={28} class="mx-auto mb-2 opacity-30" />
        {$isLoading ? 'Change history coming soon.' : $_('cmdb.topology.historyComingSoon')}
      </div>
      {/if}
    </div>

    {:else if edge}
    <!-- Edge details -->
    <div class="p-3 space-y-3 overflow-y-auto flex-1">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        Relationship
      </div>
      <table class="w-full text-xs">
        <tbody class="divide-y divide-slate-700/30">
          <tr>
            <td class="py-1.5 pr-2 text-slate-500">{$isLoading ? 'Type' : $_('common.type')}</td>
            <td class="py-1.5 text-slate-300">{relTypeMap.get(edge.relTypeId) ?? edge.relTypeId}</td>
          </tr>
          <tr>
            <td class="py-1.5 pr-2 text-slate-500">{$isLoading ? 'Status' : $_('common.status')}</td>
            <td class="py-1.5 text-slate-300 capitalize">{edge.status}</td>
          </tr>
          {#if edge.sinceDate}
          <tr>
            <td class="py-1.5 pr-2 text-slate-500">{$isLoading ? 'Since' : $_('cmdb.topology.since')}</td>
            <td class="py-1.5 font-mono text-[10px] text-slate-400">{formatDate(edge.sinceDate)}</td>
          </tr>
          {/if}
          {#if edge.note}
          <tr>
            <td class="py-1.5 pr-2 align-top text-slate-500">{$isLoading ? 'Note' : $_('common.notes')}</td>
            <td class="py-1.5 text-slate-400 leading-relaxed">{edge.note}</td>
          </tr>
          {/if}
        </tbody>
      </table>
    </div>
    {/if}

  </div>
  {/if}
</div>
