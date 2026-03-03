import { describe, it, expect, beforeEach } from 'vitest'
import { MaintenanceService } from './MaintenanceService.js'
import type {
    AssetAssignmentInput,
    AssetAssignmentRecord,
    AssetBulkUpsertInput,
    AssetEventInput,
    AssetEventRecord,
    AssetCreateInput,
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetUpdatePatch,
    IAssetEventRepo,
    IAssetRepo,
    IAssignmentRepo,
    IMaintenanceRepo,
    MaintenanceTicketInput,
    MaintenanceTicketRecord,
    MaintenanceTicketStatusPatch
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
        if (!existing) throw new Error('Asset not found')
        const updated: AssetRecord = { ...existing, ...patch, updatedAt: new Date() }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }

    async getById(id: string): Promise<AssetRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }

    async getByAssetCode(assetCode: string): Promise<AssetRecord | null> {
        return this.items.find(item => item.assetCode === assetCode) ?? null
    }

    async delete(): Promise<boolean> {
        return true
    }

    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: 50 }
    }

    async bulkUpsert(_items: AssetBulkUpsertInput[]) {
        return { created: 0, updated: 0, items: [] }
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
        const updated: AssetAssignmentRecord = { ...active, returnedAt, note: note ?? null }
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

class FakeMaintenanceRepo implements IMaintenanceRepo {
    private items: MaintenanceTicketRecord[] = []
    private seq = 1

    async open(ticket: MaintenanceTicketInput): Promise<MaintenanceTicketRecord> {
        const record: MaintenanceTicketRecord = {
            id: `ticket-${this.seq++}`,
            assetId: ticket.assetId,
            title: ticket.title,
            severity: ticket.severity,
            status: ticket.status ?? 'open',
            openedAt: ticket.openedAt ?? new Date(),
            closedAt: null,
            diagnosis: ticket.diagnosis ?? null,
            resolution: ticket.resolution ?? null,
            createdBy: ticket.createdBy ?? null,
            correlationId: ticket.correlationId ?? null
        }
        this.items.push(record)
        return record
    }

    async updateStatus(
        ticketId: string,
        status: MaintenanceTicketRecord['status'],
        patch: MaintenanceTicketStatusPatch
    ): Promise<MaintenanceTicketRecord | null> {
        const existing = await this.getById(ticketId)
        if (!existing) return null
        const updated: MaintenanceTicketRecord = {
            ...existing,
            status,
            closedAt: patch.closedAt ?? existing.closedAt,
            diagnosis: patch.diagnosis ?? existing.diagnosis,
            resolution: patch.resolution ?? existing.resolution,
            correlationId: patch.correlationId ?? existing.correlationId
        }
        this.items = this.items.map(item => item.id === ticketId ? updated : item)
        return updated
    }

    async list(filters: { assetId?: string; status?: MaintenanceTicketRecord['status']; page?: number; limit?: number }) {
        const filtered = this.items.filter(item => {
            if (filters.assetId && item.assetId !== filters.assetId) return false
            if (filters.status && item.status !== filters.status) return false
            return true
        })
        return {
            items: filtered,
            total: filtered.length,
            page: filters.page ?? 1,
            limit: filters.limit ?? 50
        }
    }

    async getById(ticketId: string): Promise<MaintenanceTicketRecord | null> {
        return this.items.find(item => item.id === ticketId) ?? null
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

    async listByAsset(assetId: string, page: number, limit: number) {
        const filtered = this.items.filter(item => item.assetId === assetId)
        const start = (page - 1) * limit
        return { items: filtered.slice(start, start + limit), page, limit }
    }

    getAll(): AssetEventRecord[] {
        return this.items
    }
}

describe('MaintenanceService', () => {
    const ctx = { userId: 'user-1', correlationId: 'corr-2' }
    let assets: FakeAssetRepo
    let assignments: FakeAssignmentRepo
    let maintenance: FakeMaintenanceRepo
    let events: FakeEventRepo
    let service: MaintenanceService

    beforeEach(() => {
        assets = new FakeAssetRepo()
        assignments = new FakeAssignmentRepo()
        maintenance = new FakeMaintenanceRepo()
        events = new FakeEventRepo()
        service = new MaintenanceService(assets, assignments, maintenance, events)
    })

    it('opens ticket and sets asset to in_repair', async () => {
        const asset = await assets.create({ assetCode: 'ASSET-100', modelId: 'model-1', status: 'in_stock' })
        const ticket = await service.openTicket(asset.id, { title: 'Check', severity: 'low' }, ctx)
        expect(ticket.status).toBe('open')

        const updated = await assets.getById(asset.id)
        expect(updated?.status).toBe('in_repair')
        expect(events.getAll().some(e => e.eventType === 'MAINT_OPEN')).toBe(true)
    })

    it('closes ticket and restores asset status based on assignment', async () => {
        const asset = await assets.create({ assetCode: 'ASSET-101', modelId: 'model-1', status: 'in_stock' })
        await assignments.assign(asset.id, { assigneeType: 'person', assigneeId: 'user-9', assigneeName: 'Dana' })
        const ticket = await service.openTicket(asset.id, { title: 'Fix', severity: 'medium' }, ctx)

        const updatedTicket = await service.updateTicketStatus(ticket.id, 'closed', {}, ctx)
        expect(updatedTicket.status).toBe('closed')

        const updated = await assets.getById(asset.id)
        expect(updated?.status).toBe('in_use')
        expect(events.getAll().some(e => e.eventType === 'MAINT_CLOSE')).toBe(true)
    })
})
