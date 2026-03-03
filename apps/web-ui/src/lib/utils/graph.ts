/**
 * CMDB Graph utilities — pure TypeScript, no Svelte dependencies.
 * Handles filtering, adjacency, BFS path-finding, neighbour expansion,
 * and visual property mapping for the Topology canvas.
 */

import type { CiRecord, RelationshipRecord } from '$lib/api/cmdb';

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface GraphFilters {
    /** CI type IDs to show; empty = show all */
    typeIds: string[];
    /** Status values to show; empty = show all */
    statuses: string[];
    /** Environment values to show; empty = show all */
    envs: string[];
    /** Criticality values to show; empty = show all */
    criticalities: string[];
    /** Relationship type IDs to show; empty = show all */
    relTypeIds: string[];
    /** Max hop depth from any focused node (0 = no limit) */
    depth: number;
    /** Hide nodes with zero edges after type/status filtering */
    hideIsolated: boolean;
}

export const DEFAULT_FILTERS: GraphFilters = {
    typeIds: [],
    statuses: [],
    envs: [],
    criticalities: [],
    relTypeIds: [],
    depth: 0,
    hideIsolated: false,
};

// ─── Adjacency ───────────────────────────────────────────────────────────────

export function buildAdjacency(edges: RelationshipRecord[]): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    for (const e of edges) {
        if (!adj.has(e.fromCiId)) adj.set(e.fromCiId, new Set());
        if (!adj.has(e.toCiId)) adj.set(e.toCiId, new Set());
        adj.get(e.fromCiId)!.add(e.toCiId);
        adj.get(e.toCiId)!.add(e.fromCiId); // undirected for traversal
    }
    return adj;
}

// ─── Neighbour expansion ─────────────────────────────────────────────────────

export function expandNeighbors(
    adj: Map<string, Set<string>>,
    seedIds: string[],
    depth: number
): Set<string> {
    const visited = new Set<string>(seedIds);
    let frontier = new Set<string>(seedIds);
    for (let d = 0; d < depth; d++) {
        const next = new Set<string>();
        for (const id of frontier) {
            for (const nb of adj.get(id) ?? []) {
                if (!visited.has(nb)) {
                    visited.add(nb);
                    next.add(nb);
                }
            }
        }
        frontier = next;
        if (frontier.size === 0) break;
    }
    return visited;
}

// ─── BFS shortest path ───────────────────────────────────────────────────────

export function shortestPath(
    adj: Map<string, Set<string>>,
    from: string,
    to: string
): string[] | null {
    if (from === to) return [from];
    const prev = new Map<string, string>();
    const queue = [from];
    const visited = new Set([from]);
    while (queue.length) {
        const cur = queue.shift()!;
        for (const nb of adj.get(cur) ?? []) {
            if (!visited.has(nb)) {
                visited.add(nb);
                prev.set(nb, cur);
                if (nb === to) {
                    // reconstruct
                    const path: string[] = [];
                    let c: string | undefined = to;
                    while (c !== undefined) { path.unshift(c); c = prev.get(c); }
                    return path;
                }
                queue.push(nb);
            }
        }
    }
    return null;
}

// ─── Graph filtering ─────────────────────────────────────────────────────────

export function filterGraph(
    nodes: CiRecord[],
    edges: RelationshipRecord[],
    filters: GraphFilters
): { nodes: CiRecord[]; edges: RelationshipRecord[] } {
    let filteredNodes = nodes;

    if (filters.typeIds.length)
        filteredNodes = filteredNodes.filter(n => filters.typeIds.includes(n.typeId));
    if (filters.statuses.length)
        filteredNodes = filteredNodes.filter(n => filters.statuses.includes(n.status));
    if (filters.envs.length)
        filteredNodes = filteredNodes.filter(n => filters.envs.includes(n.environment));

    const nodeSet = new Set(filteredNodes.map(n => n.id));

    let filteredEdges = edges.filter(
        e => nodeSet.has(e.fromCiId) && nodeSet.has(e.toCiId)
    );
    if (filters.relTypeIds.length)
        filteredEdges = filteredEdges.filter(e => filters.relTypeIds.includes(e.relTypeId));

    if (filters.hideIsolated) {
        const connectedIds = new Set<string>();
        filteredEdges.forEach(e => { connectedIds.add(e.fromCiId); connectedIds.add(e.toCiId); });
        filteredNodes = filteredNodes.filter(n => connectedIds.has(n.id));
    }

    return { nodes: filteredNodes, edges: filteredEdges };
}

