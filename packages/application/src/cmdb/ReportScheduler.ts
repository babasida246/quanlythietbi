/**
 * Scheduled Report Generation Service
 * Uses Bull queue for automated report generation
 */

import Bull, { type Job } from 'bull'
import type { CiInventoryReportService } from './CiInventoryReportService.js'
import type { RelationshipAnalyticsService } from './RelationshipAnalyticsService.js'
import type { AuditTrailService } from './AuditTrailService.js'

export interface ScheduledReportConfig {
    ciInventorySchedule?: string // Cron expression (default: daily at 2 AM)
    relationshipAnalyticsSchedule?: string // Cron expression (default: daily at 3 AM)
    auditTrailSchedule?: string // Cron expression (default: daily at 4 AM)
    redisUrl?: string
}

interface ReportJobData {
    reportType: 'ci-inventory' | 'relationship-analytics' | 'audit-trail'
    generatedAt: string
    parameters?: {
        ciId?: string
        startDate?: string
        endDate?: string
    }
}

interface ScheduledReportRecord {
    id: string
    reportType: string
    schedule: string
    lastGeneratedAt?: Date
    nextScheduledAt?: Date
    createdAt: Date
}

interface RepeatableJobRecord {
    id: string
    key: string
    name: string
    cron?: string
}

interface QueueLike<T> {
    add(name: string, data: T, options?: Record<string, unknown>): Promise<Job<T>>
    getRepeatableJobs(): Promise<RepeatableJobRecord[]>
    removeRepeatableByKey(key: string): Promise<void>
    on(event: string, handler: (...args: any[]) => void): void
    process(handler: (job: Job<T>) => Promise<unknown>): void
    close(): Promise<void>
    getActiveCount(): Promise<number>
    getWaitingCount(): Promise<number>
    getCompletedCount(): Promise<number>
    getFailedCount(): Promise<number>
    getDelayedCount(): Promise<number>
    client: { ping: () => Promise<string> }
}

class InMemoryQueue<T> implements QueueLike<T> {
    private sequence = 0
    private repeatableJobs: RepeatableJobRecord[] = []
    private listeners = new Map<string, Array<(...args: any[]) => void>>()
    private processor: ((job: Job<T>) => Promise<unknown>) | null = null
    private counts = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0
    }

    client = {
        ping: async (): Promise<string> => 'PONG'
    }

    async add(name: string, data: T, options: Record<string, unknown> = {}): Promise<Job<T>> {
        this.sequence += 1
        const id = `job-${this.sequence}`
        const job = { id, name, data } as unknown as Job<T>
        const repeat = (options.repeat as { cron?: string } | undefined)?.cron

        if (repeat) {
            const key = `${name}:${repeat}`
            this.repeatableJobs = this.repeatableJobs.filter((item) => item.key !== key)
            this.repeatableJobs.push({ id, key, name, cron: repeat })
            return job
        }

        this.counts.waiting += 1
        if (this.processor) {
            await this.runJob(job)
        }
        return job
    }

    async getRepeatableJobs(): Promise<RepeatableJobRecord[]> {
        return [...this.repeatableJobs]
    }

    async removeRepeatableByKey(key: string): Promise<void> {
        this.repeatableJobs = this.repeatableJobs.filter((item) => item.key !== key)
    }

    on(event: string, handler: (...args: any[]) => void): void {
        const handlers = this.listeners.get(event) ?? []
        handlers.push(handler)
        this.listeners.set(event, handlers)
    }

    process(handler: (job: Job<T>) => Promise<unknown>): void {
        this.processor = handler
    }

    async close(): Promise<void> {
        this.processor = null
        this.repeatableJobs = []
    }

    async getActiveCount(): Promise<number> {
        return this.counts.active
    }

    async getWaitingCount(): Promise<number> {
        return this.counts.waiting
    }

    async getCompletedCount(): Promise<number> {
        return this.counts.completed
    }

    async getFailedCount(): Promise<number> {
        return this.counts.failed
    }

    async getDelayedCount(): Promise<number> {
        return this.counts.delayed
    }

    private async runJob(job: Job<T>): Promise<void> {
        if (!this.processor) return

        this.counts.waiting = Math.max(0, this.counts.waiting - 1)
        this.counts.active += 1
        try {
            await this.processor(job)
            this.counts.completed += 1
            this.emit('completed', job)
        } catch (error) {
            this.counts.failed += 1
            this.emit('failed', job, error)
        } finally {
            this.counts.active = Math.max(0, this.counts.active - 1)
        }
    }

    private emit(event: string, ...args: unknown[]): void {
        const handlers = this.listeners.get(event)
        if (!handlers) return
        handlers.forEach((handler) => {
            try {
                handler(...args)
            } catch {
                // no-op
            }
        })
    }
}

/**
 * Report Scheduler
 * Manages scheduled report generation with Bull queue
 */
