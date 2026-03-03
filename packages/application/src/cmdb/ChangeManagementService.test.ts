import { beforeEach, describe, expect, it } from 'vitest'
import type { CiCreateInput, CiRecord, CmdbChangeCreateInput, CmdbChangeListFilters, CmdbChangePage, CmdbChangeRecord, CmdbChangeUpdatePatch, ICiRepo, ICmdbChangeRepo, IOpsEventRepo, OpsEventInput, OpsEventRecord } from '@qltb/contracts'
import { ChangeManagementService } from './ChangeManagementService.js'

class FakeChangeRepo implements ICmdbChangeRepo {
    private seq = 1
    items: CmdbChangeRecord[] = []

    async create(input: CmdbChangeCreateInput): Promise<CmdbChangeRecord> {
        const now = new Date()
        const record: CmdbChangeRecord = {
            id: `chg-${this.seq}`,
            code: `CHG-2026-00000${this.seq++}`,
            title: input.title,
            description: input.description ?? null,
            status: 'draft',
            risk: input.risk ?? 'medium',
            primaryCiId: input.primaryCiId ?? null,
            impactSnapshot: null,
            implementationPlan: input.implementationPlan ?? null,
            rollbackPlan: input.rollbackPlan ?? null,
            plannedStartAt: input.plannedStartAt ?? null,
            plannedEndAt: input.plannedEndAt ?? null,
            requestedBy: input.requestedBy ?? null,
            approvedBy: null,
            implementedBy: null,
            implementedAt: null,
            closedAt: null,
            metadata: input.metadata ?? null,
            createdAt: now,
            updatedAt: now
        }
        this.items.push(record)
        return record
    }

    async update(id: string, patch: CmdbChangeUpdatePatch): Promise<CmdbChangeRecord | null> {
        const index = this.items.findIndex(item => item.id === id)
        if (index < 0) return null
        const updated: CmdbChangeRecord = {
            ...this.items[index],
            ...patch,
            updatedAt: new Date()
        }
        this.items[index] = updated
        return updated
    }

    async getById(id: string): Promise<CmdbChangeRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }

    async list(filters: CmdbChangeListFilters): Promise<CmdbChangePage> {
        let items = [...this.items]
        if (filters.status) items = items.filter(item => item.status === filters.status)
        return { items, total: items.length, page: filters.page ?? 1, limit: filters.limit ?? 20 }
    }
}

class FakeCiRepo implements ICiRepo {
    constructor(private cis: CiRecord[]) { }
    async create(_input: CiCreateInput): Promise<CiRecord> { throw new Error('not implemented') }
    async update(): Promise<CiRecord | null> { return null }
    async getById(id: string): Promise<CiRecord | null> { return this.cis.find(ci => ci.id === id) ?? null }
    async list(): Promise<{ items: CiRecord[]; total: number; page: number; limit: number }> {
        return { items: this.cis, total: this.cis.length, page: 1, limit: 20 }
    }
    async getByAssetId(): Promise<CiRecord | null> { return null }
}

class FakeOpsEvents implements IOpsEventRepo {
    events: OpsEventInput[] = []
    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        this.events.push(event)
        return { id: `evt-${this.events.length}`, createdAt: new Date(), ...event }
    }
    async listByEntity(): Promise<OpsEventRecord[]> { return [] }
    async list(): Promise<OpsEventRecord[]> { return [] }
}

describe('ChangeManagementService', () => {
    let repo: FakeChangeRepo
    let ciRepo: FakeCiRepo
    let ops: FakeOpsEvents
    let service: ChangeManagementService

    beforeEach(() => {
        repo = new FakeChangeRepo()
        ciRepo = new FakeCiRepo([
            { id: 'ci-1', typeId: 'type-1', name: 'App', ciCode: 'APP-1', status: 'active', environment: 'prod', createdAt: new Date(), updatedAt: new Date() }
        ])
        ops = new FakeOpsEvents()
        const relationshipService = {
            getImpactAnalysis: async () => ({ affected: [], count: 0, depth: 0 })
        } as any
        service = new ChangeManagementService(repo, ciRepo, relationshipService, ops)
    })

    it('runs full change workflow and stores impact snapshot', async () => {
        const created = await service.createChange({
            title: 'Patch application',
            primaryCiId: 'ci-1',
            risk: 'high'
        }, { userId: 'requester', correlationId: 'corr-1' })

        const submitted = await service.submitChange(created.id, { userId: 'requester', correlationId: 'corr-1' })
        expect(submitted.status).toBe('submitted')
        expect(submitted.impactSnapshot).toBeTruthy()

        const approved = await service.approveChange(created.id, { userId: 'approver', correlationId: 'corr-2' })
        expect(approved.status).toBe('approved')
        expect(approved.approvedBy).toBe('approver')

        const implemented = await service.implementChange(created.id, { userId: 'implementer', correlationId: 'corr-3' })
        expect(implemented.status).toBe('implemented')
        expect(implemented.implementedBy).toBe('implementer')
        expect(implemented.implementedAt).toBeInstanceOf(Date)

        const closed = await service.closeChange(created.id, { userId: 'closer', correlationId: 'corr-4' })
        expect(closed.status).toBe('closed')
        expect(closed.closedAt).toBeInstanceOf(Date)
        expect(ops.events.some(event => event.eventType === 'CMDB_CHANGE_CLOSED')).toBe(true)
    })

    it('enforces separation of duties on approve/implement', async () => {
        const created = await service.createChange({ title: 'Restart service', primaryCiId: 'ci-1' }, { userId: 'same-user', correlationId: 'corr-1' })
        await service.submitChange(created.id, { userId: 'same-user', correlationId: 'corr-1' })

        await expect(service.approveChange(created.id, { userId: 'same-user', correlationId: 'corr-2' })).rejects.toThrow()
        await service.approveChange(created.id, { userId: 'approver', correlationId: 'corr-3' })
        await expect(service.implementChange(created.id, { userId: 'approver', correlationId: 'corr-4' })).rejects.toThrow()
    })
})

