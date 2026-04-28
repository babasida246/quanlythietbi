import type { IOpsEventRepo } from '../events/opsEvents.js'
import type { IStockDocumentRepo } from './stockDocuments.js'
import type { IMovementRepo, IStockRepo } from './stockMovements.js'
import type { IRepairOrderRepo, IRepairPartRepo } from './repairs.js'
import type { IAssetRepo } from '../assets/index.js'

export interface WarehouseTransactionContext {
    documents: IStockDocumentRepo
    modelStock: IStockRepo
    modelMovements: IMovementRepo
    repairs: IRepairOrderRepo
    repairParts: IRepairPartRepo
    assets: IAssetRepo
    opsEvents?: IOpsEventRepo
}

export interface IWarehouseUnitOfWork {
    withTransaction<T>(handler: (context: WarehouseTransactionContext) => Promise<T>): Promise<T>
}
