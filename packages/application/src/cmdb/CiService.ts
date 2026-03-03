import { AppError } from '@qltb/domain'
import type {
    CiAttrDefRecord,
    CiAttrValueRecord,
    CiCreateInput,
    CiListFilters,
    CiPage,
    CiRecord,
    CiTypeVersionRecord,
    ICiAttrValueRepo,
    ICiRepo,
    ICiSchemaRepo,
    ICiTypeVersionRepo,
    IOpsEventRepo
} from '@qltb/contracts'
import { validateCiAttributes } from './specValidation.js'

export interface CmdbContext {
    userId: string
    correlationId: string
}

export interface CiDetail {
    ci: CiRecord
    attributes: CiAttrValueRecord[]
    schema: CiAttrDefRecord[]
    version: CiTypeVersionRecord
}

export class CiService {
    constructor(
        private cis: ICiRepo,
        private versions: ICiTypeVersionRepo,
        private defs: ICiSchemaRepo,
        private values: ICiAttrValueRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async createCi(
        input: CiCreateInput,
        attributes: Record<string, unknown> | undefined,
        ctx: CmdbContext
    ): Promise<CiDetail> {
        const active = await this.getActiveVersion(input.typeId)
        const defs = await this.defs.listByVersion(active.id)
        validateCiAttributes(defs, attributes)
        const created = await this.cis.create(input)
        const stored = await this.values.upsertMany(created.id, active.id, toValueInputs(attributes))
        await this.appendEvent('cmdb_ci', created.id, 'CI_CREATED', { ciCode: created.ciCode }, ctx)
        return { ci: created, attributes: stored, schema: defs, version: active }
    }

    async updateCi(
        id: string,
        patch: Partial<CiCreateInput>,
        attributes: Record<string, unknown> | undefined,
        ctx: CmdbContext
    ): Promise<CiDetail> {
        const existing = await this.cis.getById(id)
        if (!existing) throw AppError.notFound('CI not found')
        const updated = await this.cis.update(id, patch)
        if (!updated) throw AppError.notFound('CI not found')
        const active = await this.getActiveVersion(updated.typeId)
        const defs = await this.defs.listByVersion(active.id)
        if (attributes) {
            validateCiAttributes(defs, attributes)
        }
        const stored = attributes
            ? await this.values.upsertMany(updated.id, active.id, toValueInputs(attributes))
            : await this.values.listByCi(updated.id)
        await this.appendEvent('cmdb_ci', updated.id, 'CI_UPDATED', { ...patch }, ctx)
        return { ci: updated, attributes: stored, schema: defs, version: active }
    }

    async getCiDetail(id: string): Promise<CiDetail> {
        const ci = await this.cis.getById(id)
        if (!ci) throw AppError.notFound('CI not found')
        const active = await this.getActiveVersion(ci.typeId)
        const defs = await this.defs.listByVersion(active.id)
        const stored = await this.values.listByCi(ci.id)
        return { ci, attributes: stored, schema: defs, version: active }
    }

    async listCis(filters: CiListFilters): Promise<CiPage> {
        return await this.cis.list(filters)
    }

    async retireCi(id: string, ctx: CmdbContext): Promise<CiDetail> {
        return await this.updateCi(id, { status: 'retired' }, undefined, ctx)
    }

    async resolveCiByAsset(assetId: string): Promise<CiRecord | null> {
        return await this.cis.getByAssetId(assetId)
    }

    private async getActiveVersion(typeId: string): Promise<CiTypeVersionRecord> {
        const active = await this.versions.getActiveByType(typeId)
        if (!active) throw AppError.notFound('Active spec version not found')
        return active
    }

    private async appendEvent(
        entityType: 'cmdb_ci',
        entityId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: CmdbContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType,
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}

function toValueInputs(attributes?: Record<string, unknown>): Array<{ key: string; value?: unknown }> {
    if (!attributes) return []
    return Object.entries(attributes).map(([key, value]) => ({ key, value }))
}
