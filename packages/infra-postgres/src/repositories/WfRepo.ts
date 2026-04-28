/**
 * Workflow Module - Repository Layer
 * @package @qltb/infra-postgres
 */

import type { PoolClient } from 'pg';
import type { PgClient } from '../PgClient.js';
import type {
    WfDefinition,
    WfStep,
    WfRequest,
    WfRequestWithDetails,
    WfApproval,
    WfApprovalWithDetails,
    WfEvent,
    WfAttachment,
    WfRequestLine,
    CreateWfRequestDto,
    CreateWfRequestLineDto,
    CreateWfDefinitionDto,
    WfRequestListParams,
    WfPaginatedResult,
    InboxSummary,
    WfRequestStatus,
    WfApprovalStatus,
    WfEventType,
} from '@qltb/contracts';

// ==================== Row mappers ====================

function mapRequest(r: Record<string, unknown>): WfRequest {
    return {
        id: r.id as string,
        code: r.code as string,
        title: r.title as string,
        requestType: r.request_type as WfRequest['requestType'],
        priority: r.priority as WfRequest['priority'],
        status: r.status as WfRequest['status'],
        requesterId: r.requester_id as string,
        requesterOuId: r.requester_ou_id as string | null,
        definitionId: r.definition_id as string | null,
        currentStepNo: r.current_step_no != null ? Number(r.current_step_no) : null,
        dueAt: r.due_at as Date | null,
        payload: (r.payload ?? {}) as Record<string, unknown>,
        submittedAt: r.submitted_at as Date | null,
        closedAt: r.closed_at as Date | null,
        createdAt: r.created_at as Date,
        updatedAt: r.updated_at as Date,
    };
}

function mapRequestWithDetails(r: Record<string, unknown>): WfRequestWithDetails {
    return {
        ...mapRequest(r),
        requesterName: r.requester_name as string | null,
        requesterEmail: r.requester_email as string | null,
        definitionName: r.definition_name as string | null,
    };
}

function mapApproval(r: Record<string, unknown>): WfApproval {
    return {
        id: r.id as string,
        requestId: r.request_id as string,
        stepId: r.step_id as string,
        stepNo: Number(r.step_no),
        assigneeUserId: r.assignee_user_id as string | null,
        assigneeGroupId: r.assignee_group_id as string | null,
        status: r.status as WfApprovalStatus,
        comment: r.comment as string | null,
        decisionAt: r.decision_at as Date | null,
        decisionBy: r.decision_by as string | null,
        dueAt: r.due_at as Date | null,
        version: Number(r.version ?? 1),
        createdAt: r.created_at as Date,
        updatedAt: r.updated_at as Date,
    };
}

function mapApprovalWithDetails(r: Record<string, unknown>): WfApprovalWithDetails {
    return {
        ...mapApproval(r),
        stepName: r.step_name as string | null,
        assigneeName: r.assignee_name as string | null,
        decisionByName: r.decision_by_name as string | null,
    };
}

function mapDefinition(r: Record<string, unknown>): WfDefinition {
    return {
        id: r.id as string,
        key: r.key as string,
        name: r.name as string,
        requestType: r.request_type as WfDefinition['requestType'],
        version: Number(r.version),
        isActive: Boolean(r.is_active),
        createdAt: r.created_at as Date,
        updatedAt: r.updated_at as Date,
    };
}

function mapStep(r: Record<string, unknown>): WfStep {
    return {
        id: r.id as string,
        definitionId: r.definition_id as string,
        stepNo: Number(r.step_no),
        name: r.name as string,
        approverRule: (r.approver_rule ?? {}) as WfStep['approverRule'],
        onApprove: (r.on_approve ?? {}) as WfStep['onApprove'],
        onReject: (r.on_reject ?? {}) as WfStep['onReject'],
        slaHours: r.sla_hours != null ? Number(r.sla_hours) : null,
    };
}

function mapEvent(r: Record<string, unknown>): WfEvent {
    return {
        id: r.id as string,
        requestId: r.request_id as string,
        eventType: r.event_type as WfEventType,
        actorId: r.actor_id as string | null,
        meta: (r.meta ?? {}) as Record<string, unknown>,
        createdAt: r.created_at as Date,
        actorName: r.actor_name as string | null,
    };
}

