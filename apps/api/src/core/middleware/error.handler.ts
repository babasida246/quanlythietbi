/**
 * Standardized Error Handler
 */
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { createErrorResponse, createApiError, ERROR_CODES } from '../../shared/utils/response.utils.js'

/**
 * Standard error handler for all API endpoints
 */
export async function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const requestId = request.id

    // Zod validation errors
    if (error instanceof ZodError) {
        const details = error.errors.reduce((acc, err) => {
            const path = err.path.join('.')
            acc[path] = err.message
            return acc
        }, {} as Record<string, string>)

        const apiError = createApiError.validation(
            'Validation failed',
            details
        )

        reply.status(400).send(createErrorResponse(apiError, requestId))
        return
    }

    // Fastify validation errors
    if (error.validation) {
        const details = error.validation.reduce((acc, err) => {
            const path = err.instancePath || err.schemaPath || 'unknown'
            acc[path] = err.message || 'Invalid value'
            return acc
        }, {} as Record<string, string>)

        const apiError = createApiError.validation(
            'Request validation failed',
            details
        )

        reply.status(400).send(createErrorResponse(apiError, requestId))
        return
    }

    // Rate limit errors
    if (error.statusCode === 429) {
        const apiError = {
            code: ERROR_CODES.RATE_LIMITED,
            message: 'Too many requests, please try again later'
        }

        reply.status(429).send(createErrorResponse(apiError, requestId))
        return
    }

    // Authentication errors
    if (error.statusCode === 401) {
        const apiError = createApiError.unauthorized(error.message)
        reply.status(401).send(createErrorResponse(apiError, requestId))
        return
    }

    // Authorization errors  
    if (error.statusCode === 403) {
        const apiError = createApiError.forbidden(error.message)
        reply.status(403).send(createErrorResponse(apiError, requestId))
        return
    }

    // Not found errors
    if (error.statusCode === 404) {
        const apiError = createApiError.notFound('Resource')
        reply.status(404).send(createErrorResponse(apiError, requestId))
        return
    }

    // Database errors
    if (error.message.includes('database') || error.message.includes('sql')) {
        request.log.error({ error, requestId }, 'Database error')

        const apiError = {
            code: ERROR_CODES.DATABASE_ERROR,
            message: 'Database operation failed'
        }

        reply.status(500).send(createErrorResponse(apiError, requestId))
        return
    }

    // Generic server errors
    request.log.error({ error, requestId }, 'Unhandled error')

    const apiError = createApiError.internal(
        process.env.NODE_ENV === 'development' ? error.message : undefined
    )

    reply.status(error.statusCode || 500).send(createErrorResponse(apiError, requestId))
}