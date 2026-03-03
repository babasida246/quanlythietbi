/**
 * Redis Caching Service
 * Wraps report services with Redis caching (15-minute TTL)
 */

import { createClient, type RedisClientType } from 'redis'
import type { CiInventoryReportService } from './CiInventoryReportService.js'
import type { RelationshipAnalyticsService } from './RelationshipAnalyticsService.js'
import type { AuditTrailService } from './AuditTrailService.js'

export interface CacheConfig {
    redisUrl?: string
    ttlSeconds?: number
    enabled?: boolean
}

/**
 * Report Caching Service
 * Provides Redis-backed caching for CMDB reports
 * Default TTL: 15 minutes
 */
export class ReportCachingService {
    private redis: RedisClientType | null = null
    private memoryCache = new Map<string, { value: string; expiresAt: number | null }>()
    private readonly ttl: number
    private enabled: boolean
    private initialized = false

    constructor(config: CacheConfig = {}) {
        this.ttl = config.ttlSeconds ?? 15 * 60 // 15 minutes default
        this.enabled = config.enabled ?? true
    }

    /**
     * Initialize Redis connection
     */
    async initialize(redisUrl?: string): Promise<void> {
        if (!this.enabled) return
        if (process.env.NODE_ENV === 'test' || process.env.REPORT_CACHE_MODE === 'memory') {
            this.initialized = true
            return
        }

        try {
            const url = typeof redisUrl === 'string' && redisUrl.length > 0
                ? redisUrl
                : process.env.REDIS_URL ?? 'redis://localhost:6379'
            this.redis = createClient({
                url,
                socket: {
                    connectTimeout: 250,
                    reconnectStrategy: () => false
                }
            })

            this.redis.on('error', (err: unknown) => {
                console.error('Redis Client Error', err)
            })

            this.redis.on('connect', () => {
                console.log('Redis Client Connected')
            })

            await this.redis.connect()
            this.initialized = true
        } catch (error) {
            // Keep cache usable in development/tests even when Redis is unavailable.
            console.error('Failed to initialize Redis, falling back to in-memory cache:', error)
            this.redis = null
            this.initialized = true
        }
    }

    /**
     * Disconnect Redis
     */
    async disconnect(): Promise<void> {
        if (this.redis?.isOpen) {
            await this.redis.disconnect().catch(() => {
                // no-op
            })
        }
        this.redis = null
        this.initialized = false
    }

    /**
     * Get cached value
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.enabled || !this.initialized) return null

        try {
            if (this.redis) {
                const cached = await this.redis.get(key)
                if (cached) {
                    return JSON.parse(cached) as T
                }
                return null
            }

            const entry = this.memoryCache.get(key)
            if (!entry) return null
            if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
                this.memoryCache.delete(key)
                return null
            }
            return JSON.parse(entry.value) as T
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error)
            return null
        }
    }

    /**
     * Set cached value with TTL
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        if (!this.enabled || !this.initialized) return

        try {
            const ttlValue = ttl ?? this.ttl
            if (this.redis) {
                await this.redis.setEx(key, ttlValue, JSON.stringify(value))
                return
            }

            this.memoryCache.set(key, {
                value: JSON.stringify(value),
                expiresAt: Date.now() + ttlValue * 1000
            })
        } catch (error) {
            console.error(`Cache set error for key ${key}:`, error)
        }
    }

    /**
     * Delete cached value
     */
    async delete(key: string): Promise<void> {
        if (!this.enabled || !this.initialized) return

        try {
            if (this.redis) {
                await this.redis.del(key)
                return
            }
            this.memoryCache.delete(key)
        } catch (error) {
            console.error(`Cache delete error for key ${key}:`, error)
        }
    }

    /**
     * Clear all cache with prefix
     */
    async clearByPrefix(prefix: string): Promise<void> {
        if (!this.enabled || !this.initialized) return

        try {
            if (this.redis) {
                const keys = await this.redis.keys(`${prefix}:*`)
                if (keys.length > 0) {
                    await this.redis.del(keys)
                }
                return
            }

            const normalizedPrefix = `${prefix}:`
            for (const key of this.memoryCache.keys()) {
                if (key.startsWith(normalizedPrefix) || key === prefix) {
                    this.memoryCache.delete(key)
                }
            }
        } catch (error) {
            console.error(`Cache clear prefix error for ${prefix}:`, error)
        }
    }

