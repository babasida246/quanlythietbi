import type { FastifyReply, FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { UnauthorizedError } from '../../shared/errors/http-errors.js'
import { authenticateBearerRequest } from '../../shared/security/jwt-auth.js'

function getRequestPath(request: FastifyRequest): string {
    const rawUrl = typeof request.url === 'string' ? request.url : String(request.url ?? '')
    const queryIndex = rawUrl.indexOf('?')
    return queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl
}

function shouldSkipAuth(request: FastifyRequest): boolean {
    if (request.method === 'OPTIONS') return true

    const path = getRequestPath(request)
    if (!path.startsWith('/api/v1')) return true

    if (path === '/api/v1/auth' || path.startsWith('/api/v1/auth/')) return true
    // Inbound webhooks are called by external systems (Zabbix) — auth via HMAC secret
    return path.startsWith('/api/v1/integrations/inbound/')
}

export function createApiV1AuthHook(pgClient?: PgClient) {
    return async function apiV1AuthHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
        if (shouldSkipAuth(request)) return

        if (request.user?.id) return

        const authHeader = request.headers.authorization
        if (authHeader?.startsWith('Bearer ')) {
            await authenticateBearerRequest(request, pgClient)
            return
        }

        throw new UnauthorizedError('Missing or invalid authorization header')
    }
}
