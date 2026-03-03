import type { RelationshipRecord, CiRecord, ICiRepo, IRelRepo } from '@qltb/contracts'

export interface RelationshipDensity {
    ciTypeId: string
    typeName: string
    ciCount: number
    relationshipCount: number
    densityRatio: number // relationships per CI
}

export interface HubCi {
    ciId: string
    ciCode: string
    ciName: string
    connectionCount: number
    incomingCount: number
    outgoingCount: number
}

export interface IsolatedCluster {
    ciIds: string[]
    ciCodes: string[]
    size: number
}

export interface BrokenRelationship {
    relationshipId: string
    fromCiId: string
    fromCiCode: string
    toCiId: string
    toCiCode: string | null
    relTypeId: string
    issue: string
}

export interface RelationshipAnalyticsReport {
    generatedAt: Date
    totalRelationshipCount: number
    densityByType: RelationshipDensity[]
    hubCis: HubCi[] // Top 10 most connected CIs
    isolatedClusters: IsolatedCluster[]
    brokenRelationships: BrokenRelationship[]
}

export class RelationshipAnalyticsService {
    constructor(
        private relRepo: IRelRepo,
        private ciRepo: ICiRepo
    ) { }

    async generateAnalyticsReport(): Promise<RelationshipAnalyticsReport> {
        const allRelationships = await this.relRepo.list()
        const allCisPage = await this.ciRepo.list({ limit: 10000 })
        const allCis = allCisPage.items

        const ciMap = new Map(allCis.map((ci: CiRecord) => [ci.id, ci]))
        const cisByType = this.groupBy(allCis, 'typeId')

        // Calculate density by type
        const densityByType = cisByType.map(([typeId, cis]) => {
            const relCount = allRelationships.filter(rel =>
                (ciMap.get(rel.fromCiId)?.typeId === typeId) ||
                (ciMap.get(rel.toCiId)?.typeId === typeId)
            ).length
            return {
                ciTypeId: typeId,
                typeName: `Type-${typeId}`,
                ciCount: cis.length,
                relationshipCount: relCount,
                densityRatio: cis.length > 0 ? relCount / cis.length : 0
            }
        })

        // Find hub CIs (most connected)
        const connectionMap = new Map<string, { incoming: number; outgoing: number }>()
        allCis.forEach((ci: CiRecord) => {
            connectionMap.set(ci.id, { incoming: 0, outgoing: 0 })
        })
        allRelationships.forEach(rel => {
            const from = connectionMap.get(rel.fromCiId)
            const to = connectionMap.get(rel.toCiId)
            if (from) from.outgoing++
            if (to) to.incoming++
        })

        const hubCis: HubCi[] = allCis
            .map((ci: CiRecord) => {
                const conn = connectionMap.get(ci.id) || { incoming: 0, outgoing: 0 }
                return {
                    ciId: ci.id,
                    ciCode: ci.ciCode,
                    ciName: ci.name,
                    connectionCount: conn.incoming + conn.outgoing,
                    incomingCount: conn.incoming,
                    outgoingCount: conn.outgoing
                }
            })
            .sort((a: any, b: any) => b.connectionCount - a.connectionCount)
            .slice(0, 10)

        // Find isolated clusters (connected components)
        const isolatedClusters = this.findIsolatedClusters(allRelationships, allCis)

        // Find broken relationships (reference non-existent CIs)
        const brokenRelationships = this.findBrokenRelationships(allRelationships, ciMap)

        return {
            generatedAt: new Date(),
            totalRelationshipCount: allRelationships.length,
            densityByType,
            hubCis,
            isolatedClusters,
            brokenRelationships
        }
    }

    private groupBy<T>(items: T[], key: keyof T): Array<[string, T[]]> {
        const grouped = new Map<string, T[]>()
        items.forEach(item => {
            const k = String(item[key])
            if (!grouped.has(k)) {
                grouped.set(k, [])
            }
            grouped.get(k)!.push(item)
        })
        return Array.from(grouped.entries())
    }

    private findIsolatedClusters(relationships: RelationshipRecord[], cis: CiRecord[]): IsolatedCluster[] {
        const visited = new Set<string>()
        const clusters: IsolatedCluster[] = []

        // Build adjacency list
        const adj = new Map<string, string[]>()
        cis.forEach(ci => {
            adj.set(ci.id, [])
        })
        relationships.forEach(rel => {
            const from = adj.get(rel.fromCiId) || []
            const to = adj.get(rel.toCiId) || []
            from.push(rel.toCiId)
            to.push(rel.fromCiId)
            adj.set(rel.fromCiId, from)
            adj.set(rel.toCiId, to)
        })

        // BFS to find connected components
        const bfs = (startId: string): string[] => {
            const component: string[] = []
            const queue: string[] = [startId]
            visited.add(startId)

            while (queue.length > 0) {
                const id = queue.shift()!
                component.push(id)
                const neighbors = adj.get(id) || []
                neighbors.forEach(neighborId => {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId)
                        queue.push(neighborId)
                    }
                })
            }
            return component
        }

        cis.forEach(ci => {
            if (!visited.has(ci.id)) {
                const component = bfs(ci.id)
                if (component.length > 1) {
                    const ciMap = new Map(cis.map(c => [c.id, c]))
                    clusters.push({
                        ciIds: component,
                        ciCodes: component.map(id => ciMap.get(id)?.ciCode || id),
                        size: component.length
                    })
                }
            }
        })

        return clusters.sort((a, b) => b.size - a.size)
    }

    private findBrokenRelationships(
        relationships: RelationshipRecord[],
        ciMap: Map<string, CiRecord>
    ): BrokenRelationship[] {
        const broken: BrokenRelationship[] = []

        relationships.forEach(rel => {
            const fromCi = ciMap.get(rel.fromCiId)
            const toCi = ciMap.get(rel.toCiId)

            if (!fromCi) {
                broken.push({
                    relationshipId: rel.id,
                    fromCiId: rel.fromCiId,
                    fromCiCode: 'MISSING',
                    toCiId: rel.toCiId,
                    toCiCode: toCi?.ciCode || null,
                    relTypeId: rel.relTypeId,
                    issue: 'Source CI not found'
                })
            } else if (!toCi) {
                broken.push({
                    relationshipId: rel.id,
                    fromCiId: rel.fromCiId,
                    fromCiCode: fromCi.ciCode,
                    toCiId: rel.toCiId,
                    toCiCode: null,
                    relTypeId: rel.relTypeId,
                    issue: 'Target CI not found'
                })
            }
        })

        return broken
    }
}
