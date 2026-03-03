import type {
    AssetIncreaseDoc,
    AssetIncreaseLine,
    AssetIncreaseCreateInput,
    AssetIncreaseUpdateInput,
    AssetIncreaseStatus,
    IncreaseType,
    IAssetIncreaseRepo
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface AssetIncreaseDocRow {
    id: string
    doc_no: string
    doc_date: Date
    increase_type: string
    org_unit_id: string | null
    org_unit_name: string | null
    vendor_id: string | null
    vendor_name: string | null
    invoice_no: string | null
    invoice_date: Date | null
    total_cost: number | null
    currency: string
    status: string
    created_by: string
    created_at: Date
    submitted_by: string | null
    submitted_at: Date | null
    approved_by: string | null
    approved_at: Date | null
    posted_by: string | null
    posted_at: Date | null
    cancelled_by: string | null
    cancelled_at: Date | null
    updated_at: Date
    purchase_plan_doc_id: string | null
    note: string | null
    attachments: unknown
    metadata: unknown
}

interface AssetIncreaseLineRow {
    id: string
    doc_id: string
    line_no: number
    asset_code: string | null
    asset_name: string
    category_id: string | null
    model_id: string | null
    serial_number: string | null
    quantity: number
    unit: string | null
    original_cost: number
    current_value: number | null
    location_id: string | null
    location_name: string | null
    custodian_id: string | null
    custodian_name: string | null
    acquisition_date: Date | null
    in_service_date: Date | null
    warranty_end_date: Date | null
    specs: unknown
    note: string | null
    asset_id: string | null
    created_at: Date
}

export class AssetIncreaseRepo implements IAssetIncreaseRepo {
    constructor(private pg: PgClient) { }

    async create(input: AssetIncreaseCreateInput, createdBy: string): Promise<AssetIncreaseDoc> {
        return await this.pg.transaction(async (client) => {
            const docNo = await this.generateDocNo()

            const docResult = await client.query<AssetIncreaseDocRow>(
                `INSERT INTO asset_increase_docs (
                    doc_no, doc_date, increase_type, org_unit_id, org_unit_name,
                    vendor_id, invoice_no, invoice_date, currency,
                    purchase_plan_doc_id, note, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [
                    docNo,
                    input.docDate,
                    input.increaseType,
                    input.orgUnitId ?? null,
                    input.orgUnitName ?? null,
                    input.vendorId ?? null,
                    input.invoiceNo ?? null,
                    input.invoiceDate ?? null,
                    input.currency ?? 'VND',
                    input.purchasePlanDocId ?? null,
                    input.note ?? null,
                    createdBy
                ]
            )

            const doc = docResult.rows[0]
            const lines: AssetIncreaseLine[] = []

            for (const line of input.lines) {
                const lineResult = await client.query<AssetIncreaseLineRow>(
                    `INSERT INTO asset_increase_lines (
                        doc_id, line_no, asset_code, asset_name, category_id, model_id,
                        serial_number, quantity, unit, original_cost, current_value,
                        location_id, location_name, custodian_id, custodian_name,
                        acquisition_date, in_service_date, warranty_end_date,
                        specs, note
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                    RETURNING *`,
                    [
                        doc.id,
                        line.lineNo,
                        line.assetCode ?? null,
                        line.assetName,
                        line.categoryId ?? null,
                        line.modelId ?? null,
                        line.serialNumber ?? null,
                        line.quantity ?? 1,
                        line.unit ?? null,
                        line.originalCost,
                        line.currentValue ?? line.originalCost,
                        line.locationId ?? null,
                        line.locationName ?? null,
                        line.custodianId ?? null,
                        line.custodianName ?? null,
                        line.acquisitionDate ?? null,
                        line.inServiceDate ?? null,
                        line.warrantyEndDate ?? null,
                        line.specs ? JSON.stringify(line.specs) : '{}',
                        line.note ?? null
                    ]
                )
                lines.push(this.mapLineRow(lineResult.rows[0]))
            }

            const total = lines.reduce((sum, l) => sum + l.originalCost * l.quantity, 0)
            await client.query(
                `UPDATE asset_increase_docs SET total_cost = $1 WHERE id = $2`,
                [total, doc.id]
            )

            return { ...this.mapDocRow(doc), lines, totalCost: total }
        })
    }

    async getById(id: string): Promise<AssetIncreaseDoc | null> {
        const docResult = await this.pg.query<AssetIncreaseDocRow>(
            `SELECT * FROM asset_increase_docs WHERE id = $1`,
            [id]
        )

        if (docResult.rows.length === 0) return null

        const linesResult = await this.pg.query<AssetIncreaseLineRow>(
            `SELECT * FROM asset_increase_lines WHERE doc_id = $1 ORDER BY line_no`,
            [id]
        )

        return {
            ...this.mapDocRow(docResult.rows[0]),
            lines: linesResult.rows.map(row => this.mapLineRow(row))
        }
    }

    async getByDocNo(docNo: string): Promise<AssetIncreaseDoc | null> {
        const docResult = await this.pg.query<AssetIncreaseDocRow>(
            `SELECT * FROM asset_increase_docs WHERE doc_no = $1`,
            [docNo]
        )

        if (docResult.rows.length === 0) return null

        const linesResult = await this.pg.query<AssetIncreaseLineRow>(
            `SELECT * FROM asset_increase_lines WHERE doc_id = $1 ORDER BY line_no`,
            [docResult.rows[0].id]
        )

        return {
            ...this.mapDocRow(docResult.rows[0]),
            lines: linesResult.rows.map(row => this.mapLineRow(row))
        }
    }

    async update(id: string, input: AssetIncreaseUpdateInput): Promise<AssetIncreaseDoc> {
        return await this.pg.transaction(async (client) => {
            const updates: string[] = []
            const params: unknown[] = []
            let paramCount = 1

            if (input.docDate !== undefined) {
                updates.push(`doc_date = $${paramCount++}`)
                params.push(input.docDate)
            }
            if (input.increaseType !== undefined) {
                updates.push(`increase_type = $${paramCount++}`)
                params.push(input.increaseType)
            }
            if (input.orgUnitId !== undefined) {
                updates.push(`org_unit_id = $${paramCount++}`)
                params.push(input.orgUnitId)
            }
            if (input.orgUnitName !== undefined) {
                updates.push(`org_unit_name = $${paramCount++}`)
                params.push(input.orgUnitName)
            }
            if (input.vendorId !== undefined) {
                updates.push(`vendor_id = $${paramCount++}`)
                params.push(input.vendorId)
            }
            if (input.invoiceNo !== undefined) {
                updates.push(`invoice_no = $${paramCount++}`)
                params.push(input.invoiceNo)
            }
            if (input.invoiceDate !== undefined) {
                updates.push(`invoice_date = $${paramCount++}`)
                params.push(input.invoiceDate)
            }
            if (input.note !== undefined) {
                updates.push(`note = $${paramCount++}`)
                params.push(input.note)
            }

            if (updates.length > 0) {
                updates.push(`updated_at = NOW()`)
                params.push(id)
                await client.query(
                    `UPDATE asset_increase_docs SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                    params
                )
            }

            if (input.lines) {
                await client.query(`DELETE FROM asset_increase_lines WHERE doc_id = $1`, [id])

                for (const line of input.lines) {
                    await client.query(
                        `INSERT INTO asset_increase_lines (
                            doc_id, line_no, asset_code, asset_name, category_id, model_id,
                            serial_number, quantity, unit, original_cost, current_value,
                            location_id, location_name, custodian_id, custodian_name,
                            acquisition_date, in_service_date, warranty_end_date,
                            specs, note
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
                        [
                            id,
                            line.lineNo,
                            line.assetCode ?? null,
                            line.assetName,
                            line.categoryId ?? null,
                            line.modelId ?? null,
                            line.serialNumber ?? null,
                            line.quantity ?? 1,
                            line.unit ?? null,
                            line.originalCost,
                            line.currentValue ?? line.originalCost,
                            line.locationId ?? null,
                            line.locationName ?? null,
                            line.custodianId ?? null,
                            line.custodianName ?? null,
                            line.acquisitionDate ?? null,
                            line.inServiceDate ?? null,
                            line.warrantyEndDate ?? null,
                            line.specs ? JSON.stringify(line.specs) : '{}',
                            line.note ?? null
                        ]
                    )
                }

                const linesResult = await client.query<{ total: number }>(
                    `SELECT COALESCE(SUM(original_cost * quantity), 0) as total FROM asset_increase_lines WHERE doc_id = $1`,
                    [id]
                )
                await client.query(
                    `UPDATE asset_increase_docs SET total_cost = $1 WHERE id = $2`,
                    [linesResult.rows[0].total, id]
                )
            }

            const result = await this.getById(id)
            if (!result) throw new Error('Asset increase not found after update')
            return result
        })
    }

    async updateStatus(id: string, status: AssetIncreaseStatus, actor: string): Promise<void> {
        const statusField = this.getStatusField(status)
        await this.pg.query(
            `UPDATE asset_increase_docs 
             SET status = $1, ${statusField} = $2, ${statusField.replace('_at', '_by')} = $3, updated_at = NOW()
             WHERE id = $4`,
            [status, new Date(), actor, id]
        )
    }

    async list(filters: {
        status?: AssetIncreaseStatus
        increaseType?: IncreaseType
        fromDate?: Date
        toDate?: Date
        page?: number
        limit?: number
    }): Promise<{ items: AssetIncreaseDoc[]; total: number }> {
        const conditions: string[] = ['1=1']
        const params: unknown[] = []
        let paramCount = 1

        if (filters.status) {
            conditions.push(`status = $${paramCount++}`)
            params.push(filters.status)
        }
        if (filters.increaseType) {
            conditions.push(`increase_type = $${paramCount++}`)
            params.push(filters.increaseType)
        }
        if (filters.fromDate) {
            conditions.push(`doc_date >= $${paramCount++}`)
            params.push(filters.fromDate)
        }
        if (filters.toDate) {
            conditions.push(`doc_date <= $${paramCount++}`)
            params.push(filters.toDate)
        }

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM asset_increase_docs WHERE ${conditions.join(' AND ')}`,
            params
        )

        const page = filters.page ?? 1
        const limit = filters.limit ?? 20
        const offset = (page - 1) * limit

        const result = await this.pg.query<AssetIncreaseDocRow>(
            `SELECT * FROM asset_increase_docs 
             WHERE ${conditions.join(' AND ')}
             ORDER BY doc_date DESC, doc_no DESC
             LIMIT $${paramCount++} OFFSET $${paramCount}`,
            [...params, limit, offset]
        )

        const items = await Promise.all(
            result.rows.map(async (row) => {
                const linesResult = await this.pg.query<AssetIncreaseLineRow>(
                    `SELECT * FROM asset_increase_lines WHERE doc_id = $1 ORDER BY line_no`,
                    [row.id]
                )
                return {
                    ...this.mapDocRow(row),
                    lines: linesResult.rows.map(l => this.mapLineRow(l))
                }
            })
        )

        return {
            items,
            total: parseInt(countResult.rows[0].count)
        }
    }

    private async generateDocNo(): Promise<string> {
        const result = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM asset_increase_docs WHERE EXTRACT(YEAR FROM doc_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
        )
        const seq = parseInt(result.rows[0].count) + 1
        const year = new Date().getFullYear()
        return `AI-${year}-${seq.toString().padStart(4, '0')}`
    }

    private getStatusField(status: AssetIncreaseStatus): string {
        switch (status) {
            case 'submitted': return 'submitted_at'
            case 'approved': return 'approved_at'
            case 'posted': return 'posted_at'
            case 'cancelled': return 'cancelled_at'
            default: return 'updated_at'
        }
    }

    private mapDocRow(row: AssetIncreaseDocRow): AssetIncreaseDoc {
        return {
            id: row.id,
            docNo: row.doc_no,
            docDate: row.doc_date,
            increaseType: row.increase_type as IncreaseType,
            orgUnitId: row.org_unit_id,
            orgUnitName: row.org_unit_name,
            vendorId: row.vendor_id,
            vendorName: row.vendor_name,
            invoiceNo: row.invoice_no,
            invoiceDate: row.invoice_date,
            totalCost: row.total_cost,
            currency: row.currency,
            status: row.status as AssetIncreaseStatus,
            createdBy: row.created_by,
            createdAt: row.created_at,
            submittedBy: row.submitted_by,
            submittedAt: row.submitted_at,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at,
            postedBy: row.posted_by,
            postedAt: row.posted_at,
            cancelledBy: row.cancelled_by,
            cancelledAt: row.cancelled_at,
            updatedAt: row.updated_at,
            purchasePlanDocId: row.purchase_plan_doc_id,
            note: row.note,
            attachments: row.attachments as unknown[],
            metadata: row.metadata as Record<string, unknown>
        }
    }

    private mapLineRow(row: AssetIncreaseLineRow): AssetIncreaseLine {
        return {
            id: row.id,
            docId: row.doc_id,
            lineNo: row.line_no,
            assetCode: row.asset_code,
            assetName: row.asset_name,
            categoryId: row.category_id,
            modelId: row.model_id,
            serialNumber: row.serial_number,
            quantity: row.quantity,
            unit: row.unit,
            originalCost: row.original_cost,
            currentValue: row.current_value,
            locationId: row.location_id,
            locationName: row.location_name,
            custodianId: row.custodian_id,
            custodianName: row.custodian_name,
            acquisitionDate: row.acquisition_date,
            inServiceDate: row.in_service_date,
            warrantyEndDate: row.warranty_end_date,
            specs: row.specs as Record<string, unknown>,
            note: row.note,
            assetId: row.asset_id,
            createdAt: row.created_at
        }
    }
}
