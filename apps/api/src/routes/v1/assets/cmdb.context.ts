import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    ChangeAssessmentRepo,
    CiAttrValueRepo,
    CiRepo,
    CiSchemaRepo,
    CiTypeRepo,
    CiTypeVersionRepo,
    CmdbChangeRepo,
    CmdbServiceRepo,
    DiscoveryResultRepo,
    DiscoveryRuleRepo,
    OpsEventRepo,
    RelationshipRepo,
    RelationshipTypeRepo,
    SmartTagRepo
} from '@qltb/infra-postgres'
import {
    AuditTrailService,
    CachedAuditTrailService,
    CachedCiInventoryReportService,
    CachedRelationshipAnalyticsService,
    ChangeManagementService,
    CiInventoryReportService,
    CiService,
    CmdbEnhancementService,
    RelationshipAnalyticsService,
    RelationshipService,
    ReportCachingService,
    SchemaService,
    ServiceMappingService
} from '@qltb/application'
import { cmdbRoutes } from '../cmdb/cmdb.routes.js'
import { cmdbEnhancementRoutes } from '../cmdb/cmdb-enhancement.routes.js'
import { reportAggregationRoutes } from '../reports/report-aggregation.routes.js'

export async function registerCmdbContext(
    fastify: FastifyInstance,
    pgClient: PgClient,
    cache?: ReportCachingService
): Promise<void> {
    const ciTypeRepo = new CiTypeRepo(pgClient)
    const ciTypeVersionRepo = new CiTypeVersionRepo(pgClient)
    const ciSchemaRepo = new CiSchemaRepo(pgClient)
    const ciRepo = new CiRepo(pgClient)
    const ciAttrValueRepo = new CiAttrValueRepo(pgClient)
    const relTypeRepo = new RelationshipTypeRepo(pgClient)
    const relRepo = new RelationshipRepo(pgClient)
    const cmdbServiceRepo = new CmdbServiceRepo(pgClient)
    const cmdbChangeRepo = new CmdbChangeRepo(pgClient)
    const opsEventRepo = new OpsEventRepo(pgClient)
    const discoveryRuleRepo = new DiscoveryRuleRepo(pgClient)
    const discoveryResultRepo = new DiscoveryResultRepo(pgClient)
    const smartTagRepo = new SmartTagRepo(pgClient)
    const changeAssessmentRepo = new ChangeAssessmentRepo(pgClient)

    const schemaService = new SchemaService(ciTypeRepo, ciTypeVersionRepo, ciSchemaRepo, ciRepo, ciAttrValueRepo, opsEventRepo)
    const ciService = new CiService(ciRepo, ciTypeVersionRepo, ciSchemaRepo, ciAttrValueRepo, opsEventRepo)
    const relationshipService = new RelationshipService(relTypeRepo, relRepo, ciRepo, opsEventRepo)
    const changeManagementService = new ChangeManagementService(cmdbChangeRepo, ciRepo, relationshipService, opsEventRepo)
    const serviceMappingService = new ServiceMappingService(cmdbServiceRepo, relationshipService, opsEventRepo)
    const cmdbEnhancementService = new CmdbEnhancementService(discoveryRuleRepo as any, discoveryResultRepo, smartTagRepo as any, changeAssessmentRepo)

    const ciInventoryReportService = new CiInventoryReportService(ciRepo, relRepo, ciTypeRepo)
    const relationshipAnalyticsService = new RelationshipAnalyticsService(relRepo, ciRepo)
    const auditTrailService = new AuditTrailService(opsEventRepo)

    const cachedCiInventoryReport = cache
        ? new CachedCiInventoryReportService(ciInventoryReportService, cache)
        : ciInventoryReportService
    const cachedRelationshipAnalytics = cache
        ? new CachedRelationshipAnalyticsService(relationshipAnalyticsService, cache)
        : relationshipAnalyticsService
    const cachedAuditTrail = cache
        ? new CachedAuditTrailService(auditTrailService, cache)
        : auditTrailService

    await fastify.register(cmdbRoutes, {
        prefix: '/api/v1',
        schemaService,
        ciService,
        relationshipService,
        changeManagementService,
        serviceMappingService,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ciInventoryReportService: cachedCiInventoryReport as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        relationshipAnalyticsService: cachedRelationshipAnalytics as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        auditTrailService: cachedAuditTrail as any,
        pgClient
    })
    await fastify.register(cmdbEnhancementRoutes, { prefix: '/api/v1', cmdbEnhancementService })
    await fastify.register(reportAggregationRoutes, { prefix: '/api/v1', pgClient })
}
