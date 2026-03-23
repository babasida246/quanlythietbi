import { AppError, assertStockDocLines, assertTransferTarget } from '@qltb/domain'
import type {
    IOpsEventRepo,
    IStockDocumentRepo,
    IStockRepo,
    IMovementRepo,
    IWarehouseUnitOfWork,
    StockDocumentCreateInput,
    StockDocumentDetail,
    StockDocumentLineInput,
    StockDocumentLineRecord,
    StockDocumentRecord,
    StockDocumentUpdatePatch,
    StockMovementInput,
    StockMovementPage,
    StockMovementFilters
} from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

type StockChange = {
    warehouseId: string
    partId: string
    delta: number
    movementType: StockMovementInput['movementType']
    unitCost?: number | null
    refType?: string | null
    refId?: string | null
}

export class StockDocumentService {
    constructor(
        private documents: IStockDocumentRepo,
        private stock: IStockRepo,
        private movements: IMovementRepo,
        private unitOfWork: IWarehouseUnitOfWork,
        private opsEvents?: IOpsEventRepo
    ) { }

    async createDocument(
        input: StockDocumentCreateInput,
        lines: StockDocumentLineInput[],
        ctx: MaintenanceWarehouseContext
    ): Promise<StockDocumentDetail> {
        const document = await this.documents.create({
            ...input,
            createdBy: ctx.userId,
            correlationId: ctx.correlationId
        })
        const savedLines = await this.documents.replaceLines(document.id, lines)
        await this.appendEvent(document.id, 'STOCK_DOC_CREATED', { docType: document.docType }, ctx)
        return { document, lines: savedLines }
    }

    async updateDocument(
        id: string,
        patch: StockDocumentUpdatePatch,
        lines: StockDocumentLineInput[],
        ctx: MaintenanceWarehouseContext
    ): Promise<StockDocumentDetail> {
        const existing = await this.documents.getById(id)
        if (!existing) throw AppError.notFound('Stock document not found')
        if (existing.status !== 'draft') {
            throw AppError.badRequest('Only draft documents can be updated')
        }
        const updated = await this.documents.update(id, { ...patch, correlationId: ctx.correlationId })
        if (!updated) throw AppError.notFound('Stock document not found')
        const savedLines = await this.documents.replaceLines(id, lines)
        const payload: Record<string, unknown> = { ...patch }
        await this.appendEvent(updated.id, 'STOCK_DOC_UPDATED', payload, ctx)
        return { document: updated, lines: savedLines }
    }

    async getDocument(id: string): Promise<StockDocumentDetail> {
        const document = await this.documents.getById(id)
        if (!document) throw AppError.notFound('Stock document not found')
        const lines = await this.documents.listLines(id)
        return { document, lines }
    }

    async listDocuments(filters: {
        docType?: StockDocumentRecord['docType']
        status?: StockDocumentRecord['status']
        from?: string
        to?: string
        page?: number
        limit?: number
    }): Promise<{ items: StockDocumentRecord[]; total: number; page: number; limit: number }> {
        return await this.documents.list(filters)
    }

    async submitDocument(id: string, ctx: MaintenanceWarehouseContext): Promise<StockDocumentRecord> {
        const document = await this.documents.getById(id)
        if (!document) throw AppError.notFound('Stock document not found')
        if (document.status !== 'draft') {
            throw AppError.badRequest('Only draft documents can be submitted')
        }
        const lines = await this.documents.listLines(id)
        assertStockDocLines(lines)

        const submitted = await this.documents.setStatus(id, 'submitted', document.approvedBy ?? null)
        if (!submitted) throw AppError.notFound('Stock document not found')
        await this.appendEvent(submitted.id, 'STOCK_DOC_SUBMITTED', { docType: submitted.docType }, ctx)
        return submitted
    }

