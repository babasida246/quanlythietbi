import { z } from 'zod'
import { CiStatusValues, CmdbChangeRiskValues, CmdbChangeStatusValues, CmdbFieldTypeValues, EnvironmentValues } from '@qltb/domain'

export const cmdbTypeIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbVersionIdParamsSchema = z.object({
    versionId: z.string().uuid()
})

export const cmdbAttrDefIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbCiIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbRelationshipIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbRelationshipTypeIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbServiceIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbServiceMemberIdParamsSchema = z.object({
    id: z.string().uuid(),
    memberId: z.string().uuid()
})

export const cmdbChangeIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbTypeCreateSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional()
})

export const cmdbTypeUpdateSchema = cmdbTypeCreateSchema.partial()

export const cmdbAttrDefCreateSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    fieldType: z.enum(CmdbFieldTypeValues),
    required: z.boolean().optional(),
    unit: z.string().nullable().optional(),
    enumValues: z.array(z.string()).nullable().optional(),
    pattern: z.string().nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
    stepValue: z.number().nullable().optional(),
    minLen: z.number().int().nullable().optional(),
    maxLen: z.number().int().nullable().optional(),
    defaultValue: z.unknown().optional(),
    isSearchable: z.boolean().optional(),
    isFilterable: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
})

export const cmdbAttrDefUpdateSchema = cmdbAttrDefCreateSchema.partial()

export const cmdbCiCreateSchema = z.object({
    typeId: z.string().uuid(),
    name: z.string().min(1),
    ciCode: z.string().min(1),
    status: z.enum(CiStatusValues).optional(),
    environment: z.enum(EnvironmentValues).optional(),
    assetId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    ownerTeam: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    attributes: z.record(z.unknown()).optional()
})

export const cmdbCiUpdateSchema = cmdbCiCreateSchema.partial()

export const cmdbCiListQuerySchema = z.object({
    q: z.string().optional(),
    status: z.enum(CiStatusValues).optional(),
    environment: z.enum(EnvironmentValues).optional(),
    typeId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const cmdbGraphQuerySchema = z.object({
    depth: z.coerce.number().int().positive().optional(),
    direction: z.enum(['upstream', 'downstream', 'both']).optional()
})

export const cmdbRelationshipCreateSchema = z.object({
    relTypeId: z.string().uuid(),
    fromCiId: z.string().uuid(),
    toCiId: z.string().uuid(),
    sinceDate: z.string().nullable().optional(),
    note: z.string().nullable().optional()
})

export const cmdbRelationshipTypeCreateSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    reverseName: z.string().nullable().optional(),
    allowedFromTypeId: z.string().uuid().nullable().optional(),
    allowedToTypeId: z.string().uuid().nullable().optional()
})

export const cmdbRelationshipTypeUpdateSchema = cmdbRelationshipTypeCreateSchema.partial()

export const cmdbRelationshipImportSchema = z.object({
    dryRun: z.boolean().optional(),
    allowCycles: z.boolean().optional(),
    items: z.array(cmdbRelationshipCreateSchema).min(1).max(500)
})

export const cmdbServiceCreateSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    criticality: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    sla: z.string().nullable().optional(),
    status: z.string().nullable().optional()
})

export const cmdbServiceUpdateSchema = cmdbServiceCreateSchema.partial()

export const cmdbServiceListQuerySchema = z.object({
    q: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const cmdbServiceMemberCreateSchema = z.object({
    ciId: z.string().uuid(),
    role: z.string().nullable().optional()
})

export const cmdbChangeCreateSchema = z.object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    risk: z.enum(CmdbChangeRiskValues).optional(),
    primaryCiId: z.string().uuid().nullable().optional(),
    implementationPlan: z.string().nullable().optional(),
    rollbackPlan: z.string().nullable().optional(),
    plannedStartAt: z.string().datetime().nullable().optional(),
    plannedEndAt: z.string().datetime().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional()
})

export const cmdbChangeUpdateSchema = cmdbChangeCreateSchema.partial()

export const cmdbChangeListQuerySchema = z.object({
    q: z.string().optional(),
    status: z.enum(CmdbChangeStatusValues).optional(),
    risk: z.enum(CmdbChangeRiskValues).optional(),
    primaryCiId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

// ── Config Files ──────────────────────────────────────────────────────────────

const configFileTypeValues = ['config', 'script', 'template', 'env', 'other'] as const

export const cmdbConfigFileIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const cmdbConfigFileVersionParamsSchema = z.object({
    id: z.string().uuid(),
    version: z.coerce.number().int().positive()
})

export const cmdbConfigFileCreateSchema = z.object({
    ciId: z.string().uuid(),
    name: z.string().min(1),
    fileType: z.enum(configFileTypeValues).optional(),
    language: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    filePath: z.string().nullable().optional(),
    content: z.string(),
    changeSummary: z.string().nullable().optional()
})

export const cmdbConfigFileUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    fileType: z.enum(configFileTypeValues).optional(),
    language: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    filePath: z.string().nullable().optional(),
    content: z.string().optional(),
    changeSummary: z.string().nullable().optional()
})

export const cmdbConfigFileListQuerySchema = z.object({
    ciId: z.string().uuid().optional(),
    fileType: z.enum(configFileTypeValues).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})