// ─── Search filtering ────────────────────────────────────────────────────────

export function searchNodes(nodes: CiRecord[], query: string): Set<string> {
    if (!query.trim()) return new Set(nodes.map(n => n.id));
    const q = query.toLowerCase();
    return new Set(
        nodes
            .filter(n => n.name.toLowerCase().includes(q) || n.ciCode.toLowerCase().includes(q))
            .map(n => n.id)
    );
}

// ─── Visual mapping ──────────────────────────────────────────────────────────

/** Map CI status → fill color (uses design token values from tokens.css) */
export function nodeColor(status: string): string {
    switch (status?.toLowerCase()) {
        case 'active':
        case 'healthy':
        case 'online': return '#10B981'; // --color-success
        case 'warning':
        case 'degraded': return '#F59E0B'; // --color-warning
        case 'critical':
        case 'error':
        case 'down': return '#EF4444'; // --color-danger
        case 'inactive':
        case 'retired': return '#475569'; // slate-600
        default: return '#64748B'; // slate-500
    }
}

/** Map CI status → border color (slightly darker / more saturated) */
export function nodeBorderColor(status: string): string {
    switch (status?.toLowerCase()) {
        case 'active':
        case 'healthy':
        case 'online': return '#059669';
        case 'warning':
        case 'degraded': return '#D97706';
        case 'critical':
        case 'error':
        case 'down': return '#DC2626';
        case 'inactive':
        case 'retired': return '#334155';
        default: return '#475569';
    }
}

/** Derive a shape class token from CI type name */
export function nodeShapeClass(typeName: string): string {
    const l = (typeName ?? '').toLowerCase();
    if (l.includes('server') || l.includes('vm') || l.includes('host')) return 'rect';
    if (l.includes('database') || l.includes('db') || l.includes('data')) return 'diamond';
    if (l.includes('network') || l.includes('router') || l.includes('switch') || l.includes('firewall')) return 'hex';
    if (l.includes('storage') || l.includes('disk') || l.includes('nas') || l.includes('san')) return 'vee';
    if (l.includes('application') || l.includes('app') || l.includes('service') || l.includes('api')) return 'round-rect';
    return 'ellipse';
}

/** Cytoscape shape name from shape class (these are valid Cytoscape node shapes) */
export function cytoscapeShape(shapeClass: string): string {
    switch (shapeClass) {
        case 'rect': return 'round-rectangle';
        case 'diamond': return 'diamond';
        case 'hex': return 'hexagon';
        case 'vee': return 'vee';
        case 'round-rect': return 'round-rectangle';
        default: return 'ellipse';
    }
}

// ─── Legend data ─────────────────────────────────────────────────────────────

export const STATUS_LEGEND = [
    { label: 'Active / Online', color: '#10B981', status: 'active' },
    { label: 'Warning', color: '#F59E0B', status: 'warning' },
    { label: 'Critical / Down', color: '#EF4444', status: 'critical' },
    { label: 'Inactive', color: '#64748B', status: 'inactive' },
] as const;

export const TYPE_LEGEND = [
    { label: 'Server / VM', shapeClass: 'rect', icon: '▬' },
    { label: 'Database', shapeClass: 'diamond', icon: '◆' },
    { label: 'Network device', shapeClass: 'hex', icon: '⬡' },
    { label: 'Storage', shapeClass: 'vee', icon: '▾' },
    { label: 'Application', shapeClass: 'round-rect', icon: '◉' },
    { label: 'Other', shapeClass: 'ellipse', icon: '●' },
] as const;
