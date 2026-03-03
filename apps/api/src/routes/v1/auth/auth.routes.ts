/**
 * Auth API Routes
 * Authentication endpoints for the Asset Management System
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'

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
        password: 'admin123',
        status: 'active'
    },
    {
        id: 'user-002',
        email: 'manager@example.com',
        name: 'Asset Manager',
        role: 'manager',
        password: 'manager123',
        status: 'active'
    },
    {
        id: 'user-003',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        password: 'user123',
        status: 'active'
    }
]

// In-memory store for refresh tokens (in production, use Redis or database)
const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date }>()

// JWT secrets (in production, use environment variables)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key'
const ACCESS_TOKEN_EXPIRES_IN = '15m' // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d' // 7 days

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
        passwordHash: user.password,
        isActive: user.status === 'active'
    }
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

function buildAuthResponse(user: AuthUserRecord, accessToken: string, refreshToken: string): AuthResponse {
    return {
        accessToken,
        refreshToken,
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
            const { email, password } = request.body
            const normalizedEmail = email.trim().toLowerCase()

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

            const accessToken = signAccessToken(user)
            const refreshToken = signRefreshToken(user.id)
            storeRefreshToken(refreshToken, user.id)
            await updateDbLastLogin(pgClient, user)

            const authResponse = buildAuthResponse(user, accessToken, refreshToken)
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
            const { refreshToken } = request.body

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

            const authResponse = buildAuthResponse(user, newAccessToken, newRefreshToken)
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
            const { refreshToken } = request.body

            if (refreshToken) {
                refreshTokenStore.delete(refreshToken)
            }

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
