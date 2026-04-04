import type { FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import jwt from 'jsonwebtoken'
import { UnauthorizedError } from '../errors/http-errors.js'

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true'

type TokenPayload = {
    userId: string
    email: string
    role: string
}

// Cache permission lookups per role slug for 5 minutes
const permissionCache = new Map<string, { perms: string[]; expiresAt: number }>()

// Cache policy DENY lookups per userId for 5 minutes
const denialCache = new Map<string, { perms: string[]; expiresAt: number }>()

// Cache policy ALLOW (per-user/OU/group assignments) per userId for 5 minutes
const allowanceCache = new Map<string, { perms: string[]; expiresAt: number }>()

/** Invalidate denial cache for a user — call after policy assignments change */
export function invalidateDenialCache(userId?: string): void {
    if (userId) {
        denialCache.delete(userId)
    } else {
        denialCache.clear()
    }
}

/** Invalidate allowance cache for a user — call after policy assignments change */
export function invalidateAllowanceCache(userId?: string): void {
    if (userId) {
        allowanceCache.delete(userId)
    } else {
        allowanceCache.clear()
    }
}

/** Invalidate role permission cache — call after policy permissions change */
export function invalidatePermissionCache(roleSlug?: string): void {
    if (roleSlug) {
        permissionCache.delete(roleSlug)
    } else {
        permissionCache.clear()
    }
    // Policy permission changes affect all per-user ALLOW caches too
    // (assignments point to policies, so policy content change = stale allowance cache)
    allowanceCache.clear()
}

type AuthUserRecord = {
    id: string
    email: string
    role: string
    status: string
    isActive: boolean
}

const MOCK_USERS: AuthUserRecord[] = [
    {
        id: 'user-001',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        isActive: true
    },
    {
        id: 'user-002',
        email: 'manager@example.com',
        role: 'manager',
        status: 'active',
        isActive: true
    },
    {
        id: 'user-003',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        isActive: true
    }
]

function resolveJwtAccessSecret(): string {
    const fallback = 'dev-access-secret-key'
    const value = process.env.JWT_ACCESS_SECRET || fallback
    if (process.env.NODE_ENV === 'production' && value === fallback) {
        throw new Error('JWT_ACCESS_SECRET must be explicitly configured in production')
    }
    return value
}

const JWT_ACCESS_SECRET = resolveJwtAccessSecret()
const USERS_TABLE_EXISTS_TTL_MS = 60_000
const usersTableExistsCache = new WeakMap<PgClient, { value: boolean; expiresAt: number }>()

export function normalizeUserRole(role: string | null | undefined): string {
    const value = (role ?? '').trim().toLowerCase()
    if (!value) return 'viewer'

    // Transitional alias while backend routes still check for it_asset_manager.
    if (value === 'manager') return 'it_asset_manager'

    return value
}

async function usersTableExists(pgClient: PgClient): Promise<boolean> {
    const cached = usersTableExistsCache.get(pgClient)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
        return cached.value
    }

    const result = await pgClient.query<{ found: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'users'
        ) AS found
        `
    )
    const value = result.rows[0]?.found === true
    usersTableExistsCache.set(pgClient, { value, expiresAt: now + USERS_TABLE_EXISTS_TTL_MS })
    return value
}

async function getRolePermissions(pgClient: PgClient, role: string): Promise<string[]> {
    const cacheKey = role
    const cached = permissionCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.perms

    try {
        // Policy Library is authoritative: read from policy_permissions (migration 060+).
        // Falls back to role_permissions only if no policy with matching slug exists.
        const result = await pgClient.query<{ name: string | null; policy_exists: boolean }>(
            `SELECT p.name,
                    (SELECT EXISTS(SELECT 1 FROM policies WHERE slug = $1)) AS policy_exists
             FROM policies pol
             LEFT JOIN policy_permissions pp ON pp.policy_id = pol.id
             LEFT JOIN permissions p ON p.id = pp.permission_id
             WHERE pol.slug = $1`,
            [role]
        )
        let perms: string[]
        if (result.rows.length > 0 && result.rows[0].policy_exists) {
            // Policy exists — use policy_permissions (may be empty if admin cleared all)
            perms = result.rows.map(r => r.name).filter((n): n is string => n !== null)
        } else {
            // No policy with this slug → fallback to classic role_permissions
            const roleResult = await pgClient.query<{ name: string }>(
                `SELECT p.name
                 FROM permissions p
                 JOIN role_permissions rp ON rp.permission_id = p.id
                 JOIN roles r ON r.id = rp.role_id
                 WHERE r.slug = $1`,
                [role]
            )
            perms = roleResult.rows.map(r => r.name)
        }
        permissionCache.set(cacheKey, { perms, expiresAt: Date.now() + 5 * 60_000 })
        return perms
    } catch {
        // Bảng roles/permissions chưa tồn tại → trả về rỗng (fallback về role-based trong helpers)
        return []
    }
}

// Layer 2 ALLOW: load additive permission grants from per-user/OU/group policy assignments.
// These are unioned with the role defaults (Layer 1) — not limited by a ceiling.
// Cached per userId for 5 minutes to avoid per-request DB overhead.
async function getPolicyAllowancesForUser(pgClient: PgClient, userId: string): Promise<string[]> {
    const cached = allowanceCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return cached.perms

    try {
        const result = await pgClient.query<{ name: string }>(
            `SELECT DISTINCT pm.name
             FROM policy_assignments pa
             JOIN policy_permissions pp ON pp.policy_id = pa.policy_id
             JOIN permissions pm ON pm.id = pp.permission_id
             WHERE pa.effect = 'ALLOW'
               AND (
                 -- Direct USER assignment
                 (pa.principal_type = 'USER' AND pa.principal_id = $1)
                 OR
                 -- Via GROUP membership
                 (pa.principal_type = 'GROUP' AND EXISTS (
                   SELECT 1 FROM rbac_group_members gm
                   JOIN rbac_users ru ON ru.id = gm.member_user_id
                                     AND ru.linked_user_id = $1
                   WHERE gm.group_id = pa.principal_id
                     AND gm.member_type = 'USER'
                 ))
                 OR
                 -- Via OU (direct or inherited)
                 (pa.principal_type = 'OU' AND EXISTS (
                   SELECT 1 FROM rbac_users ru
                   JOIN org_units user_ou ON user_ou.id = ru.ou_id
                   WHERE ru.linked_user_id = $1
                     AND (
                       pa.principal_id = ru.ou_id
                       OR (pa.inherit = true AND EXISTS (
                         SELECT 1 FROM org_units scope_ou
                         WHERE scope_ou.id = pa.principal_id
                           AND user_ou.path LIKE scope_ou.path || '%'
                       ))
                     )
                 ))
               )`,
            [userId]
        )
        const perms = result.rows.map(r => r.name)
        allowanceCache.set(userId, { perms, expiresAt: Date.now() + 5 * 60_000 })
        return perms
    } catch {
        // policy_assignments table may not exist yet — fail open (no extra allowances)
        return []
    }
}

// Load policy DENY permissions for a specific user (USER + GROUP + OU assignments).
// Cached per userId for 5 minutes to avoid per-request DB overhead.
async function getPolicyDenialsForUser(pgClient: PgClient, userId: string): Promise<string[]> {
    const cached = denialCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return cached.perms

    try {
        const result = await pgClient.query<{ name: string }>(
            `SELECT DISTINCT pm.name
             FROM policy_assignments pa
             JOIN policy_permissions pp ON pp.policy_id = pa.policy_id
             JOIN permissions pm ON pm.id = pp.permission_id
             WHERE pa.effect = 'DENY'
               AND (
                 -- Direct USER assignment
                 (pa.principal_type = 'USER' AND pa.principal_id = $1)
                 OR
                 -- Via GROUP membership
                 (pa.principal_type = 'GROUP' AND EXISTS (
                   SELECT 1 FROM rbac_group_members gm
                   JOIN rbac_users ru ON ru.id = gm.member_user_id
                                     AND ru.linked_user_id = $1
                   WHERE gm.group_id = pa.principal_id
                     AND gm.member_type = 'USER'
                 ))
                 OR
                 -- Via OU (direct or inherited)
                 (pa.principal_type = 'OU' AND EXISTS (
                   SELECT 1 FROM rbac_users ru
                   JOIN org_units user_ou ON user_ou.id = ru.ou_id
                   WHERE ru.linked_user_id = $1
                     AND (
                       pa.principal_id = ru.ou_id
                       OR (pa.inherit = true AND EXISTS (
                         SELECT 1 FROM org_units scope_ou
                         WHERE scope_ou.id = pa.principal_id
                           AND user_ou.path LIKE scope_ou.path || '%'
                       ))
                     )
                 ))
               )`,
            [userId]
        )
        const perms = result.rows.map(r => r.name)
        denialCache.set(userId, { perms, expiresAt: Date.now() + 5 * 60_000 })
        return perms
    } catch {
        // policy_assignments table may not exist yet — fail open (no denials)
        return []
    }
}

async function getUserById(pgClient: PgClient, userId: string): Promise<AuthUserRecord | null> {
    const result = await pgClient.query<{
        id: string
        email: string
        role: string
        status: string | null
        is_active: boolean
    }>(
        `
        SELECT id, email, role, status, COALESCE(is_active, true) AS is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    )

    if (result.rows.length === 0) return null
    const row = result.rows[0]
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status ?? 'active',
        isActive: row.is_active
    }
}

