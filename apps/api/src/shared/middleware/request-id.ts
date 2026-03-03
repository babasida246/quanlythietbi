/**
 * Request ID / Correlation ID Middleware
 */
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { randomUUID } from 'crypto'

const REQUEST_ID_HEADER = 'x-request-id'
const CORRELATION_ID_HEADER = 'x-correlation-id'

export function requestIdHook(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    // Get or generate request ID
    const requestId = (request.headers[REQUEST_ID_HEADER] as string) || randomUUID()

    // Get or use request ID as correlation ID
    const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) || requestId

    // Set on request for logging
    request.id = requestId
        ; (request as any).correlationId = correlationId

    // Set response headers
    reply.header(REQUEST_ID_HEADER, requestId)
    reply.header(CORRELATION_ID_HEADER, correlationId)

    done()
}
