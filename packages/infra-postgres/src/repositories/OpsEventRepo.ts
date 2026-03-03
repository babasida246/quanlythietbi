import type { PoolClient } from 'pg'
import type { IOpsEventRepo, OpsEventInput, OpsEventRecord, OpsEntityType } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import type { Queryable } from './types.js'

type OpsRow = {
    id: string
    entity_type: OpsEntityType
    entity_id: string
    event_type: string
    payload: Record<string, unknown>
    actor_user_id: string | null
    correlation_id: string | null
    created_at: Date
}

const mapOps = (row: OpsRow): OpsEventRecord => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    eventType: row.event_type,
    payload: row.payload ?? {},
    actorUserId: row.actor_user_id,
    correlationId: row.correlation_id,
    createdAt: row.created_at
})

export class OpsEventRepo implements IOpsEventRepo {
    constructor(private pg: Queryable) { }

    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        const result = await this.pg.query<OpsRow>(
            `INSERT INTO ops_events (entity_type, entity_id, event_type, payload, actor_user_id, correlation_id)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id, entity_type, entity_id, event_type, payload, actor_user_id, correlation_id, created_at`,
            [
                event.entityType,
                event.entityId,
                event.eventType,
                event.payload ?? {},
                event.actorUserId ?? null,
                event.correlationId ?? null
            ]
        )
        return mapOps(result.rows[0])
    }

    async listByEntity(entityType: OpsEntityType, entityId: string, limit: number): Promise<OpsEventRecord[]> {
        const result = await this.pg.query<OpsRow>(
            `SELECT id, entity_type, entity_id, event_type, payload, actor_user_id, correlation_id, created_at
             FROM ops_events
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY created_at DESC
             LIMIT $3`,
            [entityType, entityId, limit]
        )
        return result.rows.map(mapOps)
    }

    async list(): Promise<OpsEventRecord[]> {
        const result = await this.pg.query<OpsRow>(
            `SELECT id, entity_type, entity_id, event_type, payload, actor_user_id, correlation_id, created_at
             FROM ops_events
             ORDER BY created_at DESC
             LIMIT 1000`
        )
        return result.rows.map(mapOps)
    }
}
