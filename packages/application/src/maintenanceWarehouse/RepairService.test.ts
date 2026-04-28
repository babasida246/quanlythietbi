import { describe, it, expect, beforeEach } from 'vitest'
import { RepairService } from './RepairService.js'
import type {
    IOpsEventRepo,
    IRepairOrderRepo,
    IRepairPartRepo,
    ICiRepo,
    IStockDocumentRepo,
    IMovementRepo,
    IStockRepo,
    IWarehouseUnitOfWork,
    CiRecord,
    OpsEventInput,
    OpsEventRecord,
    RepairOrderCreateInput,
    RepairOrderRecord,
    RepairOrderUpdatePatch,
    RepairOrderPartInput,
    RepairOrderPartRecord,
    RelationshipRecord,
    StockDocumentLineRecord,
    StockDocumentRecord,
    StockRecord,
    StockUpsertInput,
    StockViewFilters,
    StockViewPage,
    StockMovementFilters,
    StockMovementInput,
    StockMovementPage,
    StockMovementRecord
} from '@qltb/contracts'

class FakeOpsEventRepo implements IOpsEventRepo {
    events: Array<{ entityId: string; eventType: string }> = []

    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        this.events.push({ entityId: event.entityId, eventType: event.eventType })
        return { id: `evt-${this.events.length}`, createdAt: new Date(), ...event }
    }

    async listByEntity(): Promise<OpsEventRecord[]> {
        return []
    }
}

class FakeRepairOrderRepo implements IRepairOrderRepo {
    private items: RepairOrderRecord[] = []
    private seq = 1

    async create(input: RepairOrderCreateInput): Promise<RepairOrderRecord> {
        const now = new Date()
        const record: RepairOrderRecord = {
            id: `repair-${this.seq++}`,
            assetId: input.assetId,
            ciId: input.ciId ?? null,
            code: `RO-2025-00000${this.seq}`,
            title: input.title,
            description: input.description ?? null,
            severity: input.severity,
            status: 'open',
            openedAt: now,
            closedAt: null,
            diagnosis: null,
            resolution: null,
            repairType: input.repairType,
            technicianName: input.technicianName ?? null,
            vendorId: input.vendorId ?? null,
            laborCost: input.laborCost ?? null,
            partsCost: 0,
            downtimeMinutes: input.downtimeMinutes ?? null,
            createdBy: input.createdBy ?? null,
            correlationId: input.correlationId ?? null,
            createdAt: now,
            updatedAt: now
        }
        this.items.push(record)
        return record
    }

    async update(id: string, patch: RepairOrderUpdatePatch): Promise<RepairOrderRecord | null> {
        const existing = await this.getById(id)
        if (!existing) return null
        const updated: RepairOrderRecord = {
            ...existing,
            ...patch,
            updatedAt: new Date()
        }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }

    async getById(id: string): Promise<RepairOrderRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }

    async list(): Promise<{ items: RepairOrderRecord[]; total: number; page: number; limit: number }> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: this.items.length }
    }

    async summary() {
        return {
            total: this.items.length,
            activeCount: this.items.filter(item => !['closed', 'canceled'].includes(item.status)).length,
            closedCount: this.items.filter(item => item.status === 'closed').length,
            canceledCount: this.items.filter(item => item.status === 'canceled').length,
            totalLaborCost: this.items.reduce((sum, item) => sum + (item.laborCost ?? 0), 0),
            totalPartsCost: this.items.reduce((sum, item) => sum + (item.partsCost ?? 0), 0),
            totalCost: this.items.reduce((sum, item) => sum + (item.laborCost ?? 0) + (item.partsCost ?? 0), 0),
            totalDowntimeMinutes: this.items.reduce((sum, item) => sum + (item.downtimeMinutes ?? 0), 0),
            avgDowntimeMinutes: null,
            avgResolutionHours: null,
            byStatus: {
                open: this.items.filter(item => item.status === 'open').length,
                diagnosing: this.items.filter(item => item.status === 'diagnosing').length,
                waiting_parts: this.items.filter(item => item.status === 'waiting_parts').length,
                repaired: this.items.filter(item => item.status === 'repaired').length,
                closed: this.items.filter(item => item.status === 'closed').length,
                canceled: this.items.filter(item => item.status === 'canceled').length
            },
            bySeverity: {
                low: this.items.filter(item => item.severity === 'low').length,
                medium: this.items.filter(item => item.severity === 'medium').length,
                high: this.items.filter(item => item.severity === 'high').length,
                critical: this.items.filter(item => item.severity === 'critical').length
            },
            byType: {
                internal: this.items.filter(item => item.repairType === 'internal').length,
                vendor: this.items.filter(item => item.repairType === 'vendor').length
            }
        }
    }
}

