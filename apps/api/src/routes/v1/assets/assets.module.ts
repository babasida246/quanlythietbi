import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    AssetEventRepo,
    AssetRepo,
    AssignmentRepo,
    AttachmentRepo,
    ApprovalRepo,
    AssetIncreaseRepo,
    CatalogRepo,
    DocumentRepo,
    CategorySpecRepo,
    CategorySpecVersionRepo,
    CiAttrValueRepo,
    CiRepo,
    CiSchemaRepo,
    CiTypeRepo,
    CiTypeVersionRepo,
    CmdbChangeRepo,
    CmdbServiceRepo,
    InventoryRepo,
    MaintenanceRepo,
    MovementRepo,
    OpsEventRepo,
    RepairOrderRepo,
    RepairPartRepo,
    PurchasePlanRepo,
    SparePartRepo,
    StockDocumentRepo,
    RelationshipRepo,
    RelationshipTypeRepo,
    ReminderRepo,
    StockRepo,
    StockReportRepo,
    WarehouseRepo,
    WarehouseUnitOfWork,
    WorkflowRepo,
    // Advanced feature repos
    AutomationRuleRepo,
    AutomationLogRepo,
    NotificationRepo,
    ScheduledTaskRepo,
    AnalyticsRepo,
    CostRecordRepo,
    PerformanceMetricRepo,
    DashboardConfigRepo,
    IntegrationConnectorRepo,
    SyncRuleRepo,
    WebhookRepo,
    RbacPermissionRepo,
    SecurityAuditRepo,
    ComplianceRepo,
    DiscoveryRuleRepo,
    DiscoveryResultRepo,
    SmartTagRepo,
    ChangeAssessmentRepo,
    LabelsRepository,
    AccessoryRepo,
    AuditRepo,
    CheckoutRepo,
    ComponentRepo,
    ConsumableRepo,
    DepreciationRepo,
    LicenseRepo,
    WfRepo,
    WfApproverResolverRepo
} from '@qltb/infra-postgres'
import {
    AssetService,
    AttachmentService,
    CatalogService,
    CiService,
    ChangeManagementService,
    CategorySpecService,
    InventoryService,
    MaintenanceService,
    ReminderService,
    RepairService,
    RelationshipService,
    SchemaService,
    ServiceMappingService,
    StockDocumentService,
    StockReportService,
    StockService,
    WarehouseCatalogService,
    CiInventoryReportService,
    RelationshipAnalyticsService,
    AuditTrailService,
    ReportCachingService,
    CachedCiInventoryReportService,
    CachedRelationshipAnalyticsService,
    CachedAuditTrailService,
    // Advanced feature services
    AutomationService,
    AnalyticsService,
    IntegrationService,
    SecurityService,
    CmdbEnhancementService,
    // Documents
    DocumentService,
    // Labels
    LabelsService,
    // Migrated modules
    AccessoryService,
    AuditService,
    CheckoutService,
    ComponentService,
    ConsumableService,
    DepreciationService,
    LicenseService,
    WfService
} from '@qltb/application'
import { assetsRoutes } from './assets.routes.js'
import { catalogRoutes } from './catalogs.routes.js'
import { assetImportRoutes } from './assets.import.routes.js'
import { attachmentRoutes } from './attachments.routes.js'
import { categorySpecRoutes } from './category-specs.routes.js'
import { maintenanceRoutes } from '../maintenance/maintenance.routes.js'
import { inventoryRoutes } from '../inventory/inventory.routes.js'
import { reminderRoutes } from '../reports/reminders.routes.js'
import { reportsRoutes } from '../reports/reports.routes.js'
import { reportAggregationRoutes } from '../reports/report-aggregation.routes.js'
import { cmdbRoutes } from '../cmdb/cmdb.routes.js'
import { warehouseRoutes } from '../warehouse/warehouse.routes.js'
import { stockDocumentRoutes } from '../warehouse/stock-documents.routes.js'
import { repairOrderRoutes } from '../warehouse/repair-orders.routes.js'
import { communicationRoutes } from '../communications/communications.routes.js'
import { qltsRoutes } from '../../../modules/qlts/routes/index.js'
// Advanced feature routes
import { analyticsRoutes } from '../analytics/analytics.routes.js'
import { automationRoutes } from '../automation/automation.routes.js'
import { integrationRoutes } from '../integrations/integrations.routes.js'
import { securityRoutes } from '../security/security.routes.js'
import { cmdbEnhancementRoutes } from '../cmdb/cmdb-enhancement.routes.js'
import { documentsRoute } from '../documents/documents.route.js'
import { labelsRoute } from '../labels/labels.route.js'
import { accessoriesRoute } from '../accessories/accessories.route.js'
import { auditRoute } from '../audit/audit.route.js'
import { checkoutRoute } from '../checkout/checkout.route.js'
import { componentsRoute } from '../components/components.route.js'
import { consumablesRoute } from '../consumables/consumables.route.js'
import { depreciationRoute } from '../depreciation/depreciation.route.js'
import { licensesRoute } from '../licenses/licenses.route.js'
import { wfRoute } from '../wf/wf.route.js'

