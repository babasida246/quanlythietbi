import { describe, it, expect, beforeEach } from 'vitest'
import { ReminderService } from './ReminderService.js'
import type {
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetCreateInput,
    AssetBulkUpsertInput,
    AssetUpdatePatch,
    IAssetRepo,
    IReminderRepo,
    ReminderPage,
    ReminderRecord,
    ReminderUpsertInput
} from '@qltb/contracts'

class FakeAssetRepo implements IAssetRepo {
    private items: AssetRecord[] = [
        { id: 'a1', assetCode: 'A1', modelId: 'm1', status: 'in_stock', warrantyEnd: new Date(), createdAt: new Date(), updatedAt: new Date() }
    ]
    async create(_asset: AssetCreateInput): Promise<AssetRecord> { throw new Error('not used') }
    async update(_id: string, _patch: AssetUpdatePatch): Promise<AssetRecord> { throw new Error('not used') }
    async getById() { return null }
    async getByAssetCode(_assetCode: string) { return null }
    async delete() { return false }
    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: this.items.length }
    }
    async bulkUpsert(_items: AssetBulkUpsertInput[]) { return { created: 0, updated: 0, items: [] } }
}

class FakeReminderRepo implements IReminderRepo {
    private items: ReminderRecord[] = []
    private seq = 1
    async upsert(input: ReminderUpsertInput): Promise<ReminderRecord> {
        const record: ReminderRecord = {
            id: `r-${this.seq++}`,
            reminderType: input.reminderType,
            assetId: input.assetId,
            dueAt: input.dueAt,
            status: input.status ?? 'pending',
            channel: input.channel ?? 'ui',
            createdAt: new Date(),
            sentAt: null,
            correlationId: input.correlationId ?? null
        }
        this.items.push(record)
        return record
    }
    async list(): Promise<ReminderPage> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: 50 }
    }
    async listPending(limit: number): Promise<ReminderRecord[]> {
        return this.items.filter(item => item.status === 'pending').slice(0, limit)
    }
    async markSent(id: string): Promise<ReminderRecord | null> {
        const existing = this.items.find(item => item.id === id)
        if (!existing) return null
        const updated = { ...existing, status: 'sent', sentAt: new Date() }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }
}

describe('ReminderService', () => {
    let service: ReminderService
    const ctx = { userId: 'u1', correlationId: 'c1' }

    beforeEach(() => {
        service = new ReminderService(new FakeAssetRepo(), new FakeReminderRepo())
    })

    it('generates warranty reminders', async () => {
        const result = await service.runWarrantyReminders([30], ctx)
        expect(result.created).toBe(1)
    })
})
