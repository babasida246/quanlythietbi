import type { AssetAssignmentInput, AssetAssignmentRecord, IAssignmentRepo } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface AssignmentRow {
    id: string
    asset_id: string
    assignee_type: AssetAssignmentRecord['assigneeType']
    assignee_id: string | null
    assignee_name: string
    assigned_at: Date
    returned_at: Date | null
    note: string | null
}

function mapAssignmentRow(row: AssignmentRow): AssetAssignmentRecord {
    return {
        id: row.id,
        assetId: row.asset_id,
        assigneeType: row.assignee_type,
        assigneeId: row.assignee_id,
        assigneeName: row.assignee_name,
        assignedAt: row.assigned_at,
        returnedAt: row.returned_at,
        note: row.note
    }
}

export class AssignmentRepo implements IAssignmentRepo {
    constructor(private pg: PgClient) { }

    async assign(assetId: string, assignment: AssetAssignmentInput): Promise<AssetAssignmentRecord> {
        const result = await this.pg.query<AssignmentRow>(
            `INSERT INTO asset_assignments (
                asset_id,
                assignee_type,
                assignee_id,
                assignee_name,
                assigned_at,
                note
            ) VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *`,
            [
                assetId,
                assignment.assigneeType,
                assignment.assigneeId,
                assignment.assigneeName,
                assignment.assignedAt ?? new Date(),
                assignment.note ?? null
            ]
        )

        return mapAssignmentRow(result.rows[0])
    }

    async return(assetId: string, returnedAt: Date, note?: string): Promise<AssetAssignmentRecord | null> {
        const result = await this.pg.query<AssignmentRow>(
            `UPDATE asset_assignments
             SET returned_at = $1,
                 note = COALESCE($2, note)
             WHERE asset_id = $3 AND returned_at IS NULL
             RETURNING *`,
            [returnedAt, note ?? null, assetId]
        )

        if (result.rows.length === 0) return null
        return mapAssignmentRow(result.rows[0])
    }

    async listByAsset(assetId: string): Promise<AssetAssignmentRecord[]> {
        const result = await this.pg.query<AssignmentRow>(
            `SELECT * FROM asset_assignments
             WHERE asset_id = $1
             ORDER BY assigned_at DESC`,
            [assetId]
        )
        return result.rows.map(mapAssignmentRow)
    }

    async getActiveByAsset(assetId: string): Promise<AssetAssignmentRecord | null> {
        const result = await this.pg.query<AssignmentRow>(
            `SELECT * FROM asset_assignments
             WHERE asset_id = $1 AND returned_at IS NULL
             ORDER BY assigned_at DESC
             LIMIT 1`,
            [assetId]
        )
        if (result.rows.length === 0) return null
        return mapAssignmentRow(result.rows[0])
    }
}
