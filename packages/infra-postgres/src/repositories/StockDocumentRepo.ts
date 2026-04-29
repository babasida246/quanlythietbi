import type {
    IStockDocumentRepo,
    StockDocumentCreateInput,
    StockDocumentLineInput,
    StockDocumentLineRecord,
    StockDocumentListFilters,
    StockDocumentPage,
    StockDocumentRecord,
    StockDocumentUpdatePatch
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type DocumentRow = {
    id: string
    doc_type: StockDocumentRecord['docType']
    code: string
    status: StockDocumentRecord['status']
    warehouse_id: string | null
    target_warehouse_id: string | null
    doc_date: Date
    ref_type: string | null
    ref_id: string | null
    ref_request_id: string | null
    note: string | null
    idempotency_key: string | null
    supplier: string | null
    submitter_name: string | null
    receiver_name: string | null
    department: string | null
    recipient_ou_id: string | null
    location_id: string | null
    item_group: string | null
    equipment_group_id: string | null
    created_by: string | null
    approved_by: string | null
    correlation_id: string | null
    created_at: Date
    updated_at: Date
}

type LineRow = {
    id: string
    document_id: string
    line_type: 'qty' | 'serial'
    qty: number
    unit_cost: number | string | null
    serial_no: string | null
    note: string | null
    adjust_direction: 'plus' | 'minus' | null
    spec_fields: Record<string, unknown> | null
    asset_model_id: string | null
    asset_category_id: string | null
    asset_name: string | null
    asset_code: string | null
    asset_id: string | null
}

type Update = { column: string; value: unknown }

const DOC_COLS = `id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                  ref_request_id, note, idempotency_key, supplier, submitter_name, receiver_name, department,
                  recipient_ou_id, location_id, item_group, equipment_group_id,
                  created_by, approved_by, correlation_id, created_at, updated_at`

const LINE_COLS = `id, document_id, line_type, qty, unit_cost, serial_no, note,
                   adjust_direction, spec_fields, asset_model_id, asset_category_id,
                   asset_name, asset_code, asset_id`

const mapDocDate = (value: Date): string => value.toISOString().slice(0, 10)

const mapDocument = (row: DocumentRow): StockDocumentRecord => ({
    id: row.id,
    docType: row.doc_type,
    code: row.code,
    status: row.status,
    warehouseId: row.warehouse_id,
    targetWarehouseId: row.target_warehouse_id,
    docDate: mapDocDate(row.doc_date),
    refType: row.ref_type,
    refId: row.ref_id,
    refRequestId: row.ref_request_id,
    note: row.note,
    idempotencyKey: row.idempotency_key,
    supplier: row.supplier,
    submitterName: row.submitter_name,
    receiverName: row.receiver_name,
    department: row.department,
    recipientOuId: row.recipient_ou_id,
    locationId: row.location_id,
    itemGroup: row.item_group,
    equipmentGroupId: row.equipment_group_id,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
})

const mapLine = (row: LineRow): StockDocumentLineRecord => ({
    id: row.id,
    documentId: row.document_id,
    lineType: row.line_type ?? 'qty',
    qty: row.qty,
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    serialNo: row.serial_no,
    note: row.note,
    adjustDirection: row.adjust_direction,
    specFields: row.spec_fields ?? null,
    assetModelId: row.asset_model_id,
    assetCategoryId: row.asset_category_id,
    assetName: row.asset_name,
    assetCode: row.asset_code,
    assetId: row.asset_id,
    resolvedModelName: (row.resolved_model_name as string | null) ?? null,
    resolvedModelUom: (row.resolved_model_uom as string | null) ?? null,
    resolvedCategoryName: (row.resolved_category_name as string | null) ?? null,
})

function buildUpdates(patch: StockDocumentUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.docDate !== undefined) updates.push({ column: 'doc_date', value: patch.docDate })
    if (patch.note !== undefined) updates.push({ column: 'note', value: patch.note })
    if (patch.warehouseId !== undefined) updates.push({ column: 'warehouse_id', value: patch.warehouseId })
    if (patch.targetWarehouseId !== undefined) updates.push({ column: 'target_warehouse_id', value: patch.targetWarehouseId })
    if (patch.supplier !== undefined) updates.push({ column: 'supplier', value: patch.supplier })
    if (patch.submitterName !== undefined) updates.push({ column: 'submitter_name', value: patch.submitterName })
    if (patch.receiverName !== undefined) updates.push({ column: 'receiver_name', value: patch.receiverName })
    if (patch.department !== undefined) updates.push({ column: 'department', value: patch.department })
    if (patch.recipientOuId !== undefined) updates.push({ column: 'recipient_ou_id', value: patch.recipientOuId })
    if (patch.locationId !== undefined) updates.push({ column: 'location_id', value: patch.locationId })
    if (patch.itemGroup !== undefined) updates.push({ column: 'item_group', value: patch.itemGroup })
    if (patch.equipmentGroupId !== undefined) updates.push({ column: 'equipment_group_id', value: patch.equipmentGroupId })
    if (patch.correlationId !== undefined) updates.push({ column: 'correlation_id', value: patch.correlationId })
    return updates
}

