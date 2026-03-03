import type { AssetEventInput, AssetEventPage, AssetEventRecord, IAssetEventRepo } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface AssetEventRow {
    id: string
    asset_id: string
    event_type: AssetEventRecord['eventType']
    payload: Record<string, unknown> | null
    actor_user_id: string | null
    correlation_id: string | null
    created_at: Date
}

function mapEventRow(row: AssetEventRow): AssetEventRecord {
    return {
        id: row.id,
        assetId: row.asset_id,
        eventType: row.event_type,
        payload: row.payload ?? {},
        actorUserId: row.actor_user_id,
        correlationId: row.correlation_id,
        createdAt: row.created_at
    }
}

export class AssetEventRepo implements IAssetEventRepo {
    constructor(private pg: PgClient) { }

    async append(event: AssetEventInput): Promise<AssetEventRecord> {
        const result = await this.pg.query<AssetEventRow>(
            `INSERT INTO asset_events (
                asset_id,
                event_type,
                payload,
                actor_user_id,
                correlation_id
            ) VALUES ($1,$2,$3,$4,$5)
            RETURNING *`,
            [
                event.assetId,
                event.eventType,
                event.payload ?? {},
                event.actorUserId ?? null,
                event.correlationId ?? null
            ]
        )

        return mapEventRow({
            ...result.rows[0],
            payload: event.payload ?? {}
        })
    }

    async listByAsset(assetId: string, page: number, limit: number): Promise<AssetEventPage> {
        const safePage = Math.max(1, page)
        const safeLimit = Math.min(Math.max(1, limit), 100)
        const offset = (safePage - 1) * safeLimit

        const result = await this.pg.query<AssetEventRow>(
            `SELECT * FROM asset_events
             WHERE asset_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [assetId, safeLimit, offset]
        )

        return {
            items: result.rows.map(mapEventRow),
            page: safePage,
            limit: safeLimit
        }
    }
}