    /**
     * Check if cache is enabled
     */
    isEnabled(): boolean {
        return this.enabled && this.initialized
    }
}

/**
 * Cached CI Inventory Report Service
 * Wraps original service with caching layer
 */
export class CachedCiInventoryReportService {
    private cache: ReportCachingService

    constructor(
        private originalService: CiInventoryReportService,
        cache: ReportCachingService
    ) {
        this.cache = cache
    }

    async generateCiInventoryReport() {
        const cacheKey = 'report:ci-inventory'

        // Try to get from cache first
        const cached = await this.cache.get(cacheKey)
        if (cached) {
            console.log('Cache hit for CI Inventory Report')
            return cached
        }

        // Generate fresh report
        console.log('Cache miss - generating CI Inventory Report')
        const report = await this.originalService.generateCiInventoryReport()

        // Cache the result
        await this.cache.set(cacheKey, report)

        return report
    }
}

/**
 * Cached Relationship Analytics Service
 * Wraps original service with caching layer
 */
export class CachedRelationshipAnalyticsService {
    private cache: ReportCachingService

    constructor(
        private originalService: RelationshipAnalyticsService,
        cache: ReportCachingService
    ) {
        this.cache = cache
    }

    async generateAnalyticsReport() {
        const cacheKey = 'report:relationship-analytics'

        // Try to get from cache first
        const cached = await this.cache.get(cacheKey)
        if (cached) {
            console.log('Cache hit for Relationship Analytics Report')
            return cached
        }

        // Generate fresh report
        console.log('Cache miss - generating Relationship Analytics Report')
        const report = await this.originalService.generateAnalyticsReport()

        // Cache the result
        await this.cache.set(cacheKey, report)

        return report
    }
}

/**
 * Cached Audit Trail Service
 * Wraps original service with caching layer
 */
export class CachedAuditTrailService {
    private cache: ReportCachingService

    constructor(
        private originalService: AuditTrailService,
        cache: ReportCachingService
    ) {
        this.cache = cache
    }

    async generateAuditTrailReport(ciId?: string, startDate?: Date, endDate?: Date) {
        // Build cache key based on parameters
        const params = [ciId, startDate?.toISOString(), endDate?.toISOString()].filter(Boolean).join(':')
        const cacheKey = params ? `report:audit-trail:${params}` : 'report:audit-trail'

        // Try to get from cache first
        const cached = await this.cache.get(cacheKey)
        if (cached) {
            console.log(`Cache hit for Audit Trail Report (${cacheKey})`)
            return cached
        }

        // Generate fresh report
        console.log(`Cache miss - generating Audit Trail Report (${cacheKey})`)
        const report = await this.originalService.generateAuditTrailReport(ciId, startDate, endDate)

        // Cache the result
        await this.cache.set(cacheKey, report)

        return report
    }

    /**
     * Invalidate audit trail cache (called when data changes)
     */
    async invalidateCache(): Promise<void> {
        await this.cache.clearByPrefix('report:audit-trail')
    }
}

/**
 * Cache Invalidator
 * Handles cache invalidation when data changes
 */
export class CacheInvalidator {
    private cache: ReportCachingService

    constructor(cache: ReportCachingService) {
        this.cache = cache
    }

    /**
     * Invalidate all report caches
     */
    async invalidateAllReports(): Promise<void> {
        console.log('Invalidating all report caches')
        await this.cache.clearByPrefix('report')
    }

    /**
     * Invalidate CI-related caches
     */
    async invalidateCiReports(): Promise<void> {
        console.log('Invalidating CI report caches')
        await this.cache.delete('report:ci-inventory')
        await this.cache.delete('report:relationship-analytics')
    }

    /**
     * Invalidate relationship-related caches
     */
    async invalidateRelationshipReports(): Promise<void> {
        console.log('Invalidating relationship report caches')
        await this.cache.delete('report:relationship-analytics')
    }

    /**
     * Invalidate audit trail cache
     */
    async invalidateAuditTrail(): Promise<void> {
        console.log('Invalidating audit trail cache')
        await this.cache.clearByPrefix('report:audit-trail')
    }
}
