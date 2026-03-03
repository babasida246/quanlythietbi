import type { IReminderRepo, ReminderFilters, ReminderPage, ReminderRecord, ReminderUpsertInput } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface ReminderRow {
    id: string
    reminder_type: ReminderRecord['reminderType']
    asset_id: string | null
    due_at: Date
    status: ReminderRecord['status']
    channel: string
    created_at: Date
    sent_at: Date | null
    correlation_id: string | null
}

function mapReminderRow(row: ReminderRow): ReminderRecord {
    return {
        id: row.id,
        reminderType: row.reminder_type,
        assetId: row.asset_id,
        dueAt: row.due_at,
        status: row.status,
        channel: row.channel,
        createdAt: row.created_at,
        sentAt: row.sent_at,
        correlationId: row.correlation_id
    }
}

function normalizePagination(filters: ReminderFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class ReminderRepo implements IReminderRepo {
    constructor(private pg: PgClient) { }

    async upsert(input: ReminderUpsertInput): Promise<ReminderRecord> {
        return await this.pg.transaction(async (client) => {
            const existing = await client.query<{ id: string }>(
                `SELECT id FROM reminders WHERE reminder_type = $1 AND asset_id = $2 AND due_at = $3`,
                [input.reminderType, input.assetId, input.dueAt]
            )

            if (existing.rows.length > 0) {
                const id = existing.rows[0]?.id as string
                const result = await client.query<ReminderRow>(
                    `UPDATE reminders
                     SET status = $1,
                         channel = $2,
                         correlation_id = $3
                     WHERE id = $4
                     RETURNING *`,
                    [
                        input.status ?? 'pending',
                        input.channel ?? 'ui',
                        input.correlationId ?? null,
                        id
                    ]
                )
                return mapReminderRow(result.rows[0])
            }

            const insertResult = await client.query<ReminderRow>(
                `INSERT INTO reminders (
                    reminder_type,
                    asset_id,
                    due_at,
                    status,
                    channel,
                    correlation_id
                ) VALUES ($1,$2,$3,$4,$5,$6)
                RETURNING *`,
                [
                    input.reminderType,
                    input.assetId,
                    input.dueAt,
                    input.status ?? 'pending',
                    input.channel ?? 'ui',
                    input.correlationId ?? null
                ]
            )
            return mapReminderRow(insertResult.rows[0])
        })
    }

    async list(filters: ReminderFilters): Promise<ReminderPage> {
        const params: unknown[] = []
        const conditions: string[] = []
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.reminderType) {
            params.push(filters.reminderType)
            conditions.push(`reminder_type = $${params.length}`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM reminders ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const listResult = await this.pg.query<ReminderRow>(
            `SELECT * FROM reminders
             ${whereClause}
             ORDER BY due_at ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: listResult.rows.map(mapReminderRow),
            total,
            page,
            limit
        }
    }

    async listPending(limit: number): Promise<ReminderRecord[]> {
        const result = await this.pg.query<ReminderRow>(
            `SELECT * FROM reminders
             WHERE status = 'pending'
             ORDER BY due_at ASC
             LIMIT $1`,
            [limit]
        )
        return result.rows.map(mapReminderRow)
    }

    async markSent(id: string, sentAt: Date): Promise<ReminderRecord | null> {
        const result = await this.pg.query<ReminderRow>(
            `UPDATE reminders
             SET status = 'sent',
                 sent_at = $1
             WHERE id = $2
             RETURNING *`,
            [sentAt, id]
        )
        if (result.rows.length === 0) return null
        return mapReminderRow(result.rows[0])
    }
}
