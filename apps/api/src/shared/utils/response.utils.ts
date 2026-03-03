/**
 * API Response Utilities
 */
import type {
    ApiResponse,
    ApiErrorResponse,
    ResponseMeta,
    PaginationMeta,
    ApiError
} from '../types/api.types.js'

/**
 * Create standard success response
 */
export function createSuccessResponse<T>(
    data: T,
    requestId: string,
    pagination?: PaginationMeta
): ApiResponse<T> {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            requestId,
            ...(pagination && { pagination })
        }
    }
}

/**
 * Create standard error response
 */
export function createErrorResponse(
    error: ApiError,
    requestId: string
): ApiErrorResponse {
    return {
        success: false,
        error,
        meta: {
            timestamp: new Date().toISOString(),
            requestId
        }
    }
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
    page: number,
    limit: number,
    total: number
): PaginationMeta {
    const totalPages = Math.ceil(total / limit)

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    }
}

/**
 * Normalize pagination parameters
 */
export function normalizePagination(query: {
    page?: string | number
    limit?: string | number
}) {
    const page = Math.max(1, parseInt(String(query.page ?? 1)))
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 10))))

    return { page, limit }
}

/**
 * Extract user context from request
 */
export function extractUserContext(request: any) {
    return {
        userId: request.user?.id,
        userRole: request.user?.role,
        userEmail: request.user?.email,
        role: request.user?.role,
        permissions: request.user?.permissions || []
    }
}

/**
 * Standard API error codes
 */
export const ERROR_CODES = {
    // Client errors (4xx)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',

    // Server errors (5xx)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const

/**
 * Create standard API errors
 */
export const createApiError = {
    badRequest: (message: string, details?: Record<string, unknown>): ApiError => ({
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details
    }),

    validation: (message: string, details?: Record<string, unknown>): ApiError => ({
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details
    }),

    notFound: (resource: string, id?: string): ApiError => ({
        code: ERROR_CODES.NOT_FOUND,
        message: `${resource}${id ? ` with ID '${id}'` : ''} not found`
    }),

    unauthorized: (message = 'Authentication required'): ApiError => ({
        code: ERROR_CODES.AUTHENTICATION_ERROR,
        message
    }),

    forbidden: (message = 'Insufficient permissions'): ApiError => ({
        code: ERROR_CODES.AUTHORIZATION_ERROR,
        message
    }),

    conflict: (message: string): ApiError => ({
        code: ERROR_CODES.CONFLICT,
        message
    }),

    internal: (message = 'Internal server error'): ApiError => ({
        code: ERROR_CODES.INTERNAL_ERROR,
        message
    })
}
