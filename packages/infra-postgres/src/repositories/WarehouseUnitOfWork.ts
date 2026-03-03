import type { IWarehouseUnitOfWork, WarehouseTransactionContext } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import { MovementRepo } from './MovementRepo.js'
import { RepairOrderRepo } from './RepairOrderRepo.js'
import { RepairPartRepo } from './RepairPartRepo.js'
import { StockDocumentRepo } from './StockDocumentRepo.js'
import { StockRepo } from './StockRepo.js'
import { OpsEventRepo } from './OpsEventRepo.js'

export class WarehouseUnitOfWork implements IWarehouseUnitOfWork {
    constructor(private pg: PgClient, private useOpsEvents = true) { }

    async withTransaction<T>(handler: (context: WarehouseTransactionContext) => Promise<T>): Promise<T> {
        return await this.pg.transaction(async (client) => {
            const context: WarehouseTransactionContext = {
                documents: new StockDocumentRepo(client),
                stock: new StockRepo(client),
                movements: new MovementRepo(client),
                repairs: new RepairOrderRepo(client),
                repairParts: new RepairPartRepo(client),
                opsEvents: this.useOpsEvents ? new OpsEventRepo(client) : undefined
            }
            return await handler(context)
        })
    }
}
