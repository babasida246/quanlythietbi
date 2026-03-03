import { describe, it, expect, beforeEach } from 'vitest'
import { InventoryService } from './InventoryService.js'
import type {
    AssetEventInput,
    AssetEventRecord,
    AssetBulkUpsertInput,
    AssetCreateInput,
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetUpdatePatch,
    IAssetEventRepo,
    IAssetRepo,
    IInventoryRepo,
    InventoryItemRecord,
    InventoryScanInput,
    InventorySessionInput,
    InventorySessionListFilters,
    InventorySessionPage,
    InventorySessionRecord
} from '@qltb/contracts'

class FakeAssetRepo implements IAssetRepo {
    private items: AssetRecord[] = [
        { id: 'asset-1', assetCode: 'A1', modelId: 'm1', locationId: 'loc-1', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() }
    ]
    async create(_asset: AssetCreateInput): Promise<AssetRecord> { throw new Error('not used') }
    async update(_id: string, _patch: AssetUpdatePatch): Promise<AssetRecord> { throw new Error('not used') }
    async getById(id: string) { return this.items.find(item => item.id === id) ?? null }
    async getByAssetCode(code: string) { return this.items.find(item => item.assetCode === code) ?? null }
    async delete() { return false }
    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> { return { items: [], total: 0, page: 1, limit: 10 } }
    async bulkUpsert(_items: AssetBulkUpsertInput[]) { return { created: 0, updated: 0, items: [] } }
}

class FakeInventoryRepo implements IInventoryRepo {
    private sessions: InventorySessionRecord[] = []
    private items: InventoryItemRecord[] = []
    private seq = 1
    async createSession(input: InventorySessionInput): Promise<InventorySessionRecord> {
        const record: InventorySessionRecord = {
            id: `session-${this.seq++}`,
            name: input.name,
            locationId: input.locationId ?? null,
            status: input.status ?? 'draft',
            startedAt: input.startedAt ?? null,
            closedAt: null,
            createdBy: input.createdBy ?? null,
            correlationId: input.correlationId ?? null,
            createdAt: new Date()
        }
        this.sessions.push(record)
        return record
    }
    async addScan(input: InventoryScanInput): Promise<InventoryItemRecord> {
        const record: InventoryItemRecord = { id: `item-${this.seq++}`, ...input }
        this.items.push(record)
        return record
    }
    async closeSession(sessionId: string, closedAt: Date): Promise<InventorySessionRecord | null> {
        const session = this.sessions.find(item => item.id === sessionId)
        if (!session) return null
        const updated = { ...session, status: 'closed', closedAt }
        this.sessions = this.sessions.map(item => item.id === sessionId ? updated : item)
        return updated
    }
    async getSession(sessionId: string) { return this.sessions.find(item => item.id === sessionId) ?? null }
    async listSessions(filters: InventorySessionListFilters): Promise<InventorySessionPage> {
        const filtered = this.sessions.filter(item => !filters.status || item.status === filters.status)
        return { items: filtered, total: filtered.length, page: filters.page ?? 1, limit: filters.limit ?? 20 }
    }
    async listItems(sessionId: string) { return this.items.filter(item => item.sessionId === sessionId) }
}

class FakeEventRepo implements IAssetEventRepo {
    private items: AssetEventRecord[] = []
    private seq = 1
    async append(event: AssetEventInput): Promise<AssetEventRecord> {
        const record: AssetEventRecord = { id: `event-${this.seq++}`, createdAt: new Date(), payload: event.payload ?? {}, ...event }
        this.items.push(record)
        return record
    }
    async listByAsset() { return { items: [], page: 1, limit: 20 } }
    getAll() { return this.items }
}

describe('InventoryService', () => {
    let service: InventoryService
    let events: FakeEventRepo
    const ctx = { userId: 'u1', correlationId: 'c1' }

    beforeEach(() => {
        events = new FakeEventRepo()
        service = new InventoryService(new FakeInventoryRepo(), new FakeAssetRepo(), events)
    })

    it('scans asset and records inventory event', async () => {
        const session = await service.createSession({ name: 'Cycle 1' }, ctx)
        const item = await service.scanAsset({
            sessionId: session.id,
            assetCode: 'A1',
            scannedLocationId: 'loc-1'
        }, ctx)
        expect(item.status).toBe('found')
        expect(events.getAll()[0]?.eventType).toBe('INVENTORY_FOUND')
    })
})
