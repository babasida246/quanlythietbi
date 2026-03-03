import type {
    AssetRecord,
    AssetSearchFilters,
    IAssetRepo,
    IReminderRepo,
    ReminderPage,
    ReminderRecord
} from '@qltb/contracts'

export interface ReminderServiceContext {
    userId: string
    correlationId: string
}

export class ReminderService {
    constructor(
        private assets: IAssetRepo,
        private reminders: IReminderRepo
    ) { }

    async runWarrantyReminders(days: number[], ctx: ReminderServiceContext): Promise<{ created: number }> {
        let created = 0
        for (const day of days) {
            const assets = await this.fetchAllAssets({ warrantyExpiringDays: day })
            for (const asset of assets) {
                if (!asset.warrantyEnd) continue
                await this.reminders.upsert({
                    reminderType: 'warranty_expiring',
                    assetId: asset.id,
                    dueAt: asset.warrantyEnd,
                    status: 'pending',
                    channel: 'ui',
                    correlationId: ctx.correlationId
                })
                created += 1
            }
        }
        return { created }
    }

    async listReminders(filters: Parameters<IReminderRepo['list']>[0]): Promise<ReminderPage> {
        return await this.reminders.list(filters)
    }

    async listPending(limit = 50): Promise<ReminderRecord[]> {
        return await this.reminders.listPending(limit)
    }

    async markSent(id: string): Promise<ReminderRecord | null> {
        return await this.reminders.markSent(id, new Date())
    }

    private async fetchAllAssets(filters: AssetSearchFilters): Promise<AssetRecord[]> {
        const first = await this.assets.search({ ...filters, page: 1, limit: 100 })
        const items = [...first.items]
        const totalPages = Math.max(1, Math.ceil(first.total / first.limit))
        for (let page = 2; page <= totalPages; page += 1) {
            const next = await this.assets.search({ ...filters, page, limit: first.limit })
            items.push(...next.items)
        }
        return items
    }
}
