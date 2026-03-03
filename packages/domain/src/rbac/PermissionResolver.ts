// ============================================================================
// Domain: PermissionResolver — AD-style effective permissions computation
// Algorithm: collect principals (BFS groups), collect ACL entries, apply
//   DENY > ALLOW, OU inheritance, scope matching
// ============================================================================

import type {
    AclEntry,
    AclEffect,
    EffectivePermissionResult,
    GroupMember,
    OrgUnit,
    RbacAdPermission,
    RbacRole,
} from './types.js'

/** Minimal data needed to resolve permissions for one user */
export interface PermissionResolverInput {
    /** The RBAC user id */
    userId: string
    /** The OU path of the user (e.g. '/Root/IT/Network') */
    userOuPath: string
    /** All group memberships in the system (USER + GROUP types) */
    memberships: GroupMember[]
    /** All ACL entries relevant to the user's principals */
    aclEntries: AclEntry[]
    /** All roles keyed by id */
    rolesById: Map<string, RbacRole>
    /** role_id → Set<permissionKey> */
    rolePermissions: Map<string, Set<string>>
    /** All OU records keyed by id (for path lookup) */
    ousById: Map<string, OrgUnit>
}

export interface CheckContext {
    ouPath?: string      // The OU of the resource being accessed
    resource?: string    // Resource key (e.g. 'asset:uuid')
}

/**
 * PermissionResolver — zero-dependency pure domain service.
 * Computes effective permissions for a given user following AD rules:
 * 1. Walk the group graph (BFS) to find all groups the user is (transitively) a member of
 * 2. Collect all ACL entries that apply to the user or any of their groups
 * 3. Expand each ACL entry's role into permission keys
 * 4. Apply scope matching (GLOBAL always, OU with inheritance, RESOURCE exact match)
 * 5. DENY overrides ALLOW at the same or narrower scope
 */
export class PermissionResolver {

    // ─── Step 1: Resolve all groups a user belongs to ─────────────────────

    /**
     * BFS through group memberships to find all groups `userId` transitively belongs to.
     * Detects cycles via visited set.
     * @returns Set of group IDs (including nested parents)
     */
    static resolveUserGroups(userId: string, memberships: GroupMember[]): Set<string> {
        // Build lookup: user → [groupIds], group → [parentGroupIds]
        const userToGroups = new Map<string, string[]>()
        const groupToParents = new Map<string, string[]>()

        for (const m of memberships) {
            if (m.memberType === 'USER' && m.memberUserId) {
                const list = userToGroups.get(m.memberUserId) ?? []
                list.push(m.groupId)
                userToGroups.set(m.memberUserId, list)
            } else if (m.memberType === 'GROUP' && m.memberGroupId) {
                const list = groupToParents.get(m.memberGroupId) ?? []
                list.push(m.groupId)
                groupToParents.set(m.memberGroupId, list)
            }
        }

        const visited = new Set<string>()
        const queue: string[] = [...(userToGroups.get(userId) ?? [])]

        while (queue.length > 0) {
            const gid = queue.shift()!
            if (visited.has(gid)) continue  // cycle detection
            visited.add(gid)
            // This group may itself be a member of other groups
            for (const parentGid of (groupToParents.get(gid) ?? [])) {
                if (!visited.has(parentGid)) queue.push(parentGid)
            }
        }

        return visited
    }

    /**
     * Detect cycle in group nesting graph.
     * Returns the cycle path if found, null otherwise.
     */
    static detectGroupCycle(memberships: GroupMember[]): string[] | null {
        // Build adjacency: child → parents (a group can be member of multiple groups)
        const adj = new Map<string, string[]>()
        for (const m of memberships) {
            if (m.memberType === 'GROUP' && m.memberGroupId) {
                const list = adj.get(m.memberGroupId) ?? []
                list.push(m.groupId)
                adj.set(m.memberGroupId, list)
            }
        }

        const WHITE = 0, GRAY = 1, BLACK = 2
        const color = new Map<string, number>()
        const parent = new Map<string, string | null>()

        for (const node of adj.keys()) {
            color.set(node, WHITE)
        }

        for (const startNode of adj.keys()) {
            if (color.get(startNode) !== WHITE) continue

            const stack: string[] = [startNode]
            while (stack.length > 0) {
                const u = stack[stack.length - 1]!

                if (color.get(u) === WHITE) {
                    color.set(u, GRAY)
                    for (const v of (adj.get(u) ?? [])) {
                        if (color.get(v) === GRAY) {
                            // Found cycle — reconstruct path
                            const cycle: string[] = [v, u]
                            let curr = u
                            while (curr !== v && parent.has(curr)) {
                                curr = parent.get(curr)!
                                cycle.push(curr)
                            }
                            return cycle.reverse()
                        }
                        if (!color.has(v) || color.get(v) === WHITE) {
                            color.set(v, WHITE)
                            parent.set(v, u)
                            stack.push(v)
                        }
                    }
                } else {
                    color.set(u, BLACK)
                    stack.pop()
                }
            }
        }

        return null
    }

