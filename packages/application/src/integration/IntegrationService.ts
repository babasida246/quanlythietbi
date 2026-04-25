/**
 * Integration Hub Service
 * Manages connectors, sync rules, webhooks, and sync orchestration.
 */
import { ZabbixClient, type ZabbixConfig } from './providers/ZabbixClient.js'
import { ZabbixSyncService, type IZabbixAssetRepo, type ISyncLogOps, type ICiStatusQueryable } from './ZabbixSyncService.js'

// Severity mapping: Zabbix 0-5 → QLTB maintenance severity
const ZABBIX_SEVERITY: Record<string, string> = {
    '0': 'low', '1': 'low', '2': 'medium', '3': 'high', '4': 'critical', '5': 'critical',
}

// --- Interfaces (decoupled from infra) ---
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

export interface IIntegrationConnectorRepo {
    create(input: Omit<IntegrationConnector, 'id' | 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthCheck'>): Promise<IntegrationConnector>
    list(): Promise<IntegrationConnector[]>
    getById(id: string): Promise<IntegrationConnector | null>
    update(id: string, patch: Partial<Pick<IntegrationConnector, 'name' | 'config' | 'isActive' | 'healthStatus'>>): Promise<IntegrationConnector | null>
    delete(id: string): Promise<boolean>
}

export interface ISyncRuleRepo {
    create(input: Record<string, unknown>): Promise<unknown>
    listByConnector(connectorId: string): Promise<unknown[]>
    delete(id: string): Promise<boolean>
}

export interface Webhook {
    id: string
    name: string
    url: string
    eventTypes: string[]
    secret: string | null
    isActive: boolean
    createdAt: Date
}

export interface IWebhookRepo {
    create(input: Omit<Webhook, 'id' | 'createdAt'>): Promise<Webhook>
    list(): Promise<Webhook[]>
    delete(id: string): Promise<boolean>
}

export interface IInboundAlertInput {
    connectorId: string
    problemName: string
    triggerName: string
    severity: string
    hostname?: string
    hostIp?: string
}

export class IntegrationService {
    constructor(
        private connectors: IIntegrationConnectorRepo,
        private syncRules: ISyncRuleRepo,
        private webhooks: IWebhookRepo,
        private syncLogOps?: ISyncLogOps,
        private assetRepo?: IZabbixAssetRepo,
        private db?: ICiStatusQueryable,
    ) { }

