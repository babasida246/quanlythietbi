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
    EquipmentGroupRepo,
    InventoryRepo,
    MaintenanceRepo,
    OpsEventRepo,
    PurchasePlanRepo,
    ReminderRepo
} from '@qltb/infra-postgres'
import {
    AssetService,
    AttachmentService,
    CatalogService,
    CategorySpecService,
    EquipmentGroupService,
    InventoryService,
    MaintenanceService,
    ReminderService
} from '@qltb/application'
import { assetsRoutes } from './assets.routes.js'
import { catalogRoutes } from './catalogs.routes.js'
import { assetImportRoutes } from './assets.import.routes.js'
import { attachmentRoutes } from './attachments.routes.js'
import { categorySpecRoutes } from './category-specs.routes.js'
import { maintenanceRoutes } from '../maintenance/maintenance.routes.js'
import { inventoryRoutes } from '../inventory/inventory.routes.js'
import { reminderRoutes } from '../reports/reminders.routes.js'
import { equipmentGroupRoutes } from './equipment-groups.routes.js'
import { qltsRoutes } from '../../../modules/qlts/routes/index.js'

export async function registerAssetsContext(
    fastify: FastifyInstance,
    pgClient: PgClient
): Promise<{ assetService: AssetService }> {
    const assetRepo = new AssetRepo(pgClient)
    const assignmentRepo = new AssignmentRepo(pgClient)
    const maintenanceRepo = new MaintenanceRepo(pgClient)
    const assetEventRepo = new AssetEventRepo(pgClient)
    const catalogRepo = new CatalogRepo(pgClient)
    const categorySpecRepo = new CategorySpecRepo(pgClient)
    const categorySpecVersionRepo = new CategorySpecVersionRepo(pgClient)
    const opsEventRepo = new OpsEventRepo(pgClient)
    const attachmentRepo = new AttachmentRepo(pgClient)
    const inventoryRepo = new InventoryRepo(pgClient)
    const reminderRepo = new ReminderRepo(pgClient)
    const purchasePlanRepo = new PurchasePlanRepo(pgClient)
    const assetIncreaseRepo = new AssetIncreaseRepo(pgClient)
    const approvalRepo = new ApprovalRepo(pgClient)

    const equipmentGroupRepo = new EquipmentGroupRepo(pgClient)
    const equipmentGroupService = new EquipmentGroupService(equipmentGroupRepo)

    const assetService = new AssetService(assetRepo, assignmentRepo, assetEventRepo, maintenanceRepo)
    const maintenanceService = new MaintenanceService(assetRepo, assignmentRepo, maintenanceRepo, assetEventRepo)
    const catalogService = new CatalogService(catalogRepo, categorySpecRepo, categorySpecVersionRepo, undefined, opsEventRepo)
    const categorySpecService = new CategorySpecService(catalogRepo, categorySpecRepo, categorySpecVersionRepo, opsEventRepo)
    const attachmentService = new AttachmentService(assetRepo, attachmentRepo, assetEventRepo)
    const inventoryService = new InventoryService(inventoryRepo, assetRepo, assetEventRepo)
    const reminderService = new ReminderService(assetRepo, reminderRepo)

    await fastify.register(assetsRoutes, { prefix: '/api/v1', assetService, pgClient })
    await fastify.register(maintenanceRoutes, { prefix: '/api/v1', maintenanceService })
    await fastify.register(catalogRoutes, { prefix: '/api/v1', catalogService, pgClient })
    await fastify.register(categorySpecRoutes, { prefix: '/api/v1', catalogService, categorySpecService })
    await fastify.register(assetImportRoutes, { prefix: '/api/v1', assetService })
    await fastify.register(attachmentRoutes, { prefix: '/api/v1', attachmentService })
    await fastify.register(inventoryRoutes, { prefix: '/api/v1', inventoryService, pgClient })
    await fastify.register(reminderRoutes, { prefix: '/api/v1', reminderService })
    await fastify.register(equipmentGroupRoutes, { prefix: '/api/v1', equipmentGroupService })

    await fastify.register(async (qltsApp) => {
        qltsApp.decorate('diContainer', {
            resolve<T>(key: string): T {
                const registry: Record<string, unknown> = {
                    pgClient,
                    purchasePlanRepo,
                    assetIncreaseRepo,
                    approvalRepo
                }
                return registry[key] as T
            }
        })
        await qltsApp.register(qltsRoutes, { prefix: '/api/v1/assets' })
    })

    return { assetService }
}
