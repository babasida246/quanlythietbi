/**
 * Analytics Routes
 * API for analytics dashboard, cost tracking, performance metrics, AI insights
 */
import type { FastifyInstance } from 'fastify'
import type { AnalyticsService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

interface AnalyticsRoutesOptions {
    analyticsService: AnalyticsService
}

const costRecordSchema = z.object({
    assetId: z.string().uuid(),
    costType: z.enum(['purchase', 'maintenance', 'repair', 'upgrade', 'disposal', 'other']),
    amount: z.number().positive(),
    currency: z.string().length(3).optional().default('VND'),
    description: z.string().optional(),
    recordedDate: z.string().optional()
})

const metricSchema = z.object({
    assetId: z.string().uuid(),
    metricType: z.enum(['uptime', 'response_time', 'error_rate', 'utilization', 'throughput', 'temperature', 'custom']),
    metricValue: z.number(),
    unit: z.string().optional(),
    metadata: z.record(z.unknown()).optional().default({})
})

export async function analyticsRoutes(
    fastify: FastifyInstance,
    opts: AnalyticsRoutesOptions
): Promise<void> {
    const svc = opts.analyticsService

    // --- Summary Dashboard ---
    fastify.get('/analytics/summary', async (request, reply) => {
        getUserContext(request)
        const stats = await svc.getSummaryStats()
        return reply.send({ data: stats })
    })

    // --- Snapshots ---
    fastify.post('/analytics/snapshots', async (request, reply) => {
        requirePermission(request, 'analytics:read')
        const snapshot = await svc.createSnapshot()
        return reply.status(201).send({ data: snapshot })
    })

    fastify.get('/analytics/snapshots/latest', async (request, reply) => {
        getUserContext(request)
        const snapshot = await svc.getLatestSnapshot()
        return reply.send({ data: snapshot })
    })

    fastify.get('/analytics/snapshots/history', async (request, reply) => {
        getUserContext(request)
        const query = request.query as Record<string, string>
        const days = query.days ? parseInt(query.days) : 30
        const snapshots = await svc.getSnapshotHistory(days)
        return reply.send({ data: snapshots })
    })

    // --- Cost Tracking ---
    fastify.post('/analytics/costs', async (request, reply) => {
        const ctx = requirePermission(request, 'analytics:read')
        const body = costRecordSchema.parse(request.body)
        const record = await svc.recordCost({
            ...body,
            recordedDate: body.recordedDate ? new Date(body.recordedDate) : new Date(),
            recordedBy: ctx.userId
        } as any)
        return reply.status(201).send({ data: record })
    })

    fastify.get('/analytics/costs/asset/:assetId', async (request, reply) => {
        getUserContext(request)
        const { assetId } = request.params as { assetId: string }
        const costs = await svc.getAssetCosts(assetId)
        return reply.send({ data: costs })
    })

    fastify.get('/analytics/costs/asset/:assetId/summary', async (request, reply) => {
        getUserContext(request)
        const { assetId } = request.params as { assetId: string }
        const summary = await svc.getAssetCostSummary(assetId)
        return reply.send({ data: summary })
    })

    fastify.get('/analytics/costs/overview', async (request, reply) => {
        getUserContext(request)
        const query = request.query as Record<string, string>
        const overview = await svc.getCostOverview({
            startDate: query.startDate,
            endDate: query.endDate
        })
        return reply.send({ data: overview })
    })

    // --- Performance Metrics ---
    fastify.post('/analytics/metrics', async (request, reply) => {
        requirePermission(request, 'analytics:read')
        const body = metricSchema.parse(request.body)
        const metric = await svc.recordMetric(body as any)
        return reply.status(201).send({ data: metric })
    })

    fastify.get('/analytics/metrics/asset/:assetId', async (request, reply) => {
        getUserContext(request)
        const { assetId } = request.params as { assetId: string }
        const metrics = await svc.getAssetMetrics(assetId)
        return reply.send({ data: metrics })
    })

    fastify.get('/analytics/metrics/asset/:assetId/:metricType/history', async (request, reply) => {
        getUserContext(request)
        const { assetId, metricType } = request.params as { assetId: string; metricType: string }
        const query = request.query as Record<string, string>
        const hours = query.hours ? parseInt(query.hours) : 24
        const history = await svc.getMetricHistory(assetId, metricType, hours)
        return reply.send({ data: history })
    })

    // --- AI Insights (Feature 6/7) ---
    fastify.get('/analytics/insights/asset/:assetId', async (request, reply) => {
        getUserContext(request)
        const { assetId } = request.params as { assetId: string }
        const insights = await svc.getPredictiveInsights(assetId)
        return reply.send({ data: insights })
    })

    fastify.get('/analytics/anomalies', async (request, reply) => {
        requirePermission(request, 'analytics:read')
        const anomalies = await svc.getAnomalies()
        return reply.send({ data: anomalies })
    })

    // --- Dashboard Config ---
    fastify.get('/analytics/dashboard', async (request, reply) => {
        const ctx = getUserContext(request)
        const config = await svc.getDashboard(ctx.userId)
        return reply.send({ data: config })
    })

    fastify.put('/analytics/dashboard', async (request, reply) => {
        const ctx = getUserContext(request)
        const body = z.object({
            name: z.string().optional(),
            layout: z.array(z.unknown()).optional(),
            widgets: z.array(z.unknown()).optional()
        }).parse(request.body)
        const config = await svc.saveDashboard(ctx.userId, body)
        return reply.send({ data: config })
    })
}
