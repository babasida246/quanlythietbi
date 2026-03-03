import { AppError, type RelationshipDirection } from '@qltb/domain'
import type {
    CiRecord,
    ICiRepo,
    IOpsEventRepo,
    IRelRepo,
    IRelTypeRepo,
    RelationshipRecord,
    RelationshipTypeRecord
} from '@qltb/contracts'
import type { CmdbContext } from './SchemaService.js'

export interface CiGraph {
    nodes: CiRecord[]
    edges: RelationshipRecord[]
}

export interface GraphProvider {
    getGraph(ciId: string, depth: number, direction: RelationshipDirection): Promise<CiGraph>
}

export interface RelationshipImportItem {
    relTypeId: string
    fromCiId: string
    toCiId: string
    sinceDate?: string | null
    note?: string | null
}

export interface RelationshipImportResult {
    dryRun: boolean
    total: number
    created: RelationshipRecord[]
    errors: Array<{ index: number; message: string }>
}

export class RelationshipService implements GraphProvider {
    constructor(
        private relTypes: IRelTypeRepo,
        private rels: IRelRepo,
        private cis: ICiRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async listRelationshipTypes(): Promise<RelationshipTypeRecord[]> {
        return await this.relTypes.list()
    }

    async createRelationshipType(
        input: { code: string; name: string; reverseName?: string | null; allowedFromTypeId?: string | null; allowedToTypeId?: string | null },
        ctx: CmdbContext
    ): Promise<RelationshipTypeRecord> {
        const created = await this.relTypes.create(input)
        await this.appendEvent('REL_TYPE_CREATED', created.id, { code: created.code, name: created.name }, ctx)
        return created
    }

    async updateRelationshipType(
        id: string,
        patch: Partial<{
            code: string
            name: string
            reverseName: string | null
            allowedFromTypeId: string | null
            allowedToTypeId: string | null
        }>,
        ctx: CmdbContext
    ): Promise<RelationshipTypeRecord> {
        const existing = await this.relTypes.getById(id)
        if (!existing) throw AppError.notFound('Relationship type not found')
        const updated = await this.relTypes.update(id, patch)
        if (!updated) throw AppError.notFound('Relationship type not found')
        await this.appendEvent('REL_TYPE_UPDATED', updated.id, { code: updated.code, name: updated.name }, ctx)
        return updated
    }

    async deleteRelationshipType(id: string, ctx: CmdbContext): Promise<void> {
        const existing = await this.relTypes.getById(id)
        if (!existing) throw AppError.notFound('Relationship type not found')
        const deleted = await this.relTypes.delete(id)
        if (!deleted) throw AppError.notFound('Relationship type not found')
        await this.appendEvent('REL_TYPE_DELETED', existing.id, { code: existing.code, name: existing.name }, ctx)
    }

    async createRelationship(
        input: { relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null },
        ctx: CmdbContext
    ): Promise<RelationshipRecord> {
        if (input.fromCiId === input.toCiId) {
            throw AppError.badRequest('Self-loop relationships are not allowed')
        }
        const relType = await this.getRelType(input.relTypeId)
        const from = await this.getCi(input.fromCiId, 'Source CI not found')
        const to = await this.getCi(input.toCiId, 'Target CI not found')
        this.assertTypeAllowed(relType, from, to)
        await this.assertNoCycles([{ fromCiId: input.fromCiId, toCiId: input.toCiId }])
        const created = await this.rels.create(input)
        await this.appendEvent('REL_CREATED', created.id, { relTypeId: created.relTypeId, fromCiId: created.fromCiId, toCiId: created.toCiId }, ctx)
        return created
    }

    async retireRelationship(id: string, ctx: CmdbContext): Promise<RelationshipRecord> {
        const updated = await this.rels.retire(id)
        if (!updated) throw AppError.notFound('Relationship not found')
        await this.appendEvent('REL_RETIRED', updated.id, { relTypeId: updated.relTypeId, fromCiId: updated.fromCiId, toCiId: updated.toCiId }, ctx)
        return updated
    }

    async listRelationshipsByCi(ciId: string): Promise<RelationshipRecord[]> {
        await this.getCi(ciId, 'CI not found')
        return await this.rels.listByCi(ciId)
    }

    async importRelationships(
        input: { items: RelationshipImportItem[]; dryRun?: boolean; allowCycles?: boolean },
        ctx: CmdbContext
    ): Promise<RelationshipImportResult> {
        const items = input.items ?? []
        if (items.length === 0) {
            throw AppError.badRequest('No relationships provided')
        }

        const errors: Array<{ index: number; message: string }> = []
        const existing = await this.rels.list()
        const existingKeys = new Set(existing.filter(rel => rel.status === 'active').map(rel => this.relKey(rel.relTypeId, rel.fromCiId, rel.toCiId)))
        const batchKeys = new Set<string>()
        const relTypeCache = new Map<string, RelationshipTypeRecord>()
        const ciCache = new Map<string, CiRecord>()

        const loadRelType = async (id: string): Promise<RelationshipTypeRecord> => {
            const found = relTypeCache.get(id)
            if (found) return found
            const relType = await this.getRelType(id)
            relTypeCache.set(id, relType)
            return relType
        }
        const loadCi = async (id: string, message: string): Promise<CiRecord> => {
            const found = ciCache.get(id)
            if (found) return found
            const ci = await this.getCi(id, message)
            ciCache.set(id, ci)
            return ci
        }

        for (const [index, item] of items.entries()) {
            try {
                if (item.fromCiId === item.toCiId) {
                    throw AppError.badRequest('Self-loop relationships are not allowed')
                }
                const relType = await loadRelType(item.relTypeId)
                const from = await loadCi(item.fromCiId, 'Source CI not found')
                const to = await loadCi(item.toCiId, 'Target CI not found')
                this.assertTypeAllowed(relType, from, to)
                const key = this.relKey(item.relTypeId, item.fromCiId, item.toCiId)
                if (existingKeys.has(key)) {
                    throw AppError.conflict('Relationship already exists')
                }
                if (batchKeys.has(key)) {
                    throw AppError.conflict('Duplicate relationship in import payload')
                }
                batchKeys.add(key)
            } catch (error) {
                errors.push({
                    index,
                    message: error instanceof Error ? error.message : 'Validation failed'
                })
            }
        }

        if (!input.allowCycles) {
            const validItems = items.filter((_, index) => !errors.some(err => err.index === index))
            try {
                await this.assertNoCycles(validItems.map(item => ({ fromCiId: item.fromCiId, toCiId: item.toCiId })))
            } catch (error) {
                errors.push({
                    index: -1,
                    message: error instanceof Error ? error.message : 'Cycle validation failed'
                })
            }
        }

        if (errors.length > 0 || input.dryRun) {
            return {
                dryRun: Boolean(input.dryRun),
                total: items.length,
                created: [],
                errors
            }
        }

        const created: RelationshipRecord[] = []
        for (const item of items) {
            const record = await this.rels.create(item)
            created.push(record)
            await this.appendEvent('REL_CREATED', record.id, { relTypeId: record.relTypeId, fromCiId: record.fromCiId, toCiId: record.toCiId, imported: true }, ctx)
        }
        return {
            dryRun: false,
            total: items.length,
            created,
            errors: []
        }
    }

    async getGraph(ciId: string, depth = 1, direction: RelationshipDirection = 'both'): Promise<CiGraph> {
        const start = await this.cis.getById(ciId)
        if (!start) throw AppError.notFound('CI not found')
        const nodes = new Map<string, CiRecord>([[start.id, start]])
        const edges = new Map<string, RelationshipRecord>()
        const visited = new Set<string>([start.id])
        let frontier = [start.id]

        for (let level = 0; level < depth; level += 1) {
            const next: string[] = []
            for (const currentId of frontier) {
                const relationships = await this.rels.listByCi(currentId)
                for (const rel of relationships) {
                    const neighbor = this.resolveNeighbor(rel, currentId, direction)
                    if (!neighbor) continue
                    edges.set(rel.id, rel)
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor)
                        const node = await this.cis.getById(neighbor)
                        if (node) nodes.set(node.id, node)
                        next.push(neighbor)
                    }
                }
            }
            frontier = next
            if (frontier.length === 0) break
        }

