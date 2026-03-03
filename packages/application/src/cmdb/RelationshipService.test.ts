import { describe, it, expect } from 'vitest'
import { RelationshipService } from './RelationshipService.js'
import type {
    CiCreateInput,
    CiRecord,
    ICiRepo,
    IOpsEventRepo,
    IRelRepo,
    IRelTypeRepo,
    OpsEventInput,
    OpsEventRecord,
    RelationshipRecord,
    RelationshipTypeRecord
} from '@qltb/contracts'

class FakeOpsEvents implements IOpsEventRepo {
    events: OpsEventInput[] = []
    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        this.events.push(event)
        return { id: `evt-${this.events.length}`, createdAt: new Date(), ...event }
    }
    async listByEntity(): Promise<OpsEventRecord[]> { return [] }
}

class FakeRelTypes implements IRelTypeRepo {
    constructor(private relType: RelationshipTypeRecord) { }
    async create(_input: { code: string; name: string; reverseName?: string | null; allowedFromTypeId?: string | null; allowedToTypeId?: string | null }): Promise<RelationshipTypeRecord> {
        return this.relType
    }
    async list(): Promise<RelationshipTypeRecord[]> { return [this.relType] }
    async getById(_id: string): Promise<RelationshipTypeRecord | null> { return this.relType }
    async update(_id: string, patch: Partial<{
        code: string
        name: string
        reverseName: string | null
        allowedFromTypeId: string | null
        allowedToTypeId: string | null
    }>): Promise<RelationshipTypeRecord | null> {
        return { ...this.relType, ...patch }
    }
    async delete(_id: string): Promise<boolean> { return true }
}

class FakeRels implements IRelRepo {
    private items: RelationshipRecord[] = []
    async create(input: { relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null }): Promise<RelationshipRecord> {
        const record: RelationshipRecord = {
            id: `rel-${this.items.length + 1}`,
            relTypeId: input.relTypeId,
            fromCiId: input.fromCiId,
            toCiId: input.toCiId,
            status: 'active',
            sinceDate: input.sinceDate ?? null,
            note: input.note ?? null,
            createdAt: new Date()
        }
        this.items.push(record)
        return record
    }
    async retire(id: string): Promise<RelationshipRecord | null> {
        const record = this.items.find(item => item.id === id)
        if (!record) return null
        record.status = 'retired'
        return record
    }
    async listByCi(ciId: string): Promise<RelationshipRecord[]> {
        return this.items.filter(item => item.status === 'active' && (item.fromCiId === ciId || item.toCiId === ciId))
    }
    async list(): Promise<RelationshipRecord[]> {
        return this.items.filter(item => item.status === 'active')
    }
}

class FakeCis implements ICiRepo {
    constructor(private items: CiRecord[]) { }
    async create(_input: CiCreateInput): Promise<CiRecord> { throw new Error('not implemented') }
    async update(_id: string): Promise<CiRecord | null> { return null }
    async getById(id: string): Promise<CiRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }
    async list(_filters: { q?: string; status?: string; environment?: string; typeId?: string; page?: number; limit?: number } = {}): Promise<{ items: CiRecord[]; total: number; page: number; limit: number }> {
        return { items: this.items, total: this.items.length, page: 1, limit: 20 }
    }
    async getByAssetId(): Promise<CiRecord | null> { return null }
}

