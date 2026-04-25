import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    AnalyticsRepo,
    AssetRepo,
    AutomationLogRepo,
    AutomationRuleRepo,
    ComplianceRepo,
    CostRecordRepo,
    DashboardConfigRepo,
    IntegrationConnectorRepo,
    NotificationRepo,
    PerformanceMetricRepo,
    RbacPermissionRepo,
    ScheduledTaskRepo,
    SecurityAuditRepo,
    SyncLogRepo,
    SyncRuleRepo,
    WebhookRepo
} from '@qltb/infra-postgres'
import {
    AnalyticsService,
    AutomationService,
    IntegrationService,
    SecurityService
} from '@qltb/application'
import { analyticsRoutes } from '../analytics/analytics.routes.js'
import { automationRoutes } from '../automation/automation.routes.js'
import { integrationRoutes } from '../integrations/integrations.routes.js'
import { securityRoutes } from '../security/security.routes.js'
import { communicationRoutes } from '../communications/communications.routes.js'

export async function registerAdvancedContext(
    fastify: FastifyInstance,
    pgClient: PgClient
): Promise<void> {
    const automationRuleRepo = new AutomationRuleRepo(pgClient)
    const automationLogRepo = new AutomationLogRepo(pgClient)
    const notificationRepo = new NotificationRepo(pgClient)
    const scheduledTaskRepo = new ScheduledTaskRepo(pgClient)
    const analyticsRepo = new AnalyticsRepo(pgClient)
    const costRecordRepo = new CostRecordRepo(pgClient)
    const performanceMetricRepo = new PerformanceMetricRepo(pgClient)
    const dashboardConfigRepo = new DashboardConfigRepo(pgClient)
    const integrationConnectorRepo = new IntegrationConnectorRepo(pgClient)
    const syncRuleRepo = new SyncRuleRepo(pgClient)
    const syncLogRepo = new SyncLogRepo(pgClient)
    const webhookRepo = new WebhookRepo(pgClient)
    const assetRepo = new AssetRepo(pgClient)
    const rbacPermissionRepo = new RbacPermissionRepo(pgClient)
    const securityAuditRepo = new SecurityAuditRepo(pgClient)
    const complianceRepo = new ComplianceRepo(pgClient)

    const automationService = new AutomationService(automationRuleRepo as any, automationLogRepo as any, notificationRepo as any, scheduledTaskRepo)
    const analyticsService = new AnalyticsService(analyticsRepo, costRecordRepo, performanceMetricRepo, dashboardConfigRepo)
    const integrationService = new IntegrationService(
        integrationConnectorRepo,
        syncRuleRepo,
        webhookRepo as any,
        syncLogRepo,
        assetRepo as any,
        pgClient as any,
    )
    const securityService = new SecurityService(rbacPermissionRepo as any, securityAuditRepo, complianceRepo)

    await fastify.register(analyticsRoutes, { prefix: '/api/v1', analyticsService })
    await fastify.register(automationRoutes, { prefix: '/api/v1', automationService })
    await fastify.register(integrationRoutes, { prefix: '/api/v1', integrationService })
    await fastify.register(securityRoutes, { prefix: '/api/v1', securityService })
    await fastify.register(communicationRoutes, { prefix: '/api/v1', pgClient })
}