export class ReportScheduler {
    private queue: QueueLike<ReportJobData>
    private readonly defaultSchedules = {
        ciInventory: '0 2 * * *', // Daily at 2 AM
        relationshipAnalytics: '0 3 * * *', // Daily at 3 AM
        auditTrail: '0 4 * * *' // Daily at 4 AM
    }

    constructor(
        private ciInventoryService: CiInventoryReportService,
        private relationshipAnalyticsService: RelationshipAnalyticsService,
        private auditTrailService: AuditTrailService,
        redisUrl?: string
    ) {
        const useInMemoryQueue =
            process.env.NODE_ENV === 'test' || process.env.REPORT_QUEUE_MODE === 'memory'

        if (useInMemoryQueue) {
            this.queue = new InMemoryQueue<ReportJobData>()
            return
        }

        const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379'
        this.queue = new Bull('report-generation', url) as unknown as QueueLike<ReportJobData>
    }

    /**
     * Initialize scheduler with default jobs
     */
    async initialize(config?: ScheduledReportConfig): Promise<void> {
        try {
            // Create scheduled jobs
            const ciInventorySchedule = config?.ciInventorySchedule ?? this.defaultSchedules.ciInventory
            const relationshipAnalyticsSchedule =
                config?.relationshipAnalyticsSchedule ?? this.defaultSchedules.relationshipAnalytics
            const auditTrailSchedule = config?.auditTrailSchedule ?? this.defaultSchedules.auditTrail

            // Remove existing repeat jobs
            const repeatableJobs = await this.queue.getRepeatableJobs()
            for (const job of repeatableJobs) {
                await this.queue.removeRepeatableByKey(job.key)
            }

            // Add new repeat jobs
            console.log(`[Scheduler] Adding CI Inventory Report job (${ciInventorySchedule})`)
            await this.queue.add(
                'ci-inventory',
                { reportType: 'ci-inventory', generatedAt: new Date().toISOString() },
                { repeat: { cron: ciInventorySchedule } }
            )

            console.log(`[Scheduler] Adding Relationship Analytics job (${relationshipAnalyticsSchedule})`)
            await this.queue.add(
                'relationship-analytics',
                { reportType: 'relationship-analytics', generatedAt: new Date().toISOString() },
                { repeat: { cron: relationshipAnalyticsSchedule } }
            )

            console.log(`[Scheduler] Adding Audit Trail Report job (${auditTrailSchedule})`)
            await this.queue.add(
                'audit-trail',
                { reportType: 'audit-trail', generatedAt: new Date().toISOString() },
                { repeat: { cron: auditTrailSchedule } }
            )

            // Setup event handlers
            this.setupEventHandlers()

            console.log('[Scheduler] Report scheduler initialized successfully')
        } catch (error) {
            console.error('[Scheduler] Failed to initialize:', error)
            throw error
        }
    }

    /**
     * Setup event handlers for queue
     */
    private setupEventHandlers(): void {
        this.queue.on('completed', (job: Job<ReportJobData>) => {
            console.log(`[Queue] Job ${job.id} completed successfully`)
        })

        this.queue.on('failed', (job: Job<ReportJobData>, error: Error) => {
            console.error(`[Queue] Job ${job.id} failed:`, error.message)
        })

        this.queue.on('error', (error: Error) => {
            console.error('[Queue] Queue error:', error)
        })

        this.queue.on('stalled', (job: Job<ReportJobData>) => {
            console.warn(`[Queue] Job ${job.id} stalled`)
        })
    }

    /**
     * Start processing jobs
     */
    async startProcessing(): Promise<void> {
        try {
            // Process jobs with queue.process() for Bull v4
            this.queue.process(async (job: Job<ReportJobData>) => {
                console.log(`[Worker] Processing report: ${job.data.reportType}`)

                try {
                    let report: any

                    switch (job.data.reportType) {
                        case 'ci-inventory':
                            report = await this.ciInventoryService.generateCiInventoryReport()
                            break
                        case 'relationship-analytics':
                            report = await this.relationshipAnalyticsService.generateAnalyticsReport()
                            break
                        case 'audit-trail': {
                            const params = job.data.parameters
                            report = await this.auditTrailService.generateAuditTrailReport(
                                params?.ciId,
                                params?.startDate ? new Date(params.startDate) : undefined,
                                params?.endDate ? new Date(params.endDate) : undefined
                            )
                            break
                        }
                        default:
                            throw new Error(`Unknown report type: ${job.data.reportType}`)
                    }

                    console.log(`[Worker] Report ${job.data.reportType} generated successfully`)
                    return { success: true, report }
                } catch (error) {
                    console.error(
                        `[Worker] Failed to generate report ${job.data.reportType}:`,
                        error instanceof Error ? error.message : 'Unknown error'
                    )
                    throw error
                }
            })

            console.log('[Worker] Report processing started')
        } catch (error) {
            console.error('[Worker] Failed to start worker:', error)
            throw error
        }
    }

    /**
     * Stop processing
     */
    async stop(): Promise<void> {
        await this.queue.close()
        console.log('[Scheduler] Report scheduler stopped')
    }

