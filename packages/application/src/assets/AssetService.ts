import {
    AppError,
    AssetEventTypeValues,
    assertAssetCode,
    assertModelId,
    assertStatusTransition,
    assertVlanId,
    type AssetStatus
} from '@qltb/domain'
import type {
    AssetAssignmentInput,
    AssetAssignmentRecord,
    AssetBulkUpsertInput,
    AssetCreateInput,
    AssetEventInput,
    AssetEventPage,
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetImportCommitResult,
    AssetImportPreviewResult,
    AssetImportRow,
    AssetUpdatePatch,
    IAssetEventRepo,
    IAssetRepo,
    IAssignmentRepo,
    IMaintenanceRepo,
    MaintenanceTicketRecord
} from '@qltb/contracts'
import { buildImportPreview, getValidImportRows } from './asset-import.js'

interface Logger {
    info?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
}

export interface AssetServiceContext {
    userId: string
    correlationId: string
    logger?: Logger
}

function cleanPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
    const cleaned: Partial<T> = {}
    for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
            cleaned[key as keyof T] = value as T[keyof T]
        }
    }
    return cleaned
}

function assertEventType(value: string): void {
    if (!AssetEventTypeValues.includes(value as (typeof AssetEventTypeValues)[number])) {
        throw AppError.badRequest('Invalid asset event type')
    }
}

export class AssetService {
    constructor(private assets: IAssetRepo, private assignments: IAssignmentRepo, private events: IAssetEventRepo, private maintenance: IMaintenanceRepo) { }

    async createAsset(input: AssetCreateInput, ctx: AssetServiceContext): Promise<AssetRecord> {
        assertAssetCode(input.assetCode)
        assertModelId(input.modelId)
        assertVlanId(input.vlanId)

        const created = await this.assets.create({
            ...input,
            status: input.status ?? 'in_stock'
        })

        await this.appendEvent(created.id, 'CREATED', {
            assetCode: created.assetCode,
            status: created.status
        }, ctx)
        return created
    }

    async updateAsset(assetId: string, patch: AssetUpdatePatch, ctx: AssetServiceContext): Promise<AssetRecord> {
        const existing = await this.assets.getById(assetId)
        if (!existing) {
            throw AppError.notFound('Asset not found')
        }

        if (patch.assetCode !== undefined) {
            assertAssetCode(patch.assetCode)
        }
        const currentStatus = existing.status ?? 'in_stock'
        if (patch.status && patch.status !== currentStatus) {
            assertStatusTransition(currentStatus, patch.status)
        }
        if (patch.vlanId !== undefined) {
            assertVlanId(patch.vlanId)
        }

        const cleaned = cleanPatch(patch)
        if (Object.keys(cleaned).length === 0) {
            return existing
        }

        const updated = await this.assets.update(assetId, cleaned)

        await this.appendEvent(updated.id, 'UPDATED', {
            changedFields: Object.keys(cleaned)
        }, ctx)
        return updated
    }

    async deleteAsset(assetId: string): Promise<void> {
        const existing = await this.assets.getById(assetId)
        if (!existing) {
            throw AppError.notFound('Asset not found')
        }

        const deleted = await this.assets.delete(assetId)
        if (!deleted) {
            throw AppError.notFound('Asset not found')
        }
    }

    async getAssetById(assetId: string): Promise<AssetRecord> {
        const asset = await this.assets.getById(assetId)
        if (!asset) {
            throw AppError.notFound('Asset not found')
        }
        return asset
    }

    async getAssetDetail(assetId: string): Promise<{
        asset: AssetRecord
        assignments: AssetAssignmentRecord[]
        maintenance: MaintenanceTicketRecord[]
    }> {
        const asset = await this.getAssetById(assetId)
        const assignments = await this.assignments.listByAsset(assetId)
        const maintenance = (await this.maintenance.list({ assetId, page: 1, limit: 50 })).items
        return { asset, assignments, maintenance }
    }

    async searchAssets(filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return await this.assets.search(filters)
    }
    async exportAssetsCsvData(filters: AssetSearchFilters): Promise<AssetRecord[]> {
        const first = await this.assets.search({ ...filters, page: 1, limit: 100 })
        const items = [...first.items]
        const totalPages = Math.max(1, Math.ceil(first.total / first.limit))
        for (let page = 2; page <= totalPages; page += 1) {
            const next = await this.assets.search({ ...filters, page, limit: first.limit })
            items.push(...next.items)
        }
        return items
    }

