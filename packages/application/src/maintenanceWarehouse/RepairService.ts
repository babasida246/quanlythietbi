import { AppError, assertStatusTransition, assertStockAvailable } from '@qltb/domain'
import type {
    IAssetRepo,
    ICiRepo,
    IOpsEventRepo,
    IRepairOrderRepo,
    IRepairPartRepo,
    IStockDocumentRepo,
    IMovementRepo,
    IStockRepo,
    IWarehouseUnitOfWork,
    RepairOrderCreateInput,
    RepairOrderDetail,
    RepairOrderFilters,
    RepairOrderPage,
    RepairOrderRecord,
    RepairOrderSummary,
    RepairOrderSummaryFilters,
    RepairOrderUpdatePatch,
    RepairOrderPartInput,
    RepairOrderPartRecord,
    StockDocumentLineInput
} from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'
import type { GraphProvider } from '../cmdb/RelationshipService.js'

function generateStockDocCode(): string {
    const year = new Date().getFullYear()
    const random = Math.floor(100000 + Math.random() * 900000)
    return `SD-${year}-${random}`
}

export class RepairService {
    constructor(
        private repairs: IRepairOrderRepo,
        private repairParts: IRepairPartRepo,
        private documents: IStockDocumentRepo,
        private stock: IStockRepo,
        private movements: IMovementRepo,
        private unitOfWork: IWarehouseUnitOfWork,
        private opsEvents?: IOpsEventRepo,
        private ciRepo?: ICiRepo,
        private graphProvider?: GraphProvider,
        private assets?: IAssetRepo
    ) { }

    async createRepairOrder(input: RepairOrderCreateInput, ctx: MaintenanceWarehouseContext): Promise<RepairOrderRecord> {
        const resolvedCiId = await this.resolveCiId(input.assetId ?? null, input.ciId ?? null)
        const record = await this.repairs.create({
            ...input,
            ciId: resolvedCiId ?? input.ciId ?? null,
            createdBy: ctx.userId,
            correlationId: ctx.correlationId
        })
        await this.appendEvent(record.id, 'REPAIR_CREATED', { code: record.code }, ctx)

        // Transition linked asset to in_repair (TC4.1 business requirement)
        if (input.assetId && this.assets) {
            const asset = await this.assets.getById(input.assetId)
            if (asset && asset.status !== 'in_repair') {
                assertStatusTransition(asset.status ?? 'in_stock', 'in_repair')
                await this.assets.update(input.assetId, { status: 'in_repair' })
            }
        }

        return record
    }

    async updateRepairOrder(id: string, patch: RepairOrderUpdatePatch, ctx: MaintenanceWarehouseContext): Promise<RepairOrderRecord> {
        const updated = await this.repairs.update(id, { ...patch, correlationId: ctx.correlationId })
        if (!updated) {
            throw AppError.notFound('Repair order not found')
        }
        const payload: Record<string, unknown> = { ...patch }
        await this.appendEvent(updated.id, 'REPAIR_UPDATED', payload, ctx)
        return updated
    }

    async changeStatus(id: string, status: RepairOrderRecord['status'], ctx: MaintenanceWarehouseContext): Promise<RepairOrderRecord> {
        const patch: RepairOrderUpdatePatch = {
            status,
            closedAt: status === 'closed' ? new Date().toISOString() : undefined,
            correlationId: ctx.correlationId
        }
        const updated = await this.repairs.update(id, patch)
        if (!updated) {
            throw AppError.notFound('Repair order not found')
        }
        await this.appendEvent(updated.id, 'REPAIR_STATUS_CHANGED', { status }, ctx)

        // On WO close/repaired: transition linked asset back from in_repair → in_use (TC4.3 business requirement)
        if ((status === 'closed' || status === 'repaired') && updated.assetId && this.assets) {
            const asset = await this.assets.getById(updated.assetId)
            if (asset?.status === 'in_repair') {
                await this.assets.update(updated.assetId, { status: 'in_use' })
            }
        }

        if (status === 'closed' && updated.ciId && this.graphProvider) {
            const impact = await this.graphProvider.getGraph(updated.ciId, 2, 'downstream')
            await this.appendEvent(updated.id, 'REPAIR_IMPACT_SNAPSHOT', {
                ciId: updated.ciId,
                impact
            }, ctx)
        }
        return updated
    }

    async getRepairDetail(id: string): Promise<RepairOrderDetail> {
        const order = await this.repairs.getById(id)
        if (!order) {
            throw AppError.notFound('Repair order not found')
        }
        const parts = await this.repairParts.listByOrder(id)
        return { order, parts }
    }

