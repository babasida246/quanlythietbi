/**
 * Auth API Routes
 * Authentication endpoints for the Asset Management System
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'

import {
    env,
    resolveRefreshCookieRuntimeConfig,
    REFRESH_TOKEN_COOKIE_NAME
} from '../../../config/env.js'

import {
    type LoginRequest,
    type RefreshTokenRequest,
    type LogoutRequest,
    type AuthResponse,
    type User,
    LoginRouteSchema,
    RefreshRouteSchema,
    LogoutRouteSchema,
    CurrentUserRouteSchema
} from './auth.schemas.js'

import { createApiError, createErrorResponse, createSuccessResponse } from '../../../shared/utils/response.utils.js'
import { verifyPassword } from '../../../shared/security/password.js'
import { authenticateBearerRequest } from '../../../shared/security/jwt-auth.js'

interface AuthRoutesOptions {
    pgClient?: PgClient
}

type AuthUserRecord = {
    id: string
    email: string
    name: string
    role: string
    status: string
    passwordHash: string
    isActive: boolean
}

type TokenPayload = {
    userId: string
    email: string
    role: string
}

type RefreshPayload = {
    userId: string
    tokenId: string
    iat?: number
    exp?: number
}

// Mock users for fallback mode (when database users table does not exist yet)
const MOCK_USERS = [
    {
        id: 'user-001',
        email: 'admin@example.com',
        name: 'Administrator',
        role: 'admin',
        passwordHash: '$2b$10$9va31dWDefnvOxfGMvcMGuWyr6VDkcYDxtGQx9OAgsWFcEhMqqGja',
        status: 'active'
    },
    {
        id: 'user-002',
        email: 'manager@example.com',
        name: 'Asset Manager',
        role: 'manager',
        passwordHash: '$2b$10$Jv9xeNuvUp.o5.pIoyX3juRBBveXtYZ0WGvzo/79YQewv7AH2IpCG',
        status: 'active'
    },
    {
        id: 'user-003',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        passwordHash: '$2b$10$lcZ2kQXxgYFVO.dkUOC6uuaY2RCPsOSEvYLyc6aDg6i9pHaSJh9Xy',
        status: 'active'
    }
]

// In-memory store for refresh tokens (in production, use Redis or database)
const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date }>()
const loginAttemptStore = new Map<string, { count: number; firstAttemptAt: number; blockedUntil: number }>()

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_BLOCK_MS = 15 * 60 * 1000

function resolveJwtSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', fallback: string): string {
    const value = process.env[name] || fallback
    if (process.env.NODE_ENV === 'production' && value === fallback) {
        throw new Error(`${name} must be explicitly configured in production`)
    }
    return value
}

const JWT_ACCESS_SECRET = resolveJwtSecret('JWT_ACCESS_SECRET', 'dev-access-secret-key')
const JWT_REFRESH_SECRET = resolveJwtSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-key')
const ACCESS_TOKEN_EXPIRES_IN = '15m' // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d' // 7 days
const refreshCookieConfig = resolveRefreshCookieRuntimeConfig(env)

type HttpError = Error & {
    statusCode: number
}

function createHttpError(statusCode: number, message: string): HttpError {
    const error = new Error(message) as HttpError
    error.statusCode = statusCode
    return error
}

function isHttpError(error: unknown): error is HttpError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof (error as { statusCode?: unknown }).statusCode === 'number'
    )
}

function apiErrorFromStatus(statusCode: number, message: string) {
    if (statusCode === 400) return createApiError.badRequest(message)
    if (statusCode === 401) return createApiError.unauthorized(message)
    if (statusCode === 403) return createApiError.forbidden(message)
    if (statusCode === 404) return createApiError.notFound(message)
    if (statusCode === 409) return createApiError.conflict(message)
    return createApiError.internal(message)
}

function normalizeDbUser(row: {
    id: string
    email: string
    name: string | null
    username: string | null
    role: string
    status: string | null
    password_hash: string
    is_active: boolean
}): AuthUserRecord {
    return {
        id: row.id,
        email: row.email,
        name: row.name ?? row.username ?? row.email,
        role: row.role,
        status: row.status ?? 'active',
        passwordHash: row.password_hash,
        isActive: row.is_active
    }
}

function normalizeMockUser(user: (typeof MOCK_USERS)[number]): AuthUserRecord {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        passwordHash: user.passwordHash,
        isActive: user.status === 'active'
    }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {}
    const result: Record<string, string> = {}
    for (const chunk of cookieHeader.split(';')) {
        const [rawKey, ...rawValueParts] = chunk.split('=')
        if (!rawKey || rawValueParts.length === 0) continue
        const key = rawKey.trim()
        const value = rawValueParts.join('=').trim()
        if (!key) continue
        try {
            result[key] = decodeURIComponent(value)
        } catch {
            result[key] = value
        }
    }
    return result
}

function buildRefreshTokenCookie(token: string): string {
    const cookie = refreshCookieConfig
    const parts = [
        `${REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}`,
        `Path=${cookie.path}`,
        `Max-Age=${cookie.maxAgeSeconds}`,
        'HttpOnly',
        `SameSite=${cookie.sameSite}`
    ]

    if (cookie.secure) {
        parts.push('Secure')
    }

    return parts.join('; ')
}

function buildClearRefreshTokenCookie(): string {
    const cookie = refreshCookieConfig
    const parts = [
        `${REFRESH_TOKEN_COOKIE_NAME}=`,
        `Path=${cookie.path}`,
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'HttpOnly',
        `SameSite=${cookie.sameSite}`
    ]

    if (cookie.secure) {
        parts.push('Secure')
    }

    return parts.join('; ')
}

function setRefreshTokenCookie(reply: { header: (name: string, value: string) => unknown }, token: string): void {
    reply.header('Set-Cookie', buildRefreshTokenCookie(token))
}

function clearRefreshTokenCookie(reply: { header: (name: string, value: string) => unknown }): void {
    reply.header('Set-Cookie', buildClearRefreshTokenCookie())
}

function extractRefreshTokenFromRequest(
    request: { headers: Record<string, unknown>; body?: { refreshToken?: string } }
): string | null {
    const fromBody = request.body?.refreshToken?.trim()
    if (fromBody) return fromBody

    const cookieHeader = request.headers.cookie
    const cookies = parseCookies(typeof cookieHeader === 'string' ? cookieHeader : undefined)
    return cookies[REFRESH_TOKEN_COOKIE_NAME] ?? null
}

function setNoStoreHeaders(reply: { header: (name: string, value: string) => unknown }): void {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    reply.header('Pragma', 'no-cache')
    reply.header('Expires', '0')
}

function getLoginRateLimitKey(email: string, ip: string): string {
    return `${email.toLowerCase()}|${ip}`
}

function consumeLoginAttempt(email: string, ip: string): { blocked: boolean; retryAfterMs: number } {
    const now = Date.now()
    const key = getLoginRateLimitKey(email, ip)
    const current = loginAttemptStore.get(key)

    if (!current) {
        loginAttemptStore.set(key, { count: 1, firstAttemptAt: now, blockedUntil: 0 })
        return { blocked: false, retryAfterMs: 0 }
    }

    if (current.blockedUntil > now) {
        return { blocked: true, retryAfterMs: current.blockedUntil - now }
    }

    if (now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
        loginAttemptStore.set(key, { count: 1, firstAttemptAt: now, blockedUntil: 0 })
        return { blocked: false, retryAfterMs: 0 }
    }

    current.count += 1
    if (current.count >= LOGIN_MAX_ATTEMPTS) {
        current.blockedUntil = now + LOGIN_BLOCK_MS
        return { blocked: true, retryAfterMs: LOGIN_BLOCK_MS }
    }

    loginAttemptStore.set(key, current)
    return { blocked: false, retryAfterMs: 0 }
}

function clearLoginAttempts(email: string, ip: string): void {
    loginAttemptStore.delete(getLoginRateLimitKey(email, ip))
}

async function usersTableExists(pgClient: PgClient): Promise<boolean> {
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
    return result.rows[0]?.found === true
}

async function getUserByEmail(pgClient: PgClient, email: string): Promise<AuthUserRecord | null> {
    const result = await pgClient.query<{
        id: string
        email: string
        name: string | null
        username: string | null
        role: string
        status: string | null
        password_hash: string
        is_active: boolean
    }>(
        `
        SELECT id, email, name, username, role, status, password_hash, COALESCE(is_active, true) AS is_active
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
        `,
        [email]
    )

    if (result.rows.length === 0) return null
    return normalizeDbUser(result.rows[0])
}

async function getUserById(pgClient: PgClient, userId: string): Promise<AuthUserRecord | null> {
    const result = await pgClient.query<{
        id: string
        email: string
        name: string | null
        username: string | null
        role: string
        status: string | null
        password_hash: string
        is_active: boolean
    }>(
        `
        SELECT id, email, name, username, role, status, password_hash, COALESCE(is_active, true) AS is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    )

    if (result.rows.length === 0) return null
    return normalizeDbUser(result.rows[0])
}

async function loadUserByEmail(pgClient: PgClient | undefined, email: string): Promise<AuthUserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase()
    if (pgClient) {
        const hasUsers = await usersTableExists(pgClient)
        if (hasUsers) {
            return getUserByEmail(pgClient, normalizedEmail)
        }
    }

    const mockUser = MOCK_USERS.find((entry) => entry.email.toLowerCase() === normalizedEmail)
    return mockUser ? normalizeMockUser(mockUser) : null
}

async function loadUserById(pgClient: PgClient | undefined, userId: string): Promise<AuthUserRecord | null> {
    if (pgClient) {
        const hasUsers = await usersTableExists(pgClient)
        if (hasUsers) {
            return getUserById(pgClient, userId)
        }
    }

    const mockUser = MOCK_USERS.find((entry) => entry.id === userId)
    return mockUser ? normalizeMockUser(mockUser) : null
}

function buildAuthResponse(user: AuthUserRecord, accessToken: string): AuthResponse {
    return {
        accessToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        tokenType: 'Bearer',
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            lastLogin: new Date().toISOString()
        }
    }
}

function signAccessToken(user: AuthUserRecord): string {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role } as TokenPayload,
        JWT_ACCESS_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    )
}

function signRefreshToken(userId: string): string {
    return jwt.sign(
        { userId, tokenId: randomUUID() } as RefreshPayload,
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    )
}

function storeRefreshToken(token: string, userId: string): void {
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    refreshTokenStore.set(token, { userId, expiresAt: refreshExpiresAt })
}

async function updateDbLastLogin(pgClient: PgClient | undefined, user: AuthUserRecord): Promise<void> {
    if (!pgClient) return
    try {
        const hasUsers = await usersTableExists(pgClient)
        if (!hasUsers) return
        await pgClient.query(
            `
            UPDATE users
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
            `,
            [user.id]
        )
    } catch {
        // Ignore non-blocking telemetry update failure.
    }
}

/**
 * Auth Routes Plugin
 */
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
    fastify: FastifyInstance,
    opts
) => {
    const pgClient = opts.pgClient ?? fastify.pgClient

    /**
     * POST /api/v1/auth/login
     * Authenticate user and return tokens
     */
    fastify.post<{
        Body: LoginRequest
    }>('/login', {
        schema: LoginRouteSchema
    }, async (request, reply) => {
        try {
            setNoStoreHeaders(reply)
            const { email, password } = request.body
            const normalizedEmail = email.trim().toLowerCase()
            const loginAttempt = consumeLoginAttempt(normalizedEmail, request.ip)
            if (loginAttempt.blocked) {
                const retryAfterSeconds = Math.max(1, Math.ceil(loginAttempt.retryAfterMs / 1000))
                reply.header('Retry-After', String(retryAfterSeconds))
                throw createHttpError(429, 'Too many failed login attempts. Please try again later.')
            }

            const user = await loadUserByEmail(pgClient, normalizedEmail)
            if (!user) {
                throw createHttpError(401, 'Invalid email or password')
            }

            const passwordMatch = await verifyPassword(password, user.passwordHash)

            if (!passwordMatch) {
                throw createHttpError(401, 'Invalid email or password')
            }

            if (!user.isActive || user.status !== 'active') {
                throw createHttpError(403, 'Account is not active')
            }

            clearLoginAttempts(normalizedEmail, request.ip)

            const accessToken = signAccessToken(user)
            const refreshToken = signRefreshToken(user.id)
            storeRefreshToken(refreshToken, user.id)
            await updateDbLastLogin(pgClient, user)
            setRefreshTokenCookie(reply, refreshToken)

            const authResponse = buildAuthResponse(user, accessToken)
            request.log.info({ userId: user.id, email: user.email }, 'User logged in successfully')
            reply.status(200).send(createSuccessResponse(authResponse, request.id))
        } catch (error) {
            if (isHttpError(error)) {
                reply
                    .status(error.statusCode)
                    .send(createErrorResponse(apiErrorFromStatus(error.statusCode, error.message), request.id))
                return
            }

            request.log.error({ error }, 'Login error')
            throw createHttpError(500, 'Login failed')
        }
    })

    /**
     * POST /api/v1/auth/refresh
     * Refresh access token using refresh token
     */
    fastify.post<{
        Body: RefreshTokenRequest
    }>('/refresh', {
        schema: RefreshRouteSchema
    }, async (request, reply) => {
        try {
            setNoStoreHeaders(reply)
            const refreshToken = extractRefreshTokenFromRequest(request)

            if (!refreshToken) {
                throw createHttpError(400, 'Refresh token is required')
            }

            let payload: RefreshPayload
            try {
                payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as RefreshPayload
            } catch {
                throw createHttpError(401, 'Invalid refresh token')
            }

            const tokenData = refreshTokenStore.get(refreshToken)
            if (!tokenData || tokenData.expiresAt < new Date()) {
                refreshTokenStore.delete(refreshToken)
                throw createHttpError(401, 'Refresh token expired or invalid')
            }

            const user = await loadUserById(pgClient, payload.userId)
            if (!user || !user.isActive || user.status !== 'active') {
                refreshTokenStore.delete(refreshToken)
                throw createHttpError(401, 'User not found or inactive')
            }

            const newAccessToken = signAccessToken(user)
            const newRefreshToken = signRefreshToken(user.id)
            refreshTokenStore.delete(refreshToken)
            storeRefreshToken(newRefreshToken, user.id)
            setRefreshTokenCookie(reply, newRefreshToken)

            const authResponse = buildAuthResponse(user, newAccessToken)
            reply.status(200).send(createSuccessResponse(authResponse, request.id))
        } catch (error) {
            if (isHttpError(error)) {
                reply
                    .status(error.statusCode)
                    .send(createErrorResponse(apiErrorFromStatus(error.statusCode, error.message), request.id))
                return
            }

            request.log.error({ error }, 'Token refresh error')
            throw createHttpError(500, 'Token refresh failed')
        }
    })

    /**
     * POST /api/v1/auth/logout
     * Logout user and invalidate refresh token
     */
    fastify.post<{
        Body: LogoutRequest
    }>('/logout', {
        schema: LogoutRouteSchema
    }, async (request, reply) => {
        try {
            setNoStoreHeaders(reply)
            const refreshToken = extractRefreshTokenFromRequest(request)

            if (refreshToken) {
                refreshTokenStore.delete(refreshToken)
            }
            clearRefreshTokenCookie(reply)

            reply.status(200).send(
                createSuccessResponse(
                    {
                        success: true,
                        message: 'Successfully logged out'
                    },
                    request.id
                )
            )
        } catch (error) {
            request.log.error({ error }, 'Logout error')
            throw createHttpError(500, 'Logout failed')
        }
    })

    /**
     * GET /api/v1/auth/me
     * Get current authenticated user information
     */
    fastify.get('/me', {
        schema: CurrentUserRouteSchema,
        preHandler: async (request) => {
            await authenticateBearerRequest(request, pgClient)
        }
    }, async (request, reply) => {
        try {
            setNoStoreHeaders(reply)
            const user = request.user
            if (!user) {
                throw createHttpError(401, 'User not available')
            }

            const current = await loadUserById(pgClient, user.id)
            if (!current || !current.isActive || current.status !== 'active') {
                throw createHttpError(401, 'User not found or inactive')
            }

            const userResponse: User = {
                id: current.id,
                email: current.email,
                name: current.name,
                role: current.role,
                status: current.status
            }

            reply.status(200).send(createSuccessResponse(userResponse, request.id))
        } catch (error) {
            if (isHttpError(error)) {
                reply
                    .status(error.statusCode)
                    .send(createErrorResponse(apiErrorFromStatus(error.statusCode, error.message), request.id))
                return
            }
            request.log.error({ error }, 'Get current user error')
            throw createHttpError(500, 'Failed to get user information')
        }
    })
}

export { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET }
export { refreshCookieConfig }
