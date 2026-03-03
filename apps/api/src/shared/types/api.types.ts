/**
 * Core API Types and Interfaces
 */

export interface ApiResponse<T = unknown> {
    success: true
    data: T
    meta: ResponseMeta
}

export interface ApiErrorResponse {
    success: false
    error: ApiError
    meta: ResponseMeta
}

export interface ResponseMeta {
    timestamp: string
    requestId: string
    pagination?: PaginationMeta
}

export interface PaginationMeta {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
}

export interface ApiError {
    code: string
    message: string
    details?: Record<string, unknown>
    field?: string
}

export interface PaginationQuery {
    page?: number
    limit?: number
}

export interface SortQuery {
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

export interface SearchQuery {
    q?: string
    search?: string
}

export type StandardQuery = PaginationQuery & SortQuery & SearchQuery

// Controller base class interface
export interface BaseController {
    readonly service: unknown
}

// Service base class interface  
export interface BaseService {
    readonly repository?: unknown
}

// Standard route options
export interface RouteOptions {
    auth?: boolean
    roles?: string[]
    rateLimit?: {
        max: number
        timeWindow: string
    }
}

// Module registration interface
export interface ApiModule {
    name: string
    prefix: string
    register: (app: import('fastify').FastifyInstance) => Promise<void>
}

// Database query interfaces
export interface ListOptions extends PaginationQuery, SortQuery {
    filters?: Record<string, unknown>
}

export interface CreateOptions {
    validate?: boolean
}

export interface UpdateOptions {
    validate?: boolean
    partial?: boolean
}