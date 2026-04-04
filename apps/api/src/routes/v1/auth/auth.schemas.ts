/**
 * Auth API - JSON Schemas
 * Authentication and authorization schemas
 */
import { Type } from '@sinclair/typebox'

// ==================== Request Schemas ====================

/**
 * Login Request Schema
 */
export const LoginRequestSchema = Type.Object({
    email: Type.String({
        format: 'email',
        description: 'User email address'
    }),
    password: Type.String({
        minLength: 1,
        writeOnly: true,
        description: 'User password'
    })
}, {
    title: 'Login Request',
    description: 'User credentials for authentication'
})

/**
 * Refresh Token Request Schema
 */
export const RefreshTokenRequestSchema = Type.Object({
    refreshToken: Type.Optional(Type.String({
        writeOnly: true,
        description: 'Refresh token for getting new access token'
    }))
}, {
    title: 'Refresh Token Request',
    description: 'Request to refresh authentication tokens'
})

/**
 * Logout Request Schema
 */
export const LogoutRequestSchema = Type.Object({
    refreshToken: Type.Optional(Type.String({
        writeOnly: true,
        description: 'Refresh token to invalidate'
    }))
}, {
    title: 'Logout Request',
    description: 'Optional refresh token to revoke'
})

// ==================== Response Schemas ====================

/**
 * User Schema
 */
export const UserSchema = Type.Object({
    id: Type.String({
        description: 'Unique user identifier'
    }),
    email: Type.String({
        format: 'email',
        description: 'User email address'
    }),
    name: Type.String({
        description: 'Full name of the user'
    }),
    role: Type.String({
        description: 'User role (admin, manager, user, etc.)'
    }),
    status: Type.Optional(Type.String({
        description: 'Account status (active, inactive, etc.)'
    })),
    lastLogin: Type.Optional(Type.String({
        format: 'date-time',
        description: 'Last login timestamp'
    }))
}, {
    title: 'User',
    description: 'User information'
})

/**
 * Auth Response Schema
 */
export const AuthResponseSchema = Type.Object({
    accessToken: Type.String({
        description: 'JWT access token'
    }),
    refreshToken: Type.Optional(Type.String({
        description: 'JWT refresh token (legacy field, migrated to HttpOnly cookie)'
    })),
    expiresIn: Type.Number({
        description: 'Token expiration time in seconds'
    }),
    tokenType: Type.Optional(Type.String({
        default: 'Bearer',
        description: 'Token type'
    })),
    user: UserSchema
}, {
    title: 'Authentication Response',
    description: 'Successful authentication result'
})

/**
 * Auth Error Schema
 */
export const AuthErrorSchema = Type.Object({
    error: Type.Object({
        message: Type.String({
            description: 'Error message'
        }),
        type: Type.String({
            description: 'Error type'
        }),
        code: Type.Optional(Type.String({
            description: 'Error code'
        }))
    })
}, {
    title: 'Authentication Error',
    description: 'Authentication error response'
})

// ==================== Route Schemas ====================

/**
 * Login Route Schema
 */
export const LoginRouteSchema = {
    tags: ['Authentication'],
    summary: 'User login',
    description: 'Authenticate user with email and password',
    body: LoginRequestSchema
} as const

/**
 * Refresh Route Schema
 */
export const RefreshRouteSchema = {
    tags: ['Authentication'],
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token',
    body: RefreshTokenRequestSchema
} as const

/**
 * Logout Route Schema
 */
export const LogoutRouteSchema = {
    tags: ['Authentication'],
    summary: 'User logout',
    description: 'Invalidate user session and refresh token',
    body: LogoutRequestSchema
} as const

/**
 * Current User Route Schema
 */
export const CurrentUserRouteSchema = {
    tags: ['Authentication'],
    summary: 'Get current user',
    description: 'Get authenticated user information'
} as const

// ==================== Type Exports ====================
export type LoginRequest = typeof LoginRequestSchema.static
export type RefreshTokenRequest = typeof RefreshTokenRequestSchema.static
export type LogoutRequest = typeof LogoutRequestSchema.static
export type User = typeof UserSchema.static
export type AuthResponse = typeof AuthResponseSchema.static
export type AuthError = typeof AuthErrorSchema.static
