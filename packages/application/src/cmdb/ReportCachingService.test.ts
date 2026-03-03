import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    ReportCachingService,
    CachedCiInventoryReportService,
    CachedRelationshipAnalyticsService,
    CachedAuditTrailService,
    CacheInvalidator
} from './ReportCachingService.js'

// Mock services
const mockCiInventoryReportService = {
    generateCiInventoryReport: vi.fn(async () => ({
        generatedAt: new Date(),
        totalCiCount: 100,
        orphanedCiCount: 5
    }))
}

const mockRelationshipAnalyticsService = {
    generateAnalyticsReport: vi.fn(async () => ({
        generatedAt: new Date(),
        totalRelationshipCount: 250
    }))
}

const mockAuditTrailService = {
    generateAuditTrailReport: vi.fn(async () => ({
        generatedAt: new Date(),
        ciChangeHistory: []
    }))
}

describe('CMDB Reports - Redis Caching', () => {
    let cacheService: ReportCachingService

    beforeEach(async () => {
        cacheService = new ReportCachingService({ enabled: true })
        // Use in-memory cache simulation if Redis unavailable
        await cacheService.initialize('redis://localhost:6379').catch(() => {
            console.log('Redis not available, using cache simulation')
        })
        vi.clearAllMocks()
    })

    afterEach(async () => {
        await cacheService.disconnect()
    })

    describe('ReportCachingService', () => {
        it('initializes Redis connection', async () => {
            const cache = new ReportCachingService({ enabled: true })
            await cache.initialize()
            expect(cache.isEnabled()).toBe(true)
            await cache.disconnect()
        })

        it('disables cache when enabled is false', () => {
            const cache = new ReportCachingService({ enabled: false })
            expect(cache.isEnabled()).toBe(false)
        })

        it('sets and gets cached values', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const testData = { test: 'data', value: 123 }
            await cacheService.set('test:key', testData)

            const retrieved = await cacheService.get('test:key')
            expect(retrieved).toEqual(testData)

            await cacheService.delete('test:key')
        })

        it('respects TTL for cached values', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const testData = { temporary: 'value' }
            const shortTtl = 1 // 1 second

            await cacheService.set('short:ttl', testData, shortTtl)

            // Should exist immediately
            const immediate = await cacheService.get('short:ttl')
            expect(immediate).toBeTruthy()

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 1100))

            // Should be expired
            const expired = await cacheService.get('short:ttl')
            expect(expired).toBeNull()
        })

        it('deletes cached values', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const testData = { deleteme: 'yes' }
            await cacheService.set('delete:test', testData)

            // Should exist
            const before = await cacheService.get('delete:test')
            expect(before).toBeTruthy()

            // Delete
            await cacheService.delete('delete:test')

            // Should not exist
            const after = await cacheService.get('delete:test')
            expect(after).toBeNull()
        })

        it('clears cache by prefix', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            // Set multiple keys with same prefix
            await cacheService.set('prefix:key1', { data: 1 })
            await cacheService.set('prefix:key2', { data: 2 })
            await cacheService.set('other:key', { data: 3 })

            // Clear prefix
            await cacheService.clearByPrefix('prefix')

            // Keys with prefix should be deleted
            const key1 = await cacheService.get('prefix:key1')
            const key2 = await cacheService.get('prefix:key2')
            expect(key1).toBeNull()
            expect(key2).toBeNull()

            // Other key should remain
            const other = await cacheService.get('other:key')
            expect(other).toBeTruthy()

            // Cleanup
            await cacheService.delete('other:key')
        })

        it('handles errors gracefully', async () => {
            const cache = new ReportCachingService({ enabled: true })
            // Don't initialize - will fail gracefully

            // Should not throw
            await cache.set('test', { data: 'value' })
            const result = await cache.get('test')
            expect(result).toBeNull()
        })
    })

    describe('CachedCiInventoryReportService', () => {
        it('returns report from original service on cache miss', async () => {
            const cachedService = new CachedCiInventoryReportService(
                mockCiInventoryReportService as any,
                cacheService
            )

            const report = await cachedService.generateCiInventoryReport()

            expect(report).toBeDefined()
            expect(report.totalCiCount).toBe(100)
            expect(mockCiInventoryReportService.generateCiInventoryReport).toHaveBeenCalledOnce()
        })

        it('returns cached report on subsequent calls', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const cachedService = new CachedCiInventoryReportService(
                mockCiInventoryReportService as any,
                cacheService
            )

            // First call - cache miss
            const report1 = await cachedService.generateCiInventoryReport()
            expect(mockCiInventoryReportService.generateCiInventoryReport).toHaveBeenCalledOnce()

            // Second call - cache hit
            const report2 = await cachedService.generateCiInventoryReport()
            expect(mockCiInventoryReportService.generateCiInventoryReport).toHaveBeenCalledOnce() // Still once!

            // Reports should be equivalent
            expect(report1.totalCiCount).toBe(report2.totalCiCount)
        })
    })

    describe('CachedRelationshipAnalyticsService', () => {
        it('generates and caches analytics report', async () => {
            const cachedService = new CachedRelationshipAnalyticsService(
                mockRelationshipAnalyticsService as any,
                cacheService
            )

            const report = await cachedService.generateAnalyticsReport()

            expect(report).toBeDefined()
            expect(report.totalRelationshipCount).toBe(250)
            expect(mockRelationshipAnalyticsService.generateAnalyticsReport).toHaveBeenCalledOnce()
        })

        it('caches based on report type', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const cachedService = new CachedRelationshipAnalyticsService(
                mockRelationshipAnalyticsService as any,
                cacheService
            )

            await cachedService.generateAnalyticsReport()
            await cachedService.generateAnalyticsReport()

            // Should only call original service once due to caching
            expect(mockRelationshipAnalyticsService.generateAnalyticsReport).toHaveBeenCalledOnce()
        })
    })

    describe('CachedAuditTrailService', () => {
        it('generates and caches audit trail report', async () => {
            const cachedService = new CachedAuditTrailService(
                mockAuditTrailService as any,
                cacheService
            )

            const report = await cachedService.generateAuditTrailReport()

            expect(report).toBeDefined()
            expect(mockAuditTrailService.generateAuditTrailReport).toHaveBeenCalledOnce()
        })

        it('caches audit trail with different parameters', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const cachedService = new CachedAuditTrailService(
                mockAuditTrailService as any,
                cacheService
            )

            const now = new Date()
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

            // Call with different parameters
            await cachedService.generateAuditTrailReport('ci-001', yesterday, now)
            await cachedService.generateAuditTrailReport('ci-002', yesterday, now)

            // Each should call original service (different parameters)
            expect(mockAuditTrailService.generateAuditTrailReport).toHaveBeenCalledTimes(2)
        })

        it('invalidates audit trail cache', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const cachedService = new CachedAuditTrailService(
                mockAuditTrailService as any,
                cacheService
            )

            // Generate and cache
            await cachedService.generateAuditTrailReport()
            expect(mockAuditTrailService.generateAuditTrailReport).toHaveBeenCalledTimes(1)

            // Invalidate cache
            await cachedService.invalidateCache()

            // Next call should generate fresh
            await cachedService.generateAuditTrailReport()
            expect(mockAuditTrailService.generateAuditTrailReport).toHaveBeenCalledTimes(2)
        })
    })

    describe('CacheInvalidator', () => {
        it('invalidates all report caches', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const invalidator = new CacheInvalidator(cacheService)

            // Set some cache keys
            await cacheService.set('report:test1', { data: 1 })
            await cacheService.set('report:test2', { data: 2 })

            // Verify they exist
            let test1 = await cacheService.get('report:test1')
            expect(test1).toBeTruthy()

            // Invalidate all
            await invalidator.invalidateAllReports()

            // Verify they're deleted
            test1 = await cacheService.get('report:test1')
            expect(test1).toBeNull()
        })

        it('invalidates CI report caches', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const invalidator = new CacheInvalidator(cacheService)

            // Set cache keys
            await cacheService.set('report:ci-inventory', { data: 1 })
            await cacheService.set('report:relationship-analytics', { data: 2 })

            // Invalidate CI reports
            await invalidator.invalidateCiReports()

            // Verify they're deleted
            const ci = await cacheService.get('report:ci-inventory')
            const rel = await cacheService.get('report:relationship-analytics')
            expect(ci).toBeNull()
            expect(rel).toBeNull()
        })

        it('invalidates audit trail cache', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const invalidator = new CacheInvalidator(cacheService)

            // Set audit trail cache
            await cacheService.set('report:audit-trail:ci-001', { data: 1 })

            // Invalidate
            await invalidator.invalidateAuditTrail()

            // Verify deleted
            const audit = await cacheService.get('report:audit-trail:ci-001')
            expect(audit).toBeNull()
        })
    })

    describe('Cache Performance', () => {
        it('improves performance with caching', async () => {
            if (!cacheService.isEnabled()) {
                console.log('Skipping test - Redis not available')
                return
            }

            const slowService = {
                generateCiInventoryReport: vi.fn(async () => {
                    // Simulate slow operation
                    await new Promise((resolve) => setTimeout(resolve, 100))
                    return { totalCiCount: 100 }
                })
            }

            const cachedService = new CachedCiInventoryReportService(
                slowService as any,
                cacheService
            )

            const start1 = Date.now()
            await cachedService.generateCiInventoryReport()
            const time1 = Date.now() - start1

            const start2 = Date.now()
            await cachedService.generateCiInventoryReport()
            const time2 = Date.now() - start2

            // Cached call should be significantly faster
            expect(time2).toBeLessThan(time1 / 2)
        })
    })
})
