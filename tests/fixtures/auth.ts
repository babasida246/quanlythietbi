import type { APIRequestContext, Page } from '@playwright/test'
import jwt from 'jsonwebtoken'
import pg from 'pg'

export type TestRole = 'admin' | 'user'

export type TestIdentity = {
    userId: string
    email: string
    role: string
    name: string
}

type DbUserRow = {
    id: string
    email: string
    role: string
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key'
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/qltb'

const FALLBACK_IDENTITIES: Record<TestRole, TestIdentity> = {
    admin: {
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'playwright-admin@example.com',
        role: 'admin',
        name: 'playwright-admin@example.com'
    },
    user: {
        userId: '22222222-2222-4222-8222-222222222222',
        email: 'playwright-user@example.com',
        role: 'user',
        name: 'playwright-user@example.com'
    }
}

let resolvedIdentityCache: Partial<Record<TestRole, TestIdentity>> | null = null
let resolvingIdentityPromise: Promise<Partial<Record<TestRole, TestIdentity>>> | null = null

export function identityFor(role: TestRole): TestIdentity {
    return FALLBACK_IDENTITIES[role]
}

function signAccessToken(identity: TestIdentity): string {
    return jwt.sign(
        {
            userId: identity.userId,
            email: identity.email,
            role: identity.role
        },
        JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    )
}

async function loadUsersFromDb(): Promise<Partial<Record<TestRole, TestIdentity>>> {
    const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL
    const client = new pg.Client({ connectionString })
    await client.connect()
    try {
        const activeUsers = await client.query<DbUserRow>(
            `
            SELECT id::text, email, role
            FROM users
            WHERE COALESCE(is_active, true) = true
              AND COALESCE(status, 'active') = 'active'
            ORDER BY CASE
                WHEN role IN ('super_admin', 'admin') THEN 0
                WHEN role IN ('it_asset_manager', 'manager') THEN 1
                WHEN role IN ('user', 'viewer') THEN 2
                ELSE 9
            END, created_at ASC
            LIMIT 50
            `
        )

        const rows = activeUsers.rows
        const adminRow =
            rows.find((row) => row.email.toLowerCase() === 'admin@example.com') ??
            rows.find((row) => row.email.toLowerCase() === 'admin@netopsai.local') ??
            rows.find((row) => ['super_admin', 'admin'].includes(row.role)) ??
            rows.find((row) => ['it_asset_manager', 'manager'].includes(row.role)) ??
            rows[0]
        const userRow =
            rows.find((row) => row.email.toLowerCase() === 'user@example.com') ??
            rows.find((row) => !['super_admin', 'admin', 'it_asset_manager', 'manager'].includes(row.role)) ?? adminRow

        const result: Partial<Record<TestRole, TestIdentity>> = {}

        if (adminRow) {
            result.admin = {
                userId: adminRow.id,
                email: adminRow.email,
                role: adminRow.role,
                name: adminRow.email
            }
        }

        if (userRow) {
            result.user = {
                userId: userRow.id,
                email: userRow.email,
                // Force a low-privilege claim if fallback uses admin row.
                role: ['super_admin', 'admin', 'it_asset_manager', 'manager'].includes(userRow.role) ? 'user' : userRow.role,
                name: userRow.email
            }
        }

        return result
    } finally {
        await client.end().catch(() => undefined)
    }
}

async function ensureResolvedIdentities(): Promise<Partial<Record<TestRole, TestIdentity>>> {
    if (resolvedIdentityCache) {
        return resolvedIdentityCache
    }
    if (!resolvingIdentityPromise) {
        resolvingIdentityPromise = loadUsersFromDb().catch(() => ({}))
    }
    resolvedIdentityCache = await resolvingIdentityPromise
    return resolvedIdentityCache
}

async function resolveIdentity(role: TestRole): Promise<TestIdentity> {
    const cached = (await ensureResolvedIdentities())[role]
    return cached ?? FALLBACK_IDENTITIES[role]
}

export async function applyUiAuth(page: Page, role: TestRole = 'admin'): Promise<void> {
    const identity = await resolveIdentity(role)
    const accessToken = signAccessToken(identity)
    await page.addInitScript((payload: { identity: TestIdentity; token: string }) => {
        localStorage.setItem('authToken', payload.token)
        localStorage.setItem('refreshToken', 'playwright-no-refresh')
        localStorage.setItem('userId', payload.identity.userId)
        localStorage.setItem('userEmail', payload.identity.email)
        localStorage.setItem('userRole', payload.identity.role)
        localStorage.setItem('userName', payload.identity.name)
    }, { identity, token: accessToken })
}

export async function apiHeaders(role: TestRole = 'admin'): Promise<Record<string, string>> {
    const identity = await resolveIdentity(role)
    return {
        authorization: `Bearer ${signAccessToken(identity)}`
    }
}

export async function apiGetJson<T>(
    request: APIRequestContext,
    url: string,
    role: TestRole = 'admin'
): Promise<{ status: number; body: T }> {
    const response = await request.get(url, {
        headers: await apiHeaders(role)
    })
    const body = (await response.json()) as T
    return { status: response.status(), body }
}
