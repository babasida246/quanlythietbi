/**
 * Integration Hub Service
 * Manages connectors, sync rules, webhooks
 */
import { ZabbixClient, type ZabbixConfig } from './providers/ZabbixClient.js'

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

export class IntegrationService {
    constructor(
        private connectors: IIntegrationConnectorRepo,
        private syncRules: ISyncRuleRepo,
        private webhooks: IWebhookRepo
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
}
