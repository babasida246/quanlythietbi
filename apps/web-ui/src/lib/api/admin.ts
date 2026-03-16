import { API_BASE, apiJson, apiJsonCached, apiJsonData, requireAccessToken } from './httpClient'

const authJson = <T>(input: string, init?: RequestInit) => {
    requireAccessToken()
    return apiJson<T>(input, init)
}

const authJsonData = <T>(input: string, init?: RequestInit) => {
    requireAccessToken()
    return apiJsonData<T>(input, init)
}

const authJsonCached = <T>(
    input: string,
    init?: RequestInit,
    options?: { ttlMs?: number; errorTtlMs?: number }
) => {
    requireAccessToken()
    return apiJsonCached<T>(input, init, {
        ttlMs: options?.ttlMs ?? 5000,
        errorTtlMs: options?.errorTtlMs ?? 10000
    })
}

export interface AdminUser {
    id: string
    email: string
    name: string
    role: string
    isActive: boolean
    lastLogin?: string
    createdAt: string
}

export interface AuditLogEntry {
    id: string
    userId: string | null
    action: string
    resource: string
    resourceId: string | null
    details?: Record<string, any> | null
    ipAddress?: string | null
    userAgent?: string | null
    createdAt: string
}

export async function listUsers(): Promise<{ data: AdminUser[]; meta: any }> {
    return authJsonCached(`${API_BASE}/v1/admin/users`, undefined, { ttlMs: 5000, errorTtlMs: 10000 })
}

export async function createUser(data: { email: string; name: string; password: string; role?: string }): Promise<AdminUser> {
    return authJsonData(`${API_BASE}/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function updateUser(id: string, data: Partial<{ email: string; name: string; role: string; isActive: boolean }>): Promise<AdminUser> {
    return authJsonData(`${API_BASE}/v1/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
    return authJsonData(`${API_BASE}/v1/admin/users/${id}`, { method: 'DELETE' })
}

export async function resetPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return authJsonData(`${API_BASE}/v1/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
    })
}

export async function listAuditLogs(params?: { limit?: number; page?: number }): Promise<{ data: AuditLogEntry[]; meta: any }> {
    const search = new URLSearchParams()
    if (params?.limit) search.append('limit', params.limit.toString())
    if (params?.page) search.append('page', params.page.toString())
    const query = search.toString()
    return authJsonCached(`${API_BASE}/v1/admin/audit-logs${query ? `?${query}` : ''}`, undefined, { ttlMs: 5000, errorTtlMs: 10000 })
}

// ──── RBAC Management ──────────────────────────────────────────────────────────

export interface RbacRole {
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
    permissionCount: number
    createdAt: string
}

export interface RbacPermission {
    id: string
    name: string
    resource: string
    action: string
    description: string | null
}

const PERMISSIONS_CLASSIC_BASE = `${API_BASE}/v1/admin/permissions/classic`

export async function listRbacRoles(): Promise<{ data: RbacRole[] }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles`)
}

export async function listRbacPermissions(): Promise<{ data: RbacPermission[] }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/permissions`)
}

export async function getRolePermissions(roleSlug: string): Promise<{ data: Array<{ permission_id: string; name: string; resource: string; action: string }> }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles/${roleSlug}/permissions`)
}

export async function setRolePermissions(roleSlug: string, permissionIds: string[]): Promise<{ data: { success: boolean; roleSlug: string; permissionCount: number } }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles/${roleSlug}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds })
    })
}

export async function createRole(data: { slug: string; name: string; description?: string }): Promise<{ data: RbacRole }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function updateRole(slug: string, data: { name?: string; description?: string }): Promise<{ data: { success: boolean } }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function deleteRole(slug: string): Promise<{ data: { success: boolean } }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/roles/${slug}`, { method: 'DELETE' })
}

export async function assignOuRole(ouId: string, roleSlug: string, includeSubOUs = true): Promise<{ data: { success: boolean; updatedCount: number } }> {
    return authJson(`${PERMISSIONS_CLASSIC_BASE}/ou-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ouId, roleSlug, includeSubOUs })
    })
}

// ──── AD-style RBAC Management ─────────────────────────────────────────────────

