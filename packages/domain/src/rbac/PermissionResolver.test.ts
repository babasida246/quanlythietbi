// ============================================================================
// Tests: PermissionResolver — AD-style RBAC core logic
// ============================================================================

import { describe, it, expect } from 'vitest'
import { PermissionResolver } from './PermissionResolver.js'
import type { PermissionResolverInput, CheckContext } from './PermissionResolver.js'
import type {
    OrgUnit, RbacUser, RbacGroup, GroupMember,
    RbacRole, AclEntry, MemberType, ScopeType, AclEffect,
} from './types.js'
import { getOuAncestorPaths, isOuAncestor, buildOuPath } from './types.js'

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeOu(id: string, name: string, parentId: string | null, path: string, depth: number): OrgUnit {
    return { id, name, parentId, path, depth, description: null, createdAt: new Date(), updatedAt: new Date() }
}

function makeMembership(groupId: string, memberType: MemberType, memberUserId: string | null, memberGroupId: string | null): GroupMember {
    return { id: `m-${groupId}-${memberUserId ?? memberGroupId}`, groupId, memberType, memberUserId, memberGroupId, createdAt: new Date() }
}

function makeRole(id: string, key: string): RbacRole {
    return { id, key, name: key, description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() }
}

function makeAcl(opts: {
    principalType: MemberType; principalUserId?: string; principalGroupId?: string;
    roleId: string; scopeType: ScopeType; scopeOuId?: string; scopeResource?: string;
    effect: AclEffect; inherit?: boolean;
}): AclEntry {
    return {
        id: `acl-${Date.now()}-${Math.random()}`,
        principalType: opts.principalType,
        principalUserId: opts.principalUserId ?? null,
        principalGroupId: opts.principalGroupId ?? null,
        roleId: opts.roleId,
        scopeType: opts.scopeType,
        scopeOuId: opts.scopeOuId ?? null,
        scopeResource: opts.scopeResource ?? null,
        effect: opts.effect,
        inherit: opts.inherit ?? true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const rootOu = makeOu('ou-root', 'Root', null, '/', 0)
const itOu = makeOu('ou-it', 'IT', 'ou-root', '/Root/IT', 1)
const netOu = makeOu('ou-net', 'Network', 'ou-it', '/Root/IT/Network', 2)
const secOu = makeOu('ou-sec', 'Security', 'ou-it', '/Root/IT/Security', 2)
const clinOu = makeOu('ou-clin', 'Clinical', 'ou-root', '/Root/Clinical', 1)

const allOus = [rootOu, itOu, netOu, secOu, clinOu]
const ousById = new Map(allOus.map(ou => [ou.id, ou]))

const roleAdmin = makeRole('role-admin', 'full_admin')
const roleViewer = makeRole('role-viewer', 'viewer')
const roleTech = makeRole('role-tech', 'technician')

const rolesById = new Map([roleAdmin, roleViewer, roleTech].map(r => [r.id, r]))

const rolePermissions = new Map<string, Set<string>>([
    ['role-admin', new Set(['asset:read', 'asset:create', 'asset:update', 'asset:delete', 'rbac:admin'])],
    ['role-viewer', new Set(['asset:read', 'cmdb:read', 'report:read'])],
    ['role-tech', new Set(['asset:read', 'asset:update', 'maintenance:read', 'maintenance:create'])],
])

// ─── resolveUserGroups ───────────────────────────────────────────────────────

describe('PermissionResolver.resolveUserGroups', () => {
    it('returns direct group memberships', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-admins', 'USER', 'user-1', null),
            makeMembership('g-devs', 'USER', 'user-1', null),
        ]
        const groups = PermissionResolver.resolveUserGroups('user-1', memberships)
        expect(groups).toEqual(new Set(['g-admins', 'g-devs']))
    })

    it('resolves transitive group nesting', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-netadmins', 'USER', 'user-1', null),
            makeMembership('g-it-all', 'GROUP', null, 'g-netadmins'), // g-netadmins ∈ g-it-all
        ]
        const groups = PermissionResolver.resolveUserGroups('user-1', memberships)
        expect(groups).toEqual(new Set(['g-netadmins', 'g-it-all']))
    })

    it('handles deep nesting (3 levels)', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-leaf', 'USER', 'user-1', null),
            makeMembership('g-mid', 'GROUP', null, 'g-leaf'),
            makeMembership('g-top', 'GROUP', null, 'g-mid'),
        ]
        const groups = PermissionResolver.resolveUserGroups('user-1', memberships)
        expect(groups).toEqual(new Set(['g-leaf', 'g-mid', 'g-top']))
    })

    it('handles cyclic group nesting gracefully', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-a', 'USER', 'user-1', null),
            makeMembership('g-b', 'GROUP', null, 'g-a'),
            makeMembership('g-a', 'GROUP', null, 'g-b'), // cycle: g-a → g-b → g-a
        ]
        // Should not hang, should return both groups
        const groups = PermissionResolver.resolveUserGroups('user-1', memberships)
        expect(groups).toContain('g-a')
        expect(groups).toContain('g-b')
    })

    it('returns empty set for user with no groups', () => {
        const groups = PermissionResolver.resolveUserGroups('user-x', [])
        expect(groups.size).toBe(0)
    })
})

