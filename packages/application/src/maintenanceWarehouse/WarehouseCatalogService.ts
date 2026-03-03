import { AppError } from '@qltb/domain'
import type {
    IWarehouseRepo,
    WarehouseCreateInput,
    WarehouseRecord,
    ISparePartRepo,
    SparePartCreateInput,
    SparePartUpdatePatch,
    SparePartPage,
    SparePartRecord,
    WarehouseUpdatePatch,
    IOpsEventRepo
} from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

export class WarehouseCatalogService {
    constructor(
        private warehouses: IWarehouseRepo,
        private parts: ISparePartRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async listWarehouses(): Promise<WarehouseRecord[]> {
        return await this.warehouses.list()
    }

    async createWarehouse(input: WarehouseCreateInput, ctx: MaintenanceWarehouseContext): Promise<WarehouseRecord> {
        if (!input.code || !input.name) {
            throw AppError.badRequest('Warehouse code and name are required')
        }
        const record = await this.warehouses.create(input)
        await this.appendEvent('warehouse', record.id, 'WAREHOUSE_CREATED', {
            code: record.code,
            name: record.name
        }, ctx)
        return record
    }

    async updateWarehouse(id: string, patch: WarehouseUpdatePatch, ctx: MaintenanceWarehouseContext): Promise<WarehouseRecord> {
        const updated = await this.warehouses.update(id, patch)
        if (!updated) {
            throw AppError.notFound('Warehouse not found')
        }
        await this.appendEvent('warehouse', updated.id, 'WAREHOUSE_UPDATED', patch, ctx)
        return updated
    }

    async deleteWarehouse(id: string, ctx: MaintenanceWarehouseContext): Promise<void> {
        const deleted = await this.warehouses.delete(id)
        if (!deleted) {
            throw AppError.notFound('Warehouse not found')
        }
        await this.appendEvent('warehouse', id, 'WAREHOUSE_DELETED', { id }, ctx)
    }

    async listParts(filters: { q?: string; page?: number; limit?: number } = {}): Promise<SparePartPage> {
        return await this.parts.list(filters)
    }

    async createPart(input: SparePartCreateInput, ctx: MaintenanceWarehouseContext): Promise<SparePartRecord> {
        if (!input.partCode || !input.name) {
            throw AppError.badRequest('Part code and name are required')
        }
        const record = await this.parts.create(input)
        await this.appendEvent('spare_part', record.id, 'SPARE_PART_CREATED', {
            partCode: record.partCode,
            name: record.name
        }, ctx)
        return record
    }

    async updatePart(id: string, patch: SparePartUpdatePatch, ctx: MaintenanceWarehouseContext): Promise<SparePartRecord> {
        const updated = await this.parts.update(id, patch)
        if (!updated) {
            throw AppError.notFound('Spare part not found')
        }
        await this.appendEvent('spare_part', updated.id, 'SPARE_PART_UPDATED', patch, ctx)
        return updated
    }

    async deletePart(id: string, ctx: MaintenanceWarehouseContext): Promise<void> {
        const deleted = await this.parts.delete(id)
        if (!deleted) {
            throw AppError.notFound('Spare part not found')
        }
        await this.appendEvent('spare_part', id, 'SPARE_PART_DELETED', { id }, ctx)
    }

    private async appendEvent(
        entityType: 'warehouse' | 'spare_part',
        entityId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: MaintenanceWarehouseContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType,
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