// Types
export interface AdOrgUnit {
    id: string; name: string; parentId: string | null; path: string;
    depth: number; description: string | null; createdAt: string; updatedAt: string;
}
export interface AdRbacUser {
    id: string; username: string; displayName: string; email: string | null;
    ouId: string; linkedUserId: string | null; status: string;
    createdAt: string; updatedAt: string;
}
export interface AdRbacGroup {
    id: string; name: string; description: string | null; ouId: string;
    createdAt: string; updatedAt: string;
}
export interface AdGroupMember {
    id: string; groupId: string; memberType: 'USER' | 'GROUP';
    memberUserId: string | null; memberGroupId: string | null; createdAt: string;
}
export interface AdRbacRoleAd {
    id: string; key: string; name: string; description: string | null;
    isSystem: boolean; createdAt: string; updatedAt: string;
}
export interface AdPermission {
    id: string; key: string; description: string | null; createdAt: string;
}
export interface AdAclEntry {
    id: string; principalType: 'USER' | 'GROUP';
    principalUserId: string | null; principalGroupId: string | null;
    roleId: string; scopeType: 'GLOBAL' | 'OU' | 'RESOURCE';
    scopeOuId: string | null; scopeResource: string | null;
    effect: 'ALLOW' | 'DENY'; inherit: boolean;
    createdBy: string | null; createdAt: string; updatedAt: string;
}
export interface EffectivePermsResult {
    userId: string; username?: string;
    permissions: Record<string, any>;
    denied: string[]; allowed: string[];
}

const RBAC_AD_BASE = `${API_BASE}/v1/admin/permissions/directory`

