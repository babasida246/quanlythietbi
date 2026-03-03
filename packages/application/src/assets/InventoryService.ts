import { AppError } from '@qltb/domain'
import type {
    AssetRecord,
    IAssetEventRepo,
    IAssetRepo,
    IInventoryRepo,
    InventoryItemRecord,
    InventorySessionInput,
    InventorySessionRecord,
    InventorySessionListFilters,
    InventorySessionPage
} from '@qltb/contracts'

export interface InventoryServiceContext {
    userId: string
    correlationId: string
}

export interface InventoryScanRequest {
    sessionId: string
    assetId?: string
    assetCode?: string
    scannedLocationId?: string | null
    note?: string | null
}

export interface InventoryCloseResult {
    session: InventorySessionRecord
    counts: Record<string, number>
}

export class InventoryService {
    constructor(
        private inventory: IInventoryRepo,
        private assets: IAssetRepo,
        private events: IAssetEventRepo
    ) { }

    async createSession(input: InventorySessionInput, ctx: InventoryServiceContext): Promise<InventorySessionRecord> {
        return await this.inventory.createSession({
            ...input,
            status: input.status ?? 'draft',
            createdBy: ctx.userId,
            correlationId: ctx.correlationId
        })
    }

    async listSessions(filters: InventorySessionListFilters): Promise<InventorySessionPage> {
        return await this.inventory.listSessions(filters)
    }

    async getSession(sessionId: string): Promise<InventorySessionRecord> {
        const session = await this.inventory.getSession(sessionId)
        if (!session) {
            throw AppError.notFound('Inventory session not found')
        }
        return session
    }

    async listItems(sessionId: string): Promise<InventoryItemRecord[]> {
        await this.getSession(sessionId)
        return await this.inventory.listItems(sessionId)
    }

    async scanAsset(request: InventoryScanRequest, ctx: InventoryServiceContext): Promise<InventoryItemRecord> {
        const session = await this.getSession(request.sessionId)
        if (session.status === 'closed' || session.status === 'canceled') {
            throw AppError.conflict('Inventory session is closed')
        }

        let asset: AssetRecord | null = null
        if (request.assetId) {
            asset = await this.assets.getById(request.assetId)
        } else if (request.assetCode) {
            asset = await this.assets.getByAssetCode(request.assetCode)
        } else {
            throw AppError.badRequest('assetId or assetCode required')
        }

        const expectedLocationId = asset?.locationId ?? null
        const scannedLocationId = request.scannedLocationId ?? null
        const status = asset
            ? (scannedLocationId && expectedLocationId && scannedLocationId === expectedLocationId ? 'found' : 'moved')
            : 'unknown'

        const item = await this.inventory.addScan({
            sessionId: session.id,
            assetId: asset?.id ?? null,
            expectedLocationId,
            scannedLocationId,
            scannedAt: new Date(),
            status,
            note: request.note ?? null
        })

        if (asset) {
            const eventType = status === 'found' ? 'INVENTORY_FOUND' : 'INVENTORY_MISSING'
            await this.events.append({
                assetId: asset.id,
                eventType,
                payload: {
                    sessionId: session.id,
                    scannedLocationId,
                    expectedLocationId,
                    status
                },
                actorUserId: ctx.userId,
                correlationId: ctx.correlationId
            })
        }

        return item
    }

    async closeSession(sessionId: string): Promise<InventoryCloseResult> {
        const updated = await this.inventory.closeSession(sessionId, new Date())
        if (!updated) {
            throw AppError.notFound('Inventory session not found')
        }
        const items = await this.inventory.listItems(sessionId)
        const counts = items.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1
            return acc
        }, {})
        return { session: updated, counts }
    }

    async startSession(sessionId: string, _ctx: InventoryServiceContext): Promise<InventorySessionRecord> {
        const session = await this.getSession(sessionId)
        if (session.status !== 'draft') {
            throw AppError.conflict('Session is not in draft status — can only start a draft session')
        }
        const updated = await this.inventory.startSession(sessionId, new Date())
        if (!updated) {
            throw AppError.notFound('Inventory session not found')
        }
        return updated
    }

    async undoScan(sessionId: string, itemId: string, _ctx: InventoryServiceContext): Promise<void> {
        const session = await this.getSession(sessionId)
        if (session.status === 'closed' || session.status === 'canceled') {
            throw AppError.conflict('Cannot undo scan on a closed session')
        }
        const deleted = await this.inventory.deleteItem(itemId)
        if (!deleted) {
            throw AppError.notFound('Scan item not found')
        }
    }
}