// ─── detectGroupCycle ────────────────────────────────────────────────────────

describe('PermissionResolver.detectGroupCycle', () => {
    it('returns null when no cycle exists', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-top', 'GROUP', null, 'g-mid'),
            makeMembership('g-mid', 'GROUP', null, 'g-leaf'),
        ]
        expect(PermissionResolver.detectGroupCycle(memberships)).toBeNull()
    })

    it('detects a simple cycle', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-a', 'GROUP', null, 'g-b'),
            makeMembership('g-b', 'GROUP', null, 'g-a'),
        ]
        const cycle = PermissionResolver.detectGroupCycle(memberships)
        expect(cycle).not.toBeNull()
        expect(cycle!.length).toBeGreaterThanOrEqual(2)
    })

    it('ignores USER memberships (no false positives)', () => {
        const memberships: GroupMember[] = [
            makeMembership('g-a', 'USER', 'user-1', null),
            makeMembership('g-b', 'USER', 'user-2', null),
        ]
        expect(PermissionResolver.detectGroupCycle(memberships)).toBeNull()
    })
})

// ─── detectOuCycle ───────────────────────────────────────────────────────────

describe('PermissionResolver.detectOuCycle', () => {
    it('returns null for a valid tree', () => {
        expect(PermissionResolver.detectOuCycle(allOus)).toBeNull()
    })

    it('detects an OU cycle', () => {
        const cycleOus: OrgUnit[] = [
            makeOu('a', 'A', 'b', '/A', 0),
            makeOu('b', 'B', 'a', '/B', 0),
        ]
        const cycle = PermissionResolver.detectOuCycle(cycleOus)
        expect(cycle).not.toBeNull()
    })
})

// ─── scopeApplies ────────────────────────────────────────────────────────────

describe('PermissionResolver.scopeApplies', () => {
    it('GLOBAL always applies', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'GLOBAL', effect: 'ALLOW' })
        expect(PermissionResolver.scopeApplies(entry, '/Root/IT', ousById)).toBe(true)
    })

    it('OU exact match applies', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'OU', scopeOuId: 'ou-it', effect: 'ALLOW' })
        expect(PermissionResolver.scopeApplies(entry, '/Root/IT', ousById)).toBe(true)
    })

    it('OU inherit applies to child paths', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'OU', scopeOuId: 'ou-it', effect: 'ALLOW', inherit: true })
        expect(PermissionResolver.scopeApplies(entry, '/Root/IT/Network', ousById)).toBe(true)
    })

    it('OU without inherit does not apply to child paths', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'OU', scopeOuId: 'ou-it', effect: 'ALLOW', inherit: false })
        expect(PermissionResolver.scopeApplies(entry, '/Root/IT/Network', ousById)).toBe(false)
    })

    it('OU scope does not apply to sibling OU', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'OU', scopeOuId: 'ou-it', effect: 'ALLOW', inherit: true })
        expect(PermissionResolver.scopeApplies(entry, '/Root/Clinical', ousById)).toBe(false)
    })

    it('RESOURCE exact match applies', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'RESOURCE', scopeResource: 'asset:123', effect: 'ALLOW' })
        expect(PermissionResolver.scopeApplies(entry, '/Root', ousById, { resource: 'asset:123' })).toBe(true)
    })

    it('RESOURCE mismatch does not apply', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'RESOURCE', scopeResource: 'asset:123', effect: 'ALLOW' })
        expect(PermissionResolver.scopeApplies(entry, '/Root', ousById, { resource: 'asset:999' })).toBe(false)
    })

    it('Root OU with inherit applies to all', () => {
        const entry = makeAcl({ principalType: 'USER', principalUserId: 'u1', roleId: 'r1', scopeType: 'OU', scopeOuId: 'ou-root', effect: 'ALLOW', inherit: true })
        expect(PermissionResolver.scopeApplies(entry, '/Root/IT/Network', ousById)).toBe(true)
    })
})

