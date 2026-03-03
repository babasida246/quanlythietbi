import { AppError } from '@qltb/domain'
import type {
    CiAttrDefInput,
    CiAttrDefRecord,
    CiAttrDefUpdatePatch,
    CiTypeRecord,
    CiTypeVersionRecord,
    ICiAttrValueRepo,
    ICiRepo,
    ICiSchemaRepo,
    ICiTypeRepo,
    ICiTypeVersionRepo,
    IOpsEventRepo
} from '@qltb/contracts'
import { validateAttrDefInput, validateAttrDefPatch } from './specValidation.js'

export interface CmdbContext {
    userId: string
    correlationId: string
}

export interface SpecCompatibilityWarning {
    ciId: string
    ciName: string
    missingKeys: string[]
}

export class SchemaService {
    constructor(
        private types: ICiTypeRepo,
        private versions: ICiTypeVersionRepo,
        private defs: ICiSchemaRepo,
        private cis: ICiRepo,
        private attrValues: ICiAttrValueRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async createType(input: { code: string; name: string; description?: string | null }, ctx: CmdbContext): Promise<CiTypeRecord> {
        const created = await this.types.create(input)
        await this.appendEvent('cmdb_type', created.id, 'CMDB_TYPE_CREATED', { code: created.code }, ctx)
        return created
    }

    async listTypes(): Promise<CiTypeRecord[]> {
        return await this.types.list()
    }

    async listTypeVersions(typeId: string): Promise<CiTypeVersionRecord[]> {
        return await this.versions.listByType(typeId)
    }

    async createDraftVersion(
        typeId: string,
        ctx: CmdbContext
    ): Promise<{ version: CiTypeVersionRecord; defs: CiAttrDefRecord[] }> {
        const result = await this.defs.withTransaction(async ({ versions, defs }) => {
            const latest = await versions.getLatestVersionNumber(typeId)
            const version = await versions.create(typeId, latest + 1, 'draft', ctx.userId)
            const active = await versions.getActiveByType(typeId)
            const baseDefs = active ? await defs.listByVersion(active.id) : []
            const createdDefs = baseDefs.length > 0
                ? await defs.bulkInsert(version.id, baseDefs.map(mapDefToInput))
                : []
            return { version, defs: createdDefs }
        })
        await this.appendEvent('cmdb_schema', typeId, 'SPEC_VERSION_CREATED', { version: result.version.version }, ctx)
        return result
    }

    async publishVersion(
        versionId: string,
        ctx: CmdbContext
    ): Promise<{ version: CiTypeVersionRecord; warnings: SpecCompatibilityWarning[] }> {
        const updated = await this.defs.withTransaction(async ({ versions }) => {
            const existing = await versions.getById(versionId)
            if (!existing) throw AppError.notFound('Spec version not found')
            const active = await versions.updateStatus(versionId, 'active')
            if (!active) throw AppError.notFound('Spec version not found')
            await versions.retireOtherActive(existing.typeId, versionId)
            return active
        })
        const defs = await this.defs.listByVersion(updated.id)
        const warnings = await this.getCompatibilityWarnings(updated.typeId, defs)
        await this.appendEvent('cmdb_schema', updated.typeId, 'SPEC_VERSION_PUBLISHED', { version: updated.version }, ctx)
        return { version: updated, warnings }
    }

    async listDefsByVersion(versionId: string): Promise<CiAttrDefRecord[]> {
        return await this.defs.listByVersion(versionId)
    }

    async addAttrDef(versionId: string, input: CiAttrDefInput, ctx: CmdbContext): Promise<CiAttrDefRecord> {
        validateAttrDefInput(input)
        const created = await this.defs.create({ ...input, versionId })
        await this.appendEvent('cmdb_schema', versionId, 'SPEC_DEF_CHANGED', { action: 'created', key: created.key }, ctx)
        return created
    }

    async updateAttrDef(id: string, patch: CiAttrDefUpdatePatch, ctx: CmdbContext): Promise<CiAttrDefRecord> {
        validateAttrDefPatch(patch)
        const updated = await this.defs.update(id, patch)
        if (!updated) throw AppError.notFound('Spec definition not found')
        await this.appendEvent('cmdb_schema', updated.versionId, 'SPEC_DEF_CHANGED', { action: 'updated', key: updated.key }, ctx)
        return updated
    }

    async deleteAttrDef(id: string, ctx: CmdbContext): Promise<void> {
        const updated = await this.defs.softDelete(id)
        if (!updated) throw AppError.notFound('Spec definition not found')
        await this.appendEvent('cmdb_schema', id, 'SPEC_DEF_CHANGED', { action: 'deleted', id }, ctx)
    }

    private async getCompatibilityWarnings(
        typeId: string,
        defs: CiAttrDefRecord[]
    ): Promise<SpecCompatibilityWarning[]> {
        const requiredKeys = defs.filter(def => def.required).map(def => def.key)
        if (requiredKeys.length === 0) return []
        const warnings: SpecCompatibilityWarning[] = []
        const limit = 100
        let page = 1
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const result = await this.cis.list({ typeId, page, limit })
            for (const ci of result.items) {
                const values = await this.attrValues.listByCi(ci.id)
                const present = new Set(values.map(item => item.key))
                const missing = requiredKeys.filter(key => !present.has(key))
                if (missing.length > 0) {
                    warnings.push({ ciId: ci.id, ciName: ci.name, missingKeys: missing })
                }
            }
            if (result.items.length < limit) break
            page += 1
            if (page > 50) break
        }
        return warnings
    }

    private async appendEvent(
        entityType: 'cmdb_type' | 'cmdb_schema',
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

function mapDefToInput(def: CiAttrDefRecord): CiAttrDefInput {
    return {
        key: def.key,
        label: def.label,
        fieldType: def.fieldType,
        required: def.required,
        unit: def.unit ?? null,
        enumValues: def.enumValues ?? null,
        pattern: def.pattern ?? null,
        minValue: def.minValue ?? null,
        maxValue: def.maxValue ?? null,
        stepValue: def.stepValue ?? null,
        minLen: def.minLen ?? null,
        maxLen: def.maxLen ?? null,
        defaultValue: def.defaultValue,
        isSearchable: def.isSearchable,
        isFilterable: def.isFilterable,
        sortOrder: def.sortOrder,
        isActive: def.isActive
    }
}
