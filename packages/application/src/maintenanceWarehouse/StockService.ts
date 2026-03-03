import type { IStockRepo, StockRecord, StockViewFilters, StockViewPage } from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

export class StockService {
    constructor(private stock: IStockRepo) { }

    async listView(filters: StockViewFilters, _ctx: MaintenanceWarehouseContext): Promise<StockViewPage> {
        return await this.stock.listView(filters)
    }

    async reserve(warehouseId: string, partId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.reserve(warehouseId, partId, qty)
    }

    async release(warehouseId: string, partId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.release(warehouseId, partId, qty)
    }

    async commitReserved(warehouseId: string, partId: string, qty: number, _ctx: MaintenanceWarehouseContext): Promise<StockRecord> {
        return await this.stock.commitReserved(warehouseId, partId, qty)
    }
}