    async listRepairs(filters: RepairOrderFilters): Promise<RepairOrderPage> {
        return await this.repairs.list(filters)
    }

    async getRepairSummary(filters: RepairOrderSummaryFilters): Promise<RepairOrderSummary> {
        return await this.repairs.summary(filters)
    }

    async addRepairPart(orderId: string, input: RepairOrderPartInput, ctx: MaintenanceWarehouseContext): Promise<RepairOrderDetail> {
        const order = await this.repairs.getById(orderId)
        if (!order) {
            throw AppError.notFound('Repair order not found')
        }
        if (!input.partId && !input.partName) {
            throw AppError.badRequest('Part selection or name is required')
        }
        if (input.partId && !input.warehouseId) {
            throw AppError.badRequest('Warehouse is required for stocked parts')
        }

        const result = await this.unitOfWork.withTransaction(async (tx) => {
            let stockDocumentId: string | null = input.stockDocumentId ?? null
            const unitCost = input.unitCost ?? null

            if (input.partId && input.warehouseId) {
                const line: StockDocumentLineInput = {
                    partId: input.partId,
                    qty: input.qty,
                    unitCost: unitCost ?? 0,
                    serialNo: input.serialNo ?? null,
                    note: input.note ?? null
                }

                const doc = await tx.documents.create({
                    docType: 'issue',
                    code: generateStockDocCode(),
                    warehouseId: input.warehouseId,
                    refType: 'repair_order',
                    refId: orderId,
                    createdBy: ctx.userId,
                    correlationId: ctx.correlationId
                })
                await tx.documents.replaceLines(doc.id, [line])

                const current = await tx.stock.get(input.warehouseId, input.partId)
                const onHand = current?.onHand ?? 0
                const reserved = current?.reserved ?? 0
                assertStockAvailable(onHand, reserved, input.qty)

                await tx.stock.upsert({
                    warehouseId: input.warehouseId,
                    partId: input.partId,
                    onHand: onHand - input.qty,
                    reserved
                })

                await tx.movements.addMany([{
                    warehouseId: input.warehouseId,
                    partId: input.partId,
                    movementType: 'out',
                    qty: input.qty,
                    unitCost: unitCost ?? 0,
                    refType: 'repair_order',
                    refId: orderId,
                    actorUserId: ctx.userId,
                    correlationId: ctx.correlationId
                }])

                await tx.documents.setStatus(doc.id, 'posted', ctx.userId)
                stockDocumentId = doc.id

                if (tx.opsEvents) {
                    await tx.opsEvents.append({
                        entityType: 'stock_document',
                        entityId: doc.id,
                        eventType: 'STOCK_DOC_POSTED',
                        payload: { refType: 'repair_order', refId: orderId },
                        actorUserId: ctx.userId,
                        correlationId: ctx.correlationId
                    })
                }
            }

            const part = await tx.repairParts.add(orderId, {
                ...input,
                unitCost: unitCost ?? 0,
                stockDocumentId
            })

            const parts = await tx.repairParts.listByOrder(orderId)
            const partsCost = parts.reduce((sum, item) => sum + (item.unitCost ?? 0) * item.qty, 0)
            const updated = await tx.repairs.update(orderId, {
                partsCost,
                correlationId: ctx.correlationId
            })
            return { order: updated ?? order, parts, part }
        })

        await this.appendEvent(orderId, 'REPAIR_PART_ADDED', {
            partId: result.part.id,
            partName: result.part.partName,
            qty: result.part.qty,
            stockDocumentId: result.part.stockDocumentId
        }, ctx)

        return { order: result.order, parts: result.parts }
    }

    async listEvents(orderId: string, limit = 50): Promise<Array<{ id: string; eventType: string; payload: Record<string, unknown>; createdAt: Date }>> {
        if (!this.opsEvents) return []
        const events = await this.opsEvents.listByEntity('repair_order', orderId, limit)
        return events.map(event => ({
            id: event.id,
            eventType: event.eventType,
            payload: event.payload,
            createdAt: event.createdAt
        }))
    }

    private async appendEvent(
        orderId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: MaintenanceWarehouseContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType: 'repair_order',
            entityId: orderId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }

    private async resolveCiId(assetId: string | null, currentCiId: string | null): Promise<string | null> {
        if (currentCiId) return currentCiId
        if (!assetId || !this.ciRepo) return null
        const resolved = await this.ciRepo.getByAssetId(assetId)
        return resolved?.id ?? null
    }
}