// ─── resolve (full effective permissions) ────────────────────────────────────

describe('PermissionResolver.resolve', () => {
    it('grants permissions from direct user ACL', () => {
        const input: PermissionResolverInput = {
            userId: 'user-1',
            userOuPath: '/Root/IT',
            memberships: [],
            aclEntries: [
                makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-viewer', scopeType: 'GLOBAL', effect: 'ALLOW' }),
            ],
            rolesById,
            rolePermissions,
            ousById,
        }
        const result = PermissionResolver.resolve(input)
        expect(result.allowed).toContain('asset:read')
        expect(result.allowed).toContain('cmdb:read')
        expect(result.allowed).toContain('report:read')
        expect(result.denied.size).toBe(0)
    })

    it('grants permissions from group ACL', () => {
        const input: PermissionResolverInput = {
            userId: 'user-1',
            userOuPath: '/Root/IT',
            memberships: [
                makeMembership('g-admins', 'USER', 'user-1', null),
            ],
            aclEntries: [
                makeAcl({ principalType: 'GROUP', principalGroupId: 'g-admins', roleId: 'role-admin', scopeType: 'GLOBAL', effect: 'ALLOW' }),
            ],
            rolesById,
            rolePermissions,
            ousById,
        }
        const result = PermissionResolver.resolve(input)
        expect(result.allowed).toContain('asset:create')
        expect(result.allowed).toContain('rbac:admin')
    })

    it('grants permissions from nested group ACL', () => {
        const input: PermissionResolverInput = {
            userId: 'user-1',
            userOuPath: '/Root/IT/Network',
            memberships: [
                makeMembership('g-netadmins', 'USER', 'user-1', null),
                makeMembership('g-all-it', 'GROUP', null, 'g-netadmins'),
            ],
            aclEntries: [
                makeAcl({ principalType: 'GROUP', principalGroupId: 'g-all-it', roleId: 'role-tech', scopeType: 'GLOBAL', effect: 'ALLOW' }),
            ],
            rolesById,
            rolePermissions,
            ousById,
        }
        const result = PermissionResolver.resolve(input)
        expect(result.allowed).toContain('maintenance:create')
    })

    it('DENY overrides ALLOW', () => {
        const input: PermissionResolverInput = {
            userId: 'user-1',
            userOuPath: '/Root/IT',
            memberships: [],
            aclEntries: [
                makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-admin', scopeType: 'GLOBAL', effect: 'ALLOW' }),
                makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-admin', scopeType: 'GLOBAL', effect: 'DENY' }),
            ],
            rolesById,
            rolePermissions,
            ousById,
        }
        const result = PermissionResolver.resolve(input)
        expect(result.allowed.size).toBe(0)
        expect(result.denied).toContain('asset:read')
        expect(result.denied).toContain('rbac:admin')
    })

    it('empty ACL results in no permissions', () => {
        const input: PermissionResolverInput = {
            userId: 'user-1',
            userOuPath: '/Root/IT',
            memberships: [],
            aclEntries: [],
            rolesById,
            rolePermissions,
            ousById,
        }
        const result = PermissionResolver.resolve(input)
        expect(result.allowed.size).toBe(0)
        expect(result.denied.size).toBe(0)
    })
})