    async bulkImportPreview(rows: AssetImportRow[]): Promise<AssetImportPreviewResult> {
        return buildImportPreview(rows)
    }
    async bulkImportCommit(rows: AssetImportRow[], ctx: AssetServiceContext): Promise<AssetImportCommitResult> {
        const preview = await this.bulkImportPreview(rows)
        const validRows = getValidImportRows(preview) as AssetBulkUpsertInput[]
        if (validRows.length === 0) {
            return { created: 0, updated: 0, skipped: rows.length }
        }

        const result = await this.assets.bulkUpsert(validRows)
        for (const asset of result.items) {
            await this.appendEvent(asset.id, 'IMPORTED', { assetCode: asset.assetCode }, ctx)
        }
        return {
            created: result.created,
            updated: result.updated,
            skipped: rows.length - validRows.length
        }
    }

    async assignAsset(assetId: string, input: AssetAssignmentInput, ctx: AssetServiceContext): Promise<{
        asset: AssetRecord
        assignment: AssetAssignmentRecord
    }> {
        const asset = await this.getAssetById(assetId)

        const active = await this.assignments.getActiveByAsset(assetId)
        if (active) {
            const returned = await this.assignments.return(assetId, new Date(), 'Auto-return due to reassignment')
            if (returned) {
                await this.appendEvent(assetId, 'UNASSIGNED', {
                    assignmentId: returned.id,
                    returnedAt: returned.returnedAt?.toISOString(),
                    note: returned.note
                }, ctx)
            }
        }

        const assignment = await this.assignments.assign(assetId, input)
        let updated = asset
        const assignStatus = asset.status ?? 'in_stock'
        if (assignStatus !== 'in_use') {
            assertStatusTransition(assignStatus, 'in_use')
            updated = await this.assets.update(assetId, { status: 'in_use' })
        }

        await this.appendEvent(assetId, 'ASSIGNED', {
            assignmentId: assignment.id,
            assigneeType: assignment.assigneeType,
            assigneeId: assignment.assigneeId ?? null,
            assigneeName: assignment.assigneeName
        }, ctx)
        return { asset: updated, assignment }
    }

    async returnAsset(
        assetId: string,
        opts: { note?: string; verificationMethod?: string | null; verifiedAt?: Date | null; wfRequestId?: string | null } | string | undefined,
        ctx: AssetServiceContext
    ): Promise<{
        asset: AssetRecord
        assignment: AssetAssignmentRecord
    }> {
        const asset = await this.getAssetById(assetId)
        const active = await this.assignments.getActiveByAsset(assetId)
        if (!active) {
            throw AppError.conflict('No active assignment to return')
        }

        const returnOpts = typeof opts === 'string' ? { note: opts } : (opts ?? {})
        const returned = await this.assignments.return(assetId, new Date(), returnOpts)
        if (!returned) {
            throw AppError.conflict('Failed to return assignment')
        }

        let updated = asset
        const returnStatus = asset.status ?? 'in_stock'
        if (returnStatus !== 'in_stock') {
            assertStatusTransition(returnStatus, 'in_stock')
            updated = await this.assets.update(assetId, { status: 'in_stock' })
        }

        await this.appendEvent(assetId, 'UNASSIGNED', {
            assignmentId: returned.id,
            returnedAt: returned.returnedAt?.toISOString(),
            note: returned.note ?? null
        }, ctx)
        return { asset: updated, assignment: returned }
    }

    async moveAsset(assetId: string, newLocationId: string, ctx: AssetServiceContext): Promise<AssetRecord> {
        const asset = await this.getAssetById(assetId)
        const updated = await this.assets.update(assetId, { locationId: newLocationId })

        await this.appendEvent(assetId, 'MOVED', {
            fromLocationId: asset.locationId ?? null,
            toLocationId: newLocationId
        }, ctx)
        return updated
    }

    async changeStatus(assetId: string, newStatus: AssetStatus, ctx: AssetServiceContext): Promise<AssetRecord> {
        const asset = await this.getAssetById(assetId)
        const currentStatus = asset.status ?? 'in_stock'
        if (currentStatus === newStatus) {
            return asset
        }

        assertStatusTransition(currentStatus, newStatus)
        const updated = await this.assets.update(assetId, { status: newStatus })

        const eventType = newStatus === 'retired' ? 'RETIRED'
            : newStatus === 'disposed' ? 'DISPOSED'
                : 'UPDATED'

        await this.appendEvent(assetId, eventType, {
            fromStatus: currentStatus,
            toStatus: newStatus
        }, ctx)

        return updated
    }

    async listTimeline(assetId: string, page = 1, limit = 20): Promise<AssetEventPage> {
        await this.getAssetById(assetId)
        return await this.events.listByAsset(assetId, page, limit)
    }
    private async appendEvent(
        assetId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: AssetServiceContext
    ): Promise<void> {
        assertEventType(eventType)
        const event: AssetEventInput = {
            assetId,
            eventType: eventType as AssetEventInput['eventType'],
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        }
        await this.events.append(event)
    }
}
