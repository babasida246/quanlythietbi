import type {
    FieldApprovalRequest,
    FieldAuditEvent,
    FieldNote,
    FieldPlaybookRun,
    FieldQuickCheckSnapshot,
    FieldSnippet,
    FieldSnapshot,
    FieldVendor,
} from '@qltb/contracts'
import type { Queryable } from './types.js'

function toCamelCase<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        result[camelKey] = row[key]
    }
    return result as T
}

export class FieldKitRepo {
    constructor(private readonly db: Queryable) { }

    async createQuickCheck(snapshot: Omit<FieldQuickCheckSnapshot, 'id' | 'createdAt'>): Promise<FieldQuickCheckSnapshot> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_quick_checks (
                device_id, ticket_id, vendor, overall_status, items
            ) VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING *`,
            [
                snapshot.deviceId,
                snapshot.ticketId,
                snapshot.vendor,
                snapshot.overallStatus,
                JSON.stringify(snapshot.items)
            ]
        )
        return toCamelCase<FieldQuickCheckSnapshot>(result.rows[0] as unknown as Record<string, unknown>)
    }

    async listQuickChecks(deviceId: string): Promise<FieldQuickCheckSnapshot[]> {
        const result = await this.db.query(
            `SELECT *
             FROM fieldkit_quick_checks
             WHERE device_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [deviceId]
        )
        return result.rows.map((row) => toCamelCase<FieldQuickCheckSnapshot>(row as unknown as Record<string, unknown>))
    }

    async createPlaybook(run: Omit<FieldPlaybookRun, 'id' | 'createdAt'>): Promise<FieldPlaybookRun> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_playbooks (
                device_id, vendor, scenario, steps
            ) VALUES ($1, $2, $3, $4::jsonb)
            RETURNING *`,
            [run.deviceId, run.vendor, run.scenario, JSON.stringify(run.steps)]
        )
        return toCamelCase<FieldPlaybookRun>(result.rows[0] as unknown as Record<string, unknown>)
    }

    async listPlaybooks(deviceId: string): Promise<FieldPlaybookRun[]> {
        const result = await this.db.query(
            `SELECT *
             FROM fieldkit_playbooks
             WHERE device_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [deviceId]
        )
        return result.rows.map((row) => toCamelCase<FieldPlaybookRun>(row as unknown as Record<string, unknown>))
    }

    async listSnippets(vendor?: FieldVendor | 'any'): Promise<FieldSnippet[]> {
        const result = vendor && vendor !== 'any'
            ? await this.db.query(
                `SELECT *
                 FROM fieldkit_snippets
                 WHERE vendor = $1 OR vendor = 'any'
                 ORDER BY risk DESC, title ASC`,
                [vendor]
            )
            : await this.db.query(
                `SELECT *
                 FROM fieldkit_snippets
                 ORDER BY risk DESC, title ASC`
            )

        return result.rows.map((row) => toCamelCase<FieldSnippet>(row as unknown as Record<string, unknown>))
    }

    async createSnapshot(snapshot: Omit<FieldSnapshot, 'id' | 'createdAt'>): Promise<FieldSnapshot> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_snapshots (
                device_id, quick_check_id, summary, notes, ticket_id, visualizer
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING *`,
            [
                snapshot.deviceId,
                snapshot.quickCheckId || null,
                snapshot.summary,
                snapshot.notes || null,
                snapshot.ticketId,
                JSON.stringify(snapshot.visualizer || null)
            ]
        )
        return toCamelCase<FieldSnapshot>(result.rows[0] as unknown as Record<string, unknown>)
    }

    async listSnapshots(deviceId: string): Promise<FieldSnapshot[]> {
        const result = await this.db.query(
            `SELECT *
             FROM fieldkit_snapshots
             WHERE device_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [deviceId]
        )
        return result.rows.map((row) => toCamelCase<FieldSnapshot>(row as unknown as Record<string, unknown>))
    }

    async createNote(note: Omit<FieldNote, 'id' | 'createdAt'>): Promise<FieldNote> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_notes (
                device_id, author, message, attachments, ticket_id
            ) VALUES ($1, $2, $3, $4::jsonb, $5)
            RETURNING *`,
            [note.deviceId, note.author, note.message, JSON.stringify(note.attachments), note.ticketId]
        )
        return toCamelCase<FieldNote>(result.rows[0] as unknown as Record<string, unknown>)
    }

    async listNotes(deviceId: string): Promise<FieldNote[]> {
        const result = await this.db.query(
            `SELECT *
             FROM fieldkit_notes
             WHERE device_id = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [deviceId]
        )
        return result.rows.map((row) => toCamelCase<FieldNote>(row as unknown as Record<string, unknown>))
    }

    async createApproval(request: Omit<FieldApprovalRequest, 'id' | 'createdAt' | 'status'>): Promise<FieldApprovalRequest> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_approvals (
                device_id, requested_by, reason, status, ticket_id
            ) VALUES ($1, $2, $3, 'pending', $4)
            RETURNING *`,
            [request.deviceId, request.requestedBy, request.reason, request.ticketId]
        )
        return toCamelCase<FieldApprovalRequest>(result.rows[0] as unknown as Record<string, unknown>)
    }

    async listApprovals(deviceId: string): Promise<FieldApprovalRequest[]> {
        const result = await this.db.query(
            `SELECT *
             FROM fieldkit_approvals
             WHERE device_id = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [deviceId]
        )
        return result.rows.map((row) => toCamelCase<FieldApprovalRequest>(row as unknown as Record<string, unknown>))
    }

    async createAuditEvent(event: Omit<FieldAuditEvent, 'id' | 'createdAt'>): Promise<FieldAuditEvent> {
        const result = await this.db.query(
            `INSERT INTO fieldkit_audit_events (
                device_id, actor, event_type, detail, ticket_id
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, device_id, actor, event_type AS type, detail, ticket_id, created_at`,
            [event.deviceId, event.actor, event.type, event.detail, event.ticketId || null]
        )
        return toCamelCase<FieldAuditEvent>(result.rows[0] as unknown as Record<string, unknown>)
    }
}