// ── OU ───────────────────────────────────────
export async function getAdOuTree(): Promise<{ data: AdOrgUnit[] }> {
    return authJson(`${RBAC_AD_BASE}/org-units/tree`)
}
export async function createAdOu(data: { name: string; parentId: string | null; description?: string }): Promise<{ data: AdOrgUnit }> {
    return authJson(`${RBAC_AD_BASE}/org-units`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function updateAdOu(id: string, data: { name?: string; description?: string }): Promise<{ data: AdOrgUnit }> {
    return authJson(`${RBAC_AD_BASE}/org-units/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function deleteAdOu(id: string): Promise<{ data: { deleted: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/org-units/${id}`, { method: 'DELETE' })
}

// ── Users ────────────────────────────────────
export async function listAdUsers(params?: { ouId?: string; search?: string }): Promise<{ data: AdRbacUser[] }> {
    const sp = new URLSearchParams()
    if (params?.ouId) sp.append('ouId', params.ouId)
    if (params?.search) sp.append('search', params.search)
    const q = sp.toString()
    return authJson(`${RBAC_AD_BASE}/users${q ? `?${q}` : ''}`)
}
export async function createAdUser(data: { username: string; displayName: string; email?: string; ouId: string; linkedUserId?: string; status?: string }): Promise<{ data: AdRbacUser }> {
    return authJson(`${RBAC_AD_BASE}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function updateAdUser(id: string, data: { displayName?: string; email?: string; status?: string }): Promise<{ data: AdRbacUser }> {
    return authJson(`${RBAC_AD_BASE}/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function deleteAdUser(id: string): Promise<{ data: { deleted: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/users/${id}`, { method: 'DELETE' })
}
export async function moveAdUser(id: string, ouId: string): Promise<{ data: AdRbacUser }> {
    return authJson(`${RBAC_AD_BASE}/users/${id}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ouId })
    })
}

// ── Groups ───────────────────────────────────
export async function listAdGroups(params?: { ouId?: string; search?: string }): Promise<{ data: AdRbacGroup[] }> {
    const sp = new URLSearchParams()
    if (params?.ouId) sp.append('ouId', params.ouId)
    if (params?.search) sp.append('search', params.search)
    const q = sp.toString()
    return authJson(`${RBAC_AD_BASE}/groups${q ? `?${q}` : ''}`)
}
export async function createAdGroup(data: { name: string; description?: string; ouId: string }): Promise<{ data: AdRbacGroup }> {
    return authJson(`${RBAC_AD_BASE}/groups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function updateAdGroup(id: string, data: { name?: string; description?: string }): Promise<{ data: AdRbacGroup }> {
    return authJson(`${RBAC_AD_BASE}/groups/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function deleteAdGroup(id: string): Promise<{ data: { deleted: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/groups/${id}`, { method: 'DELETE' })
}

// ── Group Members ────────────────────────────
export async function listAdGroupMembers(groupId: string): Promise<{ data: AdGroupMember[] }> {
    return authJson(`${RBAC_AD_BASE}/groups/${groupId}/members`)
}
export async function addAdGroupMember(groupId: string, data: { memberType: 'USER' | 'GROUP'; memberUserId?: string; memberGroupId?: string }): Promise<{ data: AdGroupMember }> {
    return authJson(`${RBAC_AD_BASE}/groups/${groupId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function removeAdGroupMember(groupId: string, memberType: string, memberId: string): Promise<{ data: { removed: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/groups/${groupId}/members?memberType=${memberType}&memberId=${memberId}`, {
        method: 'DELETE'
    })
}

// ── ACL ──────────────────────────────────────
export async function listAdAcl(params?: { principalUserId?: string; principalGroupId?: string }): Promise<{ data: AdAclEntry[] }> {
    const sp = new URLSearchParams()
    if (params?.principalUserId) sp.append('principalUserId', params.principalUserId)
    if (params?.principalGroupId) sp.append('principalGroupId', params.principalGroupId)
    const q = sp.toString()
    return authJson(`${RBAC_AD_BASE}/acl${q ? `?${q}` : ''}`)
}
export async function assignAdAcl(data: {
    principalType: 'USER' | 'GROUP'; principalUserId?: string; principalGroupId?: string;
    roleId: string; scopeType: 'GLOBAL' | 'OU' | 'RESOURCE';
    scopeOuId?: string; scopeResource?: string;
    effect: 'ALLOW' | 'DENY'; inherit?: boolean;
}): Promise<{ data: AdAclEntry }> {
    return authJson(`${RBAC_AD_BASE}/acl`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}
export async function revokeAdAcl(id: string): Promise<{ data: { deleted: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/acl/${id}`, { method: 'DELETE' })
}

// ── Roles & Permissions (AD model) ───────────
export async function listAdRoles(): Promise<{ data: AdRbacRoleAd[] }> {
    return authJson(`${RBAC_AD_BASE}/roles`)
}
export async function listAdPermissions(): Promise<{ data: AdPermission[] }> {
    return authJson(`${RBAC_AD_BASE}/permissions`)
}
export async function getAdRolePermissions(roleId: string): Promise<{ data: AdPermission[] }> {
    return authJson(`${RBAC_AD_BASE}/roles/${roleId}/permissions`)
}
export async function setAdRolePermissions(roleId: string, permissionIds: string[]): Promise<{ data: { updated: boolean } }> {
    return authJson(`${RBAC_AD_BASE}/roles/${roleId}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissionIds })
    })
}

// ── Effective Permissions ────────────────────
export async function getMyAdEffectivePerms(): Promise<{ data: EffectivePermsResult }> {
    return authJson(`${RBAC_AD_BASE}/me/effective-permissions`)
}
export async function getUserAdEffectivePerms(userId: string): Promise<{ data: EffectivePermsResult }> {
    return authJson(`${RBAC_AD_BASE}/users/${userId}/effective-permissions`)
}

// ──── Unified Policy System ────────────────────────────────────────────────────

export interface Policy {
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
    permissionCount: number
    createdAt: string
}

export interface PolicyPermission {
    permission_id: string
    name: string
    resource: string
    action: string
}

export interface PolicyAssignment {
    id: string
    principalType: 'USER' | 'GROUP' | 'OU'
    principalId: string
    principalName: string | null
    scopeType: 'GLOBAL' | 'OU' | 'RESOURCE'
    scopeOuId: string | null
    scopeResource: string | null
    effect: 'ALLOW' | 'DENY'
    inherit: boolean
    createdAt: string
}

export interface PolicyPrincipal {
    users: Array<{ id: string; name: string; email: string; role: string | null }>
    groups: Array<{ id: string; name: string; description: string | null }>
    ous: Array<{ id: string; name: string; path: string }>
}

const POLICIES_BASE = `${API_BASE}/v1/admin/permissions/policies`

export async function listPolicies(): Promise<{ data: Policy[] }> {
    return authJson(POLICIES_BASE)
}

export async function createPolicy(data: { slug: string; name: string; description?: string }): Promise<{ data: Policy }> {
    return authJson(POLICIES_BASE, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}

export async function updatePolicy(id: string, data: { name?: string; description?: string }): Promise<{ data: { success: boolean } }> {
    return authJson(`${POLICIES_BASE}/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}

export async function deletePolicy(id: string): Promise<{ data: { success: boolean } }> {
    return authJson(`${POLICIES_BASE}/${id}`, { method: 'DELETE' })
}

export async function getPolicyPermissions(policyId: string): Promise<{ data: PolicyPermission[] }> {
    return authJson(`${POLICIES_BASE}/${policyId}/permissions`)
}

export async function setPolicyPermissions(policyId: string, permissionIds: string[]): Promise<{ data: { success: boolean; permissionCount: number } }> {
    return authJson(`${POLICIES_BASE}/${policyId}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissionIds })
    })
}

export async function listPolicyAssignments(policyId: string): Promise<{ data: PolicyAssignment[] }> {
    return authJson(`${POLICIES_BASE}/${policyId}/assignments`)
}

export async function addPolicyAssignment(policyId: string, data: {
    principalType: 'USER' | 'GROUP' | 'OU'
    principalId: string
    scopeType?: 'GLOBAL' | 'OU' | 'RESOURCE'
    scopeOuId?: string
    scopeResource?: string
    effect?: 'ALLOW' | 'DENY'
    inherit?: boolean
}): Promise<{ data: { id: string; createdAt: string } }> {
    return authJson(`${POLICIES_BASE}/${policyId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}

export async function removePolicyAssignment(policyId: string, assignmentId: string): Promise<{ data: { success: boolean } }> {
    return authJson(`${POLICIES_BASE}/${policyId}/assignments/${assignmentId}`, { method: 'DELETE' })
}

export async function listPolicyPermissionCatalog(): Promise<{ data: RbacPermission[] }> {
    return authJson(`${POLICIES_BASE}/permission-catalog`)
}

export async function listPolicyPrincipals(): Promise<{ data: PolicyPrincipal }> {
    return authJson(`${POLICIES_BASE}/principals`)
}

export async function bulkAssignPolicyToOu(policyId: string, data: {
    ouId: string
    includeSubOUs?: boolean
    effect?: 'ALLOW' | 'DENY'
}): Promise<{ data: { success: boolean; inserted: number } }> {
    return authJson(`${POLICIES_BASE}/${policyId}/assignments/bulk-ou`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
}

// ── Unified Permission Center ─────────────────────────────────────────────────
// Calls PermissionCenterService — merges classic RBAC + AD directory permissions
// for a system user. Returns allowed/denied arrays (DENY > ALLOW).
export interface UnifiedEffectivePerms {
    systemUserId: string
    linkedRbacUserId: string | null
    roleSlug: string | null
    sources: {
        classic: string[]
        directoryAllowed: string[]
        directoryDenied: string[]
        policyAllowed: string[]
        policyDenied: string[]
    }
    allowed: string[]
    denied: string[]
}
export async function getUnifiedEffectivePerms(systemUserId: string): Promise<{ data: UnifiedEffectivePerms }> {
    return authJson(`${API_BASE}/v1/admin/permissions/effective/system-users/${systemUserId}`)
}

// ── OU-level policy linking ───────────────────────────────────────────────────

export interface OuPolicyLink {
    policyId: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
    permissionCount: number
    assignmentId: string
    principalType: 'OU' | 'GROUP'
    principalId: string
    scopeType: string
    scopeOuId: string | null
    effect: 'ALLOW' | 'DENY'
    inherit: boolean
    assignedAt: string
    linkReason: 'direct' | 'inherited' | 'via_group'
    principalName: string | null
}

export async function listPoliciesByOu(ouId: string): Promise<{ data: OuPolicyLink[] }> {
    return authJson(`${POLICIES_BASE}/by-ou/${ouId}`)
}
