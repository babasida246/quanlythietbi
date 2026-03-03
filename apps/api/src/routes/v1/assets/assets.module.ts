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
    ChangeAssessmentRepo
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
    // Advanced feature services
    AutomationService,
    AnalyticsService,
    IntegrationService,
    SecurityService,
    CmdbEnhancementService
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
// Self-contained module imports
import { AccessoryService, accessoryRoutes } from '../../../modules/accessories/index.js'
import { AuditRepository, AuditService, auditRoutes } from '../../../modules/audit/index.js'
import { CheckoutService, checkoutRoutes } from '../../../modules/checkout/index.js'
import { ComponentService, componentRoutes } from '../../../modules/components/index.js'
import { ConsumableService, consumableRoutes } from '../../../modules/consumables/index.js'
import { DepreciationRepository, DepreciationService, depreciationRoutes } from '../../../modules/depreciation/index.js'
import { documentsRoutes } from '../../../modules/documents/index.js'
import { LabelsRepository, LabelsService, labelsRoutes } from '../../../modules/labels/index.js'
import { LicenseService, licenseRoutes } from '../../../modules/licenses/index.js'
import { WfRepository, WfService, ApproverResolver, wfMeRoutes, wfInboxRoutes, wfAdminRoutes } from '../../../modules/wf/index.js'
import { createAuthService } from '../../../modules/auth/index.js'
import { createEntitlementService } from '../../../modules/entitlements/entitlement.service.js'

export interface AssetModuleDeps {
    pgClient: PgClient
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

    // Report services
    const ciInventoryReportService = new CiInventoryReportService(ciRepo, relRepo, ciTypeRepo)
    const relationshipAnalyticsService = new RelationshipAnalyticsService(relRepo, ciRepo)
    const auditTrailService = new AuditTrailService(opsEventRepo)

    await fastify.register(assetsRoutes, { prefix: '/api/v1', assetService, pgClient: deps.pgClient })
    await fastify.register(maintenanceRoutes, { prefix: '/api/v1', maintenanceService })
    await fastify.register(catalogRoutes, { prefix: '/api/v1', catalogService, pgClient: deps.pgClient })
    await fastify.register(categorySpecRoutes, { prefix: '/api/v1', catalogService, categorySpecService })
    await fastify.register(assetImportRoutes, { prefix: '/api/v1', assetService })
    await fastify.register(attachmentRoutes, { prefix: '/api/v1', attachmentService })
    await fastify.register(inventoryRoutes, { prefix: '/api/v1', inventoryService })
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
        ciInventoryReportService,
        relationshipAnalyticsService,
        auditTrailService,
        pgClient: deps.pgClient
    })

    // Advanced feature routes
    await fastify.register(analyticsRoutes, { prefix: '/api/v1', analyticsService })
    await fastify.register(automationRoutes, { prefix: '/api/v1', automationService })
    await fastify.register(integrationRoutes, { prefix: '/api/v1', integrationService })
    await fastify.register(securityRoutes, { prefix: '/api/v1', securityService })
    await fastify.register(cmdbEnhancementRoutes, { prefix: '/api/v1', cmdbEnhancementService })

    // ==================== Self-contained Modules ====================
    const pool = deps.pgClient.getPool()
    const authService = createAuthService(deps.pgClient)
    const entitlementService = createEntitlementService()

    // Wrap all self-contained modules under /api/v1 prefix
    await fastify.register(async (v1) => {
        // Accessories
        const accessoryService = new AccessoryService(pool)
        await accessoryRoutes(v1, accessoryService, authService)

        // Checkout
        const checkoutService = new CheckoutService(pool)
        await checkoutRoutes(v1, checkoutService, authService)

        // Components
        const componentService = new ComponentService(pool)
        await componentRoutes(v1, componentService, authService)

        // Consumables
        const consumableService = new ConsumableService(pool)
        await consumableRoutes(v1, consumableService, authService)

        // Licenses
        const licenseService = new LicenseService(pool)
        await licenseRoutes(v1, licenseService, authService, entitlementService)

        // Audit
        const auditRepository = new AuditRepository(pool)
        const auditService = new AuditService(auditRepository)
        await auditRoutes(v1, { auditService })

        // Depreciation
        const depreciationRepository = new DepreciationRepository(pool)
        const depreciationService = new DepreciationService(depreciationRepository)
        await depreciationRoutes(v1, { depreciationService })

        // Documents
        await documentsRoutes(v1, { db: pool, authService })

        // Labels
        const labelsRepository = new LabelsRepository(pool)
        const labelsService = new LabelsService(labelsRepository)
        await labelsRoutes(v1, { labelsService })

        // Workflow Request & Approval (wf_*)
        const wfRepository = new WfRepository(pool)
        const wfApproverResolver = new ApproverResolver(pool)
        const wfService = new WfService(wfRepository, wfApproverResolver)
        await wfMeRoutes(v1, { wfService })
        await wfInboxRoutes(v1, { wfService })
        await wfAdminRoutes(v1, { wfService })
    }, { prefix: '/api/v1' })

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
