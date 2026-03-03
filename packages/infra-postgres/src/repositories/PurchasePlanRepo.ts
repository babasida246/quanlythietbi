import type {
    PurchasePlanDoc,
    PurchasePlanLine,
    PurchasePlanCreateInput,
    PurchasePlanUpdateInput,
    PurchasePlanStatus,
    IPurchasePlanRepo
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface PurchasePlanDocRow {
    id: string
    doc_no: string
    doc_date: Date
    fiscal_year: number
    org_unit_id: string | null
    org_unit_name: string | null
    title: string
    description: string | null
    total_estimated_cost: number | null
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
    attachments: unknown
    metadata: unknown
}

interface PurchasePlanLineRow {
    id: string
    doc_id: string
    line_no: number
    model_id: string | null
    category_id: string | null
    item_description: string
    quantity: number
    unit: string | null
    estimated_unit_cost: number | null
    estimated_total_cost: number | null
    suggestion_reason: string | null
    current_stock: number | null
    min_stock: number | null
    avg_consumption: number | null
    days_until_stockout: number | null
    funding_source: string | null
    purpose: string | null
    expected_delivery_date: Date | null
    using_dept: string | null
    priority: string
    specs: unknown
    note: string | null
    created_at: Date
}

export class PurchasePlanRepo implements IPurchasePlanRepo {
    constructor(private pg: PgClient) { }

    async create(input: PurchasePlanCreateInput, createdBy: string): Promise<PurchasePlanDoc> {
        return await this.pg.transaction(async (client) => {
            // Generate doc_no
            const docNo = await this.generateDocNo(input.fiscalYear)

            // Insert header
            const docResult = await client.query<PurchasePlanDocRow>(
                `INSERT INTO purchase_plan_docs (
                    doc_no, doc_date, fiscal_year, org_unit_id, org_unit_name,
                    title, description, currency, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    docNo,
                    input.docDate,
                    input.fiscalYear,
                    input.orgUnitId ?? null,
                    input.orgUnitName ?? null,
                    input.title,
                    input.description ?? null,
                    input.currency ?? 'VND',
                    createdBy
                ]
            )

            const doc = docResult.rows[0]

            // Insert lines
            const lines: PurchasePlanLine[] = []
            for (const line of input.lines) {
                const lineResult = await client.query<PurchasePlanLineRow>(
                    `INSERT INTO purchase_plan_lines (
                        doc_id, line_no, model_id, category_id, item_description,
                        quantity, unit, estimated_unit_cost, estimated_total_cost,
                        suggestion_reason, current_stock, min_stock, avg_consumption, days_until_stockout,
                        funding_source, purpose, expected_delivery_date, using_dept, priority,
                        specs, note
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                    RETURNING *`,
                    [
                        doc.id,
                        line.lineNo,
                        line.modelId ?? null,
                        line.categoryId ?? null,
                        line.itemDescription,
                        line.quantity,
                        line.unit ?? null,
                        line.estimatedUnitCost ?? null,
                        line.estimatedUnitCost ? line.estimatedUnitCost * line.quantity : null,
                        line.suggestionReason ?? null,
                        line.currentStock ?? null,
                        line.minStock ?? null,
                        line.avgConsumption ?? null,
                        line.daysUntilStockout ?? null,
                        line.fundingSource ?? null,
                        line.purpose ?? null,
                        line.expectedDeliveryDate ?? null,
                        line.usingDept ?? null,
                        line.priority ?? 'medium',
                        line.specs ? JSON.stringify(line.specs) : '{}',
                        line.note ?? null
                    ]
                )
                lines.push(this.mapLineRow(lineResult.rows[0]))
            }

            // Update total
            const total = lines.reduce((sum, l) => sum + (l.estimatedTotalCost ?? 0), 0)
            await client.query(
                `UPDATE purchase_plan_docs SET total_estimated_cost = $1 WHERE id = $2`,
                [total, doc.id]
            )

            return { ...this.mapDocRow(doc), lines, totalEstimatedCost: total }
        })
    }

    async getById(id: string): Promise<PurchasePlanDoc | null> {
        const docResult = await this.pg.query<PurchasePlanDocRow>(
            `SELECT * FROM purchase_plan_docs WHERE id = $1`,
            [id]
        )

        if (docResult.rows.length === 0) return null

        const linesResult = await this.pg.query<PurchasePlanLineRow>(
            `SELECT * FROM purchase_plan_lines WHERE doc_id = $1 ORDER BY line_no`,
            [id]
        )

        return {
            ...this.mapDocRow(docResult.rows[0]),
            lines: linesResult.rows.map(row => this.mapLineRow(row))
        }
    }

    async getByDocNo(docNo: string): Promise<PurchasePlanDoc | null> {
        const docResult = await this.pg.query<PurchasePlanDocRow>(
            `SELECT * FROM purchase_plan_docs WHERE doc_no = $1`,
            [docNo]
        )

        if (docResult.rows.length === 0) return null

        const linesResult = await this.pg.query<PurchasePlanLineRow>(
            `SELECT * FROM purchase_plan_lines WHERE doc_id = $1 ORDER BY line_no`,
            [docResult.rows[0].id]
        )

        return {
            ...this.mapDocRow(docResult.rows[0]),
            lines: linesResult.rows.map(row => this.mapLineRow(row))
        }
    }

    async update(id: string, input: PurchasePlanUpdateInput): Promise<PurchasePlanDoc> {
        return await this.pg.transaction(async (client) => {
            const updates: string[] = []
            const params: unknown[] = []
            let paramCount = 1

            if (input.docDate !== undefined) {
                updates.push(`doc_date = $${paramCount++}`)
                params.push(input.docDate)
            }
            if (input.orgUnitId !== undefined) {
                updates.push(`org_unit_id = $${paramCount++}`)
                params.push(input.orgUnitId)
            }
            if (input.orgUnitName !== undefined) {
                updates.push(`org_unit_name = $${paramCount++}`)
                params.push(input.orgUnitName)
            }
            if (input.title !== undefined) {
                updates.push(`title = $${paramCount++}`)
                params.push(input.title)
            }
            if (input.description !== undefined) {
                updates.push(`description = $${paramCount++}`)
                params.push(input.description)
            }

            if (updates.length > 0) {
                updates.push(`updated_at = NOW()`)
                params.push(id)
                await client.query(
                    `UPDATE purchase_plan_docs SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                    params
                )
            }

            if (input.lines) {
                await client.query(`DELETE FROM purchase_plan_lines WHERE doc_id = $1`, [id])

                for (const line of input.lines) {
                    await client.query(
                        `INSERT INTO purchase_plan_lines (
                            doc_id, line_no, model_id, category_id, item_description,
                            quantity, unit, estimated_unit_cost, estimated_total_cost,
                            suggestion_reason, current_stock, min_stock, avg_consumption, days_until_stockout,
                            funding_source, purpose, expected_delivery_date, using_dept, priority,
                            specs, note
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
                        [
                            id,
                            line.lineNo,
                            line.modelId ?? null,
                            line.categoryId ?? null,
                            line.itemDescription,
                            line.quantity,
                            line.unit ?? null,
                            line.estimatedUnitCost ?? null,
                            line.estimatedUnitCost ? line.estimatedUnitCost * line.quantity : null,
                            line.suggestionReason ?? null,
                            line.currentStock ?? null,
                            line.minStock ?? null,
                            line.avgConsumption ?? null,
                            line.daysUntilStockout ?? null,
                            line.fundingSource ?? null,
                            line.purpose ?? null,
                            line.expectedDeliveryDate ?? null,
                            line.usingDept ?? null,
                            line.priority ?? 'medium',
                            line.specs ? JSON.stringify(line.specs) : '{}',
                            line.note ?? null
                        ]
                    )
                }

                const linesResult = await client.query<{ total: number }>(
                    `SELECT COALESCE(SUM(estimated_total_cost), 0) as total FROM purchase_plan_lines WHERE doc_id = $1`,
                    [id]
                )
                await client.query(
                    `UPDATE purchase_plan_docs SET total_estimated_cost = $1 WHERE id = $2`,
                    [linesResult.rows[0].total, id]
                )
            }

            const result = await this.getById(id)
            if (!result) throw new Error('Purchase plan not found after update')
            return result
        })
    }

    async updateStatus(id: string, status: PurchasePlanStatus, actor: string): Promise<void> {
        const statusField = this.getStatusField(status)
        await this.pg.query(
            `UPDATE purchase_plan_docs 
             SET status = $1, ${statusField} = $2, ${statusField.replace('_at', '_by')} = $3, updated_at = NOW()
             WHERE id = $4`,
            [status, new Date(), actor, id]
        )
    }

    async list(filters: {
        status?: PurchasePlanStatus
        fiscalYear?: number
        orgUnitId?: string
        page?: number
        limit?: number
    }): Promise<{ items: PurchasePlanDoc[]; total: number }> {
        const conditions: string[] = ['1=1']
        const params: unknown[] = []
        let paramCount = 1

        if (filters.status) {
            conditions.push(`status = $${paramCount++}`)
            params.push(filters.status)
        }
        if (filters.fiscalYear) {
            conditions.push(`fiscal_year = $${paramCount++}`)
            params.push(filters.fiscalYear)
        }
        if (filters.orgUnitId) {
            conditions.push(`org_unit_id = $${paramCount++}`)
            params.push(filters.orgUnitId)
        }

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM purchase_plan_docs WHERE ${conditions.join(' AND ')}`,
            params
        )

        const page = filters.page ?? 1
        const limit = filters.limit ?? 20
        const offset = (page - 1) * limit

        const result = await this.pg.query<PurchasePlanDocRow>(
            `SELECT * FROM purchase_plan_docs 
             WHERE ${conditions.join(' AND ')}
             ORDER BY doc_date DESC, doc_no DESC
             LIMIT $${paramCount++} OFFSET $${paramCount}`,
            [...params, limit, offset]
        )

        const items = await Promise.all(
            result.rows.map(async (row) => {
                const linesResult = await this.pg.query<PurchasePlanLineRow>(
                    `SELECT * FROM purchase_plan_lines WHERE doc_id = $1 ORDER BY line_no`,
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

    private async generateDocNo(fiscalYear: number): Promise<string> {
        const result = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM purchase_plan_docs WHERE fiscal_year = $1`,
            [fiscalYear]
        )
        const seq = parseInt(result.rows[0].count) + 1
        return `PP-${fiscalYear}-${seq.toString().padStart(4, '0')}`
    }

    private getStatusField(status: PurchasePlanStatus): string {
        switch (status) {
            case 'submitted': return 'submitted_at'
            case 'approved': return 'approved_at'
            case 'posted': return 'posted_at'
            case 'cancelled': return 'cancelled_at'
            default: return 'updated_at'
        }
    }

    private mapDocRow(row: PurchasePlanDocRow): PurchasePlanDoc {
        return {
            id: row.id,
            docNo: row.doc_no,
            docDate: row.doc_date,
            fiscalYear: row.fiscal_year,
            orgUnitId: row.org_unit_id,
            orgUnitName: row.org_unit_name,
            title: row.title,
            description: row.description,
            totalEstimatedCost: row.total_estimated_cost,
            currency: row.currency,
            status: row.status as PurchasePlanStatus,
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
            attachments: row.attachments as unknown[],
            metadata: row.metadata as Record<string, unknown>
        }
    }

    private mapLineRow(row: PurchasePlanLineRow): PurchasePlanLine {
        return {
            id: row.id,
            docId: row.doc_id,
            lineNo: row.line_no,
            modelId: row.model_id,
            categoryId: row.category_id,
            itemDescription: row.item_description,
            quantity: row.quantity,
            unit: row.unit,
            estimatedUnitCost: row.estimated_unit_cost,
            estimatedTotalCost: row.estimated_total_cost,
            suggestionReason: row.suggestion_reason as any,
            currentStock: row.current_stock,
            minStock: row.min_stock,
            avgConsumption: row.avg_consumption,
            daysUntilStockout: row.days_until_stockout,
            fundingSource: row.funding_source,
            purpose: row.purpose,
            expectedDeliveryDate: row.expected_delivery_date,
            usingDept: row.using_dept,
            priority: row.priority as any,
            specs: row.specs as Record<string, unknown>,
            note: row.note,
            createdAt: row.created_at
        }
    }
}
