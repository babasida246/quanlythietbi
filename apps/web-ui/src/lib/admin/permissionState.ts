import { readLocal, writeLocal } from './storage'
import {
    adminRoles,
    adminPermissions,
    defaultRoleGrants,
    permissionIds,
    sensitivePermissions,
    type AdminPermissionId,
    type AdminRoleId
} from './permissions'

export type RoleMatrix = Record<AdminRoleId, Record<AdminPermissionId, boolean>>

export type ScopeType = 'global' | 'org' | 'asset_group' | 'model'

export type ScopedGrant = {
    id: string
    roleId: AdminRoleId
    permissionId: AdminPermissionId
    scopeType: ScopeType
    scopeValue?: string
    effect: 'grant' | 'deny'
    reason?: string
    expiresAt?: string
    createdAt: string
    requestedBy?: string
}

export type UserOverride = {
    id: string
    userId: string
    permissionId: AdminPermissionId
    effect: 'grant' | 'deny'
    reason?: string
    expiresAt?: string
    createdAt: string
    requestedBy?: string
}

export type ApprovalRequest = {
    id: string
    targetType: 'role' | 'user' | 'scope'
    roleId?: AdminRoleId
    userId?: string
    permissionId: AdminPermissionId
    desiredEffect: 'grant' | 'deny'
    scopeType?: ScopeType
    scopeValue?: string
    reason?: string
    requestedBy?: string
    requestedAt: string
    status: 'pending' | 'approved' | 'rejected'
    reviewedBy?: string
    reviewedAt?: string
}

export type PermissionAuditEntry = {
    id: string
    action: 'matrix_update' | 'override_update' | 'scope_update' | 'approval'
    actorId?: string
    actorRole?: string
    summary: string
    details: Record<string, unknown>
    createdAt: string
}

export type RoleMatrixState = {
    matrix: RoleMatrix
    savedAt?: string
    lastSavedMatrix?: RoleMatrix
}

const MATRIX_KEY = 'admin.roleMatrix.v2'
const SCOPES_KEY = 'admin.permissionScopes.v1'
const OVERRIDES_KEY = 'admin.permissionOverrides.v1'
const APPROVALS_KEY = 'admin.permissionApprovals.v1'
const AUDIT_KEY = 'admin.permissionAudit.v1'

function createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}_${crypto.randomUUID()}`
    }
    return `${prefix}_${Math.random().toString(36).slice(2)}`
}

export function buildMatrix(grants: Record<AdminRoleId, AdminPermissionId[]>): RoleMatrix {
    const matrix: RoleMatrix = {
        user: {} as Record<AdminPermissionId, boolean>,
        admin: {} as Record<AdminPermissionId, boolean>,
        super_admin: {} as Record<AdminPermissionId, boolean>
    }
    for (const role of adminRoles) {
        for (const permissionId of permissionIds) {
            matrix[role.id][permissionId] = grants[role.id]?.includes(permissionId) ?? false
        }
    }
    return matrix
}

export function normalizeMatrix(matrix: RoleMatrix): RoleMatrix {
    const normalized: RoleMatrix = buildMatrix(defaultRoleGrants)
    for (const role of adminRoles) {
        for (const permissionId of permissionIds) {
            const current = matrix?.[role.id]?.[permissionId]
            normalized[role.id][permissionId] = current ?? normalized[role.id][permissionId]
        }
    }
    return normalized
}

export function loadRoleMatrixState(): RoleMatrixState {
    const fallback: RoleMatrixState = { matrix: buildMatrix(defaultRoleGrants) }
    const stored = readLocal<RoleMatrixState>(MATRIX_KEY, fallback)
    return {
        ...stored,
        matrix: normalizeMatrix(stored.matrix),
        lastSavedMatrix: stored.lastSavedMatrix ? normalizeMatrix(stored.lastSavedMatrix) : stored.lastSavedMatrix
    }
}

export function saveRoleMatrixState(state: RoleMatrixState): void {
    writeLocal(MATRIX_KEY, state)
}

export function loadScopedGrants(): ScopedGrant[] {
    return readLocal<ScopedGrant[]>(SCOPES_KEY, [])
}

export function saveScopedGrants(items: ScopedGrant[]): void {
    writeLocal(SCOPES_KEY, items)
}

export function loadOverrides(): UserOverride[] {
    return readLocal<UserOverride[]>(OVERRIDES_KEY, [])
}

export function saveOverrides(items: UserOverride[]): void {
    writeLocal(OVERRIDES_KEY, items)
}

export function loadApprovals(): ApprovalRequest[] {
    return readLocal<ApprovalRequest[]>(APPROVALS_KEY, [])
}

export function saveApprovals(items: ApprovalRequest[]): void {
    writeLocal(APPROVALS_KEY, items)
}

export function loadAuditLog(): PermissionAuditEntry[] {
    return readLocal<PermissionAuditEntry[]>(AUDIT_KEY, [])
}

export function saveAuditLog(items: PermissionAuditEntry[]): void {
    writeLocal(AUDIT_KEY, items)
}

export function pushAudit(entry: Omit<PermissionAuditEntry, 'id' | 'createdAt'>): PermissionAuditEntry {
    const next: PermissionAuditEntry = {
        id: createId('audit'),
        createdAt: new Date().toISOString(),
        ...entry
    }
    const current = loadAuditLog()
    saveAuditLog([next, ...current].slice(0, 200))
    return next
}

export function isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
}

export function getCurrentAdminRole(): AdminRoleId {
    if (typeof window === 'undefined') return 'user'
    const role = window.localStorage.getItem('userRole') as AdminRoleId | null
    if (role === 'admin' || role === 'super_admin' || role === 'user') return role
    return 'user'
}

export function getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('userId')
}

export type PermissionScopeContext = {
    scopeType?: ScopeType
    scopeValue?: string
}

function matchesScope(grant: { scopeType?: ScopeType; scopeValue?: string }, scope?: PermissionScopeContext): boolean {
    if (!scope?.scopeType || scope.scopeType === 'global') return true
    if (grant.scopeType !== scope.scopeType) return false
    if (!scope.scopeValue) return true
    return grant.scopeValue === scope.scopeValue
}

export function getEffectivePermissionsForRole(roleId: AdminRoleId, scope?: PermissionScopeContext): Set<AdminPermissionId> {
    const state = loadRoleMatrixState()
    const scoped = loadScopedGrants().filter((grant) => grant.roleId === roleId && !isExpired(grant.expiresAt))
    const effective = new Set<AdminPermissionId>()

    for (const permissionId of permissionIds) {
        if (state.matrix[roleId]?.[permissionId]) {
            effective.add(permissionId)
        }
    }

    for (const grant of scoped) {
        if (!matchesScope(grant, scope)) continue
        if (grant.effect === 'deny') {
            effective.delete(grant.permissionId)
        } else {
            effective.add(grant.permissionId)
        }
    }

    return effective
}

export function getEffectivePermissionsForUser(
    userId: string,
    roleId: AdminRoleId,
    scope?: PermissionScopeContext
): Set<AdminPermissionId> {
    const effective = getEffectivePermissionsForRole(roleId, scope)
    const overrides = loadOverrides().filter((override) => override.userId === userId && !isExpired(override.expiresAt))
    for (const override of overrides) {
        if (override.effect === 'deny') {
            effective.delete(override.permissionId)
        } else {
            effective.add(override.permissionId)
        }
    }
    return effective
}

export function hasAdminPermission(
    permissionId: AdminPermissionId,
    scope?: PermissionScopeContext
): boolean {
    const role = getCurrentAdminRole()
    const userId = getCurrentUserId()
    if (userId) {
        return getEffectivePermissionsForUser(userId, role, scope).has(permissionId)
    }
    return getEffectivePermissionsForRole(role, scope).has(permissionId)
}

export function computeMatrixDiff(before: RoleMatrix, after: RoleMatrix) {
    const changes: Array<{ roleId: AdminRoleId; permissionId: AdminPermissionId; from: boolean; to: boolean }> = []
    for (const role of adminRoles) {
        for (const permissionId of permissionIds) {
            const from = before[role.id]?.[permissionId] ?? false
            const to = after[role.id]?.[permissionId] ?? false
            if (from !== to) {
                changes.push({ roleId: role.id, permissionId, from, to })
            }
        }
    }
    return changes
}

export function requestApproval(input: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>): ApprovalRequest {
    const next: ApprovalRequest = {
        id: createId('approval'),
        requestedAt: new Date().toISOString(),
        status: 'pending',
        ...input
    }
    const current = loadApprovals()
    saveApprovals([next, ...current].slice(0, 200))
    return next
}

export function applyApproval(
    approval: ApprovalRequest,
    reviewer: { id?: string; role?: string },
    decision: 'approved' | 'rejected'
): ApprovalRequest {
    const updated: ApprovalRequest = {
        ...approval,
        status: decision,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer.id
    }

    const approvals = loadApprovals().map((item) => (item.id === approval.id ? updated : item))
    saveApprovals(approvals)

    if (decision === 'approved') {
        if (approval.targetType === 'role' && approval.roleId) {
            const state = loadRoleMatrixState()
            state.matrix = {
                ...state.matrix,
                [approval.roleId]: {
                    ...state.matrix[approval.roleId],
                    [approval.permissionId]: approval.desiredEffect === 'grant'
                }
            }
            saveRoleMatrixState(state)
        }

        if (approval.targetType === 'user' && approval.userId) {
            const overrides = loadOverrides()
            overrides.unshift({
                id: createId('override'),
                userId: approval.userId,
                permissionId: approval.permissionId,
                effect: approval.desiredEffect,
                reason: approval.reason,
                createdAt: new Date().toISOString(),
                requestedBy: approval.requestedBy
            })
            saveOverrides(overrides)
        }

        if (approval.targetType === 'scope' && approval.roleId) {
            const scopes = loadScopedGrants()
            scopes.unshift({
                id: createId('scope'),
                roleId: approval.roleId,
                permissionId: approval.permissionId,
                effect: approval.desiredEffect,
                scopeType: approval.scopeType ?? 'global',
                scopeValue: approval.scopeValue,
                reason: approval.reason,
                createdAt: new Date().toISOString(),
                requestedBy: approval.requestedBy
            })
            saveScopedGrants(scopes)
        }
    }

    pushAudit({
        action: 'approval',
        actorId: reviewer.id,
        actorRole: reviewer.role,
        summary: `Approval ${decision} for ${approval.permissionId}`,
        details: approval
    })

    return updated
}

export function requiresApproval(permissionId: AdminPermissionId): boolean {
    return sensitivePermissions.has(permissionId)
}
