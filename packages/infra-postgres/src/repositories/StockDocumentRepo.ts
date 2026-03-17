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
    note: string | null
    idempotency_key: string | null
    supplier: string | null
    submitter_name: string | null
    receiver_name: string | null
    department: string | null
    created_by: string | null
    approved_by: string | null
    correlation_id: string | null
    created_at: Date
    updated_at: Date
}
type LineRow = {
    id: string
    document_id: string
    part_id: string
    qty: number
    unit_cost: number | string | null
    serial_no: string | null
    note: string | null
    adjust_direction: 'plus' | 'minus' | null
    spec_fields: Record<string, unknown> | null
}
type Update = { column: string; value: unknown }
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
    note: row.note,
    idempotencyKey: row.idempotency_key,
    supplier: row.supplier,
    submitterName: row.submitter_name,
    receiverName: row.receiver_name,
    department: row.department,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
})
const mapLine = (row: LineRow): StockDocumentLineRecord => ({
    id: row.id,
    documentId: row.document_id,
    partId: row.part_id,
    qty: row.qty,
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    serialNo: row.serial_no,
    note: row.note,
    adjustDirection: row.adjust_direction,
    specFields: row.spec_fields ?? null
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
                doc_type,
                code,
                status,
                warehouse_id,
                target_warehouse_id,
                doc_date,
                ref_type,
                ref_id,
                note,
                supplier,
                submitter_name,
                receiver_name,
                department,
                created_by,
                correlation_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                       note, idempotency_key, supplier, submitter_name, receiver_name, department,
                       created_by, approved_by, correlation_id, created_at, updated_at`,
            [
                input.docType,
                input.code,
                'draft',
                input.warehouseId ?? null,
                input.targetWarehouseId ?? null,
                docDate,
                input.refType ?? null,
                input.refId ?? null,
                input.note ?? null,
                input.supplier ?? null,
                input.submitterName ?? null,
                input.receiverName ?? null,
                input.department ?? null,
                input.createdBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapDocument(result.rows[0])
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
             RETURNING id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                       note, idempotency_key, supplier, submitter_name, receiver_name, department,
                       created_by, approved_by, correlation_id, created_at, updated_at`,
            params
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }

    async getById(id: string): Promise<StockDocumentRecord | null> {
        const result = await this.pg.query<DocumentRow>(
            `SELECT id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                    note, idempotency_key, supplier, submitter_name, receiver_name, department,
                    created_by, approved_by, correlation_id, created_at, updated_at
             FROM stock_documents WHERE id = $1`,
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
        }
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`warehouse_id = $${params.length}`)
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
            `SELECT id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                    note, idempotency_key, supplier, submitter_name, receiver_name, department,
                    created_by, approved_by, correlation_id, created_at, updated_at
             FROM stock_documents
             ${whereClause}
             ORDER BY doc_date DESC, created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )
        return {
            items: result.rows.map(mapDocument),
            total,
            page,
            limit
        }
    }

    async listLines(documentId: string): Promise<StockDocumentLineRecord[]> {
        const result = await this.pg.query<LineRow>(
            `SELECT id, document_id, part_id, qty, unit_cost, serial_no, note, adjust_direction, spec_fields
             FROM stock_document_lines
             WHERE document_id = $1
             ORDER BY id ASC`,
            [documentId]
        )
        return result.rows.map(mapLine)
    }
    async replaceLines(documentId: string, lines: StockDocumentLineInput[]): Promise<StockDocumentLineRecord[]> {
        await this.pg.query('DELETE FROM stock_document_lines WHERE document_id = $1', [documentId])
        if (lines.length === 0) return []
        const params: unknown[] = []
        const values = lines.map((line, index) => {
            const base = index * 8
            params.push(
                documentId,
                line.partId,
                line.qty,
                line.unitCost ?? null,
                line.serialNo ?? null,
                line.note ?? null,
                line.adjustDirection ?? null,
                line.specFields ? JSON.stringify(line.specFields) : null
            )
            return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`
        })
        const result = await this.pg.query<LineRow>(
            `INSERT INTO stock_document_lines (
                document_id,
                part_id,
                qty,
                unit_cost,
                serial_no,
                note,
                adjust_direction,
                spec_fields
             ) VALUES ${values.join(', ')}
             RETURNING id, document_id, part_id, qty, unit_cost, serial_no, note, adjust_direction, spec_fields`,
            params
        )
        return result.rows.map(mapLine)
    }

    async setStatus(id: string, status: StockDocumentRecord['status'], approvedBy?: string | null, idempotencyKey?: string | null): Promise<StockDocumentRecord | null> {
        const result = await this.pg.query<DocumentRow>(
            `UPDATE stock_documents
             SET status = $1,
                 approved_by = $2,
                 idempotency_key = COALESCE($4, idempotency_key),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, ref_type, ref_id,
                       note, idempotency_key, supplier, submitter_name, receiver_name, department,
                       created_by, approved_by, correlation_id, created_at, updated_at`,
            [status, approvedBy ?? null, id, idempotencyKey ?? null]
        )
        return result.rows[0] ? mapDocument(result.rows[0]) : null
    }
}
