/**
 * Redis Plugin
 * Khởi tạo ReportCachingService (Redis-backed hoặc in-memory fallback)
 * và decorate Fastify instance để các route có thể sử dụng.
 */
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { ReportCachingService } from '@qltb/application'
import { env } from '../../config/env.js'

declare module 'fastify' {
    interface FastifyInstance {
        cache: ReportCachingService
    }
}

export const redisPlugin = fp(async (fastify: FastifyInstance) => {
    const cacheService = new ReportCachingService({
        redisUrl: env.REDIS_URL,
        ttlSeconds: env.REDIS_CACHE_TTL,
        enabled: env.REDIS_CACHE_ENABLED === 'true'
    })

    await cacheService.initialize(env.REDIS_URL)

    fastify.decorate('cache', cacheService)

    fastify.addHook('onClose', async () => {
        await cacheService.disconnect()
        console.log('🔌 Redis cache disconnected')
    })

    const mode = env.REDIS_CACHE_ENABLED === 'true' ? 'Redis' : 'Disabled'
    console.log(`✅ Cache initialized [${mode}] - TTL: ${env.REDIS_CACHE_TTL}s`)
})
