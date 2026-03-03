import { describe, it, expect } from 'vitest'
import { WarehouseCatalogService } from './WarehouseCatalogService.js'
import type {
    IOpsEventRepo,
    ISparePartRepo,
    IWarehouseRepo,
    SparePartCreateInput,
    SparePartPage,
    SparePartRecord,
    WarehouseCreateInput,
    WarehouseRecord
} from '@qltb/contracts'

describe('WarehouseCatalogService', () => {
    it('creates warehouse and emits ops event', async () => {
        const events: Array<{ entityType: string; eventType: string }> = []

        const warehouseRepo: IWarehouseRepo = {
            list: async () => [],
            getById: async () => null,
            create: async (input: WarehouseCreateInput) => ({
                id: 'wh-1',
                code: input.code,
                name: input.name,
                locationId: input.locationId ?? null,
                createdAt: new Date()
            }),
            update: async () => null,
            delete: async () => true
        }

        const sparePartRepo: ISparePartRepo = {
            list: async (): Promise<SparePartPage> => ({ items: [], total: 0, page: 1, limit: 20 }),
            getById: async () => null,
            create: async (input: SparePartCreateInput): Promise<SparePartRecord> => ({
                id: 'part-1',
                partCode: input.partCode,
                name: input.name,
                spec: input.spec ?? {},
                minLevel: input.minLevel ?? 0,
                createdAt: new Date()
            }),
            update: async () => null,
            delete: async () => true
        }

        const opsEvents: IOpsEventRepo = {
            append: async (event) => {
                events.push({ entityType: event.entityType, eventType: event.eventType })
                return {
                    id: 'evt-1',
                    entityType: event.entityType,
                    entityId: event.entityId,
                    eventType: event.eventType,
                    payload: event.payload,
                    actorUserId: event.actorUserId ?? null,
                    correlationId: event.correlationId ?? null,
                    createdAt: new Date()
                }
            },
            listByEntity: async () => []
        }

        const service = new WarehouseCatalogService(warehouseRepo, sparePartRepo, opsEvents)
        const created = await service.createWarehouse({ code: 'WH-01', name: 'Main' }, {
            userId: 'user-1',
            correlationId: 'corr-1'
        })

        expect(created.code).toBe('WH-01')
        expect(events[0]?.eventType).toBe('WAREHOUSE_CREATED')
    })
})
