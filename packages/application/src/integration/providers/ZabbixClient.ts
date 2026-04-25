/**
 * Zabbix JSON-RPC 2.0 client.
 *
 * Supports two auth methods:
 *   - 'token'       : API token (Zabbix 5.4+) — sent as Authorization: Bearer header
 *   - 'credentials' : user.login (older Zabbix) — exchanges username/password for a session token
 *
 * Security note: apiToken and password come from integration_connectors.config JSONB.
 * In production, migrate sensitive fields to a proper vault and store only a reference
 * in the credentials_ref column.
 */

export interface ZabbixConfig {
    baseUrl: string
    authMethod: 'token' | 'credentials'
    /** Required when authMethod === 'token' */
    apiToken?: string
    /** Required when authMethod === 'credentials' */
    username?: string
    password?: string
}

export interface ZabbixTestResult {
    healthy: boolean
    message: string
    version?: string
    /** Number of monitored hosts visible to this account */
    hostCount?: number
}

interface RpcResponse<T> {
    jsonrpc: '2.0'
    result?: T
    error?: { code: number; message: string; data?: string }
    id: number
}

export class ZabbixClient {
    private readonly apiUrl: string
    /** Session token obtained from user.login (credentials auth only) */
    private sessionToken: string | null = null

    constructor(private readonly config: ZabbixConfig) {
        this.apiUrl = config.baseUrl.replace(/\/$/, '') + '/api_jsonrpc.php'
    }

    // ── Core RPC ────────────────────────────────────────────────────────────

    private async rpc<T>(method: string, params: unknown = {}, auth = true): Promise<T> {
        const body: Record<string, unknown> = { jsonrpc: '2.0', method, params, id: 1 }

        // Older Zabbix: pass session token in body.auth
        if (auth && this.sessionToken) {
            body.auth = this.sessionToken
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        // Zabbix 5.4+: pass API token as Bearer header
        if (auth && this.config.authMethod === 'token' && this.config.apiToken) {
            headers['Authorization'] = `Bearer ${this.config.apiToken}`
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText} — ${this.apiUrl}`)
        }

        const json = (await response.json()) as RpcResponse<T>

        if (json.error) {
            const detail = json.error.data ?? json.error.message
            throw new Error(`Zabbix API [${json.error.code}]: ${detail}`)
        }

        return json.result as T
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /** Returns Zabbix server version string — requires no authentication. */
    async getApiVersion(): Promise<string> {
        return this.rpc<string>('apiinfo.version', {}, false)
    }

    /**
     * Authenticates using username/password and stores the session token.
     * No-op when authMethod === 'token'.
     */
    async authenticate(): Promise<void> {
        if (this.config.authMethod === 'token') return

        if (!this.config.username || !this.config.password) {
            throw new Error('Username and password are required for credentials auth method')
        }

        // Zabbix 5.4 renamed the field from 'user' to 'username'; try both.
        try {
            this.sessionToken = await this.rpc<string>(
                'user.login',
                { username: this.config.username, password: this.config.password },
                false,
            )
        } catch {
            this.sessionToken = await this.rpc<string>(
                'user.login',
                { user: this.config.username, password: this.config.password },
                false,
            )
        }
    }

    /**
     * Fetches all monitored hosts with interfaces and inventory.
     * Optionally filtered by host group names.
     */
    async getHosts(groupFilter?: string[]): Promise<unknown[]> {
        const params: Record<string, unknown> = {
            output: ['hostid', 'host', 'name', 'available', 'status'],
            selectInterfaces: ['interfaceid', 'type', 'ip', 'dns', 'port', 'main'],
            selectInventory: ['serialno_a', 'serialno_b', 'macaddress_a', 'macaddress_b', 'model', 'os'],
            filter: { status: '0' }, // monitored only
        }

        if (groupFilter && groupFilter.length > 0) {
            const groups = await this.rpc<Array<{ groupid: string }>>(
                'hostgroup.get',
                { output: ['groupid'], filter: { name: groupFilter } },
            )
            if (groups.length > 0) {
                params.groupids = groups.map(g => g.groupid)
            }
        }

        return this.rpc<unknown[]>('host.get', params)
    }

    /**
     * Tests connectivity and authentication.
     * 1. Fetches API version (no auth) — verifies network reachability.
     * 2. Authenticates (if credentials auth).
     * 3. Fetches host count — verifies the account has API access.
     */
    async testConnection(): Promise<ZabbixTestResult> {
        try {
            const version = await this.getApiVersion()

            await this.authenticate()

            // host.get with countOutput returns a numeric string, not an array
            const rawCount = await this.rpc<string>('host.get', { countOutput: true })
            const hostCount = parseInt(rawCount, 10)

            return {
                healthy: true,
                message: `Connected to Zabbix ${version}. Monitoring ${hostCount} host(s).`,
                version,
                hostCount,
            }
        } catch (err) {
            return {
                healthy: false,
                message: err instanceof Error ? err.message : String(err),
            }
        }
    }
}
