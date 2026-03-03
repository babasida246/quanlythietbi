import type {
    IMaintenanceRepo,
    MaintenanceTicketInput,
    MaintenanceTicketRecord,
    MaintenanceTicketStatusPatch
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface MaintenanceRow {
    id: string
    asset_id: string
    title: string
    severity: MaintenanceTicketRecord['severity']
    status: MaintenanceTicketRecord['status']
    opened_at: Date
    closed_at: Date | null
    diagnosis: string | null
    resolution: string | null
    created_by: string | null
    correlation_id: string | null
}

function mapMaintenanceRow(row: MaintenanceRow): MaintenanceTicketRecord {
    return {
        id: row.id,
        assetId: row.asset_id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        diagnosis: row.diagnosis,
        resolution: row.resolution,
        createdBy: row.created_by,
        correlationId: row.correlation_id
    }
}

function normalizePagination(page?: number, limit?: number): { page: number; limit: number; offset: number } {
    const safePage = Math.max(1, page ?? 1)
    const safeLimit = Math.min(Math.max(1, limit ?? 20), 100)
    return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit }
}

export class MaintenanceRepo implements IMaintenanceRepo {
    constructor(private pg: PgClient) { }

    async open(ticket: MaintenanceTicketInput): Promise<MaintenanceTicketRecord> {
        const result = await this.pg.query<MaintenanceRow>(
            `INSERT INTO maintenance_tickets (
                asset_id,
                title,
                severity,
                status,
                opened_at,
                closed_at,
                diagnosis,
                resolution,
                created_by,
                correlation_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *`,
            [
                ticket.assetId,
                ticket.title,
                ticket.severity,
                ticket.status ?? 'open',
                ticket.openedAt ?? new Date(),
                null,
                ticket.diagnosis ?? null,
                ticket.resolution ?? null,
                ticket.createdBy ?? null,
                ticket.correlationId ?? null
            ]
        )

        return mapMaintenanceRow(result.rows[0])
    }

    async updateStatus(
        ticketId: string,
        status: MaintenanceTicketRecord['status'],
        patch: MaintenanceTicketStatusPatch
    ): Promise<MaintenanceTicketRecord | null> {
        const result = await this.pg.query<MaintenanceRow>(
            `UPDATE maintenance_tickets
             SET status = $1,
                 closed_at = COALESCE($2, closed_at),
                 diagnosis = COALESCE($3, diagnosis),
                 resolution = COALESCE($4, resolution),
                 correlation_id = COALESCE($5, correlation_id)
             WHERE id = $6
             RETURNING *`,
            [
                status,
                patch.closedAt ?? null,
                patch.diagnosis ?? null,
                patch.resolution ?? null,
                patch.correlationId ?? null,
                ticketId
            ]
        )

        if (result.rows.length === 0) return null
        return mapMaintenanceRow(result.rows[0])
    }

    async list(filters: {
        assetId?: string
        status?: MaintenanceTicketRecord['status']
        page?: number
        limit?: number
    }): Promise<{ items: MaintenanceTicketRecord[]; total: number; page: number; limit: number }> {
        const conditions: string[] = []
        const params: unknown[] = []

        if (filters.assetId) {
            params.push(filters.assetId)
            conditions.push(`asset_id = $${params.length}`)
        }
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters.page, filters.limit)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM maintenance_tickets ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const dataParams = [...params, limit, offset]
        const dataResult = await this.pg.query<MaintenanceRow>(
            `SELECT * FROM maintenance_tickets
             ${whereClause}
             ORDER BY opened_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            dataParams
        )

        return {
            items: dataResult.rows.map(mapMaintenanceRow),
            total,
            page,
            limit
        }
    }

    async getById(ticketId: string): Promise<MaintenanceTicketRecord | null> {
        const result = await this.pg.query<MaintenanceRow>(
            `SELECT * FROM maintenance_tickets WHERE id = $1`,
            [ticketId]
        )
        if (result.rows.length === 0) return null
        return mapMaintenanceRow(result.rows[0])
    }
}
