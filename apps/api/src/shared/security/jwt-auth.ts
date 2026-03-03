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

// Cache permission lookups per (role, pgClient) for 5 minutes
const permissionCache = new Map<string, { perms: string[]; expiresAt: number }>()

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

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key'
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
        const result = await pgClient.query<{ name: string }>(
            `SELECT p.name
             FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id
             JOIN roles r ON r.id = rp.role_id
             WHERE r.slug = $1`,
            [role]
        )
        const perms = result.rows.map(r => r.name)
        permissionCache.set(cacheKey, { perms, expiresAt: Date.now() + 5 * 60_000 })
        return perms
    } catch {
        // Bảng roles/permissions chưa tồn tại → trả về rỗng (fallback về role-based trong helpers)
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
    const permissions = pgClient ? await getRolePermissions(pgClient, normalizedRole) : []

    request.user = {
        id: user.id,
        email: user.email,
        role: normalizedRole,
        status: user.status,
        permissions
    }
}
