import type {
    ApprovalRecord,
    ApprovalInput,
    ApprovalDecisionInput,
    IApprovalRepo,
    WorkflowDecision
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

export class ApprovalRepo implements IApprovalRepo {
    constructor(private pg: PgClient) { }

    async create(input: ApprovalInput): Promise<ApprovalRecord> {
        const result = await this.pg.query<{
            id: string
            entity_type: string
            entity_id: string
            step_no: number
            approver_id: string
            approver_name: string | null
            decision: string | null
            note: string | null
            decided_at: Date | null
            created_at: Date
        }>(
            `INSERT INTO approvals (entity_type, entity_id, step_no, approver_id, approver_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [input.entityType, input.entityId, input.stepNo, input.approverId, input.approverName ?? null]
        )

        return this.mapRow(result.rows[0])
    }

    async getByEntity(entityType: string, entityId: string): Promise<ApprovalRecord[]> {
        const result = await this.pg.query<{
            id: string
            entity_type: string
            entity_id: string
            step_no: number
            approver_id: string
            approver_name: string | null
            decision: string | null
            note: string | null
            decided_at: Date | null
            created_at: Date
        }>(
            `SELECT * FROM approvals
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY step_no`,
            [entityType, entityId]
        )

        return result.rows.map(row => this.mapRow(row))
    }

    async getPendingForApprover(approverId: string): Promise<ApprovalRecord[]> {
        const result = await this.pg.query<{
            id: string
            entity_type: string
            entity_id: string
            step_no: number
            approver_id: string
            approver_name: string | null
            decision: string | null
            note: string | null
            decided_at: Date | null
            created_at: Date
        }>(
            `SELECT * FROM approvals
             WHERE approver_id = $1 AND decision IS NULL
             ORDER BY created_at DESC`,
            [approverId]
        )

        return result.rows.map(row => this.mapRow(row))
    }

    async updateDecision(id: string, input: ApprovalDecisionInput, actorId?: string): Promise<ApprovalRecord> {
        // Guard: only the assigned approver can decide, and only if no decision yet
        const result = await this.pg.query<{
            id: string
            entity_type: string
            entity_id: string
            step_no: number
            approver_id: string
            approver_name: string | null
            decision: string | null
            note: string | null
            decided_at: Date | null
            created_at: Date
        }>(
            `UPDATE approvals
             SET decision = $1, note = $2, decided_at = NOW()
             WHERE id = $3
               AND decision IS NULL
               ${actorId ? 'AND approver_id = $4' : ''}
             RETURNING *`,
            actorId
                ? [input.decision, input.note ?? null, id, actorId]
                : [input.decision, input.note ?? null, id]
        )

        if (result.rows.length === 0) {
            throw new Error('Approval not found, already decided, or you are not the assigned approver')
        }

        return this.mapRow(result.rows[0])
    }

    private mapRow(row: {
        id: string
        entity_type: string
        entity_id: string
        step_no: number
        approver_id: string
        approver_name: string | null
        decision: string | null
        note: string | null
        decided_at: Date | null
        created_at: Date
    }): ApprovalRecord {
        return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            stepNo: row.step_no,
            approverId: row.approver_id,
            approverName: row.approver_name,
            decision: row.decision as WorkflowDecision | null,
            note: row.note,
            decidedAt: row.decided_at,
            createdAt: row.created_at
        }
    }
}
