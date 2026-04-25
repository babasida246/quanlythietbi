/**
 * ZabbixSyncService — orchestrates full sync from a Zabbix connector.
 *
 * Step 2: Pull hosts → upsert QLTB assets (technical fields only on update).
 * Step 4: Update CMDB CI status based on Zabbix host availability.
 *
 * Conflict resolution:
 *   - Zabbix owns: serial_no, mac_address, mgmt_ip, hostname
 *   - QLTB owns: purchase_date, warranty_end, location_id, vendor_id, unit_cost, assignment
 */
import { ZabbixClient, type ZabbixConfig } from './providers/ZabbixClient.js'
import { mapHostToAssetInput, mapHostToStatus, type ZabbixHost, type ZabbixAssetInput } from './providers/ZabbixMapper.js'

// ── Minimal interfaces so this service doesn't depend on infra-postgres directly ──

export interface IZabbixAssetRepo {
    getByAssetCode(code: string): Promise<{ id: string; status: string } | null>
    create(input: {
        assetCode: string; modelId: string; serialNo: string | null
        macAddress: string | null; mgmtIp: string | null; hostname: string | null
        notes: string | null; status: 'in_stock'
    }): Promise<{ id: string }>
    update(id: string, patch: {
        serialNo?: string | null; macAddress?: string | null
        mgmtIp?: string | null; hostname?: string | null
    }): Promise<unknown>
}

export interface ISyncLogOps {
    create(input: {
        syncRuleId: string; direction: string; recordsProcessed: number
        recordsCreated: number; recordsUpdated: number; recordsFailed: number
        errors: unknown[]; startedAt: Date; status: string
    }): Promise<{ id: string }>
    complete(id: string, patch: {
        status: string; recordsProcessed: number; recordsCreated: number
        recordsUpdated: number; recordsFailed: number; errors: unknown[]
    }): Promise<void>
    updateSyncRuleLastSync(syncRuleId: string, status: string): Promise<void>
}

/** Minimal queryable for CI status update — avoids full CiRepo dependency */
export interface ICiStatusQueryable {
    query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface SyncResult {
    created: number
    updated: number
    failed: number
    errors: string[]
    durationMs: number
}

// Zabbix CI status → CMDB status mapping
const ZABBIX_TO_CMDB_STATUS: Record<string, string> = {
    '0': 'active',       // unknown → keep active
    '1': 'active',       // available
    '2': 'maintenance',  // unavailable → maintenance (recoverable)
}

export class ZabbixSyncService {
    constructor(
        private readonly assetRepo: IZabbixAssetRepo,
        private readonly syncLogOps: ISyncLogOps,
        private readonly db?: ICiStatusQueryable,
    ) { }

    async runSync(
        connectorId: string,
        syncRuleId: string,
        config: ZabbixConfig & { defaultModelId?: string; hostGroupFilter?: string[] },
    ): Promise<SyncResult> {
        const startedAt = new Date()
        const startMs = Date.now()
        const errors: string[] = []
        let created = 0
        let updated = 0
        let failed = 0

        const logEntry = await this.syncLogOps.create({
            syncRuleId,
            direction: 'inbound',
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            startedAt,
            status: 'running',
        })

        try {
            const client = new ZabbixClient(config)
            await client.authenticate()

            const hosts = await this.fetchHosts(client, config.hostGroupFilter)

            for (const host of hosts) {
                try {
                    const result = await this.upsertHost(host, config.defaultModelId)
                    if (result === 'created') created++
                    else updated++

                    // Step 4: update linked CI status
                    if (this.db) {
                        await this.updateCiStatus(host)
                    }
                } catch (err) {
                    failed++
                    errors.push(`[${host.host}] ${err instanceof Error ? err.message : String(err)}`)
                }
            }

            const finalStatus = failed === 0 ? 'success' : (created + updated > 0 ? 'partial' : 'failed')
            await this.syncLogOps.complete(logEntry.id, {
                status: finalStatus,
                recordsProcessed: hosts.length,
                recordsCreated: created,
                recordsUpdated: updated,
                recordsFailed: failed,
                errors,
            })
            await this.syncLogOps.updateSyncRuleLastSync(syncRuleId, finalStatus)

            return { created, updated, failed, errors, durationMs: Date.now() - startMs }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            await this.syncLogOps.complete(logEntry.id, {
                status: 'failed',
                recordsProcessed: 0,
                recordsCreated: 0,
                recordsUpdated: 0,
                recordsFailed: 1,
                errors: [message],
            })
            await this.syncLogOps.updateSyncRuleLastSync(syncRuleId, 'failed')
            throw err
        }
    }

    private async fetchHosts(client: ZabbixClient, groupFilter?: string[]): Promise<ZabbixHost[]> {
        return client.getHosts(groupFilter) as Promise<ZabbixHost[]>
    }

    private async upsertHost(host: ZabbixHost, defaultModelId?: string): Promise<'created' | 'updated'> {
        const code = `ZBX-${host.hostid}`
        const existing = await this.assetRepo.getByAssetCode(code)

        if (existing) {
            // Update only technical fields — leave financial/location fields unchanged
            const preview = mapHostToAssetInput(host, '__placeholder__')
            await this.assetRepo.update(existing.id, {
                serialNo: preview.serialNo,
                macAddress: preview.macAddress,
                mgmtIp: preview.mgmtIp,
                hostname: preview.hostname,
            })
            return 'updated'
        }

        if (!defaultModelId) {
            throw new Error(`No existing asset for ${code} and no defaultModelId configured — skipping creation`)
        }

        const input = mapHostToAssetInput(host, defaultModelId)
        await this.assetRepo.create({
            assetCode: input.assetCode,
            modelId: input.modelId,
            serialNo: input.serialNo,
            macAddress: input.macAddress,
            mgmtIp: input.mgmtIp,
            hostname: input.hostname,
            notes: input.notes,
            status: 'in_stock',
        })
        return 'created'
    }

    private async updateCiStatus(host: ZabbixHost): Promise<void> {
        if (!this.db) return
        const { assetCode, available } = mapHostToStatus(host)
        const ciStatus = ZABBIX_TO_CMDB_STATUS[available] ?? 'active'

        // Find asset by code, then find linked CI, update status
        await this.db.query(
            `UPDATE cmdb_cis
             SET status = $1, updated_at = NOW()
             WHERE asset_id = (
                 SELECT id FROM assets WHERE asset_code = $2 LIMIT 1
             )
               AND status != 'decommissioned'`,
            [ciStatus, assetCode],
        )
    }
}