class FakeRepairPartRepo implements IRepairPartRepo {
    private items: RepairOrderPartRecord[] = []
    private seq = 1

    async add(orderId: string, input: RepairOrderPartInput): Promise<RepairOrderPartRecord> {
        const record: RepairOrderPartRecord = {
            id: `part-${this.seq++}`,
            repairOrderId: orderId,
            modelId: input.modelId ?? null,
            partName: input.partName ?? null,
            warehouseId: input.warehouseId ?? null,
            action: input.action,
            qty: input.qty,
            unitCost: input.unitCost ?? null,
            serialNo: input.serialNo ?? null,
            note: input.note ?? null,
            stockDocumentId: input.stockDocumentId ?? null,
            createdAt: new Date()
        }
        this.items.push(record)
        return record
    }

    async listByOrder(orderId: string): Promise<RepairOrderPartRecord[]> {
        return this.items.filter(item => item.repairOrderId === orderId)
    }
}

class FakeStockDocumentRepo implements IStockDocumentRepo {
    private seq = 1

    async create(): Promise<StockDocumentRecord> {
        const now = new Date()
        return {
            id: `doc-${this.seq++}`,
            docType: 'issue',
            code: `SD-${this.seq}`,
            status: 'draft',
            docDate: now.toISOString().slice(0, 10),
            createdAt: now,
            updatedAt: now
        }
    }

    async update(): Promise<StockDocumentRecord | null> {
        return null
    }

    async getById(): Promise<StockDocumentRecord | null> {
        return null
    }

    async list(): Promise<{ items: StockDocumentRecord[]; total: number; page: number; limit: number }> {
        return { items: [], total: 0, page: 1, limit: 20 }
    }

    async listLines(): Promise<StockDocumentLineRecord[]> {
        return []
    }

    async replaceLines(): Promise<StockDocumentLineRecord[]> {
        return []
    }

    async setStatus(): Promise<StockDocumentRecord | null> {
        return null
    }

    async findByRefRequest(): Promise<StockDocumentRecord | null> {
        return null
    }

    async setAssetOnLine(): Promise<void> {
        return
    }
}

class FakeStockRepo implements IStockRepo {
    private records = new Map<string, StockRecord>()

    async get(warehouseId: string, modelId: string): Promise<StockRecord | null> {
        return this.records.get(`${warehouseId}:${modelId}`) ?? null
    }

    async getForUpdate(warehouseId: string, modelId: string): Promise<StockRecord | null> {
        return this.get(warehouseId, modelId)
    }

    async upsert(input: StockUpsertInput): Promise<StockRecord> {
        const record: StockRecord = {
            id: `${input.warehouseId}:${input.modelId}`,
            warehouseId: input.warehouseId,
            modelId: input.modelId,
            onHand: input.onHand,
            reserved: input.reserved,
            updatedAt: new Date()
        }
        this.records.set(`${input.warehouseId}:${input.modelId}`, record)
        return record
    }

    async adjustStock(warehouseId: string, modelId: string, delta: number): Promise<StockRecord> {
        const existing = await this.get(warehouseId, modelId)
        return this.upsert({ warehouseId, modelId, onHand: (existing?.onHand ?? 0) + delta, reserved: existing?.reserved ?? 0 })
    }

    async reserve(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const existing = await this.get(warehouseId, modelId)
        return this.upsert({ warehouseId, modelId, onHand: existing?.onHand ?? 0, reserved: (existing?.reserved ?? 0) + qty })
    }

    async release(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const existing = await this.get(warehouseId, modelId)
        return this.upsert({ warehouseId, modelId, onHand: existing?.onHand ?? 0, reserved: (existing?.reserved ?? 0) - qty })
    }

    async commitReserved(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const existing = await this.get(warehouseId, modelId)
        return this.upsert({ warehouseId, modelId, onHand: (existing?.onHand ?? 0) - qty, reserved: (existing?.reserved ?? 0) - qty })
    }

    async listView(_filters: StockViewFilters): Promise<StockViewPage> {
        return { items: [], total: 0, page: 1, limit: 20 }
    }
}

class FakeMovementRepo implements IMovementRepo {
    movements: StockMovementRecord[] = []

    async addMany(inputs: StockMovementInput[]): Promise<StockMovementRecord[]> {
        const created = inputs.map((input, index) => ({
            id: `mv-${index + 1}`,
            warehouseId: input.warehouseId,
            modelId: input.modelId,
            movementType: input.movementType,
            qty: input.qty,
            unitCost: input.unitCost ?? null,
            refType: input.refType ?? null,
            refId: input.refId ?? null,
            actorUserId: input.actorUserId ?? null,
            correlationId: input.correlationId ?? null,
            createdAt: new Date()
        }))
        this.movements.push(...created)
        return created
    }