    async approveDocument(id: string, ctx: MaintenanceWarehouseContext): Promise<StockDocumentRecord> {
        const document = await this.documents.getById(id)
        if (!document) throw AppError.notFound('Stock document not found')
        if (document.status !== 'submitted') {
            throw AppError.badRequest('Only submitted documents can be approved')
        }
        if (document.createdBy && document.createdBy === ctx.userId) {
            throw AppError.forbidden('Document creator cannot approve the same document')
        }
        const lines = await this.documents.listLines(id)
        assertStockDocLines(lines)

        const approved = await this.documents.setStatus(id, 'approved', ctx.userId)
        if (!approved) throw AppError.notFound('Stock document not found')
        await this.appendEvent(approved.id, 'STOCK_DOC_APPROVED', { docType: approved.docType }, ctx)
        return approved
    }

    async postDocument(id: string, ctx: MaintenanceWarehouseContext, idempotencyKey?: string): Promise<StockDocumentRecord> {
        const document = await this.documents.getById(id)
        if (!document) throw AppError.notFound('Stock document not found')

        // Idempotency check: if already posted with same key, return existing
        if (document.status === 'posted' && idempotencyKey && document.idempotencyKey === idempotencyKey) {
            return document
        }

        if (document.status !== 'approved') {
            throw AppError.badRequest('Only approved documents can be posted')
        }
        if (!document.approvedBy) {
            throw AppError.badRequest('Approved document missing approver')
        }
        if (document.createdBy && document.createdBy === ctx.userId) {
            throw AppError.forbidden('Document creator cannot post the same document')
        }
        if (document.approvedBy === ctx.userId) {
            throw AppError.forbidden('Approver cannot post the same document')
        }

        const lines = await this.documents.listLines(id)
        assertStockDocLines(lines)

        const sparepartLines = lines.filter(l => (l.lineType ?? 'spare_part') === 'spare_part')
        const assetLines = lines.filter(l => l.lineType === 'asset')
        const changes = this.buildChangeDescriptors(document, sparepartLines)

        const posted = await this.unitOfWork.withTransaction(async (tx) => {
            // ── Spare-part stock adjustments ──────────────────────────────────
            for (const change of changes) {
                await tx.stock.adjustStock(change.warehouseId, change.partId, change.delta)
            }

            if (changes.length > 0) {
                await tx.movements.addMany(changes.map(change => ({
                    warehouseId: change.warehouseId,
                    partId: change.partId,
                    movementType: change.movementType,
                    qty: Math.abs(change.delta),
                    unitCost: change.unitCost ?? null,
                    refType: change.refType ?? document.refType ?? 'stock_document',
                    refId: change.refId ?? document.id,
                    actorUserId: ctx.userId,
                    correlationId: ctx.correlationId
                })))
            }

            // ── Receipt: auto-create assets from asset lines ──────────────────
            if (document.docType === 'receipt') {
                for (const line of assetLines) {
                    if (!line.assetModelId) {
                        throw AppError.badRequest(`Asset line ${line.id} is missing assetModelId`)
                    }
                    const assetCode = line.assetCode ?? await nextAssetCode(tx.documents)
                    const asset = await tx.assets.create({
                        assetCode,
                        modelId: line.assetModelId,
                        serialNo: line.serialNo ?? null,
                        warehouseId: document.warehouseId ?? null,
                        status: 'in_stock',
                        purchaseDate: document.docDate ? new Date(document.docDate) : null,
                        unitCost: line.unitCost ?? null,
                        notes: line.note ?? null,
                        sourceDocLineId: line.id
                    })
                    await tx.documents.setAssetOnLine(line.id, asset.id)
                }
            }

            // ── Issue: deploy existing assets to a location ───────────────────
            if (document.docType === 'issue') {
                for (const line of assetLines) {
                    if (!line.assetId) {
                        throw AppError.badRequest(`Issue asset line ${line.id} is missing assetId`)
                    }
                    const asset = await tx.assets.getById(line.assetId)
                    if (!asset) throw AppError.notFound(`Asset ${line.assetId} not found`)
                    if (asset.status !== 'in_stock') {
                        throw AppError.badRequest(`Asset ${asset.assetCode} is not in stock`)
                    }
                    if (asset.warehouseId !== document.warehouseId) {
                        throw AppError.badRequest(`Asset ${asset.assetCode} is not in the document warehouse`)
                    }

                    await tx.assets.update(asset.id, {
                        status: 'in_use',
                        locationId: document.locationId ?? null,
                        warehouseId: null
                    })
                }
            }

            const updated = await tx.documents.setStatus(document.id, 'posted', document.approvedBy ?? null, idempotencyKey ?? null)
            if (!updated) throw AppError.notFound('Stock document not found')
            return updated
        })

        await this.appendEvent(posted.id, 'STOCK_DOC_POSTED', { docType: posted.docType }, ctx)
        return posted
    }