// ─── check (hot-path permission check) ──────────────────────────────────────

describe('PermissionResolver.check', () => {
    const baseInput: PermissionResolverInput = {
        userId: 'user-1',
        userOuPath: '/Root/IT/Network',
        memberships: [
            makeMembership('g-netadmins', 'USER', 'user-1', null),
        ],
        aclEntries: [
            makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-viewer', scopeType: 'GLOBAL', effect: 'ALLOW' }),
            makeAcl({ principalType: 'GROUP', principalGroupId: 'g-netadmins', roleId: 'role-tech', scopeType: 'OU', scopeOuId: 'ou-it', effect: 'ALLOW', inherit: true }),
        ],
        rolesById,
        rolePermissions,
        ousById,
    }

    it('returns true for an allowed permission (global)', () => {
        expect(PermissionResolver.check(baseInput, 'asset:read')).toBe(true)
    })

    it('returns true for OU-scoped permission within scope', () => {
        expect(PermissionResolver.check(baseInput, 'maintenance:create')).toBe(true)
    })

    it('returns false for a permission outside OU scope', () => {
        expect(PermissionResolver.check(baseInput, 'maintenance:create', { ouPath: '/Root/Clinical' })).toBe(false)
    })

    it('returns false for a permission not granted at all', () => {
        expect(PermissionResolver.check(baseInput, 'rbac:admin')).toBe(false)
    })

    it('DENY short-circuits even with ALLOW', () => {
        const input: PermissionResolverInput = {
            ...baseInput,
            aclEntries: [
                makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-tech', scopeType: 'GLOBAL', effect: 'ALLOW' }),
                makeAcl({ principalType: 'USER', principalUserId: 'user-1', roleId: 'role-tech', scopeType: 'GLOBAL', effect: 'DENY' }),
            ],
        }
        expect(PermissionResolver.check(input, 'asset:update')).toBe(false)
    })

    it('RESOURCE scope with context', () => {
        const input: PermissionResolverInput = {
            ...baseInput,
            aclEntries: [
                makeAcl({
                    principalType: 'USER', principalUserId: 'user-1', roleId: 'role-admin',
                    scopeType: 'RESOURCE', scopeResource: 'asset:abc-123', effect: 'ALLOW'
                }),
            ],
        }
        expect(PermissionResolver.check(input, 'asset:delete', { resource: 'asset:abc-123' })).toBe(true)
        expect(PermissionResolver.check(input, 'asset:delete', { resource: 'asset:other' })).toBe(false)
        expect(PermissionResolver.check(input, 'asset:delete')).toBe(false) // no context = no match
    })
})

// ─── OU path helpers ─────────────────────────────────────────────────────────

describe('OU path helpers', () => {
    it('getOuAncestorPaths returns correct ancestors', () => {
        expect(getOuAncestorPaths('/Root/IT/Network')).toEqual(['/', '/Root', '/Root/IT', '/Root/IT/Network'])
    })

    it('getOuAncestorPaths for root', () => {
        expect(getOuAncestorPaths('/')).toEqual(['/'])
    })

    it('isOuAncestor — root is ancestor of everything', () => {
        expect(isOuAncestor('/', '/Root/IT/Network')).toBe(true)
    })

    it('isOuAncestor — exact match', () => {
        expect(isOuAncestor('/Root/IT', '/Root/IT')).toBe(true)
    })

    it('isOuAncestor — parent path', () => {
        expect(isOuAncestor('/Root/IT', '/Root/IT/Network')).toBe(true)
    })

    it('isOuAncestor — sibling is not ancestor', () => {
        expect(isOuAncestor('/Root/IT', '/Root/Clinical')).toBe(false)
    })

    it('buildOuPath constructs correct path', () => {
        expect(buildOuPath('/', 'Root')).toBe('/Root')
        expect(buildOuPath('/Root', 'IT')).toBe('/Root/IT')
        expect(buildOuPath('/Root/IT', 'Network')).toBe('/Root/IT/Network')
    })
})
