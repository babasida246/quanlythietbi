// ============================================================================
// Application: PermissionCenterService — unified permission center
//
// Permission model (AD-style, 3 layers):
//
//   Layer 1 — Identity / Role defaults
//     users.role → policy slug matching → policy_permissions
//     (replaces role_permissions since migration 060)
//     Role is the DEFAULT permission set, NOT a ceiling.
//
//   Layer 2 — Authorization / Policy grants & revocations
//     ALLOW assignments (USER | GROUP | OU) → adds permissions beyond role default
//     DENY  assignments (USER | GROUP | OU) → explicitly revokes permissions
//     Effective = UNION(role_defaults, policy_ALLOW) − DENY
//     Identical to AD Security Groups: cumulative ALLOW, DENY overrides all.
//
//   Layer 3 — Configuration (future: settings, UI prefs — separate from authz)
//
// Resolution rule: DENY always wins, ALLOW is cumulative across all sources.
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
        /** Layer 1: Role default permissions (from policy with matching slug) */
        classic: string[]
        /** @deprecated Always empty after migration 061 */
        directoryAllowed: string[]
        /** @deprecated Always empty after migration 061 */
        directoryDenied: string[]
        /** Layer 2 ALLOW: additive grants via User/Group/OU policy assignments */
        policyAllowed: string[]
        /** Layer 2 DENY: explicit revocations — override any ALLOW from any source */
        policyDenied: string[]
    }
    /** Effective = UNION(classic, policyAllowed) − policyDenied */
    allowed: string[]
    denied: string[]
}

export class PermissionCenterService {
    constructor(private deps: PermissionCenterDeps) { }

    // Resolve effective permissions for a system user using AD-style union model:
    //
    //   Layer 1: Role defaults  (users.role → policy slug → policy_permissions)
    //   Layer 2: Policy ALLOW   (cumulative grants via User/Group/OU assignments)
    //            Policy DENY    (explicit revocations — always win)
    //
    //   Effective = UNION(layer1, layer2_allow) − layer2_deny
    //
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

        // AD-style union model:
        //   Layer 1 (role defaults) + Layer 2 ALLOW grants → union set
        //   Layer 2 DENY → subtract from union (DENY always wins)
        const deniedSet = new Set<string>(policyDenied)
        const allowedSet = new Set<string>([...classicKeys, ...policyAllowed])

        // DENY overrides ALLOW from any source
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