async function loadUserById(pgClient: PgClient | undefined, userId: string): Promise<AuthUserRecord | null> {
    if (pgClient) {
        const hasUsers = await usersTableExists(pgClient)
        if (hasUsers) {
            return await getUserById(pgClient, userId)
        }
    }

    return MOCK_USERS.find(user => user.id === userId) ?? null
}

export async function authenticateBearerRequest(request: FastifyRequest, pgClient?: PgClient): Promise<void> {
    // Dev/test bypass: skip JWT verification when DISABLE_AUTH=true
    if (DISABLE_AUTH) {
        request.user = {
            id: 'dev-admin-001',
            email: 'dev@local',
            role: 'admin',
            status: 'active',
            permissions: []
        }
        return
    }

    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)

    let payload: TokenPayload
    try {
        payload = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload
    } catch {
        throw new UnauthorizedError('Invalid access token')
    }

    const user = await loadUserById(pgClient, payload.userId)
    if (!user || !user.isActive || user.status !== 'active') {
        throw new UnauthorizedError('User not found or inactive')
    }

    const normalizedRole = normalizeUserRole(user.role)

    // AD-style 3-layer permission resolution (all 3 queries run in parallel):
    //   Layer 1: role defaults  → getRolePermissions
    //   Layer 2 ALLOW: additive grants via User/Group/OU assignments
    //   Layer 2 DENY:  explicit revocations (always win over any ALLOW)
    const [rolePerms, deniedPermissions, policyAllowed] = await Promise.all([
        pgClient ? getRolePermissions(pgClient, normalizedRole) : Promise.resolve([]),
        pgClient ? getPolicyDenialsForUser(pgClient, user.id) : Promise.resolve([]),
        pgClient ? getPolicyAllowancesForUser(pgClient, user.id) : Promise.resolve([]),
    ])

    // Effective = UNION(layer1_role, layer2_allow) − layer2_deny
    // Mirrors AD Security Group model: cumulative ALLOW, DENY always overrides.
    const deniedSet = new Set(deniedPermissions)
    const unionSet = new Set([...rolePerms, ...policyAllowed])
    for (const d of deniedSet) unionSet.delete(d)
    const permissions = [...unionSet]

    request.user = {
        id: user.id,
        email: user.email,
        role: normalizedRole,
        status: user.status,
        permissions,
        deniedPermissions,
    }
}
