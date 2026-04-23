/**
 * LdapSyncService — kết nối Windows Active Directory qua LDAP/LDAPS
 * và đồng bộ cây OU vào bảng org_units.
 *
 * Dùng ldapts (ESM-native, TypeScript).
 * Password bind DN lưu plain-text; chỉ admin mới có quyền truy cập API này.
 */
import { Client as LdapClient } from 'ldapts'
import type {
    LdapDirectoryConfigDto,
    LdapDirectoryConfigCreateInput,
    LdapDirectoryConfigPatch,
    LdapSyncResult,
    LdapTestResult,
} from '@qltb/contracts'
import type { PgClient } from '@qltb/infra-postgres'

// ─── DB row types ─────────────────────────────────────────────────────────────

type ConfigRow = {
    id: string
    name: string
    server_url: string
    base_dn: string
    bind_dn: string
    bind_password: string
    ou_search_base: string | null
    ou_filter: string
    tls_enabled: boolean
    tls_reject_unauthorized: boolean
    sync_interval_hours: number
    last_sync_at: Date | null
    last_sync_status: string | null
    last_sync_error: string | null
    last_sync_count: number | null
    is_active: boolean
    created_at: Date
    updated_at: Date
}

type OuRow = {
    id: string
    name: string
    parent_id: string | null
    path: string
    depth: number
    ldap_dn: string | null
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapConfig(r: ConfigRow): LdapDirectoryConfigDto {
    return {
        id: r.id,
        name: r.name,
        serverUrl: r.server_url,
        baseDn: r.base_dn,
        bindDn: r.bind_dn,
        ouSearchBase: r.ou_search_base,
        ouFilter: r.ou_filter,
        tlsEnabled: r.tls_enabled,
        tlsRejectUnauthorized: r.tls_reject_unauthorized,
        syncIntervalHours: r.sync_interval_hours,
        lastSyncAt: r.last_sync_at?.toISOString() ?? null,
        lastSyncStatus: (r.last_sync_status as LdapDirectoryConfigDto['lastSyncStatus']) ?? null,
        lastSyncError: r.last_sync_error,
        lastSyncCount: r.last_sync_count,
        isActive: r.is_active,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
    }
}

// ─── LDAP helpers ─────────────────────────────────────────────────────────────

/** Lấy phần tên OU từ DN, ví dụ: "OU=IT,OU=Corp,DC=co,DC=local" → "IT" */
function ouNameFromDn(dn: string): string {
    const first = dn.split(',')[0] ?? ''
    return first.replace(/^OU=/i, '')
}

/** Lấy DN cha bằng cách bỏ component đầu tiên */
function parentDn(dn: string): string {
    return dn.split(',').slice(1).join(',')
}

/** Tính depth từ số component OU (không tính DC component) */
function ouDepth(dn: string, baseDn: string): number {
    const ouPart = dn.slice(0, dn.toLowerCase().indexOf(baseDn.toLowerCase())).trim().replace(/,$/, '')
    if (!ouPart) return 0
    return ouPart.split(',').filter(c => /^OU=/i.test(c.trim())).length
}

/** Build materialized path từ danh sách tổ tiên (từ xa nhất đến gần nhất) */
function buildPath(ancestorNames: string[]): string {
    if (ancestorNames.length === 0) return '/'
    return '/' + ancestorNames.join('/')
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LdapSyncService {
    constructor(private db: PgClient) {}

    // ── Config CRUD ──────────────────────────────────────────────────────────

    async listConfigs(): Promise<LdapDirectoryConfigDto[]> {
        const res = await this.db.query<ConfigRow>(
            `SELECT id, name, server_url, base_dn, bind_dn, '' AS bind_password,
                    ou_search_base, ou_filter, tls_enabled, tls_reject_unauthorized,
                    sync_interval_hours, last_sync_at, last_sync_status,
                    last_sync_error, last_sync_count, is_active, created_at, updated_at
             FROM ldap_directory_configs
             ORDER BY created_at`
        )
        return res.rows.map(mapConfig)
    }

    async getConfigById(id: string): Promise<LdapDirectoryConfigDto | null> {
        const res = await this.db.query<ConfigRow>(
            `SELECT id, name, server_url, base_dn, bind_dn, '' AS bind_password,
                    ou_search_base, ou_filter, tls_enabled, tls_reject_unauthorized,
                    sync_interval_hours, last_sync_at, last_sync_status,
                    last_sync_error, last_sync_count, is_active, created_at, updated_at
             FROM ldap_directory_configs WHERE id = $1`,
            [id]
        )
        return res.rows[0] ? mapConfig(res.rows[0]) : null
    }

    async createConfig(input: LdapDirectoryConfigCreateInput): Promise<LdapDirectoryConfigDto> {
        const res = await this.db.query<ConfigRow>(
            `INSERT INTO ldap_directory_configs
                 (name, server_url, base_dn, bind_dn, bind_password,
                  ou_search_base, ou_filter, tls_enabled, tls_reject_unauthorized, sync_interval_hours)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id, name, server_url, base_dn, bind_dn, '' AS bind_password,
                       ou_search_base, ou_filter, tls_enabled, tls_reject_unauthorized,
                       sync_interval_hours, last_sync_at, last_sync_status,
                       last_sync_error, last_sync_count, is_active, created_at, updated_at`,
            [
                input.name,
                input.serverUrl,
                input.baseDn,
                input.bindDn,
                input.bindPassword,
                input.ouSearchBase ?? null,
                input.ouFilter ?? '(objectClass=organizationalUnit)',
                input.tlsEnabled ?? false,
                input.tlsRejectUnauthorized ?? true,
                input.syncIntervalHours ?? 24,
            ]
        )
        return mapConfig(res.rows[0])
    }

    async updateConfig(id: string, patch: LdapDirectoryConfigPatch): Promise<LdapDirectoryConfigDto | null> {
        const sets: string[] = []
        const params: unknown[] = []
        let idx = 1

        const addSet = (col: string, val: unknown) => { sets.push(`${col} = $${idx++}`); params.push(val) }

        if (patch.name !== undefined) addSet('name', patch.name)
        if (patch.serverUrl !== undefined) addSet('server_url', patch.serverUrl)
        if (patch.baseDn !== undefined) addSet('base_dn', patch.baseDn)
        if (patch.bindDn !== undefined) addSet('bind_dn', patch.bindDn)
        if (patch.bindPassword !== undefined) addSet('bind_password', patch.bindPassword)
        if (patch.ouSearchBase !== undefined) addSet('ou_search_base', patch.ouSearchBase)
        if (patch.ouFilter !== undefined) addSet('ou_filter', patch.ouFilter)
        if (patch.tlsEnabled !== undefined) addSet('tls_enabled', patch.tlsEnabled)
        if (patch.tlsRejectUnauthorized !== undefined) addSet('tls_reject_unauthorized', patch.tlsRejectUnauthorized)
        if (patch.syncIntervalHours !== undefined) addSet('sync_interval_hours', patch.syncIntervalHours)
        if (patch.isActive !== undefined) addSet('is_active', patch.isActive)

        if (sets.length === 0) return this.getConfigById(id)
        sets.push(`updated_at = NOW()`)
        params.push(id)

        const res = await this.db.query<ConfigRow>(
            `UPDATE ldap_directory_configs SET ${sets.join(', ')}
             WHERE id = $${idx}
             RETURNING id, name, server_url, base_dn, bind_dn, '' AS bind_password,
                       ou_search_base, ou_filter, tls_enabled, tls_reject_unauthorized,
                       sync_interval_hours, last_sync_at, last_sync_status,
                       last_sync_error, last_sync_count, is_active, created_at, updated_at`,
            params
        )
        return res.rows[0] ? mapConfig(res.rows[0]) : null
    }

    async deleteConfig(id: string): Promise<void> {
        await this.db.query('DELETE FROM ldap_directory_configs WHERE id = $1', [id])
    }

    // ── LDAP connection ───────────────────────────────────────────────────────

    private async getFullConfig(id: string) {
        const res = await this.db.query<ConfigRow>(
            `SELECT * FROM ldap_directory_configs WHERE id = $1`,
            [id]
        )
        return res.rows[0] ?? null
    }

    private buildClient(cfg: ConfigRow): LdapClient {
        return new LdapClient({
            url: cfg.server_url,
            tlsOptions: cfg.tls_enabled
                ? { rejectUnauthorized: cfg.tls_reject_unauthorized }
                : undefined,
            connectTimeout: 10_000,
            timeout: 30_000,
        })
    }

    // ── Test connection ───────────────────────────────────────────────────────

    async testConnection(configId: string): Promise<LdapTestResult> {
        const cfg = await this.getFullConfig(configId)
        if (!cfg) return { success: false, message: 'Config không tồn tại' }

        const client = this.buildClient(cfg)
        try {
            await client.bind(cfg.bind_dn, cfg.bind_password)

            const searchBase = cfg.ou_search_base ?? cfg.base_dn
            const { searchEntries } = await client.search(searchBase, {
                scope: 'sub',
                filter: cfg.ou_filter,
                attributes: ['ou', 'dn'],
                sizeLimit: 5,
            })

            return {
                success: true,
                message: `Kết nối thành công đến ${cfg.server_url}`,
                ouCount: searchEntries.length,
            }
        } catch (err) {
            return {
                success: false,
                message: err instanceof Error ? err.message : String(err),
            }
        } finally {
            await client.unbind().catch(() => null)
        }
    }

    // ── Sync OUs ─────────────────────────────────────────────────────────────

    async syncOrgUnits(configId: string): Promise<LdapSyncResult> {
        const start = Date.now()
        const cfg = await this.getFullConfig(configId)
        if (!cfg) throw new Error('Config không tồn tại')

        await this.db.query(
            `UPDATE ldap_directory_configs SET last_sync_status='running', updated_at=NOW() WHERE id=$1`,
            [configId]
        )

        const result: LdapSyncResult = { configId, created: 0, updated: 0, errors: [], duration: 0 }
        const client = this.buildClient(cfg)

        try {
            await client.bind(cfg.bind_dn, cfg.bind_password)

            const searchBase = cfg.ou_search_base ?? cfg.base_dn
            const { searchEntries } = await client.search(searchBase, {
                scope: 'sub',
                filter: cfg.ou_filter,
                attributes: ['ou', 'description', 'distinguishedName', 'dn'],
            })

            // Chuẩn hóa DS entries: lấy dn từ entry
            const ous = searchEntries
                .map(e => ({
                    dn: (e.dn as string).trim(),
                    name: ouNameFromDn((e.dn as string).trim()),
                    description: typeof e.description === 'string' ? e.description : null,
                }))
                // Bỏ base DN (không phải OU)
                .filter(e => /^OU=/i.test(e.dn))
                // Sắp xếp từ ngắn (gần root) đến dài (sâu hơn) để insert cha trước con
                .sort((a, b) => a.dn.split(',').length - b.dn.split(',').length)

            for (const ou of ous) {
                try {
                    await this.upsertOrgUnit(ou, cfg.base_dn, result)
                } catch (err) {
                    result.errors.push(`${ou.dn}: ${err instanceof Error ? err.message : String(err)}`)
                }
            }

            result.duration = Date.now() - start
            await this.db.query(
                `UPDATE ldap_directory_configs
                 SET last_sync_at=NOW(), last_sync_status='success',
                     last_sync_error=NULL, last_sync_count=$2, updated_at=NOW()
                 WHERE id=$1`,
                [configId, result.created + result.updated]
            )
        } catch (err) {
            result.duration = Date.now() - start
            const msg = err instanceof Error ? err.message : String(err)
            await this.db.query(
                `UPDATE ldap_directory_configs
                 SET last_sync_at=NOW(), last_sync_status='error',
                     last_sync_error=$2, updated_at=NOW()
                 WHERE id=$1`,
                [configId, msg]
            )
            throw err
        } finally {
            await client.unbind().catch(() => null)
        }

        return result
    }

    private async upsertOrgUnit(
        ou: { dn: string; name: string; description: string | null },
        baseDn: string,
        result: LdapSyncResult
    ): Promise<void> {
        // Tìm parent OU trong DB theo ldap_dn của DN cha
        const pDn = parentDn(ou.dn)
        const isRootLevel = pDn.toLowerCase() === baseDn.toLowerCase()
            || !/^OU=/i.test(pDn)

        let parentId: string | null = null
        let parentPath = '/'
        let depth = 0

        if (!isRootLevel) {
            const parentRes = await this.db.query<OuRow>(
                `SELECT id, path, depth FROM org_units WHERE ldap_dn = $1`,
                [pDn]
            )
            if (parentRes.rows[0]) {
                parentId = parentRes.rows[0].id
                parentPath = parentRes.rows[0].path
                depth = parentRes.rows[0].depth + 1
            }
        }

        const path = parentPath === '/' ? `/${ou.name}` : `${parentPath}/${ou.name}`

        // Upsert theo ldap_dn
        const existing = await this.db.query<OuRow>(
            `SELECT id FROM org_units WHERE ldap_dn = $1`,
            [ou.dn]
        )

        if (existing.rows[0]) {
            await this.db.query(
                `UPDATE org_units
                 SET name=$1, parent_id=$2, path=$3, depth=$4, description=$5,
                     ldap_sync_at=NOW(), source='ldap', updated_at=NOW()
                 WHERE id=$6`,
                [ou.name, parentId, path, depth, ou.description, existing.rows[0].id]
            )
            result.updated++
        } else {
            await this.db.query(
                `INSERT INTO org_units (name, parent_id, path, depth, description, ldap_dn, ldap_sync_at, source)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW(),'ldap')`,
                [ou.name, parentId, path, depth, ou.description, ou.dn]
            )
            result.created++
        }
    }
}
