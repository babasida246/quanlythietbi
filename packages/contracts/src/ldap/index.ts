export type LdapSyncStatus = 'success' | 'error' | 'running'

export interface LdapDirectoryConfigDto {
    id: string
    name: string
    serverUrl: string
    baseDn: string
    bindDn: string
    /** Password không trả về trong response (undefined) */
    ouSearchBase: string | null
    ouFilter: string
    tlsEnabled: boolean
    tlsRejectUnauthorized: boolean
    syncIntervalHours: number
    lastSyncAt: string | null
    lastSyncStatus: LdapSyncStatus | null
    lastSyncError: string | null
    lastSyncCount: number | null
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface LdapDirectoryConfigCreateInput {
    name: string
    serverUrl: string
    baseDn: string
    bindDn: string
    bindPassword: string
    ouSearchBase?: string | null
    ouFilter?: string
    tlsEnabled?: boolean
    tlsRejectUnauthorized?: boolean
    syncIntervalHours?: number
}

export interface LdapDirectoryConfigPatch {
    name?: string
    serverUrl?: string
    baseDn?: string
    bindDn?: string
    /** Nếu undefined: giữ nguyên mật khẩu cũ */
    bindPassword?: string
    ouSearchBase?: string | null
    ouFilter?: string
    tlsEnabled?: boolean
    tlsRejectUnauthorized?: boolean
    syncIntervalHours?: number
    isActive?: boolean
}

export interface LdapSyncResult {
    configId: string
    created: number
    updated: number
    errors: string[]
    duration: number
}

export interface LdapTestResult {
    success: boolean
    message: string
    ouCount?: number
}

export interface LdapOrgUnitDto {
    id: string
    name: string
    parentId: string | null
    path: string
    depth: number
    description: string | null
    ldapDn: string | null
    ldapSyncAt: string | null
    source: 'manual' | 'ldap'
    createdAt: string
    updatedAt: string
}
