// ============================================================================
// Application: PermissionCenterService — unified permission center for
// classic RBAC (role_permissions) and unified Policy System (policy_assignments).
//
// After migration 061, all AD directory ACL rows are in policy_assignments,
// so the directory source is dropped. directoryAllowed/directoryDenied remain
// in the sources shape as empty arrays for backward compat with the frontend.
// ============================================================================

import type { IRbacUserRepo } from '@qltb/contracts'

export interface ClassicRolePermission {
    key: string
}

export interface PolicyEffectiveResult {
    allowed: string[]
    denied: string[]
}

export interface PermissionCenterDeps {
    userRepo: IRbacUserRepo
    getSystemRoleSlug: (systemUserId: string) => Promise<string | null>
    getClassicRolePermissions: (roleSlug: string) => Promise<ClassicRolePermission[]>
    /** Resolve unified policy permissions for a system user (USER + GROUP + OU assignments) */
    getPolicyPermissionsForUser?: (systemUserId: string) => Promise<PolicyEffectiveResult>
}

export interface UnifiedEffectivePermissions {
    systemUserId: string
    linkedRbacUserId: string | null
    roleSlug: string | null
    sources: {
        classic: string[]
        /** @deprecated Always empty after migration 061 — ACL rows migrated to policy_assignments */
        directoryAllowed: string[]
        /** @deprecated Always empty after migration 061 — ACL rows migrated to policy_assignments */
        directoryDenied: string[]
        policyAllowed: string[]
        policyDenied: string[]
    }
    allowed: string[]
    denied: string[]
}

export class PermissionCenterService {
    constructor(private deps: PermissionCenterDeps) { }

    // Resolve effective permissions for a system user by merging:
    //   1. Classic role permissions (users.role → role_permissions)
    //   2. Unified Policy assignments (policy_assignments → policy_permissions)
    //      Includes former AD directory ACL rows migrated in migration 061.
    // DENY always overrides ALLOW across all sources.
    async getEffectiveForSystemUser(systemUserId: string): Promise<UnifiedEffectivePermissions> {
        const [roleSlug, rbacUser] = await Promise.all([
            this.deps.getSystemRoleSlug(systemUserId),
            this.deps.userRepo.getByLinkedUserId(systemUserId),
        ])

        // 1. Classic role permissions
        const classicPerms = roleSlug
            ? await this.deps.getClassicRolePermissions(roleSlug)
            : []
        const classicKeys = classicPerms.map((p) => p.key)

        // 2. Unified Policy assignments (covers USER, GROUP, OU + former AD ACL rows)
        let policyAllowed: string[] = []
        let policyDenied: string[] = []
        if (this.deps.getPolicyPermissionsForUser) {
            const policyResult = await this.deps.getPolicyPermissionsForUser(systemUserId)
            policyAllowed = policyResult.allowed
            policyDenied = policyResult.denied
        }

        // Merge: build allowed set from all ALLOW sources, then subtract all DENY sources
        const deniedSet = new Set<string>(policyDenied)
        const allowedSet = new Set<string>([...classicKeys, ...policyAllowed])

        // DENY > ALLOW
        for (const denied of deniedSet) {
            allowedSet.delete(denied)
        }

        return {
            systemUserId,
            linkedRbacUserId: rbacUser?.id ?? null,
            roleSlug,
            sources: {
                classic: classicKeys,
                directoryAllowed: [],
                directoryDenied: [],
                policyAllowed,
                policyDenied,
            },
            allowed: Array.from(allowedSet).sort(),
            denied: Array.from(deniedSet).sort(),
        }
    }
}
