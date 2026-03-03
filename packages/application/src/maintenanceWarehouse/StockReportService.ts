import type {
    FefoLotRow,
    FefoReportFilters,
    IStockReportRepo,
    ReorderAlertRow,
    StockAvailableRow,
    StockOnHandRow,
    StockReportFilters,
    ValuationFilters,
    ValuationResult
} from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

export class StockReportService {
    constructor(private reports: IStockReportRepo) { }

    async stockOnHand(filters: StockReportFilters, _ctx: MaintenanceWarehouseContext): Promise<StockOnHandRow[]> {
        return await this.reports.stockOnHand(filters)
    }

    async stockAvailable(filters: StockReportFilters, _ctx: MaintenanceWarehouseContext): Promise<StockAvailableRow[]> {
        return await this.reports.stockAvailable(filters)
    }

    async reorderAlerts(filters: StockReportFilters, _ctx: MaintenanceWarehouseContext): Promise<ReorderAlertRow[]> {
        return await this.reports.reorderAlerts(filters)
    }

    async fefoLots(filters: FefoReportFilters, _ctx: MaintenanceWarehouseContext): Promise<FefoLotRow[]> {
        return await this.reports.fefoLots(filters)
    }

    async valuation(filters: ValuationFilters, _ctx: MaintenanceWarehouseContext): Promise<ValuationResult> {
        return await this.reports.valuation(filters)
    }
}
