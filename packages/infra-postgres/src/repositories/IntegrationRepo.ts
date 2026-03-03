/**
 * Integration Hub Repository
 * Connectors, sync rules, webhooks
 */
import type { PgClient } from '../PgClient.js'

export interface IntegrationConnector {
    id: string
    name: string
    provider: string
    config: Record<string, unknown>
    credentialsRef: string | null
    isActive: boolean
    healthStatus: string
    lastHealthCheck: Date | null
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
}

export interface SyncRule {
    id: string
    connectorId: string
    name: string
    direction: string
    entityType: string
    fieldMappings: unknown[]
    filterConditions: Record<string, unknown>
    scheduleCron: string | null
    isActive: boolean
    lastSyncAt: Date | null
    lastSyncStatus: string | null
    lastSyncCount: number
    createdAt: Date
    updatedAt: Date
}

export interface SyncLog {
    id: string
    syncRuleId: string
    direction: string
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsFailed: number
    errors: unknown[]
    startedAt: Date
    completedAt: Date | null
    status: string
}

export interface Webhook {
    id: string
    connectorId: string | null
    name: string
    url: string
    secret: string | null
    events: string[]
    isActive: boolean
    lastTriggeredAt: Date | null
    failureCount: number
    createdAt: Date
}

export class IntegrationConnectorRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<IntegrationConnector, 'id' | 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthCheck'>): Promise<IntegrationConnector> {
        const result = await this.pg.query(
            `INSERT INTO integration_connectors (name, provider, config, credentials_ref, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [input.name, input.provider, JSON.stringify(input.config), input.credentialsRef, input.isActive, input.createdBy]
        )
        return this.mapRow(result.rows[0])
    }

    async list(): Promise<IntegrationConnector[]> {
        const result = await this.pg.query(`SELECT * FROM integration_connectors ORDER BY name`)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getById(id: string): Promise<IntegrationConnector | null> {
        const result = await this.pg.query(`SELECT * FROM integration_connectors WHERE id = $1`, [id])
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async update(id: string, patch: Partial<Pick<IntegrationConnector, 'name' | 'config' | 'isActive' | 'healthStatus'>>): Promise<IntegrationConnector | null> {
        const sets: string[] = []
        const params: unknown[] = []
        let i = 1
        if (patch.name !== undefined) { sets.push(`name = $${i++}`); params.push(patch.name) }
        if (patch.config !== undefined) { sets.push(`config = $${i++}`); params.push(JSON.stringify(patch.config)) }
        if (patch.isActive !== undefined) { sets.push(`is_active = $${i++}`); params.push(patch.isActive) }
        if (patch.healthStatus !== undefined) { sets.push(`health_status = $${i++}`); params.push(patch.healthStatus); sets.push(`last_health_check = NOW()`) }
        if (sets.length === 0) return this.getById(id)
        sets.push(`updated_at = NOW()`)
        params.push(id)
        const result = await this.pg.query(
            `UPDATE integration_connectors SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM integration_connectors WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private mapRow(row: any): IntegrationConnector {
        return {
            id: row.id, name: row.name, provider: row.provider,
            config: row.config ?? {}, credentialsRef: row.credentials_ref,
            isActive: row.is_active, healthStatus: row.health_status ?? 'unknown',
            lastHealthCheck: row.last_health_check, createdBy: row.created_by,
            createdAt: row.created_at, updatedAt: row.updated_at
        }
    }
}

export class SyncRuleRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<SyncRule, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncAt' | 'lastSyncStatus' | 'lastSyncCount'>): Promise<SyncRule> {
        const result = await this.pg.query(
            `INSERT INTO integration_sync_rules (connector_id, name, direction, entity_type, field_mappings, filter_conditions, schedule_cron, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [input.connectorId, input.name, input.direction, input.entityType,
            JSON.stringify(input.fieldMappings), JSON.stringify(input.filterConditions),
            input.scheduleCron, input.isActive]
        )
        return this.mapRow(result.rows[0])
    }

    async listByConnector(connectorId: string): Promise<SyncRule[]> {
        const result = await this.pg.query(
            `SELECT * FROM integration_sync_rules WHERE connector_id = $1 ORDER BY name`, [connectorId]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM integration_sync_rules WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private mapRow(row: any): SyncRule {
        return {
            id: row.id, connectorId: row.connector_id, name: row.name,
            direction: row.direction, entityType: row.entity_type,
            fieldMappings: row.field_mappings ?? [], filterConditions: row.filter_conditions ?? {},
            scheduleCron: row.schedule_cron, isActive: row.is_active,
            lastSyncAt: row.last_sync_at, lastSyncStatus: row.last_sync_status,
            lastSyncCount: row.last_sync_count ?? 0,
            createdAt: row.created_at, updatedAt: row.updated_at
        }
    }
}

export class WebhookRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<Webhook, 'id' | 'createdAt' | 'lastTriggeredAt' | 'failureCount'>): Promise<Webhook> {
        const result = await this.pg.query(
            `INSERT INTO integration_webhooks (connector_id, name, url, secret, events, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [input.connectorId, input.name, input.url, input.secret, input.events, input.isActive]
        )
        return this.mapRow(result.rows[0])
    }

    async list(): Promise<Webhook[]> {
        const result = await this.pg.query(`SELECT * FROM integration_webhooks ORDER BY name`)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM integration_webhooks WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private mapRow(row: any): Webhook {
        return {
            id: row.id, connectorId: row.connector_id, name: row.name,
            url: row.url, secret: row.secret, events: row.events ?? [],
            isActive: row.is_active, lastTriggeredAt: row.last_triggered_at,
            failureCount: row.failure_count ?? 0, createdAt: row.created_at
        }
    }
}
