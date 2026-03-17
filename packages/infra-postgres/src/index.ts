export { PgClient } from './PgClient.js'
export type { PgConfig } from './PgClient.js'
export { ConversationRepo } from './repositories/ConversationRepo.js'
export { ModelRepo } from './repositories/ModelRepo.js'
export { UserRepo, type IUserRepository } from './repositories/UserRepo.js'
export { SessionRepo, type ISessionRepository, type Session } from './repositories/SessionRepo.js'
export { MessageRepo, type IMessageRepository } from './repositories/MessageRepo.js'
export { AssetRepo } from './repositories/AssetRepo.js'
export { AssignmentRepo } from './repositories/AssignmentRepo.js'
export { MaintenanceRepo } from './repositories/MaintenanceRepo.js'
export { AssetEventRepo } from './repositories/AssetEventRepo.js'
export { CatalogRepo } from './repositories/CatalogRepo.js'
export { CategorySpecRepo } from './repositories/CategorySpecRepo.js'
export { CategorySpecVersionRepo } from './repositories/CategorySpecVersionRepo.js'
export { AttachmentRepo } from './repositories/AttachmentRepo.js'
export { InventoryRepo } from './repositories/InventoryRepo.js'
export { WorkflowRepo } from './repositories/WorkflowRepo.js'
export { ReminderRepo } from './repositories/ReminderRepo.js'
export { OpsEventRepo } from './repositories/OpsEventRepo.js'
export { StockReportRepo } from './repositories/StockReportRepo.js'
export { WarehouseRepo } from './repositories/WarehouseRepo.js'
export { SparePartRepo } from './repositories/SparePartRepo.js'
export { StockRepo } from './repositories/StockRepo.js'
export { MovementRepo } from './repositories/MovementRepo.js'
export { StockDocumentRepo } from './repositories/StockDocumentRepo.js'
export { RepairOrderRepo } from './repositories/RepairOrderRepo.js'
export { RepairPartRepo } from './repositories/RepairPartRepo.js'
export { OpsAttachmentRepo } from './repositories/OpsAttachmentRepo.js'
export { SparePartLotRepo } from './repositories/SparePartLotRepo.js'
export { WarehouseUnitOfWork } from './repositories/WarehouseUnitOfWork.js'
export { CiTypeRepo } from './repositories/CiTypeRepo.js'
export { CiTypeVersionRepo } from './repositories/CiTypeVersionRepo.js'
export { CiSchemaRepo } from './repositories/CiSchemaRepo.js'
export { CiRepo } from './repositories/CiRepo.js'
export { CiAttrValueRepo } from './repositories/CiAttrValueRepo.js'
export { RelationshipTypeRepo } from './repositories/RelationshipTypeRepo.js'
export { RelationshipRepo } from './repositories/RelationshipRepo.js'
export { CmdbServiceRepo } from './repositories/CmdbServiceRepo.js'
export { CmdbChangeRepo } from './repositories/CmdbChangeRepo.js'
export { PurchasePlanRepo } from './repositories/PurchasePlanRepo.js'
export { AssetIncreaseRepo } from './repositories/AssetIncreaseRepo.js'
export { ApprovalRepo } from './repositories/ApprovalRepo.js'

// Advanced feature repos
export { AutomationRuleRepo, AutomationLogRepo, NotificationRepo, ScheduledTaskRepo } from './repositories/AutomationRepo.js'
export { AnalyticsRepo, CostRecordRepo, PerformanceMetricRepo, DashboardConfigRepo } from './repositories/AnalyticsRepo.js'
export { IntegrationConnectorRepo, SyncRuleRepo, WebhookRepo } from './repositories/IntegrationRepo.js'
export { RbacPermissionRepo, SecurityAuditRepo, ComplianceRepo } from './repositories/SecurityComplianceRepo.js'
export { DiscoveryRuleRepo, DiscoveryResultRepo, SmartTagRepo, ChangeAssessmentRepo } from './repositories/CmdbEnhancementRepo.js'

// Knowledge base documents
export { DocumentRepo } from './repositories/DocumentRepo.js'
export type { KbDocFileRow } from './repositories/DocumentRepo.js'

// Labels
export { LabelsRepository } from './repositories/LabelsRepo.js'

// Accessories
export { AccessoryRepo } from './repositories/AccessoryRepo.js'

// Audit
export { AuditRepo } from './repositories/AuditRepo.js'

// Checkout
export { CheckoutRepo } from './repositories/CheckoutRepo.js'

// Components
export { ComponentRepo } from './repositories/ComponentRepo.js'

// Consumables
export { ConsumableRepo } from './repositories/ConsumableRepo.js'

// Depreciation
export { DepreciationRepo } from './repositories/DepreciationRepo.js'

// Licenses
export { LicenseRepo } from './repositories/LicenseRepo.js'

// Workflow
export { WfRepo } from './repositories/WfRepo.js'
export { WfApproverResolverRepo } from './repositories/WfApproverResolverRepo.js'

// AD-style RBAC repositories
export {
    PgOrgUnitRepo, PgRbacUserRepo, PgRbacGroupRepo,
    PgRbacMembershipRepo, PgRbacAdRoleRepo,
    PgRbacAdPermissionRepo, PgRbacAclRepo,
} from './repositories/RbacAdRepo.js'