    /**
     * Detect cycle in OU tree. Returns the cycle path if found.
     */
    static detectOuCycle(ous: OrgUnit[]): string[] | null {
        const parentMap = new Map<string, string>()
        for (const ou of ous) {
            if (ou.parentId) parentMap.set(ou.id, ou.parentId)
        }

        for (const ou of ous) {
            const visited = new Set<string>()
            let current: string | undefined = ou.id
            while (current && !visited.has(current)) {
                visited.add(current)
                current = parentMap.get(current)
            }
            if (current && visited.has(current)) {
                // Reconstruct cycle
                const cycle: string[] = [current]
                let c = parentMap.get(current)
                while (c && c !== current) {
                    cycle.push(c)
                    c = parentMap.get(c)
                }
                cycle.push(current)
                return cycle
            }
        }
        return null
    }

    // ─── Step 2: Collect applicable ACL entries ───────────────────────────

    /**
     * Filter ACL entries that apply to a set of principal IDs.
     */
    static collectAclEntries(
        userId: string,
        groupIds: Set<string>,
        allAcl: AclEntry[]
    ): AclEntry[] {
        return allAcl.filter(entry => {
            if (entry.principalType === 'USER' && entry.principalUserId === userId) return true
            if (entry.principalType === 'GROUP' && entry.principalGroupId && groupIds.has(entry.principalGroupId)) return true
            return false
        })
    }

    // ─── Step 3: Scope matching ──────────────────────────────────────────

    /**
     * Check if an ACL entry's scope applies to the given context.
     *
     * GLOBAL — always applies
     * OU     — applies if the user's OU (or resource OU) is under the scope OU
     *          and entry.inherit is true (or exact match)
     * RESOURCE — applies if scope_resource matches ctx.resource
     */
    static scopeApplies(
        entry: AclEntry,
        userOuPath: string,
        ousById: Map<string, OrgUnit>,
        ctx?: CheckContext
    ): boolean {
        switch (entry.scopeType) {
            case 'GLOBAL':
                return true

            case 'OU': {
                if (!entry.scopeOuId) return false
                const scopeOu = ousById.get(entry.scopeOuId)
                if (!scopeOu) return false

                // Resource OU takes precedence if provided
                const targetPath = ctx?.ouPath ?? userOuPath

                if (scopeOu.path === targetPath) return true  // exact match
                if (entry.inherit && targetPath.startsWith(scopeOu.path + '/')) return true
                if (entry.inherit && scopeOu.path === '/') return true // root inherits to all
                return false
            }

            case 'RESOURCE':
                if (!entry.scopeResource || !ctx?.resource) return false
                return entry.scopeResource === ctx.resource

            default:
                return false
        }
    }

    // ─── Step 4 + 5: Resolve effective permissions ────────────────────────

    /**
     * Compute the full effective permission set for a user.
     */
    static resolve(input: PermissionResolverInput): EffectivePermissionResult {
        const {
            userId, userOuPath, memberships,
            aclEntries, rolesById, rolePermissions, ousById
        } = input

        // Step 1: Get all groups
        const userGroups = PermissionResolver.resolveUserGroups(userId, memberships)

        // Step 2: Filter ACL
        const applicableAcl = PermissionResolver.collectAclEntries(userId, userGroups, aclEntries)

        // Step 3+4: Expand roles → permissions, apply scope
        const allowed = new Set<string>()
        const denied = new Set<string>()

        for (const entry of applicableAcl) {
            if (!PermissionResolver.scopeApplies(entry, userOuPath, ousById)) continue

            const rolePerms = rolePermissions.get(entry.roleId)
            if (!rolePerms) continue

            for (const permKey of rolePerms) {
                if (entry.effect === 'DENY') {
                    denied.add(permKey)
                } else {
                    allowed.add(permKey)
                }
            }
        }

        // Step 5: DENY > ALLOW
        for (const key of denied) {
            allowed.delete(key)
        }

        return {
            userId,
            permissions: new Map(),  // detailed map (for UI/debug)
            denied,
            allowed,
        }
    }

    /**
     * Check if a user has a specific permission in a given context.
     * This is the hot-path method used by middleware.
     */
    static check(
        input: PermissionResolverInput,
        permissionKey: string,
        ctx?: CheckContext
    ): boolean {
        const { userId, userOuPath, memberships, aclEntries, rolesById, rolePermissions, ousById } = input

        const userGroups = PermissionResolver.resolveUserGroups(userId, memberships)
        const applicableAcl = PermissionResolver.collectAclEntries(userId, userGroups, aclEntries)

        let hasAllow = false
        let hasDeny = false

        for (const entry of applicableAcl) {
            if (!PermissionResolver.scopeApplies(entry, userOuPath, ousById, ctx)) continue

            const rolePerms = rolePermissions.get(entry.roleId)
            if (!rolePerms || !rolePerms.has(permissionKey)) continue

            if (entry.effect === 'DENY') {
                hasDeny = true
                break  // DENY is absolute — short-circuit
            } else {
                hasAllow = true
            }
        }

        return hasAllow && !hasDeny
    }
}
