/**
 * Security plugins configuration
 */
import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

export interface SecurityConfig {
    cors: {
        origin: string[] | boolean
        credentials: boolean
    }
    rateLimit: {
        enabled: boolean
        max: number
        timeWindow: number
    }
    helmet: {
        contentSecurityPolicy: boolean
    }
}

export async function registerSecurity(
    fastify: FastifyInstance,
    config: SecurityConfig
): Promise<void> {
    // CORS
    await fastify.register(cors, {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })

    // Security headers
    await fastify.register(helmet, {
        contentSecurityPolicy: config.helmet.contentSecurityPolicy
    })

    // Rate limiting
    if (config.rateLimit.enabled) {
        await fastify.register(rateLimit, {
            max: config.rateLimit.max,
            timeWindow: config.rateLimit.timeWindow
        })

        fastify.log.info(
            `Rate limiting enabled: ${config.rateLimit.max} requests per ${config.rateLimit.timeWindow}ms`
        )
    } else {
        fastify.log.info('Rate limiting disabled')
    }
}