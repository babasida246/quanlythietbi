import { AppError, type RelationshipDirection } from '@qltb/domain'
import type {
    CmdbServiceMemberRecord,
    CmdbServicePage,
    CmdbServiceRecord,
    IServiceRepo,
    IOpsEventRepo
} from '@qltb/contracts'
import type { CmdbContext } from './SchemaService.js'
import type { CiGraph, GraphProvider } from './RelationshipService.js'

export class ServiceMappingService {
    constructor(
        private services: IServiceRepo,
        private graphProvider: GraphProvider,
        private opsEvents?: IOpsEventRepo
    ) { }

    async createService(
        input: { code: string; name: string; criticality?: string | null; owner?: string | null; sla?: string | null; status?: string | null },
        ctx: CmdbContext
    ): Promise<CmdbServiceRecord> {
        const created = await this.services.create(input)
        await this.appendEvent(created.id, 'SERVICE_CREATED', { code: created.code }, ctx)
        return created
    }

    async updateService(
        id: string,
        patch: Partial<CmdbServiceRecord>,
        ctx: CmdbContext
    ): Promise<CmdbServiceRecord> {
        const updated = await this.services.update(id, patch)
        if (!updated) throw AppError.notFound('Service not found')
        await this.appendEvent(updated.id, 'SERVICE_UPDATED', { ...patch }, ctx)
        return updated
    }

    async retireService(id: string, ctx: CmdbContext): Promise<CmdbServiceRecord> {
        return await this.updateService(id, { status: 'retired' }, ctx)
    }

    async listServices(filters: { q?: string; page?: number; limit?: number }): Promise<CmdbServicePage> {
        return await this.services.list(filters)
    }

    async getServiceDetail(serviceId: string): Promise<{ service: CmdbServiceRecord; members: CmdbServiceMemberRecord[] }> {
        const service = await this.services.getById(serviceId)
        if (!service) throw AppError.notFound('Service not found')
        const members = await this.services.listMembers(serviceId)
        return { service, members }
    }

    async addMember(
        serviceId: string,
        input: { ciId: string; role?: string | null },
        ctx: CmdbContext
    ): Promise<CmdbServiceMemberRecord> {
        const created = await this.services.addMember(serviceId, input)
        await this.appendEvent(serviceId, 'SERVICE_MEMBER_ADDED', { ciId: created.ciId }, ctx)
        return created
    }

    async removeMember(serviceId: string, memberId: string, ctx: CmdbContext): Promise<void> {
        const removed = await this.services.removeMember(memberId)
        if (!removed) throw AppError.notFound('Member not found')
        await this.appendEvent(serviceId, 'SERVICE_MEMBER_REMOVED', { memberId }, ctx)
    }

    async serviceImpact(
        serviceId: string,
        depth = 1,
        direction: RelationshipDirection = 'downstream'
    ): Promise<CiGraph> {
        const members = await this.services.listMembers(serviceId)
        const nodes = new Map<string, CiGraph['nodes'][number]>()
        const edges = new Map<string, CiGraph['edges'][number]>()
        for (const member of members) {
            const graph = await this.graphProvider.getGraph(member.ciId, depth, direction)
            graph.nodes.forEach(node => nodes.set(node.id, node))
            graph.edges.forEach(edge => edges.set(edge.id, edge))
        }
        return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) }
    }

    private async appendEvent(
        entityId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: CmdbContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType: 'cmdb_service',
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
