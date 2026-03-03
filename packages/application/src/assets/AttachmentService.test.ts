import { describe, it, expect, beforeEach } from 'vitest'
import { AttachmentService } from './AttachmentService.js'
import type {
    AttachmentInput,
    AttachmentRecord,
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
    IAttachmentRepo
} from '@qltb/contracts'

class FakeAssetRepo implements IAssetRepo {
    private items: AssetRecord[] = [{ id: 'asset-1', assetCode: 'A1', modelId: 'm1', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() }]
    async create(_asset: AssetCreateInput): Promise<AssetRecord> { throw new Error('not used') }
    async update(_id: string, _patch: AssetUpdatePatch): Promise<AssetRecord> { throw new Error('not used') }
    async getById(id: string) { return this.items.find(item => item.id === id) ?? null }
    async getByAssetCode(_assetCode: string) { return null }
    async delete() { return false }
    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return { items: [], total: 0, page: 1, limit: 10 }
    }
    async bulkUpsert(_items: AssetBulkUpsertInput[]) { return { created: 0, updated: 0, items: [] } }
}

class FakeAttachmentRepo implements IAttachmentRepo {
    private items: AttachmentRecord[] = []
    private seq = 1
    async add(input: AttachmentInput): Promise<AttachmentRecord> {
        const record: AttachmentRecord = {
            id: `att-${this.seq++}`,
            createdAt: new Date(),
            ...input
        }
        this.items.push(record)
        return record
    }
    async listByAsset(assetId: string): Promise<AttachmentRecord[]> {
        return this.items.filter(item => item.assetId === assetId)
    }
    async getById(id: string): Promise<AttachmentRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }
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

describe('AttachmentService', () => {
    let service: AttachmentService
    let events: FakeEventRepo
    const ctx = { userId: 'u1', correlationId: 'c1' }

    beforeEach(() => {
        events = new FakeEventRepo()
        service = new AttachmentService(new FakeAssetRepo(), new FakeAttachmentRepo(), events)
    })

    it('adds attachment metadata and writes event', async () => {
        const record = await service.addAttachmentMeta('asset-1', {
            fileName: 'doc.pdf',
            mimeType: 'application/pdf',
            storageKey: 'uploads/doc.pdf',
            sizeBytes: 1000
        }, ctx)

        expect(record.version).toBe(1)
        expect(events.getAll()[0]?.eventType).toBe('ATTACHMENT_ADDED')
    })
})
