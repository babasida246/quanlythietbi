import type { IRepairPartRepo, RepairOrderPartInput, RepairOrderPartRecord } from '@qltb/contracts'
import type { Queryable } from './types.js'

type RepairPartRow = {
    id: string
    repair_order_id: string
    part_id: string | null
    part_name: string | null
    warehouse_id: string | null
    action: RepairOrderPartRecord['action']
    qty: number
    unit_cost: number | string | null
    serial_no: string | null
    note: string | null
    stock_document_id: string | null
    created_at: Date
}

const mapRepairPart = (row: RepairPartRow): RepairOrderPartRecord => ({
    id: row.id,
    repairOrderId: row.repair_order_id,
    partId: row.part_id,
    partName: row.part_name,
    warehouseId: row.warehouse_id,
    action: row.action,
    qty: row.qty,
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    serialNo: row.serial_no,
    note: row.note,
    stockDocumentId: row.stock_document_id,
    createdAt: row.created_at
})

export class RepairPartRepo implements IRepairPartRepo {
    constructor(private pg: Queryable) { }

    async add(orderId: string, input: RepairOrderPartInput): Promise<RepairOrderPartRecord> {
        const result = await this.pg.query<RepairPartRow>(
            `INSERT INTO repair_order_parts (
                repair_order_id,
                part_id,
                part_name,
                warehouse_id,
                action,
                qty,
                unit_cost,
                serial_no,
                note,
                stock_document_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id, repair_order_id, part_id, part_name, warehouse_id, action, qty, unit_cost, serial_no, note,
                       stock_document_id, created_at`,
            [
                orderId,
                input.partId ?? null,
                input.partName ?? null,
                input.warehouseId ?? null,
                input.action,
                input.qty,
                input.unitCost ?? null,
                input.serialNo ?? null,
                input.note ?? null,
                input.stockDocumentId ?? null
            ]
        )
        return mapRepairPart(result.rows[0])
    }

    async listByOrder(orderId: string): Promise<RepairOrderPartRecord[]> {
        const result = await this.pg.query<RepairPartRow>(
            `SELECT id, repair_order_id, part_id, part_name, warehouse_id, action, qty, unit_cost, serial_no, note,
                    stock_document_id, created_at
             FROM repair_order_parts
             WHERE repair_order_id = $1
             ORDER BY created_at ASC`,
            [orderId]
        )
        return result.rows.map(mapRepairPart)
    }
}
