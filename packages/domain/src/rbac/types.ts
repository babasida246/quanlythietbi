// ============================================================================
// Domain: RBAC AD — Types, Value Objects, Assertions
// ============================================================================

// ─── Enums / Union types ─────────────────────────────────────────────────────
export const MemberTypeValues = ['USER', 'GROUP'] as const
export type MemberType = typeof MemberTypeValues[number]

export const ScopeTypeValues = ['GLOBAL', 'OU', 'RESOURCE'] as const
export type ScopeType = typeof ScopeTypeValues[number]

export const AclEffectValues = ['ALLOW', 'DENY'] as const
export type AclEffect = typeof AclEffectValues[number]

export const RbacUserStatusValues = ['active', 'disabled', 'locked'] as const
export type RbacUserStatus = typeof RbacUserStatusValues[number]

// ─── Entity shapes ───────────────────────────────────────────────────────────
export interface OrgUnit {
    id: string
    name: string
    parentId: string | null
    path: string           // materialized path e.g. '/Root/IT/Network'
    depth: number
    description: string | null
    createdAt: Date
    updatedAt: Date
}

export interface RbacUser {
    id: string
    username: string
    displayName: string
    email: string | null
    ouId: string
    linkedUserId: string | null
    status: RbacUserStatus
    createdAt: Date
    updatedAt: Date
}

export interface RbacGroup {
    id: string
    name: string
    description: string | null
    ouId: string
    createdAt: Date
    updatedAt: Date
}

export interface GroupMember {
    id: string
    groupId: string
    memberType: MemberType
    memberUserId: string | null
    memberGroupId: string | null
    createdAt: Date
}

export interface RbacRole {
    id: string
    key: string
    name: string
    description: string | null
    isSystem: boolean
    createdAt: Date
    updatedAt: Date
}

export interface RbacAdPermission {
    id: string
    key: string
    description: string | null
    createdAt: Date
}

export interface AclEntry {
    id: string
    principalType: MemberType
    principalUserId: string | null
    principalGroupId: string | null
    roleId: string
    scopeType: ScopeType
    scopeOuId: string | null
    scopeResource: string | null
    effect: AclEffect
    inherit: boolean
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
}

// ─── Resolved permission result ──────────────────────────────────────────────
export interface EffectivePermission {
    permissionKey: string
    effect: AclEffect
    scopeType: ScopeType
    scopeOuId: string | null
    scopeResource: string | null
    sourceRoleKey: string
    sourcePrincipalType: MemberType
    sourcePrincipalId: string
}

export interface EffectivePermissionResult {
    userId: string
    permissions: Map<string, EffectivePermission>  // permKey → resolved entry
    denied: Set<string>                             // permKeys explicitly denied
    allowed: Set<string>                            // permKeys allowed (after deny filter)
}

// ─── Assertions ──────────────────────────────────────────────────────────────
export function assertMemberType(v: string): asserts v is MemberType {
    if (!MemberTypeValues.includes(v as any))
        throw new Error(`Invalid member type: ${v}. Expected: ${MemberTypeValues.join(', ')}`)
}

export function assertScopeType(v: string): asserts v is ScopeType {
    if (!ScopeTypeValues.includes(v as any))
        throw new Error(`Invalid scope type: ${v}. Expected: ${ScopeTypeValues.join(', ')}`)
}

export function assertAclEffect(v: string): asserts v is AclEffect {
    if (!AclEffectValues.includes(v as any))
        throw new Error(`Invalid ACL effect: ${v}. Expected: ${AclEffectValues.join(', ')}`)
}

export function assertRbacUserStatus(v: string): asserts v is RbacUserStatus {
    if (!RbacUserStatusValues.includes(v as any))
        throw new Error(`Invalid RBAC user status: ${v}. Expected: ${RbacUserStatusValues.join(', ')}`)
}

// ─── OU path helpers ─────────────────────────────────────────────────────────
/** Get all ancestor paths of an OU path, e.g. '/Root/IT/Network' → ['/', '/Root', '/Root/IT', '/Root/IT/Network'] */
export function getOuAncestorPaths(ouPath: string): string[] {
    if (!ouPath || ouPath === '/') return ['/']
    const parts = ouPath.split('/').filter(Boolean)
    const paths: string[] = ['/']
    let current = ''
    for (const part of parts) {
        current += '/' + part
        paths.push(current)
    }
    return paths
}

/** Check if ancestorPath is an ancestor of (or equal to) descendantPath */
export function isOuAncestor(ancestorPath: string, descendantPath: string): boolean {
    if (ancestorPath === '/') return true
    if (ancestorPath === descendantPath) return true
    return descendantPath.startsWith(ancestorPath + '/')
}

/** Build the materialized path for a child OU */
export function buildOuPath(parentPath: string, childName: string): string {
    if (parentPath === '/') return '/' + childName
    return parentPath + '/' + childName
}