    async list(_filters: StockMovementFilters): Promise<StockMovementPage> {
        return { items: [], total: 0, page: 1, limit: 20 }
    }
}

class FakeCiRepo implements ICiRepo {
    constructor(private cis: CiRecord[]) { }
    async create(): Promise<CiRecord> { throw new Error('not implemented') }
    async update(): Promise<CiRecord | null> { return null }
    async getById(id: string): Promise<CiRecord | null> {
        return this.cis.find(ci => ci.id === id) ?? null
    }
    async list(): Promise<{ items: CiRecord[]; total: number; page: number; limit: number }> {
        return { items: this.cis, total: this.cis.length, page: 1, limit: 20 }
    }
    async getByAssetId(assetId: string): Promise<CiRecord | null> {
        return this.cis.find(ci => ci.assetId === assetId) ?? null
    }
}

describe('RepairService', () => {
    let repairs: FakeRepairOrderRepo
    let parts: FakeRepairPartRepo
    let documents: FakeStockDocumentRepo
    let stock: FakeStockRepo
    let movements: FakeMovementRepo
    let opsEvents: FakeOpsEventRepo
    let unitOfWork: IWarehouseUnitOfWork
    let service: RepairService

    beforeEach(async () => {
        repairs = new FakeRepairOrderRepo()
        parts = new FakeRepairPartRepo()
        documents = new FakeStockDocumentRepo()
        stock = new FakeStockRepo()
        movements = new FakeMovementRepo()
        opsEvents = new FakeOpsEventRepo()

        unitOfWork = {
            withTransaction: async (handler) => {
                return await handler({
                    documents,
                    modelStock: stock,
                    modelMovements: movements,
                    repairs,
                    repairParts: parts,
                    assets: null as never,
                    opsEvents
                })
            }
        }

        service = new RepairService(repairs, parts, documents, unitOfWork, opsEvents)
        await stock.upsert({ warehouseId: 'wh-1', modelId: 'part-1', onHand: 5, reserved: 0 })
    })

    it('creates repair orders and appends events', async () => {
        const order = await service.createRepairOrder({
            assetId: 'asset-1',
            title: 'Fix',
            severity: 'low',
            repairType: 'internal'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(order.code).toMatch(/^RO-/)
        expect(opsEvents.events.some(evt => evt.eventType === 'REPAIR_CREATED')).toBe(true)
    })

    it('adds repair parts and updates parts cost', async () => {
        const order = await service.createRepairOrder({
            assetId: 'asset-1',
            title: 'Fix',
            severity: 'low',
            repairType: 'internal'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        const detail = await service.addRepairPart(order.id, {
            modelId: 'part-1',
            warehouseId: 'wh-1',
            action: 'replace',
            qty: 2,
            unitCost: 10
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(detail.order.partsCost).toBe(20)
        const current = await stock.get('wh-1', 'part-1')
        expect(current?.onHand).toBe(3)
    })

    it('auto-resolves ciId on create', async () => {
        const ciRepo = new FakeCiRepo([{
            id: 'ci-1',
            typeId: 'type-1',
            name: 'App',
            ciCode: 'APP-1',
            status: 'active',
            environment: 'prod',
            assetId: 'asset-1',
            locationId: null,
            ownerTeam: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date()
        }])
        const serviceWithCi = new RepairService(repairs, parts, documents, unitOfWork, opsEvents, ciRepo)

        const order = await serviceWithCi.createRepairOrder({
            assetId: 'asset-1',
            title: 'Fix',
            severity: 'low',
            repairType: 'internal'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        expect(order.ciId).toBe('ci-1')
    })

    it('captures impact snapshot on close', async () => {
        const graphProvider = {
            getGraph: async () => ({ nodes: [] as CiRecord[], edges: [] as RelationshipRecord[] })
        } as { getGraph: (ciId: string, depth: number, direction: 'upstream' | 'downstream' | 'both') => Promise<{ nodes: CiRecord[]; edges: RelationshipRecord[] }> }
        const serviceWithGraph = new RepairService(repairs, parts, documents, unitOfWork, opsEvents, undefined, graphProvider)

        const order = await serviceWithGraph.createRepairOrder({
            assetId: 'asset-1',
            ciId: 'ci-1',
            title: 'Fix',
            severity: 'low',
            repairType: 'internal'
        }, { userId: 'user-1', correlationId: 'corr-1' })

        await serviceWithGraph.changeStatus(order.id, 'closed', { userId: 'user-1', correlationId: 'corr-1' })
        expect(opsEvents.events.some(evt => evt.eventType === 'REPAIR_IMPACT_SNAPSHOT')).toBe(true)
    })
})
