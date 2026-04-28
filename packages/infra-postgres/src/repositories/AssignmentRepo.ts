import type {
    AssetAssignmentInput,
    AssetAssignmentRecord,
    AssignmentReturnOpts,
    IAssignmentRepo
} from '@qltb/contracts'
import type { Queryable } from './types.js'

interface AssignmentRow {
    id: string
    asset_id: string
    assignee_type: AssetAssignmentRecord['assigneeType']
    assignee_id: string | null
    assignee_name: string
    assigned_at: Date
    returned_at: Date | null
    note: string | null
    location_id: string | null
    organization_id: string | null
    verification_method: string | null
    verified_at: Date | null
    wf_request_id: string | null
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
        note: row.note,
        locationId: row.location_id,
        organizationId: row.organization_id,
        verificationMethod: row.verification_method as AssetAssignmentRecord['verificationMethod'],
        verifiedAt: row.verified_at,
        wfRequestId: row.wf_request_id
    }
}

export class AssignmentRepo implements IAssignmentRepo {
    constructor(private pg: Queryable) { }

    async assign(assetId: string, assignment: AssetAssignmentInput): Promise<AssetAssignmentRecord> {
        const result = await this.pg.query<AssignmentRow>(
            `INSERT INTO asset_assignments (
                asset_id,
                assignee_type,
                assignee_id,
                assignee_name,
                assigned_at,
                note,
                location_id,
                organization_id,
                verification_method,
                verified_at,
                wf_request_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *`,
            [
                assetId,
                assignment.assigneeType,
                assignment.assigneeId,
                assignment.assigneeName,
                assignment.assignedAt ?? new Date(),
                assignment.note ?? null,
                assignment.locationId ?? null,
                assignment.organizationId ?? null,
                assignment.verificationMethod ?? null,
                assignment.verifiedAt ?? null,
                assignment.wfRequestId ?? null
            ]
        )
        return mapAssignmentRow(result.rows[0])
    }

    async return(
        assetId: string,
        returnedAt: Date,
        opts?: AssignmentReturnOpts | string
    ): Promise<AssetAssignmentRecord | null> {
        const note = typeof opts === 'string' ? opts : opts?.note ?? null
        const verificationMethod = typeof opts === 'string' ? null : opts?.verificationMethod ?? null
        const verifiedAt = typeof opts === 'string' ? null : opts?.verifiedAt ?? null
        const wfRequestId = typeof opts === 'string' ? null : opts?.wfRequestId ?? null

        const result = await this.pg.query<AssignmentRow>(
            `UPDATE asset_assignments
             SET returned_at = $1,
                 note = COALESCE($2, note),
                 verification_method = COALESCE($3, verification_method),
                 verified_at = COALESCE($4, verified_at),
                 wf_request_id = COALESCE($5, wf_request_id)
             WHERE asset_id = $6 AND returned_at IS NULL
             RETURNING *`,
            [returnedAt, note, verificationMethod, verifiedAt, wfRequestId, assetId]
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
