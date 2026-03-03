/**
 * Request middleware utilities
 */
import { randomUUID } from 'crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Add request ID to all requests
 */
export async function requestIdHook(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    request.id = request.id || randomUUID()
}

/**
 * Add user context and language detection
 */
export async function contextHook(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    try {
        // Detect language from header
        const lang = request.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en'
        request.language = ['en', 'vi'].includes(lang) ? lang : 'en'

        // Add user context if authenticated
        if (request.user && typeof request.user === 'object') {
            request.userContext = {
                userId: request.user.id,
                roles: [request.user.role],
                permissions: request.user.permissions || []
            }
        }
    } catch (error) {
        // Log error but don't throw to avoid breaking the request
        request.log.error({ error }, 'Error in contextHook')
    }
}

/**
 * Request logging hook
 */
export async function requestLogHook(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    try {
        request.log.info({
            requestId: request.id,
            method: request.method,
            url: request.url,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            userId: request.user?.id
        }, 'Incoming request')
    } catch (error) {
        // Use console.log as fallback if request.log fails
        console.log('Request log error:', error)
    }
}

/**
 * Response time hook  
 */
export async function responseTimeHook(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const startTime = Date.now()

        // Use reply.raw.addHook or reply hooks correctly
        reply.header('x-response-time-start', startTime.toString())

        // Alternative approach - set the response time directly
        const originalSend = reply.send
        reply.send = function (payload) {
            const responseTime = Date.now() - startTime
            this.header('x-response-time', `${responseTime}ms`)
            return originalSend.call(this, payload)
        }
    } catch (error) {
        console.log('Response time hook error:', error)
    }
}