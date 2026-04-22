import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import type { AssetService } from '@qltb/application'
import {
    CiRepo,
    MovementRepo,
    OpsAttachmentRepo,
    OpsEventRepo,
    RelationshipRepo,
    RelationshipTypeRepo,
    RepairOrderRepo,
    RepairPartRepo,
    SparePartRepo,
    StockDocumentRepo,
    StockRepo,
    StockReportRepo,
    WarehouseRepo,
    WarehouseUnitOfWork
} from '@qltb/infra-postgres'
import {
    OpsAttachmentService,
    RelationshipService,
    RepairService,
    StockDocumentService,
    StockReportService,
    StockService,
    WarehouseCatalogService
} from '@qltb/application'
import { reportsRoutes } from '../reports/reports.routes.js'
import { warehouseRoutes } from '../warehouse/warehouse.routes.js'
import { stockDocumentRoutes } from '../warehouse/stock-documents.routes.js'
import { repairOrderRoutes } from '../warehouse/repair-orders.routes.js'
import { opsAttachmentRoutes } from '../warehouse/ops-attachments.routes.js'

export async function registerWarehouseContext(
    fastify: FastifyInstance,
    pgClient: PgClient,
    deps: { assetService: AssetService }
): Promise<void> {
    const stockReportRepo = new StockReportRepo(pgClient)
    const warehouseRepo = new WarehouseRepo(pgClient)
    const sparePartRepo = new SparePartRepo(pgClient)
    const stockRepo = new StockRepo(pgClient)
    const movementRepo = new MovementRepo(pgClient)
    const stockDocumentRepo = new StockDocumentRepo(pgClient)
    const repairOrderRepo = new RepairOrderRepo(pgClient)
    const repairPartRepo = new RepairPartRepo(pgClient)
    const warehouseUnitOfWork = new WarehouseUnitOfWork(pgClient)
    const opsEventRepo = new OpsEventRepo(pgClient)
    const opsAttachmentRepo = new OpsAttachmentRepo(pgClient)

    // Inline checker: validates that an asset_model entity exists before attaching files
    const assetModelChecker = {
        existsById: async (id: string) => {
            const r = await pgClient.query<{ exists: boolean }>(
                'SELECT EXISTS(SELECT 1 FROM asset_models WHERE id = $1) AS exists', [id]
            )
            return r.rows[0]?.exists ?? false
        }
    }

    // Local CMDB repos needed only by RepairService
    const ciRepo = new CiRepo(pgClient)
    const relTypeRepo = new RelationshipTypeRepo(pgClient)
    const relRepo = new RelationshipRepo(pgClient)
    const localRelationshipService = new RelationshipService(relTypeRepo, relRepo, ciRepo, opsEventRepo)

    const stockReportService = new StockReportService(stockReportRepo)
    const warehouseCatalogService = new WarehouseCatalogService(warehouseRepo, sparePartRepo, opsEventRepo)
    const opsAttachmentService = new OpsAttachmentService(
        opsAttachmentRepo, repairOrderRepo, stockDocumentRepo, opsEventRepo, assetModelChecker
    )
    const stockService = new StockService(stockRepo)
    const stockDocumentService = new StockDocumentService(
        stockDocumentRepo,
        stockRepo,
        movementRepo,
        warehouseUnitOfWork,
        opsEventRepo
    )
    const repairService = new RepairService(
        repairOrderRepo,
        repairPartRepo,
        stockDocumentRepo,
        stockRepo,
        movementRepo,
        warehouseUnitOfWork,
        opsEventRepo,
        ciRepo,
        localRelationshipService
    )

    await fastify.register(reportsRoutes, { prefix: '/api/v1', stockReportService })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fastify.register(warehouseRoutes, { prefix: '/api/v1', catalogService: warehouseCatalogService, stockService, assetService: deps.assetService, pgClient: pgClient as any })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fastify.register(stockDocumentRoutes, { prefix: '/api/v1', stockDocumentService, pgClient: pgClient as any })
    await fastify.register(repairOrderRoutes, { prefix: '/api/v1', repairService })
    await fastify.register(opsAttachmentRoutes, { prefix: '/api/v1', opsAttachmentService })
}
