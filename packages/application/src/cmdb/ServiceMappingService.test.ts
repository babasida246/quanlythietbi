import { describe, it, expect } from 'vitest'
import { ServiceMappingService } from './ServiceMappingService.js'
import type {
    CmdbServiceMemberRecord,
    CmdbServicePage,
    CmdbServiceRecord,
    IServiceRepo,
    IOpsEventRepo,
    OpsEventInput,
    OpsEventRecord
} from '@qltb/contracts'
import type { CiGraph, GraphProvider } from './RelationshipService.js'

class FakeOpsEvents implements IOpsEventRepo {
    events: OpsEventInput[] = []
    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        this.events.push(event)
        return { id: `evt-${this.events.length}`, createdAt: new Date(), ...event }
    }
    async listByEntity(): Promise<OpsEventRecord[]> { return [] }
}

class FakeServices implements IServiceRepo {
    private services: CmdbServiceRecord[] = []
    private members: CmdbServiceMemberRecord[] = []

    async create(input: { code: string; name: string; criticality?: string | null; owner?: string | null; sla?: string | null; status?: string | null }): Promise<CmdbServiceRecord> {
        const record: CmdbServiceRecord = {
            id: `svc-${this.services.length + 1}`,
            code: input.code,
            name: input.name,
            criticality: input.criticality ?? null,
            owner: input.owner ?? null,
            sla: input.sla ?? null,
            status: input.status ?? null,
            createdAt: new Date()
        }
        this.services.push(record)
        return record
    }

    async update(id: string, patch: Partial<CmdbServiceRecord>): Promise<CmdbServiceRecord | null> {
        const existing = this.services.find(item => item.id === id)
        if (!existing) return null
        const updated = { ...existing, ...patch }
        this.services = this.services.map(item => item.id === id ? updated : item)
        return updated
    }

    async getById(id: string): Promise<CmdbServiceRecord | null> {
        return this.services.find(item => item.id === id) ?? null
    }

    async list(_filters: { q?: string; page?: number; limit?: number } = {}): Promise<CmdbServicePage> {
        return { items: this.services, total: this.services.length, page: 1, limit: 20 }
    }

    async addMember(serviceId: string, input: { ciId: string; role?: string | null }): Promise<CmdbServiceMemberRecord> {
        const record: CmdbServiceMemberRecord = {
            id: `mem-${this.members.length + 1}`,
            serviceId,
            ciId: input.ciId,
            role: input.role ?? null,
            createdAt: new Date()
        }
        this.members.push(record)
        return record
    }

    async removeMember(memberId: string): Promise<boolean> {
        const before = this.members.length
        this.members = this.members.filter(member => member.id !== memberId)
        return this.members.length < before
    }

    async listMembers(serviceId: string): Promise<CmdbServiceMemberRecord[]> {
        return this.members.filter(member => member.serviceId === serviceId)
    }
}

class FakeGraphProvider implements GraphProvider {
    async getGraph(ciId: string, _depth: number, _direction: 'upstream' | 'downstream' | 'both'): Promise<CiGraph> {
        return {
            nodes: [{ id: ciId, typeId: 'type-1', name: `Node ${ciId}`, ciCode: ciId, status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }],
            edges: []
        }
    }
}

describe('ServiceMappingService', () => {
    it('creates services and appends events', async () => {
        const ops = new FakeOpsEvents()
        const service = new ServiceMappingService(new FakeServices(), new FakeGraphProvider(), ops)
        const created = await service.createService({ code: 'SVC', name: 'Service' }, { userId: 'user-1', correlationId: 'corr-1' })
        expect(created.code).toBe('SVC')
        expect(ops.events.some(event => event.eventType === 'SERVICE_CREATED')).toBe(true)
    })

    it('builds impact graph from members', async () => {
        const services = new FakeServices()
        const graphProvider = new FakeGraphProvider()
        const service = new ServiceMappingService(services, graphProvider)
        const created = await services.create({ code: 'SVC', name: 'Service' })
        await services.addMember(created.id, { ciId: 'ci-1' })
        await services.addMember(created.id, { ciId: 'ci-2' })

        const impact = await service.serviceImpact(created.id, 1, 'downstream')
        expect(impact.nodes).toHaveLength(2)
    })
})