export interface AssetModuleDeps {
    pgClient: PgClient
    cache?: ReportCachingService
}

export async function registerAssetModule(
    fastify: FastifyInstance,
    deps: AssetModuleDeps
): Promise<void> {
    const assetRepo = new AssetRepo(deps.pgClient)
    const assignmentRepo = new AssignmentRepo(deps.pgClient)
    const maintenanceRepo = new MaintenanceRepo(deps.pgClient)
    const assetEventRepo = new AssetEventRepo(deps.pgClient)
    const catalogRepo = new CatalogRepo(deps.pgClient)
    const categorySpecRepo = new CategorySpecRepo(deps.pgClient)
    const categorySpecVersionRepo = new CategorySpecVersionRepo(deps.pgClient)
    const opsEventRepo = new OpsEventRepo(deps.pgClient)
    const attachmentRepo = new AttachmentRepo(deps.pgClient)
    const inventoryRepo = new InventoryRepo(deps.pgClient)
    const reminderRepo = new ReminderRepo(deps.pgClient)
    const purchasePlanRepo = new PurchasePlanRepo(deps.pgClient)
    const assetIncreaseRepo = new AssetIncreaseRepo(deps.pgClient)
    const approvalRepo = new ApprovalRepo(deps.pgClient)
    const stockReportRepo = new StockReportRepo(deps.pgClient)
    const warehouseRepo = new WarehouseRepo(deps.pgClient)
    const sparePartRepo = new SparePartRepo(deps.pgClient)
    const stockRepo = new StockRepo(deps.pgClient)
    const movementRepo = new MovementRepo(deps.pgClient)
    const stockDocumentRepo = new StockDocumentRepo(deps.pgClient)
    const repairOrderRepo = new RepairOrderRepo(deps.pgClient)
    const repairPartRepo = new RepairPartRepo(deps.pgClient)
    const warehouseUnitOfWork = new WarehouseUnitOfWork(deps.pgClient)
    const ciTypeRepo = new CiTypeRepo(deps.pgClient)
    const ciTypeVersionRepo = new CiTypeVersionRepo(deps.pgClient)
    const ciSchemaRepo = new CiSchemaRepo(deps.pgClient)
    const ciRepo = new CiRepo(deps.pgClient)
    const ciAttrValueRepo = new CiAttrValueRepo(deps.pgClient)
    const relTypeRepo = new RelationshipTypeRepo(deps.pgClient)
    const relRepo = new RelationshipRepo(deps.pgClient)
    const cmdbServiceRepo = new CmdbServiceRepo(deps.pgClient)
    const cmdbChangeRepo = new CmdbChangeRepo(deps.pgClient)

    // Advanced feature repos
    const automationRuleRepo = new AutomationRuleRepo(deps.pgClient)
    const automationLogRepo = new AutomationLogRepo(deps.pgClient)
    const notificationRepo = new NotificationRepo(deps.pgClient)
    const scheduledTaskRepo = new ScheduledTaskRepo(deps.pgClient)
    const analyticsRepo = new AnalyticsRepo(deps.pgClient)
    const costRecordRepo = new CostRecordRepo(deps.pgClient)
    const performanceMetricRepo = new PerformanceMetricRepo(deps.pgClient)
    const dashboardConfigRepo = new DashboardConfigRepo(deps.pgClient)
    const integrationConnectorRepo = new IntegrationConnectorRepo(deps.pgClient)
    const syncRuleRepo = new SyncRuleRepo(deps.pgClient)
    const webhookRepo = new WebhookRepo(deps.pgClient)
    const rbacPermissionRepo = new RbacPermissionRepo(deps.pgClient)
    const securityAuditRepo = new SecurityAuditRepo(deps.pgClient)
    const complianceRepo = new ComplianceRepo(deps.pgClient)
    const discoveryRuleRepo = new DiscoveryRuleRepo(deps.pgClient)
    const discoveryResultRepo = new DiscoveryResultRepo(deps.pgClient)
    const smartTagRepo = new SmartTagRepo(deps.pgClient)
    const changeAssessmentRepo = new ChangeAssessmentRepo(deps.pgClient)
    const documentRepo = new DocumentRepo(deps.pgClient)
    const labelsRepo = new LabelsRepository(deps.pgClient)

    const assetService = new AssetService(assetRepo, assignmentRepo, assetEventRepo, maintenanceRepo)
    const maintenanceService = new MaintenanceService(assetRepo, assignmentRepo, maintenanceRepo, assetEventRepo)
    const catalogService = new CatalogService(catalogRepo, categorySpecRepo, categorySpecVersionRepo, undefined, opsEventRepo)
    const categorySpecService = new CategorySpecService(catalogRepo, categorySpecRepo, categorySpecVersionRepo, opsEventRepo)
    const attachmentService = new AttachmentService(assetRepo, attachmentRepo, assetEventRepo)
    const inventoryService = new InventoryService(inventoryRepo, assetRepo, assetEventRepo)
    const reminderService = new ReminderService(assetRepo, reminderRepo)
    const stockReportService = new StockReportService(stockReportRepo)
    const warehouseCatalogService = new WarehouseCatalogService(warehouseRepo, sparePartRepo, opsEventRepo)
    const stockService = new StockService(stockRepo)
    const stockDocumentService = new StockDocumentService(
        stockDocumentRepo,
        stockRepo,
        movementRepo,
        warehouseUnitOfWork,
        opsEventRepo
    )
    const schemaService = new SchemaService(ciTypeRepo, ciTypeVersionRepo, ciSchemaRepo, ciRepo, ciAttrValueRepo, opsEventRepo)
    const ciService = new CiService(ciRepo, ciTypeVersionRepo, ciSchemaRepo, ciAttrValueRepo, opsEventRepo)
    const relationshipService = new RelationshipService(relTypeRepo, relRepo, ciRepo, opsEventRepo)
    const changeManagementService = new ChangeManagementService(cmdbChangeRepo, ciRepo, relationshipService, opsEventRepo)
    const repairService = new RepairService(
        repairOrderRepo,
        repairPartRepo,
        stockDocumentRepo,
        stockRepo,
        movementRepo,
        warehouseUnitOfWork,
        opsEventRepo,
        ciRepo,
        relationshipService
    )
    const serviceMappingService = new ServiceMappingService(cmdbServiceRepo, relationshipService, opsEventRepo)

    // Advanced feature services
    const automationService = new AutomationService(automationRuleRepo as any, automationLogRepo as any, notificationRepo as any, scheduledTaskRepo)
    const analyticsService = new AnalyticsService(analyticsRepo, costRecordRepo, performanceMetricRepo, dashboardConfigRepo)
    const integrationService = new IntegrationService(integrationConnectorRepo, syncRuleRepo, webhookRepo as any)
    const securityService = new SecurityService(rbacPermissionRepo as any, securityAuditRepo, complianceRepo)
    const cmdbEnhancementService = new CmdbEnhancementService(discoveryRuleRepo as any, discoveryResultRepo, smartTagRepo as any, changeAssessmentRepo)
    const documentService = new DocumentService(documentRepo)
    const labelsService = new LabelsService(labelsRepo)

    // Report services
    const ciInventoryReportService = new CiInventoryReportService(ciRepo, relRepo, ciTypeRepo)
    const relationshipAnalyticsService = new RelationshipAnalyticsService(relRepo, ciRepo)
    const auditTrailService = new AuditTrailService(opsEventRepo)

    // Wrap report services with Redis cache nếu cache được cung cấp
    const cachedCiInventoryReport = deps.cache
        ? new CachedCiInventoryReportService(ciInventoryReportService, deps.cache)
        : ciInventoryReportService
    const cachedRelationshipAnalytics = deps.cache
        ? new CachedRelationshipAnalyticsService(relationshipAnalyticsService, deps.cache)
        : relationshipAnalyticsService
    const cachedAuditTrail = deps.cache
        ? new CachedAuditTrailService(auditTrailService, deps.cache)
        : auditTrailService

    await fastify.register(assetsRoutes, { prefix: '/api/v1', assetService, pgClient: deps.pgClient })
    await fastify.register(maintenanceRoutes, { prefix: '/api/v1', maintenanceService })
    await fastify.register(catalogRoutes, { prefix: '/api/v1', catalogService, pgClient: deps.pgClient })
    await fastify.register(categorySpecRoutes, { prefix: '/api/v1', catalogService, categorySpecService })
    await fastify.register(assetImportRoutes, { prefix: '/api/v1', assetService })
    await fastify.register(attachmentRoutes, { prefix: '/api/v1', attachmentService })
    await fastify.register(inventoryRoutes, { prefix: '/api/v1', inventoryService, pgClient: deps.pgClient })
    await fastify.register(reminderRoutes, { prefix: '/api/v1', reminderService })
    await fastify.register(reportsRoutes, { prefix: '/api/v1', stockReportService })
    await fastify.register(reportAggregationRoutes, { prefix: '/api/v1', pgClient: deps.pgClient })
    await fastify.register(warehouseRoutes, { prefix: '/api/v1', catalogService: warehouseCatalogService, stockService, assetService })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fastify.register(stockDocumentRoutes, { prefix: '/api/v1', stockDocumentService, pgClient: deps.pgClient as any })
    await fastify.register(repairOrderRoutes, { prefix: '/api/v1', repairService })
    await fastify.register(communicationRoutes, { prefix: '/api/v1', pgClient: deps.pgClient })
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
        pgClient: deps.pgClient
    })

    // Advanced feature routes
    await fastify.register(analyticsRoutes, { prefix: '/api/v1', analyticsService })
    await fastify.register(automationRoutes, { prefix: '/api/v1', automationService })
    await fastify.register(integrationRoutes, { prefix: '/api/v1', integrationService })
    await fastify.register(securityRoutes, { prefix: '/api/v1', securityService })
    await fastify.register(cmdbEnhancementRoutes, { prefix: '/api/v1', cmdbEnhancementService })

    // Documents (migrated to packages)
    await fastify.register(documentsRoute, { prefix: '/api/v1', documentService, pgClient: deps.pgClient })

    // Labels (migrated to packages)
    await fastify.register(labelsRoute, { prefix: '/api/v1', labelsService })

    // ==================== Migrated Modules (P1-C Clean Architecture) ====================
    const accessoryRepo = new AccessoryRepo(deps.pgClient)
    const auditRepo = new AuditRepo(deps.pgClient)
    const checkoutRepo = new CheckoutRepo(deps.pgClient)
    const componentRepo = new ComponentRepo(deps.pgClient)
    const consumableRepo = new ConsumableRepo(deps.pgClient)
    const depreciationRepo = new DepreciationRepo(deps.pgClient)
    const licenseRepo = new LicenseRepo(deps.pgClient)
    const wfRepo = new WfRepo(deps.pgClient)
    const wfApproverResolverRepo = new WfApproverResolverRepo(deps.pgClient)

    const accessoryService = new AccessoryService(accessoryRepo)
    const auditService = new AuditService(auditRepo)
    const checkoutService = new CheckoutService(checkoutRepo)
    const componentService = new ComponentService(componentRepo)
    const consumableService = new ConsumableService(consumableRepo)
    const depreciationService = new DepreciationService(depreciationRepo)
    const licenseService = new LicenseService(licenseRepo)
    const wfService = new WfService(wfRepo, wfApproverResolverRepo)

    await fastify.register(accessoriesRoute, { prefix: '/api/v1', accessoryService })
    await fastify.register(auditRoute, { prefix: '/api/v1', auditService })
    await fastify.register(checkoutRoute, { prefix: '/api/v1', checkoutService })
    await fastify.register(componentsRoute, { prefix: '/api/v1', componentService })
    await fastify.register(consumablesRoute, { prefix: '/api/v1', consumableService })
    await fastify.register(depreciationRoute, { prefix: '/api/v1', depreciationService })
    await fastify.register(licensesRoute, { prefix: '/api/v1', licenseService })
    await fastify.register(wfRoute, { prefix: '/api/v1', wfService })

    await fastify.register(async (qltsApp) => {
        qltsApp.decorate('diContainer', {
            resolve<T>(key: string): T {
                const registry: Record<string, unknown> = {
                    pgClient: deps.pgClient,
                    purchasePlanRepo,
                    assetIncreaseRepo,
                    approvalRepo
                }
                return registry[key] as T
            }
        })

        await qltsApp.register(qltsRoutes, { prefix: '/api/v1/assets' })
    })
}