describe('RelationshipService', () => {
    it('creates relationship types with events', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: null,
            allowedFromTypeId: null,
            allowedToTypeId: null
        }
        const ops = new FakeOpsEvents()
        const service = new RelationshipService(new FakeRelTypes(relType), new FakeRels(), new FakeCis([]), ops)

        const created = await service.createRelationshipType({
            code: 'DEPENDS_ON',
            name: 'Depends On'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(created.code).toBe('DEPENDS_ON')
        expect(ops.events.some(event => event.eventType === 'REL_TYPE_CREATED')).toBe(true)
    })

    it('creates relationships when types allowed', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: 'Used By',
            allowedFromTypeId: 'type-app',
            allowedToTypeId: 'type-db'
        }
        const cis: CiRecord[] = [
            { id: 'ci-1', typeId: 'type-app', name: 'App', ciCode: 'APP-1', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-2', typeId: 'type-db', name: 'DB', ciCode: 'DB-1', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ]
        const ops = new FakeOpsEvents()
        const service = new RelationshipService(new FakeRelTypes(relType), new FakeRels(), new FakeCis(cis), ops)

        const created = await service.createRelationship({
            relTypeId: relType.id,
            fromCiId: 'ci-1',
            toCiId: 'ci-2'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(created.relTypeId).toBe(relType.id)
        expect(ops.events.some(event => event.eventType === 'REL_CREATED')).toBe(true)
    })

    it('rejects relationships with invalid types', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: null,
            allowedFromTypeId: 'type-app',
            allowedToTypeId: 'type-db'
        }
        const cis: CiRecord[] = [
            { id: 'ci-1', typeId: 'type-cache', name: 'Cache', ciCode: 'CACHE-1', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-2', typeId: 'type-db', name: 'DB', ciCode: 'DB-1', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ]
        const service = new RelationshipService(new FakeRelTypes(relType), new FakeRels(), new FakeCis(cis))

        await expect(service.createRelationship({
            relTypeId: relType.id,
            fromCiId: 'ci-1',
            toCiId: 'ci-2'
        }, { userId: 'user-1', correlationId: 'corr-1' })).rejects.toThrow()
    })

    it('builds graph without cycles', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: null
        }
        const cis: CiRecord[] = [
            { id: 'ci-a', typeId: 'type-app', name: 'A', ciCode: 'A', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-b', typeId: 'type-app', name: 'B', ciCode: 'B', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-c', typeId: 'type-app', name: 'C', ciCode: 'C', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ]
        const rels = new FakeRels()
        await rels.create({ relTypeId: 'rel-type-1', fromCiId: 'ci-a', toCiId: 'ci-b' })
        await rels.create({ relTypeId: 'rel-type-1', fromCiId: 'ci-b', toCiId: 'ci-c' })
        await rels.create({ relTypeId: 'rel-type-1', fromCiId: 'ci-c', toCiId: 'ci-a' })

        const service = new RelationshipService(new FakeRelTypes(relType), rels, new FakeCis(cis))
        const graph = await service.getGraph('ci-a', 2, 'downstream')

        expect(graph.nodes).toHaveLength(3)
        expect(graph.edges).toHaveLength(2)
    })

    it('rejects relationship creation when it introduces dependency cycle', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: null
        }
        const cis: CiRecord[] = [
            { id: 'ci-a', typeId: 'type-app', name: 'A', ciCode: 'A', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-b', typeId: 'type-app', name: 'B', ciCode: 'B', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-c', typeId: 'type-app', name: 'C', ciCode: 'C', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ]
        const rels = new FakeRels()
        await rels.create({ relTypeId: relType.id, fromCiId: 'ci-a', toCiId: 'ci-b' })
        await rels.create({ relTypeId: relType.id, fromCiId: 'ci-b', toCiId: 'ci-c' })

        const service = new RelationshipService(new FakeRelTypes(relType), rels, new FakeCis(cis))
        await expect(service.createRelationship({
            relTypeId: relType.id,
            fromCiId: 'ci-c',
            toCiId: 'ci-a'
        }, { userId: 'user-1', correlationId: 'corr-1' })).rejects.toThrow(/cycle/i)
    })

    it('supports dry-run batch import with validation errors', async () => {
        const relType: RelationshipTypeRecord = {
            id: 'rel-type-1',
            code: 'DEPENDS_ON',
            name: 'Depends On',
            reverseName: null
        }
        const cis: CiRecord[] = [
            { id: 'ci-a', typeId: 'type-app', name: 'A', ciCode: 'A', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() },
            { id: 'ci-b', typeId: 'type-app', name: 'B', ciCode: 'B', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ]
        const rels = new FakeRels()
        const service = new RelationshipService(new FakeRelTypes(relType), rels, new FakeCis(cis))

        const result = await service.importRelationships({
            dryRun: true,
            items: [
                { relTypeId: relType.id, fromCiId: 'ci-a', toCiId: 'ci-b' },
                { relTypeId: relType.id, fromCiId: 'ci-a', toCiId: 'ci-a' }
            ]
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(result.dryRun).toBe(true)
        expect(result.total).toBe(2)
        expect(result.created).toHaveLength(0)
        expect(result.errors.length).toBeGreaterThan(0)
    })
})