function normalizePagination(filters: StockDocumentListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class StockDocumentRepo implements IStockDocumentRepo {
    constructor(private pg: Queryable) { }

    async create(input: StockDocumentCreateInput): Promise<StockDocumentRecord> {
        const docDate = input.docDate ?? new Date().toISOString().slice(0, 10)
        const result = await this.pg.query<DocumentRow>(
            `INSERT INTO stock_documents (
                doc_type, code, status, warehouse_id, target_warehouse_id, doc_date,
                ref_type, ref_id, ref_request_id, note, supplier, submitter_name, receiver_name,
                department, recipient_ou_id, location_id, item_group, equipment_group_id, created_by, correlation_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             RETURNING ${DOC_COLS}`,
            [
                input.docType,
                input.code,
                'draft',
                input.warehouseId ?? null,
                input.targetWarehouseId ?? null,
                docDate,
                input.refType ?? null,
                input.refId ?? null,
                input.refRequestId ?? null,
                input.note ?? null,
                input.supplier ?? null,
                input.submitterName ?? null,
                input.receiverName ?? null,
                input.department ?? null,
                input.recipientOuId ?? null,
                input.locationId ?? null,
                input.itemGroup ?? null,
                input.equipmentGroupId ?? null,
                input.createdBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapDocument(result.rows[0])
    }

    async findByRefRequest(
        requestId: string,
        docType?: StockDocumentRecord['docType']
    ): Promise<StockDocumentRecord | null> {
        const params: unknown[] = [requestId]
        const typeFilter = docType ? ` AND doc_type = $2` : ''
        if (docType) params.push(docType)

        const result = await this.pg.query<DocumentRow>(
            `SELECT ${DOC_COLS}
             FROM stock_documents
             WHERE ref_request_id = $1${typeFilter}
             ORDER BY created_at DESC
             LIMIT 1`,
            params
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }

    async update(id: string, patch: StockDocumentUpdatePatch): Promise<StockDocumentRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<DocumentRow>(
            `UPDATE stock_documents SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING ${DOC_COLS}`,
            params
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }

    async getById(id: string): Promise<StockDocumentRecord | null> {
        const result = await this.pg.query<DocumentRow>(
            `SELECT ${DOC_COLS} FROM stock_documents WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }

    async list(filters: StockDocumentListFilters): Promise<StockDocumentPage> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.docType) {
            params.push(filters.docType)
            conditions.push(`doc_type = $${params.length}`)
        } else if (filters.docTypes && filters.docTypes.length > 0) {
            params.push(filters.docTypes)
            conditions.push(`doc_type = ANY($${params.length}::text[])`)
        }

        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`warehouse_id = $${params.length}`)
        }
        if (filters.itemGroup) {
            params.push(filters.itemGroup)
            conditions.push(`item_group = $${params.length}`)
        }
        if (filters.from) {
            params.push(filters.from)
            conditions.push(`doc_date >= $${params.length}::date`)
        }
        if (filters.to) {
            params.push(filters.to)
            conditions.push(`doc_date <= $${params.length}::date`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM stock_documents ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<DocumentRow>(
            `SELECT ${DOC_COLS}
             FROM stock_documents
             ${whereClause}
             ORDER BY doc_date DESC, created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )
        return { items: result.rows.map(mapDocument), total, page, limit }
    }

    async listLines(documentId: string): Promise<StockDocumentLineRecord[]> {
        const result = await this.pg.query<LineRow>(
            `SELECT sdl.${LINE_COLS.replace(/,\s*/g, ', sdl.')},
                    am.model  AS resolved_model_name,
                    am.unit   AS resolved_model_uom,
                    cat.name  AS resolved_category_name
             FROM stock_document_lines sdl
             LEFT JOIN asset_models     am  ON am.id  = sdl.asset_model_id
             LEFT JOIN asset_categories cat ON cat.id = am.category_id
             WHERE sdl.document_id = $1
             ORDER BY sdl.id ASC`,
            [documentId]
        )
        return result.rows.map(mapLine)
    }

    async replaceLines(documentId: string, lines: StockDocumentLineInput[]): Promise<StockDocumentLineRecord[]> {
        await this.pg.query('DELETE FROM stock_document_lines WHERE document_id = $1', [documentId])
        if (lines.length === 0) return []

        const COLS_PER_ROW = 13
        const params: unknown[] = []
        const values = lines.map((line, index) => {
            const base = index * COLS_PER_ROW
            params.push(
                documentId,
                line.lineType ?? 'qty',
                line.qty,
                line.unitCost ?? null,
                line.serialNo ?? null,
                line.note ?? null,
                line.adjustDirection ?? null,
                line.specFields ? JSON.stringify(line.specFields) : null,
                line.assetModelId ?? null,
                line.assetCategoryId ?? null,
                line.assetName ?? null,
                line.assetCode ?? null,
                line.assetId ?? null
            )
            const p = (n: number) => `$${base + n}`
            return `(${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},${p(11)},${p(12)},${p(13)})`
        })

        const result = await this.pg.query<LineRow>(
            `INSERT INTO stock_document_lines (
                document_id, line_type, qty, unit_cost, serial_no, note,
                adjust_direction, spec_fields, asset_model_id, asset_category_id,
                asset_name, asset_code, asset_id
             ) VALUES ${values.join(', ')}
             RETURNING ${LINE_COLS}`,
            params
        )
        return result.rows.map(mapLine)
    }

    async setStatus(
        id: string,
        status: StockDocumentRecord['status'],
        approvedBy?: string | null,
        idempotencyKey?: string | null
    ): Promise<StockDocumentRecord | null> {
        const result = await this.pg.query<DocumentRow>(
            `UPDATE stock_documents
             SET status = $1,
                 approved_by = $2,
                 idempotency_key = COALESCE($4, idempotency_key),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING ${DOC_COLS}`,
            [status, approvedBy ?? null, id, idempotencyKey ?? null]
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }

    async setAssetOnLine(lineId: string, assetId: string): Promise<void> {
        await this.pg.query(
            `UPDATE stock_document_lines SET asset_id = $1 WHERE id = $2`,
            [assetId, lineId]
        )
    }
}