    /**
     * Trigger manual report generation
     */
    async triggerReport(
        reportType: 'ci-inventory' | 'relationship-analytics' | 'audit-trail',
        priority?: number
    ): Promise<Job<ReportJobData>> {
        console.log(`[Scheduler] Triggering manual report: ${reportType}`)

        const job = await this.queue.add(
            reportType,
            { reportType, generatedAt: new Date().toISOString() },
            {
                priority: priority ?? 10, // Higher priority than scheduled jobs
                removeOnComplete: true
            }
        )

        return job
    }

    /**
     * Get queue stats
     */
    async getStats(): Promise<{
        active: number
        waiting: number
        completed: number
        failed: number
        delayed: number
    }> {
        return {
            active: await this.queue.getActiveCount(),
            waiting: await this.queue.getWaitingCount(),
            completed: await this.queue.getCompletedCount(),
            failed: await this.queue.getFailedCount(),
            delayed: await this.queue.getDelayedCount()
        }
    }

    /**
     * Get scheduled jobs
     */
    async getScheduledJobs(): Promise<ScheduledReportRecord[]> {
        const repeatableJobs = await this.queue.getRepeatableJobs()

        return repeatableJobs.map((job) => ({
            id: job.id || job.key,
            reportType: job.name,
            schedule: (job as any).cron ?? 'manual',
            lastGeneratedAt: undefined,
            nextScheduledAt: undefined,
            createdAt: new Date()
        }))
    }

    /**
     * Update schedule for a report type
     */
    async updateSchedule(reportType: string, cronExpression: string): Promise<void> {
        console.log(`[Scheduler] Updating schedule for ${reportType}: ${cronExpression}`)

        // Remove old jobs for this report type
        const repeatableJobs = await this.queue.getRepeatableJobs()
        for (const job of repeatableJobs) {
            if (job.name === reportType) {
                await this.queue.removeRepeatableByKey(job.key)
            }
        }

        // Add new job with updated schedule
        await this.queue.add(reportType as 'ci-inventory' | 'relationship-analytics' | 'audit-trail', {
            reportType: reportType as 'ci-inventory' | 'relationship-analytics' | 'audit-trail',
            generatedAt: new Date().toISOString()
        }, {
            repeat: { cron: cronExpression }
        })

        console.log(`[Scheduler] Schedule updated for ${reportType}`)
    }

    /**
     * Clear all scheduled jobs
     */
    async clearSchedules(): Promise<void> {
        console.log('[Scheduler] Clearing all scheduled jobs')
        const repeatableJobs = await this.queue.getRepeatableJobs()
        for (const job of repeatableJobs) {
            await this.queue.removeRepeatableByKey(job.key)
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const client = this.queue.client
            await client.ping()
            return true
        } catch (error) {
            console.error('[Scheduler] Health check failed:', error)
            return false
        }
    }
}

/**
 * Report Storage Service
 * Stores generated reports for later retrieval
 * (This would typically integrate with a database)
 */
export class ScheduledReportStorage {
    private reports: Map<string, { data: any; timestamp: Date }> = new Map()

    /**
     * Store report result
     */
    async storeReport(reportType: string, data: any): Promise<void> {
        const key = `${reportType}:${Date.now()}`
        this.reports.set(key, { data, timestamp: new Date() })

        // Keep only last 10 reports per type
        const reportKeys = Array.from(this.reports.keys()).filter((k) => k.startsWith(`${reportType}:`))
        if (reportKeys.length > 10) {
            const oldestKey = reportKeys[0]
            this.reports.delete(oldestKey)
        }

        console.log(`[Storage] Report stored: ${key}`)
    }

    /**
     * Retrieve latest report
     */
    async getLatestReport(reportType: string): Promise<{ data: any; timestamp: Date } | null> {
        const reportKeys = Array.from(this.reports.keys())
            .filter((k) => k.startsWith(`${reportType}:`))
            .sort()
            .reverse()

        if (reportKeys.length === 0) return null

        return this.reports.get(reportKeys[0]) ?? null
    }

    /**
     * Get report history
     */
    async getReportHistory(reportType: string, limit: number = 10): Promise<Array<{ data: any; timestamp: Date }>> {
        const reportKeys = Array.from(this.reports.keys())
            .filter((k) => k.startsWith(`${reportType}:`))
            .sort()
            .reverse()
            .slice(0, limit)

        return reportKeys.map((key) => this.reports.get(key) as { data: any; timestamp: Date })
    }

    /**
     * Clear old reports
     */
    async clearOldReports(ageMinutes: number = 1440): Promise<void> {
        // 1440 minutes = 24 hours
        const cutoffTime = new Date(Date.now() - ageMinutes * 60 * 1000)

        let removedCount = 0
        for (const [key, value] of this.reports) {
            if (value.timestamp <= cutoffTime) {
                this.reports.delete(key)
                removedCount++
            }
        }

        console.log(`[Storage] Cleared ${removedCount} old reports`)
    }
}
