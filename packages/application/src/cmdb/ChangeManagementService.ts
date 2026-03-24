import { AppError } from '@qltb/domain'
import type { ICiRepo, ICmdbChangeRepo, IOpsEventRepo, CmdbChangeCreateInput, CmdbChangeListFilters, CmdbChangePage, CmdbChangeRecord, CmdbChangeUpdatePatch } from '@qltb/contracts'
import type { CmdbContext } from './SchemaService.js'
import type { RelationshipService } from './RelationshipService.js'

export class ChangeManagementService {
    constructor(
        private changes: ICmdbChangeRepo,
        private cis: ICiRepo,
        private relationships: RelationshipService,
        private opsEvents?: IOpsEventRepo
    ) { }

    async listChanges(filters: CmdbChangeListFilters): Promise<CmdbChangePage> {
        return await this.changes.list(filters)
    }

    async getChange(id: string): Promise<CmdbChangeRecord> {
        const change = await this.changes.getById(id)
        if (!change) throw AppError.notFound('CMDB change not found')
        return change
    }

    async createChange(input: CmdbChangeCreateInput, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        if (input.primaryCiId) {
            const ci = await this.cis.getById(input.primaryCiId)
            if (!ci) throw AppError.notFound('Primary CI not found')
        }
        const created = await this.changes.create({
            ...input,
            requestedBy: ctx.userId
        })
        await this.appendEvent(created.id, 'CMDB_CHANGE_CREATED', { code: created.code }, ctx)
        return created
    }

    async updateChange(id: string, patch: CmdbChangeUpdatePatch, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const existing = await this.getChange(id)
        if (existing.status !== 'draft') {
            throw AppError.badRequest('Only draft changes can be edited')
        }
        if (patch.primaryCiId) {
            const ci = await this.cis.getById(patch.primaryCiId)
            if (!ci) throw AppError.notFound('Primary CI not found')
        }
        const updated = await this.changes.update(id, patch)
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_UPDATED', this.compactPayload(patch), ctx)
        return updated
    }

    async submitChange(id: string, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const change = await this.getChange(id)
        if (change.status !== 'draft') {
            throw AppError.badRequest('Only draft changes can be submitted')
        }
        const impactSnapshot = await this.buildImpactSnapshot(change.primaryCiId ?? null)
        const updated = await this.changes.update(id, {
            status: 'submitted',
            impactSnapshot
        })
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_SUBMITTED', { impactCaptured: Boolean(change.primaryCiId) }, ctx)
        return updated
    }

    async approveChange(id: string, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const change = await this.getChange(id)
        if (change.status !== 'submitted') {
            throw AppError.badRequest('Only submitted changes can be approved')
        }
        if (change.requestedBy && change.requestedBy === ctx.userId) {
            throw AppError.forbidden('Requester cannot approve the same change')
        }
        const impactSnapshot = await this.buildImpactSnapshot(change.primaryCiId ?? null)
        const updated = await this.changes.update(id, {
            status: 'approved',
            approvedBy: ctx.userId,
            impactSnapshot
        })
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_APPROVED', { approvedBy: ctx.userId }, ctx)
        return updated
    }

    async implementChange(id: string, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const change = await this.getChange(id)
        if (change.status !== 'approved') {
            throw AppError.badRequest('Only approved changes can be implemented')
        }
        if (change.approvedBy && change.approvedBy === ctx.userId) {
            throw AppError.forbidden('Approver cannot implement the same change')
        }
        const impactSnapshot = await this.buildImpactSnapshot(change.primaryCiId ?? null)
        const updated = await this.changes.update(id, {
            status: 'implemented',
            implementedBy: ctx.userId,
            implementedAt: new Date().toISOString(),
            impactSnapshot
        })
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_IMPLEMENTED', { implementedBy: ctx.userId }, ctx)
        return updated
    }

    async closeChange(id: string, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const change = await this.getChange(id)
        if (change.status !== 'implemented') {
            throw AppError.badRequest('Only implemented changes can be closed')
        }
        const updated = await this.changes.update(id, {
            status: 'closed',
            closedAt: new Date().toISOString()
        })
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_CLOSED', {}, ctx)
        return updated
    }

    async cancelChange(id: string, ctx: CmdbContext): Promise<CmdbChangeRecord> {
        const change = await this.getChange(id)
        if (!['draft', 'submitted', 'approved'].includes(change.status)) {
            throw AppError.badRequest('Only draft/submitted/approved changes can be canceled')
        }
        const updated = await this.changes.update(id, { status: 'canceled' })
        if (!updated) throw AppError.notFound('CMDB change not found')
        await this.appendEvent(updated.id, 'CMDB_CHANGE_CANCELED', {}, ctx)
        return updated
    }

    private async buildImpactSnapshot(primaryCiId: string | null): Promise<unknown> {
        if (!primaryCiId) return null
        const ci = await this.cis.getById(primaryCiId)
        if (!ci) throw AppError.notFound('Primary CI not found')
        const impact = await this.relationships.getImpactAnalysis(primaryCiId)
        return {
            capturedAt: new Date().toISOString(),
            primaryCiId,
            primaryCiCode: ci.ciCode,
            impact
        }
    }

    private compactPayload(patch: CmdbChangeUpdatePatch): Record<string, unknown> {
        const payload: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(patch)) {
            if (value !== undefined) payload[key] = value
        }
        return payload
    }

    private async appendEvent(entityId: string, eventType: string, payload: Record<string, unknown>, ctx: CmdbContext): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType: 'cmdb_change',
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
