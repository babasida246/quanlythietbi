/**
 * Common Zod schemas used across the API
 */
import { z } from 'zod'

// UUID schema
export const uuidSchema = z.string().uuid()

// Pagination schemas
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

// Paginated response
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        meta: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
            hasNext: z.boolean(),
            hasPrev: z.boolean()
        })
    })

// Error response schema
export const errorResponseSchema = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional()
    }),
    requestId: z.string().optional()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// Success response schema
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: dataSchema,
        requestId: z.string().optional()
    })

// Timestamp fields
export const timestampsSchema = z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

// ID param schema
export const idParamSchema = z.object({
    id: uuidSchema
})

export type IdParam = z.infer<typeof idParamSchema>
