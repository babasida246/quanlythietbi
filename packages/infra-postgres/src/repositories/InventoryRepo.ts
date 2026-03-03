import type {
    IInventoryRepo,
    InventoryItemRecord,
    InventoryScanInput,
    InventorySessionInput,
    InventorySessionListFilters,
    InventorySessionPage,
    InventorySessionRecord
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface SessionRow {
    id: string
    name: string
    location_id: string | null
    status: InventorySessionRecord['status']
    started_at: Date | null
    closed_at: Date | null
    created_by: string | null
    correlation_id: string | null
    created_at: Date
}

interface ItemRow {
    id: string
    session_id: string
    asset_id: string | null
    expected_location_id: string | null
    scanned_location_id: string | null
    scanned_at: Date | null
    status: InventoryItemRecord['status']
    note: string | null
}

function mapSessionRow(row: SessionRow): InventorySessionRecord {
    return {
        id: row.id,
        name: row.name,
        locationId: row.location_id,
        status: row.status,
        startedAt: row.started_at,
        closedAt: row.closed_at,
        createdBy: row.created_by,
        correlationId: row.correlation_id,
        createdAt: row.created_at
    }
}

function mapItemRow(row: ItemRow): InventoryItemRecord {
    return {
        id: row.id,
        sessionId: row.session_id,
        assetId: row.asset_id,
        expectedLocationId: row.expected_location_id,
        scannedLocationId: row.scanned_location_id,
        scannedAt: row.scanned_at,
        status: row.status,
        note: row.note
    }
}

function normalizePagination(filters: InventorySessionListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class InventoryRepo implements IInventoryRepo {
    constructor(private pg: PgClient) { }

    async createSession(input: InventorySessionInput): Promise<InventorySessionRecord> {
        const result = await this.pg.query<SessionRow>(
            `INSERT INTO inventory_sessions (
                name,
                location_id,
                status,
                started_at,
                created_by,
                correlation_id
            ) VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *`,
            [
                input.name,
                input.locationId ?? null,
                input.status ?? 'draft',
                input.startedAt ?? null,
                input.createdBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapSessionRow(result.rows[0])
    }

    async addScan(input: InventoryScanInput): Promise<InventoryItemRecord> {
        const result = await this.pg.query<ItemRow>(
            `INSERT INTO inventory_items (
                session_id,
                asset_id,
                expected_location_id,
                scanned_location_id,
                scanned_at,
                status,
                note
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *`,
            [
                input.sessionId,
                input.assetId ?? null,
                input.expectedLocationId ?? null,
                input.scannedLocationId ?? null,
                input.scannedAt ?? null,
                input.status,
                input.note ?? null
            ]
        )
        return mapItemRow(result.rows[0])
    }

    async closeSession(sessionId: string, closedAt: Date): Promise<InventorySessionRecord | null> {
        const result = await this.pg.query<SessionRow>(
            `UPDATE inventory_sessions
             SET status = 'closed',
                 closed_at = $1
             WHERE id = $2
             RETURNING *`,
            [closedAt, sessionId]
        )
        if (result.rows.length === 0) return null
        return mapSessionRow(result.rows[0])
    }

    async startSession(sessionId: string, startedAt: Date): Promise<InventorySessionRecord | null> {
        const result = await this.pg.query<SessionRow>(
            `UPDATE inventory_sessions
             SET status = 'in_progress',
                 started_at = $1
             WHERE id = $2 AND status = 'draft'
             RETURNING *`,
            [startedAt, sessionId]
        )
        if (result.rows.length === 0) return null
        return mapSessionRow(result.rows[0])
    }

    async deleteItem(itemId: string): Promise<boolean> {
        const result = await this.pg.query<{ id: string }>(
            `DELETE FROM inventory_items WHERE id = $1 RETURNING id`,
            [itemId]
        )
        return result.rows.length > 0
    }

    async getSession(sessionId: string): Promise<InventorySessionRecord | null> {
        const result = await this.pg.query<SessionRow>(
            `SELECT * FROM inventory_sessions WHERE id = $1`,
            [sessionId]
        )
        if (result.rows.length === 0) return null
        return mapSessionRow(result.rows[0])
    }

    async listSessions(filters: InventorySessionListFilters): Promise<InventorySessionPage> {
        const params: unknown[] = []
        const conditions: string[] = []
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM inventory_sessions ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const listResult = await this.pg.query<SessionRow>(
            `SELECT * FROM inventory_sessions
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: listResult.rows.map(mapSessionRow),
            total,
            page,
            limit
        }
    }

    async listItems(sessionId: string): Promise<InventoryItemRecord[]> {
        const result = await this.pg.query<ItemRow>(
            `SELECT * FROM inventory_items
             WHERE session_id = $1
             ORDER BY scanned_at DESC NULLS LAST`,
            [sessionId]
        )
        return result.rows.map(mapItemRow)
    }
}
