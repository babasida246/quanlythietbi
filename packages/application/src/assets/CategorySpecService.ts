import { AppError } from '@qltb/domain'
import type {
    CategorySpecDefInput,
    CategorySpecDefRecord,
    CategorySpecDefUpdatePatch,
    CategorySpecVersionRecord,
    ICatalogRepo,
    ICategorySpecRepo,
    ICategorySpecVersionRepo,
    IOpsEventRepo
} from '@qltb/contracts'
import { matchCategoryTemplate } from './categorySpecTemplates.js'
import { validateSpecDefInput, validateSpecDefPatch } from './catalogSpecValidation.js'
import { applyComputedSpec } from './categorySpecExtractor.js'
import { normalizeSpecValues } from './categorySpecNormalize.js'

export interface CategorySpecContext {
    userId: string
    correlationId: string
}

export interface SpecCompatibilityWarning {
    modelId: string
    modelName: string
    missingKeys: string[]
}

export interface SpecPublishSyncSummary {
    totalModels: number
    syncedModels: number
    modelsMissingRequired: number
}

export class CategorySpecService {
    constructor(
        private catalogs: ICatalogRepo,
        private specs: ICategorySpecRepo,
        private versions: ICategorySpecVersionRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async listCategorySpecDefs(categoryId: string): Promise<CategorySpecDefRecord[]> {
        return this.specs.listByCategory(categoryId)
    }

    async listSpecDefsByVersion(versionId: string): Promise<CategorySpecDefRecord[]> {
        return this.specs.listByVersion(versionId)
    }

    async listSpecVersions(categoryId: string): Promise<CategorySpecVersionRecord[]> {
        return this.versions.listByCategory(categoryId)
    }

    async createDraftVersion(
        categoryId: string,
        ctx: CategorySpecContext
    ): Promise<{ version: CategorySpecVersionRecord; specDefs: CategorySpecDefRecord[] }> {
        const result = await this.specs.withTransaction(async ({ specs, versions }) => {
            const latest = await versions.getLatestVersionNumber(categoryId)
            const version = await versions.create(categoryId, latest + 1, 'draft', ctx.userId)
            const active = await versions.getActiveByCategory(categoryId)
            const baseDefs = active ? await specs.listByVersion(active.id) : []
            const specDefs = baseDefs.length > 0
                ? await specs.bulkInsert(version.id, baseDefs.map(mapDefToInput))
                : []
            return { version, specDefs }
        })
        await this.appendSpecEvent(categoryId, 'SPEC_VERSION_CREATED', { version: result.version.version, status: 'draft' }, ctx)
        return result
    }

    async publishSpecVersion(
        versionId: string,
        ctx: CategorySpecContext
    ): Promise<{ version: CategorySpecVersionRecord; warnings: SpecCompatibilityWarning[]; sync: SpecPublishSyncSummary }> {
        const result = await this.specs.withTransaction(async ({ versions, specs, catalogs }) => {
            const existing = await versions.getById(versionId)
            if (!existing) throw AppError.notFound('Spec version not found')
            const updated = await versions.updateStatus(versionId, 'active')
            if (!updated) throw AppError.notFound('Spec version not found')
            await versions.retireOtherActive(existing.categoryId, versionId)
            const defs = await specs.listByVersion(updated.id)
            const models = await catalogs.searchModels({ categoryId: existing.categoryId })
            let syncedModels = 0
            for (const model of models) {
                const nextSpec = this.buildSyncedSpec(defs, model.model, model.spec)
                const applied = await catalogs.updateModel(model.id, {
                    spec: nextSpec,
                    specVersionId: updated.id
                })
                if (applied) syncedModels += 1
            }
            return {
                version: updated,
                sync: {
                    totalModels: models.length,
                    syncedModels,
                    modelsMissingRequired: 0
                }
            }
        })
        const defs = await this.specs.listByVersion(result.version.id)
        const warnings = await this.getCompatibilityWarnings(result.version.categoryId, defs)
        const sync: SpecPublishSyncSummary = {
            ...result.sync,
            modelsMissingRequired: warnings.length
        }
        await this.appendSpecEvent(result.version.categoryId, 'SPEC_VERSION_PUBLISHED', {
            version: result.version.version,
            sync
        }, ctx)
        return { version: result.version, warnings, sync }
    }

    async addSpecDef(versionId: string, input: CategorySpecDefInput, ctx: CategorySpecContext): Promise<CategorySpecDefRecord> {
        validateSpecDefInput(input)
        const created = await this.specs.create({ ...input, versionId })
        await this.appendSpecEvent(created.versionId, 'SPEC_DEF_CHANGED', { action: 'created', key: created.key }, ctx, true)
        return created
    }

    async updateSpecDef(id: string, patch: CategorySpecDefUpdatePatch, ctx: CategorySpecContext): Promise<CategorySpecDefRecord> {
        validateSpecDefPatch(patch)
        const updated = await this.specs.update(id, patch)
        if (!updated) throw AppError.notFound('Spec definition not found')
        await this.appendSpecEvent(updated.versionId, 'SPEC_DEF_CHANGED', { action: 'updated', key: updated.key }, ctx, true)
        return updated
    }

    async deleteSpecDef(id: string, ctx: CategorySpecContext): Promise<void> {
        const updated = await this.specs.update(id, { isActive: false })
        if (!updated) throw AppError.notFound('Spec definition not found')
        await this.appendSpecEvent(updated.versionId, 'SPEC_DEF_CHANGED', { action: 'deleted', id }, ctx, true)
    }

    async applyCategorySpecTemplate(categoryId: string, ctx: CategorySpecContext): Promise<CategorySpecDefRecord[]> {
        const active = await this.versions.getActiveByCategory(categoryId)
        if (!active) throw AppError.notFound('Active spec version not found')
        const existing = await this.specs.listByVersion(active.id)
        if (existing.length > 0) throw AppError.conflict('Spec definitions already exist')
        const category = (await this.catalogs.listCategories()).find(item => item.id === categoryId)
        if (!category) throw AppError.notFound('Category not found')
        const template = matchCategoryTemplate(category.name)
        if (!template) throw AppError.badRequest('No template available for this category')
        const created = await this.specs.bulkInsert(active.id, template)
        await this.appendSpecEvent(categoryId, 'SPEC_DEF_CHANGED', { action: 'template_applied' }, ctx)
        return created
    }

    private async getCompatibilityWarnings(
        categoryId: string,
        defs: CategorySpecDefRecord[]
    ): Promise<SpecCompatibilityWarning[]> {
        const requiredKeys = defs.filter(def => def.required).map(def => def.key)
        if (requiredKeys.length === 0) return []
        const models = await this.catalogs.searchModels({ categoryId })
        return models.reduce<SpecCompatibilityWarning[]>((acc, model) => {
            const missing = requiredKeys.filter(key => {
                const value = model.spec?.[key]
                return value === undefined || value === null || value === ''
            })
            if (missing.length > 0) {
                acc.push({ modelId: model.id, modelName: model.model, missingKeys: missing })
            }
            return acc
        }, [])
    }

    private async appendSpecEvent(
        categoryId: string | undefined,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: CategorySpecContext,
        fromVersion = false
    ): Promise<void> {
        if (!this.opsEvents) return
        const entityId = fromVersion
            ? await this.resolveCategoryIdFromVersion(categoryId)
            : categoryId
        if (!entityId) return
        await this.opsEvents.append({
            entityType: 'asset_category',
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }

    private async resolveCategoryIdFromVersion(versionId?: string): Promise<string | undefined> {
        if (!versionId) return undefined
        const version = await this.versions.getById(versionId)
        return version?.categoryId
    }

    private buildSyncedSpec(
        defs: CategorySpecDefRecord[],
        modelName: string,
        currentSpec: Record<string, unknown> | null | undefined
    ): Record<string, unknown> {
        const base: Record<string, unknown> = {
            ...(currentSpec ?? {})
        }
        for (const def of defs) {
            if (base[def.key] !== undefined) continue
            base[def.key] = this.resolveMissingSpecValue(def)
        }
        const withComputed = applyComputedSpec(modelName, defs, base)
        return normalizeSpecValues(defs, withComputed)
    }

    private resolveMissingSpecValue(def: CategorySpecDefRecord): unknown {
        if (def.defaultValue !== undefined && def.defaultValue !== null) {
            return def.defaultValue
        }
        switch (def.fieldType) {
            case 'string':
            case 'enum':
            case 'date':
            case 'ip':
            case 'mac':
            case 'hostname':
            case 'cidr':
            case 'regex':
                return ''
            default:
                return null
        }
    }
}

function mapDefToInput(def: CategorySpecDefRecord): CategorySpecDefInput {
    return {
        key: def.key,
        label: def.label,
        fieldType: def.fieldType,
        unit: def.unit ?? null,
        required: def.required,
        enumValues: def.enumValues ?? null,
        pattern: def.pattern ?? null,
        minLen: def.minLen ?? null,
        maxLen: def.maxLen ?? null,
        minValue: def.minValue ?? null,
        maxValue: def.maxValue ?? null,
        stepValue: def.stepValue ?? null,
        precision: def.precision ?? null,
        scale: def.scale ?? null,
        normalize: def.normalize ?? null,
        defaultValue: def.defaultValue,
        helpText: def.helpText ?? null,
        sortOrder: def.sortOrder,
        isActive: def.isActive,
        isReadonly: def.isReadonly,
        computedExpr: def.computedExpr ?? null,
        isSearchable: def.isSearchable,
        isFilterable: def.isFilterable
    }
}
