import type { IOpsEventRepo } from '../events/opsEvents.js'
import type { IStockDocumentRepo } from './stockDocuments.js'
import type { IMovementRepo, IStockRepo } from './stockMovements.js'
import type { IRepairOrderRepo, IRepairPartRepo } from './repairs.js'

export interface WarehouseTransactionContext {
    documents: IStockDocumentRepo
    stock: IStockRepo
    movements: IMovementRepo
    repairs: IRepairOrderRepo
    repairParts: IRepairPartRepo
    opsEvents?: IOpsEventRepo
}

export interface IWarehouseUnitOfWork {
    withTransaction<T>(handler: (context: WarehouseTransactionContext) => Promise<T>): Promise<T>
}
