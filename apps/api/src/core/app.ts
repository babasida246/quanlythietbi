/**
 * QuanLyThietBi - Asset Management API
 * Simplified app that registers only the assets module.
 */
import Fastify, { type FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import multipart from '@fastify/multipart'
import type { PgClient } from '@qltb/infra-postgres'

import { env } from '../config/env.js'

// Middleware
import { errorHandler } from './middleware/error.handler.js'
import {
    requestIdHook,
    contextHook,
    requestLogHook,
    responseTimeHook
} from './middleware/request.hooks.js'
import { createApiV1AuthHook } from './middleware/api-auth.hook.js'
import { registerSecurity } from './plugins/security.plugin.js'
import { registerDocs } from './plugins/docs.plugin.js'
import { redisPlugin } from './plugins/redis.plugin.js'

// Asset module
import { registerAssetModule } from '../routes/v1/assets/assets.module.js'
// Auth module
import { registerAuthModule } from '../routes/v1/auth/auth.module.js'
import { registerSetupModule } from '../routes/setup/setup.module.js'
import { createApiError, createErrorResponse } from '../shared/utils/response.utils.js'

export interface AppDependencies {
    db: PgClient
    pgClient: PgClient
}

export async function createApp(deps: AppDependencies): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            transport: env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined
        },
        requestIdHeader: 'x-request-id',
        genReqId: () => randomUUID(),
        disableRequestLogging: false
    })

    fastify.decorate('pgClient', deps.pgClient)

    // ==================== Plugins ====================
    await registerSecurity(fastify, {
        cors: { origin: true, credentials: true },
        rateLimit: {
            enabled: env.ENABLE_RATE_LIMIT === 'true',
            max: env.RATE_LIMIT_MAX,
            timeWindow: env.RATE_LIMIT_WINDOW_MS
        },
        helmet: { contentSecurityPolicy: false }
    })

    await fastify.register(multipart)

    // ==================== Redis Cache ====================
    await fastify.register(redisPlugin)

    await registerDocs(fastify, {
        title: 'QuanLyThietBi API',
        description: 'Hệ thống Quản lý Thiết bị - REST API',
        version: '1.0.0',
        servers: [
            { url: 'http://localhost:3000', description: 'Development' }
        ]
    })

    // ==================== Hooks ====================
    fastify.addHook('onRequest', requestIdHook)
    fastify.addHook('onRequest', createApiV1AuthHook(deps.pgClient))
    fastify.addHook('onRequest', contextHook)
    fastify.addHook('onRequest', requestLogHook)
    fastify.addHook('preValidation', responseTimeHook)

    fastify.setErrorHandler(errorHandler)
    fastify.setNotFoundHandler((request, reply) => {
        const requestId = typeof request.id === 'string' ? request.id : randomUUID()
        const apiError = createApiError.notFound('Resource')
        reply.status(404).send(createErrorResponse(apiError, requestId))
    })

    // ==================== Health Check ====================
    fastify.get('/health', {
        schema: { tags: ['Health'] }
    }, async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    }))

    fastify.get('/health/ready', {
        schema: { tags: ['Health'] }
    }, async () => {
        try {
            await deps.db.query('SELECT 1')
            const cacheEnabled = fastify.cache?.isEnabled() ?? false
            return {
                status: 'ready',
                db: 'ok',
                cache: cacheEnabled ? 'ok' : 'disabled',
                timestamp: new Date().toISOString()
            }
        } catch {
            return { status: 'not_ready', db: 'error', timestamp: new Date().toISOString() }
        }
    })

    // ==================== Setup Module ====================
    try {
        console.log('🛠 Registering setup module...')
        await registerSetupModule(fastify, {
            pgClient: deps.pgClient,
            rootDir: process.cwd(),
            appVersion: '1.0.0'
        })
        console.log('✅ Setup module registered successfully')
    } catch (error) {
        console.error('❌ Setup module registration failed:', error)
        throw error
    }

    // ==================== Auth Module ====================
    try {
        console.log('🔐 Registering auth module...')
        await registerAuthModule(fastify, { pgClient: deps.pgClient })
        console.log('✅ Auth module registered successfully')
    } catch (error) {
        console.error('❌ Auth module registration failed:', error)
        throw error
    }

    // ==================== Asset Module ====================
    try {
        console.log('🔧 Registering asset module...')
        await registerAssetModule(fastify, { pgClient: deps.pgClient, cache: fastify.cache })
        console.log('✅ Asset module registered successfully')
    } catch (error) {
        console.error('❌ Asset module registration failed:', error)
        throw error
    }

    // ==================== Utility Routes ====================
    fastify.get('/openapi.json', { schema: { hide: true } }, async () => fastify.swagger())

    fastify.get('/', { schema: { hide: true } }, async () => ({
        name: 'QuanLyThietBi API',
        version: '1.0.0',
        docs: '/docs',
        timestamp: new Date().toISOString()
    }))

    return fastify
}
