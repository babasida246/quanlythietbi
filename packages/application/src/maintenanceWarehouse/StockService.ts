import type { IStockRepo, StockRecord, StockViewFilters, StockViewPage } from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

export class StockService {
    constructor(private stock: IStockRepo) { }

    async listView(filters: StockViewFilters, _ctx: MaintenanceWarehouseContext): Promise<StockViewPage> {
        return await this.stock.listView(filters)
    }

    async reserve(warehouseId: string, modelId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.reserve(warehouseId, modelId, qty)
    }

    async release(warehouseId: string, modelId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.release(warehouseId, modelId, qty)
    }

    async commitReserved(warehouseId: string, modelId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.commitReserved(warehouseId, modelId, qty)
    }
}