    async cancelDocument(id: string, ctx: MaintenanceWarehouseContext): Promise<StockDocumentRecord> {
        const document = await this.documents.getById(id)
        if (!document) throw AppError.notFound('Stock document not found')
        if (document.status !== 'draft' && document.status !== 'submitted' && document.status !== 'approved') {
            throw AppError.badRequest('Only unposted documents can be canceled')
        }
        const canceled = await this.documents.setStatus(id, 'canceled', document.approvedBy ?? null)
        if (!canceled) throw AppError.notFound('Stock document not found')
        await this.appendEvent(canceled.id, 'STOCK_DOC_CANCELED', { previousStatus: document.status }, ctx)
        return canceled
    }

    async listMovements(filters: StockMovementFilters): Promise<StockMovementPage> {
        return await this.movements.list(filters)
    }

    /**
     * Build stock change descriptors for spare_part lines only.
     * Asset lines are processed separately in postDocument().
     */
    private buildChangeDescriptors(
        document: StockDocumentRecord,
        lines: StockDocumentLineRecord[]
    ): StockChange[] {
        const changes: StockChange[] = []
        const warehouseId = document.warehouseId ?? undefined
        if ((document.docType === 'receipt' || document.docType === 'issue' || document.docType === 'adjust' || document.docType === 'transfer') && !warehouseId) {
            throw AppError.badRequest('Warehouse is required for this document')
        }

        for (const line of lines) {
            if (!line.partId) continue

            if (document.docType === 'receipt') {
                changes.push({
                    warehouseId: warehouseId as string,
                    partId: line.partId,
                    delta: line.qty,
                    movementType: 'in',
                    unitCost: line.unitCost ?? null,
                    refId: document.id
                })
            } else if (document.docType === 'issue') {
                changes.push({
                    warehouseId: warehouseId as string,
                    partId: line.partId,
                    delta: -line.qty,
                    movementType: 'out',
                    unitCost: line.unitCost ?? null,
                    refId: document.id
                })
            } else if (document.docType === 'adjust') {
                const direction = line.adjustDirection ?? 'plus'
                const delta = direction === 'minus' ? -line.qty : line.qty
                changes.push({
                    warehouseId: warehouseId as string,
                    partId: line.partId,
                    delta,
                    movementType: delta < 0 ? 'adjust_out' : 'adjust_in',
                    unitCost: line.unitCost ?? null,
                    refId: document.id
                })
            } else if (document.docType === 'transfer') {
                const targetWarehouseId = document.targetWarehouseId
                assertTransferTarget(targetWarehouseId)
                changes.push({
                    warehouseId: warehouseId as string,
                    partId: line.partId,
                    delta: -line.qty,
                    movementType: 'transfer_out',
                    unitCost: line.unitCost ?? null,
                    refId: document.id
                })
                changes.push({
                    warehouseId: targetWarehouseId as string,
                    partId: line.partId,
                    delta: line.qty,
                    movementType: 'transfer_in',
                    unitCost: line.unitCost ?? null,
                    refId: document.id
                })
            }
        }

        return changes
    }

    private async appendEvent(
        entityId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: MaintenanceWarehouseContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType: 'stock_document',
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}

/**
 * Generate the next asset code using the DB sequence.
 * Format: TBI-YYYY-NNNNNN (e.g. TBI-2026-000001)
 */
async function nextAssetCode(docs: IStockDocumentRepo): Promise<string> {
    // Use a raw query via the documents repo's underlying connection
    const raw = docs as unknown as { pg: { query(sql: string): Promise<{ rows: Array<{ nextval: string }> }> } }
    const result = await raw.pg.query(`SELECT nextval('asset_code_seq')`)
    const seq = parseInt(result.rows[0].nextval, 10)
    const year = new Date().getFullYear()
    return `TBI-${year}-${String(seq).padStart(6, '0')}`
}
