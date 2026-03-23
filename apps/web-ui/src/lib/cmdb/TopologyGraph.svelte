<script lang="ts">
  import { tick } from 'svelte';
  import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
  import {
    RefreshCw, Maximize2, Download, ZoomIn, ZoomOut,
    Search, Map as MapIcon, LayoutGrid, GitFork, Circle, BarChart3,
    Layers, BookOpen, X, ChevronRight, Loader2
  } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';

  import {
    getCmdbGraph, getCiDependencyPath, getCiImpact,
    listRelationshipTypes, listCmdbTypes,
    type CiRecord, type RelationshipRecord, type RelationshipTypeRecord,
    type CiGraph, type CmdbType
  } from '$lib/api/cmdb';
  import {
    buildAdjacency, expandNeighbors,
    filterGraph, searchNodes, nodeColor, nodeBorderColor,
    nodeShapeClass, cytoscapeShape,
    DEFAULT_FILTERS, type GraphFilters
  } from '$lib/utils/graph';

  import CmdbFiltersPanel from './CmdbFiltersPanel.svelte';
  import CmdbDetailsPanel from './CmdbDetailsPanel.svelte';
  import CmdbLegend       from './CmdbLegend.svelte';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    depth?: number;
    direction?: 'upstream' | 'downstream' | 'both';
    focusNodeId?: string;
  }

  let { depth = 2, direction = 'both', focusNodeId }: Props = $props();

  // ─── State ────────────────────────────────────────────────────────────────

  let container: HTMLDivElement | undefined = $state(undefined);
  let cy: Core | null = null;

  // Data
  let rawGraph: CiGraph | null = $state(null);
  let ciTypesList: CmdbType[] = $state([]);
  let relTypeMap: Map<string, string> = $state(new Map());
  let relTypesList: RelationshipTypeRecord[] = $state([]);

  // UI state
  let loading          = $state(true);
  let error            = $state('');
  let filtersPanelOpen = $state(true);
  let detailsPanelOpen = $state(false);
  let showLegend       = $state(false);
  let showLabels       = $state(false);
  let layoutMode: 'cose' | 'breadthfirst' | 'circle' | 'grid' = $state('cose');
  let layoutRunning    = $state(false);

  // Selection
  let selectedNode: CiRecord | null = $state(null);
  let selectedEdge: RelationshipRecord | null = $state(null);
  let pinnedNodes: Set<string> = $state(new Set());

  // Search
  let searchQuery   = $state('');
  let searchRef     = $state<HTMLInputElement | undefined>(undefined);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Context menu
  let ctxMenu = $state<{ x: number; y: number; nodeId: string } | null>(null);

  // Breadcrumb trail
  let breadcrumb = $state<Array<{ id: string; label: string }>>([]);

  // Filters
  let filters: GraphFilters = $state({ ...DEFAULT_FILTERS, depth: 2 });

  $effect(() => {
    if (filters.depth !== depth) {
      filters = { ...filters, depth };
    }
  });

  // Stats
  let stats = $state({ nodes: 0, edges: 0 });

  // Dependency / impact
  let analyzing      = $state(false);
  let highlightMode  = $state<'path' | 'impact' | null>(null);

  // Derived
  const performanceMode = $derived(stats.nodes > 200);

  // ─── Cytoscape stylesheet ────────────────────────────────────────────────

  function buildStyle(showLbl: boolean, perfMode: boolean) {
    return [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'border-color': 'data(borderColor)',
          'border-width': 2,
          'shape': 'data(shape)',
          label: showLbl ? 'data(label)' : '',
          color: '#F1F5F9',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': '11px',
          'font-family': 'ui-monospace, monospace',
          'width': 42,
          'height': 42,
          'text-max-width': '90px',
          'text-wrap': 'ellipsis',
          'text-margin-y': 7,
          ...(perfMode ? {} : {
            'shadow-blur': 8,
            'shadow-color': 'data(color)',
            'shadow-opacity': 0.5,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
          }),
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#3B82F6',
          'background-color': 'data(color)',
          ...(perfMode ? {} : {
            'shadow-blur': 14,
            'shadow-color': 'rgba(59,130,246,0.6)',
            'shadow-opacity': 1,
          }),
        },
      },
      { selector: 'node.dimmed',      style: { opacity: 0.12 } },
      {
        selector: 'node.highlighted',
        style: {
          'border-color': '#06B6D4', 'border-width': 3,
          ...(perfMode ? {} : { 'shadow-blur': 10, 'shadow-color': 'rgba(6,182,212,0.5)', 'shadow-opacity': 1 }),
        },
      },
      {
        selector: 'node.impact',
        style: {
          'border-color': '#EF4444', 'border-width': 3,
          ...(perfMode ? {} : { 'shadow-blur': 10, 'shadow-color': 'rgba(239,68,68,0.5)', 'shadow-opacity': 1 }),
        },
      },
      { selector: 'node.pinned', style: { 'border-style': 'dashed', 'border-color': '#A78BFA', 'border-width': 2 } },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': 'rgba(148,163,184,0.6)',
          'target-arrow-color': 'rgba(148,163,184,0.6)',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: '',
          'font-size': '9px',
          'text-rotation': 'autorotate',
          'text-margin-y': -7,
          color: '#CBD5E1',
        },
      },
      { selector: 'edge.show-label', style: { label: 'data(label)' } },
      { selector: 'edge:selected',   style: { 'line-color': '#3B82F6', 'target-arrow-color': '#3B82F6', width: 2.5 } },
      { selector: 'edge.dimmed',     style: { opacity: 0.05 } },
      { selector: 'edge.highlighted',style: { 'line-color': '#06B6D4', 'target-arrow-color': '#06B6D4', width: 2.5 } },
      { selector: 'edge.impact',     style: { 'line-color': '#EF4444',  'target-arrow-color': '#EF4444',  width: 2 } },
    ] as any;
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadAll() {
    loading = true;
    error = '';
    try {
      if (cy) { cy.destroy(); cy = null; }

      const [graphRes, relRes, typeRes] = await Promise.all([
        getCmdbGraph({ depth: filters.depth || depth, direction }),
        listRelationshipTypes(),
        listCmdbTypes(),
      ]);

      rawGraph     = graphRes.data;
      relTypesList = relRes.data;
      relTypeMap   = new Map(relRes.data.map((t): [string, string] => [t.id, t.name]));
      ciTypesList = typeRes.data;

      loading = false;
      await tick();
      buildCytoscape();
    } catch (e) {
      error   = e instanceof Error ? e.message : ($isLoading ? 'Failed to load graph' : $_('cmdb.topology.failedToLoad'));
      loading = false;
    }
  }

  // ─── Build / rebuild cytoscape ────────────────────────────────────────────

  function toCytoscapeElements(nodes: CiRecord[], edges: RelationshipRecord[]): ElementDefinition[] {
    const els: ElementDefinition[] = [];
    for (const n of nodes) {
      const typeName = ciTypesList.find((t) => t.id === n.typeId)?.name ?? n.typeId ?? '';
      const sc = nodeShapeClass(typeName);
      els.push({ data: {
        id: n.id, label: n.name || n.ciCode,
        color: nodeColor(n.status), borderColor: nodeBorderColor(n.status),
        shape: cytoscapeShape(sc), status: n.status,
        environment: n.environment, typeId: n.typeId,
      }});
    }
    for (const e of edges) {
      els.push({ data: {
        id: e.id, source: e.fromCiId, target: e.toCiId,
        label: relTypeMap.get(e.relTypeId) ?? '', type: e.relTypeId,
      }});
    }
    return els;
  }

  function buildCytoscape() {
    if (!rawGraph || !container) return;
    const { nodes, edges } = filterGraph(rawGraph.nodes, rawGraph.edges, filters);
    const elements = toCytoscapeElements(nodes, edges);

    cy = cytoscape({
      container, elements,
      style: buildStyle(showLabels, performanceMode) as any,
      layout: getLayout(layoutMode),
      minZoom: 0.15, maxZoom: 4, wheelSensitivity: 0.18,
    });

    attachEvents();
    stats = { nodes: cy.nodes().length, edges: cy.edges().length };

    for (const id of pinnedNodes) cy.$(`#${id}`).addClass('pinned');

    if (focusNodeId) {
      const el = cy.$(`#${focusNodeId}`);
      if (el.length) { cy.center(el); el.select(); pushBreadcrumb(focusNodeId, el.data('label')); }
    }
  }

  function getLayout(name: string): cytoscape.LayoutOptions {
    if (name === 'breadthfirst') return { name: 'breadthfirst', directed: true, padding: 40, spacingFactor: 1.4 };
    if (name === 'circle')       return { name: 'circle',       padding: 40, spacingFactor: 1.2 };
    if (name === 'grid')         return { name: 'grid',         padding: 40, rows: Math.ceil(Math.sqrt(stats.nodes || 1)) };
    return {
      name: 'cose', idealEdgeLength: 110, nodeOverlap: 20, refresh: 20,
      fit: true, padding: 40, randomize: false, componentSpacing: 120,
      nodeRepulsion: () => 500000, edgeElasticity: () => 100,
      nestingFactor: 5, gravity: 80, numIter: 1000,
      initialTemp: 200, coolingFactor: 0.95, minTemp: 1.0,
    } as any;
  }

  function runLayout() {
    if (!cy) return;
    layoutRunning = true;
    const l = cy.layout(getLayout(layoutMode) as any);
    l.on('layoutstop', () => { layoutRunning = false; });
    l.run();
  }

  // ─── Cytoscape events ─────────────────────────────────────────────────────

  function attachEvents() {
    if (!cy) return;

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      selectedNode = rawGraph?.nodes.find((n) => n.id === id) ?? null;
      selectedEdge = null;
      if (selectedNode) { detailsPanelOpen = true; pushBreadcrumb(id, evt.target.data('label')); }
      ctxMenu = null;
    });

    cy.on('tap', 'edge', (evt) => {
      selectedEdge = rawGraph?.edges.find((e) => e.id === evt.target.id()) ?? null;
      selectedNode = null;
      if (selectedEdge) detailsPanelOpen = true;
      ctxMenu = null;
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        selectedNode = null; selectedEdge = null; detailsPanelOpen = false;
        ctxMenu = null; clearDim(); clearHighlight();
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      if (selectedNode || highlightMode) return;
      const id = evt.target.id();
      const neighbors = cy!.$(`#${id}`).neighborhood();
      cy!.elements().not(neighbors).not(`#${id}`).addClass('dimmed');
    });
    cy.on('mouseout', 'node', () => { if (!selectedNode && !highlightMode) clearDim(); });

    cy.on('cxttap', 'node', (evt) => {
      ctxMenu = { x: evt.renderedPosition.x, y: evt.renderedPosition.y, nodeId: evt.target.id() };
    });
    cy.on('cxttap', (evt) => { if (evt.target === cy) ctxMenu = null; });
  }

  // ─── Dim / highlight helpers ──────────────────────────────────────────────

  function clearDim()       { cy?.elements().removeClass('dimmed'); }
  function clearHighlight() { cy?.elements().removeClass('highlighted impact'); highlightMode = null; }

  function dimAllExcept(ids: Set<string>) {
    if (!cy) return;
    cy.nodes().forEach((n) => { if (ids.has(n.id())) n.removeClass('dimmed'); else n.addClass('dimmed'); });
    cy.edges().forEach((e) => {
      const ok = ids.has(e.source().id()) && ids.has(e.target().id());
      if (ok) e.removeClass('dimmed'); else e.addClass('dimmed');
    });
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  function onSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 250);
  }

  function applySearch() {
    if (!cy || !rawGraph) return;
    if (!searchQuery.trim()) { clearDim(); return; }
    const matched = searchNodes(rawGraph.nodes, searchQuery);
    if (!matched.size) return;
    dimAllExcept(matched);
    const first = cy.$(`#${[...matched][0]}`);
    if (first.length) cy.animate({ fit: { eles: first, padding: 80 }, duration: 400 });
  }

  function clearSearch() { searchQuery = ''; clearDim(); }

  // ─── Dependency path ──────────────────────────────────────────────────────

  async function showDependencies(ciId: string, dir: 'upstream' | 'downstream') {
    if (!cy || !rawGraph) return;
    analyzing = true;
    try {
      clearHighlight();
      const res  = await getCiDependencyPath(ciId, dir);
      const path = res.data.path.map((c) => c.id);
      const set  = new Set(path);

      cy.nodes().forEach((n) => { if (set.has(n.id())) n.addClass('highlighted'); else n.addClass('dimmed'); });
      for (let i = 0; i < path.length - 1; i++) {
        cy.edges().forEach((e) => {
          const s = e.source().id(), t = e.target().id();
          if ((s === path[i] && t === path[i + 1]) || (t === path[i] && s === path[i + 1]))
            e.addClass('highlighted');
          else
            e.addClass('dimmed');
        });
      }
      highlightMode = 'path';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load dependency path';
    } finally { analyzing = false; }
  }

  async function showImpact(ciId: string) {
    if (!cy || !rawGraph) return;
    analyzing = true;
    try {
      clearHighlight();
      const res      = await getCiImpact(ciId);
      const affected = new Set(res.data.affected.map((c) => c.id));

      cy.nodes().forEach((n) => { if (affected.has(n.id())) n.addClass('impact'); else n.addClass('dimmed'); });
      cy.edges().forEach((e) => {
        if (affected.has(e.source().id()) && affected.has(e.target().id()))
          e.addClass('impact');
        else
          e.addClass('dimmed');
      });
      highlightMode = 'impact';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load impact analysis';
    } finally { analyzing = false; }
  }

  // ─── Expand neighbours ────────────────────────────────────────────────────

  function expandNode(ciId: string, hops: 1 | 2) {
    if (!rawGraph || !cy) return;
    const adj     = buildAdjacency(rawGraph.edges);
    const visible = expandNeighbors(adj, [ciId], hops);
    const nodes   = rawGraph.nodes.filter((n) => visible.has(n.id));
    const edges   = rawGraph.edges.filter((e) => visible.has(e.fromCiId) && visible.has(e.toCiId));
    cy.add(toCytoscapeElements(nodes, edges).filter((el) => !cy!.$(`#${el.data!.id}`).length));
    runLayout();
    stats = { nodes: cy.nodes().length, edges: cy.edges().length };
  }

  // ─── Pin / breadcrumb ─────────────────────────────────────────────────────

  function togglePin(id: string) {
    const next = new Set(pinnedNodes);
    if (next.has(id)) { next.delete(id); cy?.$(`#${id}`).removeClass('pinned'); }
    else               { next.add(id);    cy?.$(`#${id}`).addClass('pinned'); }
    pinnedNodes = next;
  }

  function pushBreadcrumb(id: string, label: string) {
    const i = breadcrumb.findIndex((b) => b.id === id);
    breadcrumb = i !== -1 ? breadcrumb.slice(0, i + 1) : [...breadcrumb.slice(-4), { id, label }];
  }

  function jumpBreadcrumb(id: string) {
    if (!cy) return;
    const el = cy.$(`#${id}`);
    if (el.length) cy.animate({ fit: { eles: el, padding: 120 }, duration: 350 });
    pushBreadcrumb(id, el.data('label'));
  }

  // ─── Toolbar actions ──────────────────────────────────────────────────────

  function fitGraph() { cy?.fit(undefined, 50); }
  function zoomIn()   { if (cy) { cy.zoom(cy.zoom() * 1.25); cy.center(); } }
  function zoomOut()  { if (cy) { cy.zoom(cy.zoom() * 0.8);  cy.center(); } }

  function exportPng() {
    if (!cy) return;
    const url = cy.png({ scale: 2, full: true, bg: '#1E293B' });
    const a = document.createElement('a');
    a.href = url; a.download = `cmdb-topology-${new Date().toISOString().slice(0, 10)}.png`; a.click();
  }

  function toggleLabels() {
    showLabels = !showLabels;
    if (!cy) return;
    cy.style(buildStyle(showLabels, performanceMode) as any);
    if (showLabels) cy.nodes().addClass('show-label');
    else            cy.nodes().removeClass('show-label');
  }

  function applyFilters() {
    if (!rawGraph || !container) return;
    cy?.destroy(); cy = null;
    buildCytoscape();
  }

  function resetFilters() { filters = { ...DEFAULT_FILTERS, depth }; applyFilters(); }

  function setLayout(name: typeof layoutMode) { layoutMode = name; runLayout(); }

  // ─── Context-menu actions ─────────────────────────────────────────────────

  function ctxFocus(id: string) {
    if (!cy) return;
    cy.animate({ fit: { eles: cy.$(`#${id}`).neighborhood().union(cy.$(`#${id}`)), padding: 60 }, duration: 400 });
    ctxMenu = null;
  }

  function ctxOpenDetail(id: string) {
    selectedNode = rawGraph?.nodes.find((n) => n.id === id) ?? null;
    detailsPanelOpen = true; ctxMenu = null;
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    switch (e.key) {
      case '/': e.preventDefault(); searchRef?.focus(); break;
      case 'f': case 'F': fitGraph(); break;
      case 'l': case 'L': toggleLabels(); break;
      case 'Escape':
        clearSearch(); clearDim(); clearHighlight();
        ctxMenu = null; selectedNode = null; selectedEdge = null; detailsPanelOpen = false; break;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  const LAYOUT_KEYS = ['cose', 'breadthfirst', 'circle', 'grid'] as const;
  const LAYOUT_ICONS = { cose: GitFork, breadthfirst: BarChart3, circle: Circle, grid: LayoutGrid };
  const LAYOUT_I18N = { cose: 'cmdb.topology.layoutCose', breadthfirst: 'cmdb.topology.layoutBreadthfirst', circle: 'cmdb.topology.layoutCircle', grid: 'cmdb.topology.layoutGrid' };

  $effect(() => {
    void loadAll();
    return () => { if (cy) { cy.destroy(); cy = null; } };
  });
</script>

<svelte:window onkeydown={onKeyDown} />
<svelte:document onclick={() => { ctxMenu = null; }} />

<!-- ─── Root layout ──────────────────────────────────────────────────────────── -->
<div class="flex h-full overflow-hidden bg-[#0F172A] relative select-none">

  <!-- Left filter panel -->
  <CmdbFiltersPanel
    bind:filters bind:open={filtersPanelOpen}
    ciTypes={ciTypesList} relTypes={relTypesList}
    onchange={applyFilters} onreset={resetFilters}
  />

  <!-- Canvas column -->
  <div class="flex min-w-0 flex-1 flex-col">

    <!-- Page header strip -->
    <header class="flex h-11 shrink-0 items-center gap-2 border-b border-slate-700/60
                   bg-[#0F172A]/95 px-4 backdrop-blur-sm">
      <nav class="flex items-center gap-1 text-xs text-slate-500 truncate">
        <span>{$isLoading ? 'CMDB' : $_('cmdb.pageTitle')}</span>
        <ChevronRight size={12} />
        <span class="text-slate-400">{$isLoading ? 'Topology' : $_('cmdb.topology.title')}</span>
        {#each breadcrumb as bc}
          <ChevronRight size={10} class="opacity-50" />
          <button
            onclick={() => jumpBreadcrumb(bc.id)}
            class="max-w-[120px] truncate rounded px-1 py-0.5 text-slate-300
                   hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
            {bc.label}
          </button>
        {/each}
      </nav>

      <div class="ml-auto flex items-center gap-3 text-xs text-slate-500">
        {#if !loading}
          <span>{$isLoading ? `${stats.nodes} CIs` : $_('cmdb.topology.cisCount', { values: { count: stats.nodes } })}</span><span class="opacity-40">•</span>
          <span>{$isLoading ? `${stats.edges} Relationships` : $_('cmdb.topology.relCount', { values: { count: stats.edges } })}</span>
        {/if}
        {#if performanceMode}
          <span class="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">{$isLoading ? 'Perf mode' : $_('cmdb.topology.perfMode')}</span>
        {/if}
      </div>
    </header>

    <!-- Canvas area -->
    <div class="relative flex-1 overflow-hidden"
         style="background-color:#1E293B;
                background-image:linear-gradient(rgba(148,163,184,0.07) 1px,transparent 1px),
                                 linear-gradient(90deg,rgba(148,163,184,0.07) 1px,transparent 1px);
                background-size:40px 40px;">

      <!-- Cytoscape mount -->
      <div bind:this={container} class="absolute inset-0"></div>

      <!-- Loading overlay -->
      {#if loading}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1E293B]/80 backdrop-blur-[2px]">
        <Loader2 size={28} class="animate-spin text-blue-500" />
        <span class="text-sm text-slate-400">{$isLoading ? 'Loading topology…' : $_('cmdb.topology.loading')}</span>
      </div>
      {/if}

      <!-- Error banner -->
      {#if error}
      <div class="absolute left-4 right-4 top-4 flex items-center gap-2 rounded-lg
                  border border-red-800/60 bg-red-950/80 px-4 py-2.5 text-sm text-red-300
                  shadow-xl backdrop-blur-sm">
        <span class="flex-1">{error}</span>
        <button onclick={() => (error = '')} class="text-red-400 hover:text-red-200"><X size={14}/></button>
      </div>
      {/if}

      <!-- Empty state -->
      {#if !loading && stats.nodes === 0 && !error}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
        <BarChart3 size={36} class="opacity-30" />
        <p class="text-sm">{$isLoading ? 'No CIs match the current filters.' : $_('cmdb.topology.noMatchingCis')}</p>
        <button onclick={resetFilters} class="mt-1 text-xs text-blue-400 hover:text-blue-300 underline">{$isLoading ? 'Reset filters' : $_('cmdb.topology.resetFilters')}</button>
      </div>
      {/if}

      <!-- Floating toolbar -->
      {#if !loading}
      <div class="pointer-events-auto absolute left-1/2 top-3 z-20
                  flex -translate-x-1/2 items-center gap-1 rounded-xl
                  border border-slate-600/70 bg-[#0F172A]/90 px-2 py-1.5
                  shadow-2xl backdrop-blur-md">

        <!-- Search -->
        <div class="relative mr-1">
          <Search size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            bind:this={searchRef}
            type="text" placeholder={$isLoading ? 'Search… (/)' : $_('cmdb.topology.searchPlaceholder')} value={searchQuery}
            oninput={onSearchInput}
            class="h-7 w-40 rounded-lg bg-slate-800/70 pl-6 pr-2 text-xs text-slate-200
                   placeholder:text-slate-600 outline-none border border-slate-700/50
                   focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
          />
          {#if searchQuery}
          <button onclick={clearSearch}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X size={10} />
          </button>
          {/if}
        </div>

        <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

        <!-- Layout buttons -->
        {#each LAYOUT_KEYS as key}
        {@const Icon = LAYOUT_ICONS[key]}
        <button onclick={() => setLayout(key)} title={$isLoading ? key : $_( LAYOUT_I18N[key])}
          class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors
                 {layoutMode === key
                   ? 'bg-blue-600/30 text-blue-400'
                   : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}">
          <Icon size={14} />
        </button>
        {/each}

        <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

        <button onclick={toggleLabels} title="Toggle labels (L)"
          class="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors
                 {showLabels ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}">
          <Layers size={13} /> {$isLoading ? 'Labels' : $_('cmdb.topology.labels')}
        </button>
        <button onclick={() => (showLegend = !showLegend)} title="Legend"
          class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors
                 {showLegend ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}">
          <BookOpen size={13} />
        </button>

        <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

        <button onclick={zoomIn}   title="Zoom in"         class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><ZoomIn   size={14}/></button>
        <button onclick={zoomOut}  title="Zoom out"        class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><ZoomOut  size={14}/></button>
        <button onclick={fitGraph} title="Fit screen (F)"  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><Maximize2 size={14}/></button>

        <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

        <button onclick={() => loadAll()} title="Refresh"  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><RefreshCw size={14} class={loading ? 'animate-spin' : ''}/></button>
        <button onclick={exportPng}       title="Export PNG" class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><Download  size={14}/></button>
        <button title="Minimap"           class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"><MapIcon size={14}/></button>
      </div>
      {/if}

      <!-- Legend overlay -->
      <div class="pointer-events-auto absolute bottom-4 left-4 z-20">
        <CmdbLegend bind:open={showLegend} onclose={() => (showLegend = false)} />
      </div>

      <!-- Highlight mode banner -->
      {#if highlightMode}
      <div class="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-xl backdrop-blur-md
                    {highlightMode === 'impact'
                      ? 'border-red-700/60 bg-red-950/80 text-red-300'
                      : 'border-cyan-700/60 bg-cyan-950/80 text-cyan-300'}">
          {highlightMode === 'impact' ? ($isLoading ? 'Impact zone' : $_('cmdb.topology.impactZone')) : ($isLoading ? 'Dependency path' : $_('cmdb.topology.dependencyPath'))} {$isLoading ? 'highlighted' : $_('cmdb.topology.highlighted')}
          <button onclick={() => { clearHighlight(); clearDim(); }}
            class="ml-1 opacity-70 hover:opacity-100"><X size={11}/></button>
        </div>
      </div>
      {/if}

      <!-- Context menu -->
      {#if ctxMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="pointer-events-auto absolute z-30 min-w-[160px] overflow-hidden rounded-lg
                  border border-slate-600/70 bg-[#0F172A]/95 py-1 shadow-2xl backdrop-blur-md"
           style="left:{ctxMenu.x}px; top:{ctxMenu.y}px"
           onclick={(e: MouseEvent) => e.stopPropagation()}>
        {#each [
          { label: $isLoading ? 'Focus' : $_('cmdb.topology.ctxFocus'),           action: () => ctxFocus(ctxMenu!.nodeId) },
          { label: $isLoading ? 'Expand +1 hop' : $_('cmdb.topology.ctxExpand1'),   action: () => expandNode(ctxMenu!.nodeId, 1) },
          { label: $isLoading ? 'Expand +2 hops' : $_('cmdb.topology.ctxExpand2'),  action: () => expandNode(ctxMenu!.nodeId, 2) },
          { label: $isLoading ? 'Pin / Unpin' : $_('cmdb.topology.ctxPin'),     action: () => togglePin(ctxMenu!.nodeId) },
          { label: $isLoading ? 'Upstream path' : $_('cmdb.topology.ctxUpstream'),   action: () => { showDependencies(ctxMenu!.nodeId, 'upstream'); ctxMenu = null; } },
          { label: $isLoading ? 'Downstream path' : $_('cmdb.topology.ctxDownstream'), action: () => { showDependencies(ctxMenu!.nodeId, 'downstream'); ctxMenu = null; } },
          { label: $isLoading ? 'Impact analysis' : $_('cmdb.topology.ctxImpact'), action: () => { showImpact(ctxMenu!.nodeId); ctxMenu = null; } },
          { label: $isLoading ? 'Open detail' : $_('cmdb.topology.ctxOpenDetail'),     action: () => ctxOpenDetail(ctxMenu!.nodeId) },
        ] as item}
        <button onclick={() => { item.action(); ctxMenu = null; }}
          class="flex w-full items-center px-3 py-1.5 text-left text-xs text-slate-300
                 hover:bg-slate-700/50 hover:text-slate-100 transition-colors">
          {item.label}
        </button>
        {/each}
      </div>
      {/if}

    </div><!-- /canvas area -->
  </div><!-- /canvas column -->

  <!-- Right details panel -->
  <CmdbDetailsPanel
    node={selectedNode} edge={selectedEdge}
    bind:open={detailsPanelOpen}
    {relTypeMap} {pinnedNodes}
    onclose={() => { detailsPanelOpen = false; }}
    onFocus={ctxFocus}
    onExpand={expandNode}
    onTogglePin={togglePin}
    onImpact={showImpact}
    onUpstream={(id) => showDependencies(id, 'upstream')}
    onDownstream={(id) => showDependencies(id, 'downstream')}
    onOpenDetail={(id) => { window.open(`/cmdb/cis/${id}`, '_blank'); }}
  />

</div>