function mapLine(r: Record<string, unknown>): WfRequestLine {
    return {
        id: r.id as string,
        requestId: r.request_id as string,
        lineNo: Number(r.line_no),
        itemType: r.item_type as WfRequestLine['itemType'],
        assetId: r.asset_id as string | null,
        partId: r.part_id as string | null,
        requestedQty: Number(r.requested_qty),
        fulfilledQty: Number(r.fulfilled_qty ?? 0),
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
        note: r.note as string | null,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
        status: r.status as WfRequestLine['status'],
        createdAt: r.created_at as Date,
        updatedAt: r.updated_at as Date,
        partCode: (r.part_code as string | null) ?? undefined,
        partName: (r.part_name as string | null) ?? undefined,
        assetCode: (r.asset_code as string | null) ?? undefined,
        assetName: (r.asset_name as string | null) ?? undefined,
    };
}

// ==================== Repository ====================

export class WfRepo {
    constructor(private readonly db: PgClient) { }

    // ---- Request CRUD ----

    async createRequest(dto: CreateWfRequestDto): Promise<WfRequest> {
        const code = await this.nextCode();
        const client = await this.db.getClient();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query<Record<string, unknown>>(
                `INSERT INTO wf_requests
                   (code, title, request_type, priority, status, requester_id, requester_ou_id,
                    definition_id, due_at, payload)
                 VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9)
                 RETURNING *`,
                [
                    code,
                    dto.title,
                    dto.requestType,
                    dto.priority ?? 'normal',
                    dto.requesterId,
                    dto.requesterOuId ?? null,
                    null,
                    dto.dueAt ?? null,
                    JSON.stringify(dto.payload ?? {}),
                ]
            );
            const request = mapRequest(rows[0]);

            if (dto.lines && dto.lines.length > 0) {
                await this.insertLinesInTransaction(client, request.id, dto.lines);
            }

            await client.query('COMMIT');
            return request;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findRequestById(id: string): Promise<WfRequestWithDetails | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT r.*,
                    u.name       AS requester_name,
                    u.email      AS requester_email,
                    d.name       AS definition_name
             FROM   wf_requests r
             LEFT JOIN users           u ON u.id = r.requester_id
             LEFT JOIN wf_definitions  d ON d.id = r.definition_id
             WHERE  r.id = $1`,
            [id]
        );
        if (!rows.length) return null;
        const request = mapRequestWithDetails(rows[0]);
        request.lines = await this.findLinesByRequest(id);
        return request;
    }

    async listRequests(params: WfRequestListParams): Promise<WfPaginatedResult<WfRequestWithDetails>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(100, params.limit ?? 20);
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        if (params.requesterId) { conditions.push(`r.requester_id = $${idx++}`); values.push(params.requesterId); }
        if (params.status) { conditions.push(`r.status = $${idx++}`); values.push(params.status); }
        if (params.requestType) { conditions.push(`r.request_type = $${idx++}`); values.push(params.requestType); }
        if (params.priority) { conditions.push(`r.priority = $${idx++}`); values.push(params.priority); }
        if (params.search) { conditions.push(`r.title ILIKE $${idx++}`); values.push(`%${params.search}%`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await this.db.query<{ total: string }>(
            `SELECT COUNT(*) AS total FROM wf_requests r ${where}`,
            values
        );
        const total = Number(countRes.rows[0].total);

        const dataValues = [...values, limit, offset];
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT r.*,
                    u.name       AS requester_name,
                    u.email      AS requester_email,
                    d.name       AS definition_name
             FROM   wf_requests r
             LEFT JOIN users           u ON u.id = r.requester_id
             LEFT JOIN wf_definitions  d ON d.id = r.definition_id
             ${where}
             ORDER BY r.created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            dataValues
        );

        return { data: rows.map(mapRequestWithDetails), meta: { total, page, limit } };
    }

    async updateRequestStatus(
        id: string,
        status: WfRequestStatus,
        extra: Partial<{ currentStepNo: number | null; submittedAt: Date; closedAt: Date; definitionId: string }> = {}
    ): Promise<WfRequest | null> {
        const sets: string[] = ['status = $2', 'updated_at = now()'];
        const vals: unknown[] = [id, status];
        let idx = 3;

        if (extra.currentStepNo !== undefined) { sets.push(`current_step_no = $${idx++}`); vals.push(extra.currentStepNo); }
        if (extra.submittedAt) { sets.push(`submitted_at = $${idx++}`); vals.push(extra.submittedAt); }
        if (extra.closedAt) { sets.push(`closed_at = $${idx++}`); vals.push(extra.closedAt); }
        if (extra.definitionId) { sets.push(`definition_id = $${idx++}`); vals.push(extra.definitionId); }

        const { rows } = await this.db.query<Record<string, unknown>>(
            `UPDATE wf_requests SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
            vals
        );
        return rows.length ? mapRequest(rows[0]) : null;
    }

    async updateRequestPayload(id: string, payload: Record<string, unknown>): Promise<void> {
        await this.db.query(
            `UPDATE wf_requests SET payload = $2, updated_at = now() WHERE id = $1`,
            [id, JSON.stringify(payload)]
        );
    }

    // ---- Approvals ----

    async createApproval(data: {
        requestId: string;
        stepId: string;
        stepNo: number;
        assigneeUserId?: string | null;
        assigneeGroupId?: string | null;
        dueAt?: Date | null;
    }): Promise<WfApproval> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `INSERT INTO wf_approvals
               (request_id, step_id, step_no, assignee_user_id, assignee_group_id, status, due_at)
             VALUES ($1,$2,$3,$4,$5,'pending',$6)
             RETURNING *`,
            [
                data.requestId,
                data.stepId,
                data.stepNo,
                data.assigneeUserId ?? null,
                data.assigneeGroupId ?? null,
                data.dueAt ?? null,
            ]
        );
        return mapApproval(rows[0]);
    }

    async findApprovalById(id: string): Promise<WfApprovalWithDetails | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT a.*,
                    s.name        AS step_name,
                    u.name        AS assignee_name,
                    d.name        AS decision_by_name
             FROM   wf_approvals a
             LEFT JOIN wf_steps  s ON s.id = a.step_id
             LEFT JOIN users     u ON u.id = a.assignee_user_id
             LEFT JOIN users     d ON d.id = a.decision_by
             WHERE a.id = $1`,
            [id]
        );
        return rows.length ? mapApprovalWithDetails(rows[0]) : null;
    }

    async findPendingApprovalsByRequest(requestId: string): Promise<WfApproval[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_approvals
             WHERE request_id = $1 AND status = 'pending'
             ORDER BY step_no ASC`,
            [requestId]
        );
        return rows.map(mapApproval);
    }

    async findApprovalsByRequest(requestId: string): Promise<WfApprovalWithDetails[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT a.*,
                    s.name        AS step_name,
                    u.name        AS assignee_name,
                    d.name        AS decision_by_name
             FROM   wf_approvals a
             LEFT JOIN wf_steps  s ON s.id = a.step_id
             LEFT JOIN users     u ON u.id = a.assignee_user_id
             LEFT JOIN users     d ON d.id = a.decision_by
             WHERE a.request_id = $1
             ORDER BY a.step_no ASC, a.created_at ASC`,
            [requestId]
        );
        return rows.map(mapApprovalWithDetails);
    }

    async listInboxApprovals(
        assigneeId: string,
        page = 1,
        limit = 20,
        viewAll = false
    ): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequest }>> {
        const offset = (page - 1) * limit;
        const assigneeCond = `($1::boolean = true OR a.assignee_user_id = $2)`;

        const countRes = await this.db.query<{ total: string }>(
            `SELECT COUNT(*) AS total
             FROM   wf_approvals a
             WHERE  ${assigneeCond} AND a.status = 'pending'`,
            [viewAll, assigneeId]
        );
        const total = Number(countRes.rows[0].total);

        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT a.*,
                    s.name        AS step_name,
                    u.name        AS assignee_name,
                    d.name        AS decision_by_name,
                    r.id          AS req_id,
                    r.code        AS req_code,
                    r.title       AS req_title,
                    r.request_type AS req_request_type,
                    r.priority    AS req_priority,
                    r.status      AS req_status,
                    r.requester_id AS req_requester_id,
                    r.requester_ou_id AS req_requester_ou_id,
                    r.definition_id AS req_definition_id,
                    r.current_step_no AS req_current_step_no,
                    r.due_at      AS req_due_at,
                    r.payload     AS req_payload,
                    r.submitted_at AS req_submitted_at,
                    r.closed_at   AS req_closed_at,
                    r.created_at  AS req_created_at,
                    r.updated_at  AS req_updated_at,
                    ru.name       AS req_requester_name,
                    ru.email      AS req_requester_email
             FROM   wf_approvals a
             JOIN   wf_requests  r ON r.id = a.request_id
             JOIN   users        ru ON ru.id = r.requester_id
             LEFT JOIN wf_steps  s ON s.id = a.step_id
             LEFT JOIN users     u ON u.id = a.assignee_user_id
             LEFT JOIN users     d ON d.id = a.decision_by
             WHERE  ${assigneeCond} AND a.status = 'pending'
             ORDER BY r.created_at DESC
             LIMIT $3 OFFSET $4`,
            [viewAll, assigneeId, limit, offset]
        );

        const data = rows.map(r => ({
            ...mapApprovalWithDetails(r),
            request: this._mapNestedRequest(r),
        }));

        return { data, meta: { total, page, limit } };
    }

    async updateApprovalDecision(
        id: string,
        status: WfApprovalStatus,
        actorId: string,
        comment?: string
    ): Promise<WfApproval | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `UPDATE wf_approvals
             SET status = $2, decision_at = now(), decision_by = $3,
                 comment = $4, version = version + 1, updated_at = now()
             WHERE id = $1 AND status = 'pending'
             RETURNING *`,
            [id, status, actorId, comment ?? null]
        );
        return rows.length ? mapApproval(rows[0]) : null;
    }

    async findPendingApprovalsByRequestAndStep(
        requestId: string,
        stepNo: number
    ): Promise<WfApproval[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_approvals
             WHERE request_id = $1 AND step_no = $2 AND status = 'pending'
             ORDER BY created_at ASC`,
            [requestId, stepNo]
        );
        return rows.map(mapApproval);
    }

    async skipPendingApprovalsInStep(
        requestId: string,
        stepNo: number
    ): Promise<number> {
        const { rowCount } = await this.db.query(
            `UPDATE wf_approvals
             SET status = 'skipped', version = version + 1, updated_at = now()
             WHERE request_id = $1 AND step_no = $2 AND status = 'pending'`,
            [requestId, stepNo]
        );
        return rowCount || 0;
    }

    async updateApprovalAssignee(
        id: string,
        toUserId: string
    ): Promise<WfApproval | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `UPDATE wf_approvals
             SET assignee_user_id = $2, version = version + 1, updated_at = now()
             WHERE id = $1 AND status = 'pending'
             RETURNING *`,
            [id, toUserId]
        );
        return rows.length ? mapApproval(rows[0]) : null;
    }

    async claimApproval(id: string, userId: string): Promise<WfApproval | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `UPDATE wf_approvals
             SET assignee_user_id = $2, version = version + 1, updated_at = now()
             WHERE id = $1 AND status = 'pending' AND assignee_user_id IS NULL
             RETURNING *`,
            [id, userId]
        );
        return rows.length ? mapApproval(rows[0]) : null;
    }

    async listUnassignedApprovals(
        page = 1,
        limit = 20
    ): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequest }>> {
        const offset = (page - 1) * limit;

        const countRes = await this.db.query<{ total: string }>(
            `SELECT COUNT(*) AS total
             FROM   wf_approvals a
             WHERE  a.assignee_user_id IS NULL AND a.status = 'pending'`
        );
        const total = Number(countRes.rows[0].total);

        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT a.*,
                    s.name        AS step_name,
                    NULL::text    AS assignee_name,
                    NULL::text    AS decision_by_name,
                    r.id          AS req_id,
                    r.code        AS req_code,
                    r.title       AS req_title,
                    r.request_type AS req_request_type,
                    r.priority    AS req_priority,
                    r.status      AS req_status,
                    r.requester_id AS req_requester_id,
                    r.requester_ou_id AS req_requester_ou_id,
                    r.definition_id AS req_definition_id,
                    r.current_step_no AS req_current_step_no,
                    r.due_at      AS req_due_at,
                    r.payload     AS req_payload,
                    r.submitted_at AS req_submitted_at,
                    r.closed_at   AS req_closed_at,
                    r.created_at  AS req_created_at,
                    r.updated_at  AS req_updated_at,
                    ru.name       AS req_requester_name,
                    ru.email      AS req_requester_email
             FROM   wf_approvals a
             JOIN   wf_requests  r ON r.id = a.request_id
             JOIN   users        ru ON ru.id = r.requester_id
             LEFT JOIN wf_steps  s ON s.id = a.step_id
             WHERE  a.assignee_user_id IS NULL AND a.status = 'pending'
             ORDER BY r.priority DESC, r.created_at ASC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const data = rows.map(r => ({
            ...mapApprovalWithDetails(r),
            request: this._mapNestedRequest(r),
        }));
        return { data, meta: { total, page, limit } };
    }

    async cancelPendingApprovals(requestId: string): Promise<void> {
        await this.db.query(
            `UPDATE wf_approvals SET status = 'cancelled', updated_at = now()
             WHERE request_id = $1 AND status = 'pending'`,
            [requestId]
        );
    }

    async getInboxSummary(assigneeId: string, viewAll = false): Promise<InboxSummary> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT
               COUNT(*) FILTER (WHERE a.status = 'pending'
                                  AND ($1::boolean = true OR a.assignee_user_id = $2)) AS pending_count,
               COUNT(*) FILTER (WHERE a.status = 'pending'
                                  AND ($1::boolean = true OR a.assignee_user_id = $2)
                                  AND r.priority = 'urgent')                           AS urgent_count,
               COUNT(*) FILTER (WHERE a.status = 'pending'
                                  AND ($1::boolean = true OR a.assignee_user_id = $2)
                                  AND a.due_at < now())                                AS overdue_count,
               COUNT(*) FILTER (WHERE a.status = 'pending' AND a.assignee_user_id IS NULL) AS unassigned_count
             FROM wf_approvals a
             JOIN wf_requests  r ON r.id = a.request_id`,
            [viewAll, assigneeId]
        );
        const row = rows[0] ?? {};
        return {
            pendingCount: Number(row.pending_count ?? 0),
            urgentCount: Number(row.urgent_count ?? 0),
            overdueCount: Number(row.overdue_count ?? 0),
            unassignedCount: Number(row.unassigned_count ?? 0),
        };
    }

    // ---- Definitions & Steps ----

    async findDefinitionByType(requestType: string): Promise<(WfDefinition & { steps: WfStep[] }) | null> {
        const defRes = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_definitions
             WHERE request_type = $1 AND is_active = TRUE
             ORDER BY version DESC LIMIT 1`,
            [requestType]
        );
        if (!defRes.rows.length) return null;
        const def = mapDefinition(defRes.rows[0]);
        const stepsRes = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_steps WHERE definition_id = $1 ORDER BY step_no ASC`,
            [def.id]
        );
        return { ...def, steps: stepsRes.rows.map(mapStep) };
    }

    async findStepByDefAndNo(definitionId: string, stepNo: number): Promise<WfStep | null> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_steps WHERE definition_id = $1 AND step_no = $2`,
            [definitionId, stepNo]
        );
        return rows.length ? mapStep(rows[0]) : null;
    }

    async listDefinitions(): Promise<WfDefinition[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT * FROM wf_definitions ORDER BY request_type, version DESC`
        );
        return rows.map(mapDefinition);
    }

    async createDefinitionWithSteps(dto: CreateWfDefinitionDto): Promise<WfDefinition & { steps: WfStep[] }> {
        const client = await this.db.getClient();
        try {
            await client.query('BEGIN');
            const defRes = await client.query<Record<string, unknown>>(
                `INSERT INTO wf_definitions (key, name, request_type, version, is_active)
                 VALUES ($1,$2,$3,$4,TRUE)
                 RETURNING *`,
                [dto.key, dto.name, dto.requestType, dto.version ?? 1]
            );
            const def = mapDefinition(defRes.rows[0]);
            const steps: WfStep[] = [];
            for (const s of dto.steps) {
                const sRes = await client.query<Record<string, unknown>>(
                    `INSERT INTO wf_steps (definition_id, step_no, name, approver_rule, on_approve, on_reject)
                     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                    [
                        def.id, s.stepNo, s.name,
                        JSON.stringify(s.approverRule),
                        JSON.stringify(s.onApprove ?? {}),
                        JSON.stringify(s.onReject ?? { cancel: true }),
                    ]
                );
                steps.push(mapStep(sRes.rows[0]));
            }
            await client.query('COMMIT');
            return { ...def, steps };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ---- Events ----

    async appendEvent(data: {
        requestId: string;
        eventType: WfEventType;
        actorId?: string | null;
        meta?: Record<string, unknown>;
    }): Promise<WfEvent> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `INSERT INTO wf_events (request_id, event_type, actor_id, meta)
             VALUES ($1,$2,$3,$4)
             RETURNING *`,
            [data.requestId, data.eventType, data.actorId ?? null, JSON.stringify(data.meta ?? {})]
        );
        return mapEvent(rows[0]);
    }

    async listEvents(requestId: string): Promise<WfEvent[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT e.*, u.name AS actor_name
             FROM   wf_events e
             LEFT JOIN users u ON u.id = e.actor_id
             WHERE  e.request_id = $1
             ORDER BY e.created_at ASC`,
            [requestId]
        );
        return rows.map(mapEvent);
    }

    // ---- Attachments ----

    async addAttachment(data: {
        requestId: string;
        fileKey: string;
        filename: string;
        size?: number;
        mime?: string;
        uploadedBy?: string;
    }): Promise<WfAttachment> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `INSERT INTO wf_attachments (request_id, file_key, filename, size, mime, uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [data.requestId, data.fileKey, data.filename, data.size ?? null, data.mime ?? null, data.uploadedBy ?? null]
        );
        const r = rows[0];
        return {
            id: r.id as string,
            requestId: r.request_id as string,
            fileKey: r.file_key as string,
            filename: r.filename as string,
            size: r.size != null ? Number(r.size) : null,
            mime: r.mime as string | null,
            uploadedBy: r.uploaded_by as string | null,
            createdAt: r.created_at as Date,
        };
    }

    // ---- Lines ----

    async findLinesByRequest(requestId: string): Promise<WfRequestLine[]> {
        const { rows } = await this.db.query<Record<string, unknown>>(
            `SELECT l.*,
                    sp.part_code  AS part_code,
                    sp.name       AS part_name,
                    a.asset_code  AS asset_code,
                    am.model      AS asset_name
             FROM   wf_request_lines l
             LEFT JOIN spare_parts  sp ON sp.id = l.part_id
             LEFT JOIN assets       a  ON a.id  = l.asset_id
             LEFT JOIN asset_models am ON am.id = a.model_id
             WHERE  l.request_id = $1
             ORDER BY l.line_no ASC`,
            [requestId]
        );
        return rows.map(mapLine);
    }

    async updateLineStatus(
        lineId: string,
        status: WfRequestLine['status'],
        fulfilledQty?: number
    ): Promise<WfRequestLine | null> {
        const sets = ['status = $2', 'updated_at = now()'];
        const vals: unknown[] = [lineId, status];
        if (fulfilledQty !== undefined) {
            sets.push(`fulfilled_qty = $${vals.length + 1}`);
            vals.push(fulfilledQty);
        }
        const { rows } = await this.db.query<Record<string, unknown>>(
            `UPDATE wf_request_lines SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
            vals
        );
        return rows.length ? mapLine(rows[0]) : null;
    }

    // ---- Helpers ----

    private async nextCode(): Promise<string> {
        const { rows } = await this.db.query<{ nextval: string }>(
            `SELECT nextval('wf_request_seq') AS nextval`
        );
        const seq = String(rows[0].nextval).padStart(6, '0');
        const year = new Date().getFullYear();
        return `REQ-${year}-${seq}`;
    }

    private _mapNestedRequest(r: Record<string, unknown>): WfRequestWithDetails {
        return {
            id: r.req_id as string,
            code: r.req_code as string,
            title: r.req_title as string,
            requestType: r.req_request_type as WfRequest['requestType'],
            priority: r.req_priority as WfRequest['priority'],
            status: r.req_status as WfRequest['status'],
            requesterId: r.req_requester_id as string,
            requesterOuId: r.req_requester_ou_id as string | null,
            definitionId: r.req_definition_id as string | null,
            currentStepNo: r.req_current_step_no != null ? Number(r.req_current_step_no) : null,
            dueAt: r.req_due_at as Date | null,
            payload: (r.req_payload ?? {}) as Record<string, unknown>,
            submittedAt: r.req_submitted_at as Date | null,
            closedAt: r.req_closed_at as Date | null,
            createdAt: r.req_created_at as Date,
            updatedAt: r.req_updated_at as Date,
            requesterName: r.req_requester_name as string | null,
            requesterEmail: r.req_requester_email as string | null,
            definitionName: null,
        };
    }

    private async insertLinesInTransaction(
        client: PoolClient,
        requestId: string,
        lines: CreateWfRequestLineDto[]
    ): Promise<void> {
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            await client.query(
                `INSERT INTO wf_request_lines
                   (request_id, line_no, item_type, asset_id, part_id,
                    requested_qty, unit_cost, note, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    requestId,
                    l.lineNo ?? (i + 1),
                    l.itemType,
                    l.assetId ?? null,
                    l.partId ?? null,
                    l.requestedQty,
                    l.unitCost ?? null,
                    l.note ?? null,
                    JSON.stringify(l.metadata ?? {}),
                ]
            );
        }
    }
}