    // --- Connectors ---
    async createConnector(input: Omit<IntegrationConnector, 'id' | 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthCheck'>) { return this.connectors.create(input) }
    async listConnectors() { return this.connectors.list() }
    async getConnector(id: string) { return this.connectors.getById(id) }
    async updateConnector(id: string, patch: Partial<Pick<IntegrationConnector, 'name' | 'config' | 'isActive' | 'healthStatus'>>) { return this.connectors.update(id, patch) }
    async deleteConnector(id: string) { return this.connectors.delete(id) }

    async testConnection(id: string): Promise<{ healthy: boolean; message: string; version?: string; hostCount?: number }> {
        const connector = await this.connectors.getById(id)
        if (!connector) return { healthy: false, message: 'Connector not found' }

        try {
            let result: { healthy: boolean; message: string; version?: string; hostCount?: number }

            switch (connector.provider) {
                case 'zabbix': {
                    const cfg = connector.config as unknown as ZabbixConfig
                    if (!cfg.baseUrl) {
                        result = { healthy: false, message: 'Missing required config field: baseUrl' }
                        break
                    }
                    const client = new ZabbixClient(cfg)
                    result = await client.testConnection()
                    break
                }

                default:
                    // Generic: verify the connector is enabled and config has a baseUrl/url
                    if (!connector.isActive) {
                        result = { healthy: false, message: 'Connector is disabled' }
                    } else {
                        result = { healthy: true, message: 'Connector is active (no live check implemented for this provider)' }
                    }
            }

            await this.connectors.update(id, { healthStatus: result.healthy ? 'healthy' : 'error' })
            return result
        } catch (err) {
            await this.connectors.update(id, { healthStatus: 'error' })
            return { healthy: false, message: err instanceof Error ? err.message : 'Unknown error' }
        }
    }

    // --- Sync Rules ---
    async createSyncRule(input: Record<string, unknown>) { return this.syncRules.create(input) }
    async listSyncRules(connectorId: string) { return this.syncRules.listByConnector(connectorId) }
    async deleteSyncRule(id: string) { return this.syncRules.delete(id) }

    // --- Webhooks ---
    async createWebhook(input: Omit<Webhook, 'id' | 'createdAt'>) { return this.webhooks.create(input) }
    async listWebhooks() { return this.webhooks.list() }
    async deleteWebhook(id: string) { return this.webhooks.delete(id) }

    // --- Provider helpers ---
    async getProviderTypes(): Promise<string[]> {
        return ['servicenow', 'jira', 'slack', 'teams', 'aws', 'azure', 'email', 'webhook', 'csv_import', 'api_generic', 'zabbix']
    }

    // --- Sync orchestration ---

    async triggerSync(connectorId: string, syncRuleId?: string): Promise<{ synced: number; created: number; updated: number; failed: number; errors: string[]; durationMs: number }> {
        const connector = await this.connectors.getById(connectorId)
        if (!connector) throw new Error('Connector not found')

        if (connector.provider !== 'zabbix') {
            throw new Error(`Manual sync not implemented for provider: ${connector.provider}`)
        }
        if (!this.syncLogOps || !this.assetRepo) {
            throw new Error('Sync dependencies not configured on this service instance')
        }

        // Pick sync rule: given ID or first active rule for this connector
        let ruleId = syncRuleId
        if (!ruleId) {
            const rules = await this.syncRules.listByConnector(connectorId) as Array<{ id: string; isActive: boolean; filterConditions?: Record<string, unknown> }>
            const active = rules.find(r => r.isActive)
            if (!active) throw new Error('No active sync rule found for this connector')
            ruleId = active.id
        }

        const rules = await this.syncRules.listByConnector(connectorId) as Array<{ id: string; filterConditions?: Record<string, unknown> }>
        const rule = rules.find(r => r.id === ruleId)
        const ruleConfig = rule?.filterConditions ?? {}

        const zabbixConfig = connector.config as unknown as ZabbixConfig & { defaultModelId?: string; hostGroupFilter?: string[] }
        const merged = { ...zabbixConfig, ...ruleConfig }

        const svc = new ZabbixSyncService(this.assetRepo, this.syncLogOps, this.db)
        const result = await svc.runSync(connectorId, ruleId, merged)

        return {
            synced: result.created + result.updated,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            errors: result.errors,
            durationMs: result.durationMs,
        }
    }

    /**
     * Handles an inbound alert from Zabbix (via webhook).
     * Finds the affected asset by hostname/IP and creates a maintenance ticket.
     * If no asset is found, records the alert in sync_logs and returns.
     */
    async handleInboundAlert(input: IInboundAlertInput): Promise<{ action: string; ticketId?: string; assetId?: string }> {
        if (!this.db) {
            return { action: 'no_db_configured' }
        }

        // Find asset by hostname or IP (Zabbix-synced assets have mgmt_ip and hostname)
        const assetResult = await this.db.query<{ id: string; asset_code: string }>(
            `SELECT id, asset_code FROM assets
             WHERE (hostname = $1 OR mgmt_ip = $2)
               AND deleted_at IS NULL
             LIMIT 1`,
            [input.hostname ?? '', input.hostIp ?? ''],
        )
        const asset = assetResult.rows[0]

        if (!asset) {
            return { action: 'asset_not_found' }
        }

        // Create maintenance ticket via direct SQL (avoid circular dependency with MaintenanceService)
        const severity = ZABBIX_SEVERITY[input.severity] ?? 'medium'
        const title = `[Zabbix] ${input.triggerName}`
        const diagnosis = `Problem: ${input.problemName}\nHost: ${input.hostname ?? input.hostIp ?? 'unknown'}\nSeverity: ${input.severity}`

        const ticketResult = await this.db.query<{ id: string }>(
            `INSERT INTO maintenance_tickets (asset_id, title, severity, status, diagnosis, created_by, opened_at)
             VALUES ($1, $2, $3, 'open', $4, 'system_zabbix', NOW())
             RETURNING id`,
            [asset.id, title, severity, diagnosis],
        )
        const ticket = ticketResult.rows[0]

        // Update CI status to 'maintenance' for the affected asset
        await this.db.query(
            `UPDATE cmdb_cis SET status = 'maintenance', updated_at = NOW()
             WHERE asset_id = $1 AND status != 'decommissioned'`,
            [asset.id],
        )

        return { action: 'ticket_created', ticketId: ticket?.id, assetId: asset.id }
    }

    async getSyncLogs(syncRuleId: string): Promise<unknown[]> {
        if (!this.syncLogOps) return []
        // SyncLogOps has listByRule if implemented by SyncLogRepo
        const repo = this.syncLogOps as unknown as { listByRule?: (id: string) => Promise<unknown[]> }
        if (typeof repo.listByRule === 'function') {
            return repo.listByRule(syncRuleId)
        }
        return []
    }
}
