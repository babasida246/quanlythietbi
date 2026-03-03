import { describe, it, expect, beforeEach } from 'vitest'
import { AssetService } from './AssetService.js'
import type {
    AssetAssignmentInput,
    AssetAssignmentRecord,
    AssetBulkUpsertInput,
    AssetCreateInput,
    AssetEventInput,
    AssetEventPage,
    AssetEventRecord,
    AssetRecord,
    AssetImportRow,
    AssetSearchFilters,
    AssetSearchResult,
    AssetUpdatePatch,
    IAssetEventRepo,
    IAssetRepo,
    IAssignmentRepo,
    IMaintenanceRepo,
    MaintenanceTicketRecord
} from '@qltb/contracts'

class FakeAssetRepo implements IAssetRepo {
    private items: AssetRecord[] = []
    private seq = 1

    async create(asset: AssetCreateInput): Promise<AssetRecord> {
        const now = new Date()
        const record: AssetRecord = {
            id: `asset-${this.seq++}`,
            createdAt: now,
            updatedAt: now,
            ...asset
        }
        this.items.push(record)
        return record
    }

    async update(id: string, patch: AssetUpdatePatch): Promise<AssetRecord> {
        const existing = await this.getById(id)
        if (!existing) {
            throw new Error('Asset not found')
        }
        const updated: AssetRecord = {
            ...existing,
            ...patch,
            updatedAt: new Date()
        }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }

    async getById(id: string): Promise<AssetRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }

    async getByAssetCode(assetCode: string): Promise<AssetRecord | null> {
        return this.items.find(item => item.assetCode === assetCode) ?? null
    }

    async delete(id: string): Promise<boolean> {
        const before = this.items.length
        this.items = this.items.filter(item => item.id !== id)
        return this.items.length < before
    }

    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return {
            items: [...this.items],
            total: this.items.length,
            page: 1,
            limit: this.items.length
        }
    }

    async bulkUpsert(items: AssetBulkUpsertInput[]): Promise<{ created: number; updated: number; items: AssetRecord[] }> {
        let created = 0
        let updated = 0
        const results: AssetRecord[] = []
        for (const input of items) {
            const existing = await this.getByAssetCode(input.assetCode)
            if (existing) {
                const next = await this.update(existing.id, input)
                results.push(next)
                updated += 1
            } else {
                const next = await this.create(input)
                results.push(next)
                created += 1
            }
        }
        return { created, updated, items: results }
    }
}

class FakeAssignmentRepo implements IAssignmentRepo {
    private items: AssetAssignmentRecord[] = []
    private seq = 1

    async assign(assetId: string, assignment: AssetAssignmentInput): Promise<AssetAssignmentRecord> {
        const record: AssetAssignmentRecord = {
            id: `assign-${this.seq++}`,
            assetId,
            assigneeType: assignment.assigneeType,
            assigneeId: assignment.assigneeId,
            assigneeName: assignment.assigneeName,
            assignedAt: assignment.assignedAt ?? new Date(),
            returnedAt: null,
            note: assignment.note ?? null
        }
        this.items.push(record)
        return record
    }

    async return(assetId: string, returnedAt: Date, note?: string): Promise<AssetAssignmentRecord | null> {
        const active = await this.getActiveByAsset(assetId)
        if (!active) return null
        const updated: AssetAssignmentRecord = {
            ...active,
            returnedAt,
            note: note ?? active.note ?? null
        }
        this.items = this.items.map(item => item.id === active.id ? updated : item)
        return updated
    }

    async listByAsset(assetId: string): Promise<AssetAssignmentRecord[]> {
        return this.items.filter(item => item.assetId === assetId)
    }

    async getActiveByAsset(assetId: string): Promise<AssetAssignmentRecord | null> {
        return this.items.find(item => item.assetId === assetId && !item.returnedAt) ?? null
    }
}

class FakeEventRepo implements IAssetEventRepo {
    private items: AssetEventRecord[] = []
    private seq = 1

    async append(event: AssetEventInput): Promise<AssetEventRecord> {
        const record: AssetEventRecord = {
            id: `event-${this.seq++}`,
            createdAt: new Date(),
            payload: event.payload ?? {},
            ...event
        }
        this.items.push(record)
        return record
    }

    async listByAsset(assetId: string, page: number, limit: number): Promise<AssetEventPage> {
        const filtered = this.items.filter(item => item.assetId === assetId)
        const start = (page - 1) * limit
        return {
            items: filtered.slice(start, start + limit),
            page,
            limit
        }
    }

    getAll(): AssetEventRecord[] {
        return this.items
    }
}

class FakeMaintenanceRepo implements IMaintenanceRepo {
    async open(): Promise<MaintenanceTicketRecord> {
        throw new Error('not used')
    }

    async updateStatus(): Promise<MaintenanceTicketRecord | null> {
        return null
    }

    async list(): Promise<{ items: MaintenanceTicketRecord[]; total: number; page: number; limit: number }> {
        return { items: [], total: 0, page: 1, limit: 50 }
    }

    async getById(): Promise<MaintenanceTicketRecord | null> {
        return null
    }
}

describe('AssetService', () => {
    const ctx = { userId: 'user-1', correlationId: 'corr-1' }
    let assets: FakeAssetRepo
    let assignments: FakeAssignmentRepo
    let events: FakeEventRepo
    let maintenance: FakeMaintenanceRepo
    let service: AssetService

    beforeEach(() => {
        assets = new FakeAssetRepo()
        assignments = new FakeAssignmentRepo()
        events = new FakeEventRepo()
        maintenance = new FakeMaintenanceRepo()
        service = new AssetService(assets, assignments, events, maintenance)
    })

    it('creates asset and appends event', async () => {
        const created = await service.createAsset({ assetCode: 'ASSET-001', modelId: 'model-1', status: 'in_stock' }, ctx)
        expect(created.assetCode).toBe('ASSET-001')
        expect(events.getAll()[0]?.eventType).toBe('CREATED')
    })

    it('assigns and returns asset with events', async () => {
        const asset = await service.createAsset({ assetCode: 'ASSET-002', modelId: 'model-1', status: 'in_stock' }, ctx)
        const assigned = await service.assignAsset(asset.id, { assigneeType: 'person', assigneeId: 'user-2', assigneeName: 'Bob' }, ctx)
        expect(assigned.asset.status).toBe('in_use')
        expect(events.getAll().some(e => e.eventType === 'ASSIGNED')).toBe(true)

        const returned = await service.returnAsset(asset.id, 'done', ctx)
        expect(returned.asset.status).toBe('in_stock')
        expect(events.getAll().some(e => e.eventType === 'UNASSIGNED')).toBe(true)
    })

    it('previews and commits import rows', async () => {
        const rows: AssetImportRow[] = [
            { assetCode: 'ASSET-10', modelId: 'model-1' },
            { assetCode: 'ASSET-11', modelId: 'model-1' }
        ]

        const preview = await service.bulkImportPreview(rows)
        expect(preview.validCount).toBe(2)

        const result = await service.bulkImportCommit(rows, ctx)
        expect(result.created).toBe(2)
        expect(events.getAll().some(e => e.eventType === 'IMPORTED')).toBe(true)
    })
})
