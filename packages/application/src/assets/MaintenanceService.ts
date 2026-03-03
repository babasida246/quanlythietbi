import { AppError, assertStatusTransition } from '@qltb/domain'
import type {
    AssetRecord,
    IAssetEventRepo,
    IAssetRepo,
    IAssignmentRepo,
    IMaintenanceRepo,
    MaintenanceTicketInput,
    MaintenanceTicketRecord,
    MaintenanceTicketStatusPatch
} from '@qltb/contracts'

interface Logger {
    info?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
}

export interface MaintenanceServiceContext {
    userId: string
    correlationId: string
    logger?: Logger
}

export class MaintenanceService {
    constructor(
        private assets: IAssetRepo,
        private assignments: IAssignmentRepo,
        private maintenance: IMaintenanceRepo,
        private events: IAssetEventRepo
    ) { }

    async openTicket(
        assetId: string,
        input: Omit<MaintenanceTicketInput, 'assetId'>,
        ctx: MaintenanceServiceContext
    ): Promise<MaintenanceTicketRecord> {
        const asset = await this.requireAsset(assetId)

        const ticket = await this.maintenance.open({
            ...input,
            assetId,
            status: input.status ?? 'open',
            createdBy: ctx.userId,
            correlationId: ctx.correlationId
        })

        const currentStatus = asset.status ?? 'in_stock'
        if (currentStatus !== 'in_repair') {
            assertStatusTransition(currentStatus, 'in_repair')
            await this.assets.update(assetId, { status: 'in_repair' })
        }

        await this.events.append({
            assetId,
            eventType: 'MAINT_OPEN',
            payload: {
                ticketId: ticket.id,
                severity: ticket.severity,
                status: ticket.status
            },
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })

        return ticket
    }

    async updateTicketStatus(
        ticketId: string,
        status: MaintenanceTicketRecord['status'],
        patch: MaintenanceTicketStatusPatch,
        ctx: MaintenanceServiceContext
    ): Promise<MaintenanceTicketRecord> {
        const existing = await this.maintenance.getById(ticketId)
        if (!existing) {
            throw AppError.notFound('Maintenance ticket not found')
        }

        const normalizedPatch: MaintenanceTicketStatusPatch = {
            ...patch,
            correlationId: ctx.correlationId
        }

        if (status === 'closed' && !normalizedPatch.closedAt) {
            normalizedPatch.closedAt = new Date()
        }

        const updated = await this.maintenance.updateStatus(ticketId, status, normalizedPatch)
        if (!updated) {
            throw AppError.internal('Failed to update maintenance ticket')
        }

        const eventType = status === 'closed' ? 'MAINT_CLOSE' : 'UPDATED'
        if (status === 'closed') {
            await this.syncAssetStatusAfterClose(existing.assetId, ctx)
        }

        await this.events.append({
            assetId: existing.assetId,
            eventType,
            payload: {
                ticketId,
                status,
                resolution: updated.resolution ?? null
            },
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })

        return updated
    }

    async listTickets(filters: {
        assetId?: string
        status?: MaintenanceTicketRecord['status']
        page?: number
        limit?: number
    }): Promise<{
        items: MaintenanceTicketRecord[]
        total: number
        page: number
        limit: number
    }> {
        return await this.maintenance.list(filters)
    }

    async cancelTicket(ticketId: string, reason: string | undefined, ctx: MaintenanceServiceContext): Promise<MaintenanceTicketRecord> {
        return await this.updateTicketStatus(ticketId, 'canceled', {
            resolution: reason ?? undefined
        }, ctx)
    }

    private async requireAsset(assetId: string): Promise<AssetRecord> {
        const asset = await this.assets.getById(assetId)
        if (!asset) {
            throw AppError.notFound('Asset not found')
        }
        return asset
    }

    private async syncAssetStatusAfterClose(assetId: string, ctx: MaintenanceServiceContext): Promise<void> {
        const asset = await this.assets.getById(assetId)
        if (!asset) {
            ctx.logger?.warn?.('Asset not found for maintenance close', { assetId })
            return
        }

        const activeAssignment = await this.assignments.getActiveByAsset(assetId)
        const nextStatus = activeAssignment ? 'in_use' : 'in_stock'
        const currentStatus = asset.status ?? 'in_stock'
        if (currentStatus === nextStatus) {
            return
        }

        assertStatusTransition(currentStatus, nextStatus)
        await this.assets.update(assetId, { status: nextStatus })
    }
}