        return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) }
    }

    async getFullGraph(depth = 2, direction: RelationshipDirection = 'both'): Promise<CiGraph> {
        // Get all active CIs
        const allCisPage = await this.cis.list({ status: 'active', limit: 1000 })
        const allCis = allCisPage.items

        // Get all relationships between them
        const allRels = await this.rels.list()

        // Build set of active CI ids to filter out edges referencing non-active CIs
        const activeIds = new Set(allCis.map((ci: CiRecord) => ci.id))

        // Only include edges where BOTH endpoints are active CIs
        const validRels = allRels.filter(rel => activeIds.has(rel.fromCiId) && activeIds.has(rel.toCiId))

        // Filter relationships based on direction if needed
        const edges = direction === 'both' ? validRels : validRels.filter(rel => {
            // For directed graphs, could filter by relationship type direction
            // For now, include all
            return true
        })

        // Create node map from CIs that have relationships
        const ciIds = new Set<string>()
        edges.forEach(rel => {
            ciIds.add(rel.fromCiId)
            ciIds.add(rel.toCiId)
        })

        const nodes = allCis.filter((ci: CiRecord) => ciIds.has(ci.id))

        return { nodes, edges }
    }

    async getDependencyPath(ciId: string, direction: 'upstream' | 'downstream' = 'downstream'): Promise<{ path: CiRecord[]; chain: string[] }> {
        const start = await this.cis.getById(ciId)
        if (!start) throw AppError.notFound('CI not found')

        const path: CiRecord[] = [start]
        const chain: string[] = [start.ciCode]
        const visited = new Set<string>([start.id])
        let frontier = [start.id]
        let depth = 0
        const maxDepth = 5

        while (frontier.length > 0 && depth < maxDepth) {
            const next: string[] = []
            for (const currentId of frontier) {
                const relationships = await this.rels.listByCi(currentId)
                for (const rel of relationships) {
                    const neighbor = this.resolveNeighbor(rel, currentId, direction === 'downstream' ? 'downstream' : 'upstream')
                    if (!neighbor || visited.has(neighbor)) continue

                    visited.add(neighbor)
                    const node = await this.cis.getById(neighbor)
                    if (node) {
                        path.push(node)
                        chain.push(node.ciCode)
                        next.push(neighbor)
                    }
                }
            }
            frontier = next
            depth++
        }

        return { path, chain }
    }

    async getImpactAnalysis(ciId: string): Promise<{ affected: CiRecord[]; count: number; depth: number }> {
        const start = await this.cis.getById(ciId)
        if (!start) throw AppError.notFound('CI not found')

        const affected = new Set<string>()
        const visited = new Set<string>([start.id])
        let frontier = [start.id]
        let depth = 0

        // BFS upstream: find all CIs that depend on this CI (directly or transitively).
        // In the CMDB model: rel.fromCiId depends_on rel.toCiId
        // So if X fails, all A where rel.toCiId === X are immediately affected (A depends on X).
        while (frontier.length > 0) {
            const next: string[] = []
            for (const currentId of frontier) {
                const relationships = await this.rels.listByCi(currentId)
                for (const rel of relationships) {
                    // Only traverse edges pointing TO currentId (fromCiId depends on currentId)
                    if (rel.toCiId !== currentId) continue
                    const dependent = rel.fromCiId
                    if (!visited.has(dependent)) {
                        visited.add(dependent)
                        affected.add(dependent)
                        next.push(dependent)
                    }
                }
            }
            frontier = next
            depth++
        }

        const affectedCis: CiRecord[] = []
        for (const id of affected) {
            const ci = await this.cis.getById(id)
            if (ci) affectedCis.push(ci)
        }

        return { affected: affectedCis, count: affected.size, depth }
    }

    private resolveNeighbor(
        rel: RelationshipRecord,
        currentId: string,
        direction: RelationshipDirection
    ): string | null {
        if (direction === 'downstream') {
            return rel.fromCiId === currentId ? rel.toCiId : null
        }
        if (direction === 'upstream') {
            return rel.toCiId === currentId ? rel.fromCiId : null
        }
        return rel.fromCiId === currentId ? rel.toCiId : rel.fromCiId
    }

    private async getRelType(id: string): Promise<RelationshipTypeRecord> {
        const relType = await this.relTypes.getById(id)
        if (!relType) throw AppError.notFound('Relationship type not found')
        return relType
    }

    private async getCi(id: string, message: string): Promise<CiRecord> {
        const ci = await this.cis.getById(id)
        if (!ci) throw AppError.notFound(message)
        return ci
    }

    private assertTypeAllowed(relType: RelationshipTypeRecord, from: CiRecord, to: CiRecord): void {
        if (relType.allowedFromTypeId && relType.allowedFromTypeId !== from.typeId) {
            throw AppError.badRequest('Source CI type not allowed')
        }
        if (relType.allowedToTypeId && relType.allowedToTypeId !== to.typeId) {
            throw AppError.badRequest('Target CI type not allowed')
        }
    }

    private relKey(relTypeId: string, fromCiId: string, toCiId: string): string {
        return `${relTypeId}:${fromCiId}:${toCiId}`
    }

    private async assertNoCycles(candidateEdges: Array<{ fromCiId: string; toCiId: string }>): Promise<void> {
        if (candidateEdges.length === 0) return
        const existing = await this.rels.list()
        const graph = new Map<string, Set<string>>()
        const addEdge = (from: string, to: string) => {
            if (!graph.has(from)) graph.set(from, new Set())
            graph.get(from)!.add(to)
        }

        for (const rel of existing) {
            if (rel.status !== 'active') continue
            addEdge(rel.fromCiId, rel.toCiId)
        }
        for (const edge of candidateEdges) {
            addEdge(edge.fromCiId, edge.toCiId)
        }

        const visiting = new Set<string>()
        const visited = new Set<string>()
        const visit = (node: string): boolean => {
            if (visiting.has(node)) return true
            if (visited.has(node)) return false
            visiting.add(node)
            for (const neighbor of graph.get(node) ?? []) {
                if (visit(neighbor)) return true
            }
            visiting.delete(node)
            visited.add(node)
            return false
        }

        for (const node of graph.keys()) {
            if (visit(node)) {
                throw AppError.badRequest('Dependency cycle detected')
            }
        }
    }

    private async appendEvent(
        eventType: string,
        entityId: string,
        payload: Record<string, unknown>,
        ctx: CmdbContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType: 'cmdb_rel',
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
