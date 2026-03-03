import type {
    IWorkflowRepo,
    WorkflowRequestInput,
    WorkflowRequestListFilters,
    WorkflowRequestPage,
    WorkflowRequestRecord,
    WorkflowStatusPatch
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface WorkflowRow {
    id: string
    request_type: WorkflowRequestRecord['requestType']
    asset_id: string | null
    from_dept: string | null
    to_dept: string | null
    requested_by: string | null
    approved_by: string | null
    status: WorkflowRequestRecord['status']
    payload: Record<string, unknown> | null
    created_at: Date
    updated_at: Date
    correlation_id: string | null
}

function mapWorkflowRow(row: WorkflowRow): WorkflowRequestRecord {
    return {
        id: row.id,
        requestType: row.request_type,
        assetId: row.asset_id,
        fromDept: row.from_dept,
        toDept: row.to_dept,
        requestedBy: row.requested_by,
        approvedBy: row.approved_by,
        status: row.status,
        payload: row.payload ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        correlationId: row.correlation_id
    }
}

function normalizePagination(filters: WorkflowRequestListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class WorkflowRepo implements IWorkflowRepo {
    constructor(private pg: PgClient) { }

    async submit(input: WorkflowRequestInput): Promise<WorkflowRequestRecord> {
        const result = await this.pg.query<WorkflowRow>(
            `INSERT INTO workflow_requests (
                request_type,
                asset_id,
                from_dept,
                to_dept,
                requested_by,
                status,
                payload,
                correlation_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *`,
            [
                input.requestType,
                input.assetId ?? null,
                input.fromDept ?? null,
                input.toDept ?? null,
                input.requestedBy ?? null,
                'submitted',
                input.payload ?? {},
                input.correlationId ?? null
            ]
        )
        return mapWorkflowRow(result.rows[0])
    }

    async approve(id: string, patch: WorkflowStatusPatch): Promise<WorkflowRequestRecord | null> {
        return await this.updateStatus(id, 'approved', patch)
    }

    async reject(id: string, patch: WorkflowStatusPatch): Promise<WorkflowRequestRecord | null> {
        return await this.updateStatus(id, 'rejected', patch)
    }

    async updateStatus(
        id: string,
        status: WorkflowRequestRecord['status'],
        patch: WorkflowStatusPatch
    ): Promise<WorkflowRequestRecord | null> {
        const result = await this.pg.query<WorkflowRow>(
            `UPDATE workflow_requests
             SET status = $1,
                 approved_by = COALESCE($2, approved_by),
                 payload = COALESCE($3, payload),
                 correlation_id = COALESCE($4, correlation_id),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [
                status,
                patch.approvedBy ?? null,
                patch.payload ?? null,
                patch.correlationId ?? null,
                id
            ]
        )
        if (result.rows.length === 0) return null
        return mapWorkflowRow(result.rows[0])
    }

    async list(filters: WorkflowRequestListFilters): Promise<WorkflowRequestPage> {
        const params: unknown[] = []
        const conditions: string[] = []
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.requestType) {
            params.push(filters.requestType)
            conditions.push(`request_type = $${params.length}`)
        }
        if (filters.requestedBy) {
            params.push(filters.requestedBy)
            conditions.push(`requested_by = $${params.length}`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM workflow_requests ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const listResult = await this.pg.query<WorkflowRow>(
            `SELECT * FROM workflow_requests
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: listResult.rows.map(mapWorkflowRow),
            total,
            page,
            limit
        }
    }

    async getById(id: string): Promise<WorkflowRequestRecord | null> {
        const result = await this.pg.query<WorkflowRow>(
            `SELECT * FROM workflow_requests WHERE id = $1`,
            [id]
        )
        if (result.rows.length === 0) return null
        return mapWorkflowRow(result.rows[0])
    }
}
