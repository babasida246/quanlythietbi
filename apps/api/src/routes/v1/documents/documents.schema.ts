/**
 * Knowledge Base Documents — Zod schemas (routes layer)
 * Migrated from apps/api/src/modules/documents/documents.schemas.ts
 */
import { z } from 'zod'

export const kbDocTypeValues = [
    'sop', 'howto', 'policy', 'template', 'diagram', 'report', 'certificate', 'other'
] as const

export const kbDocContentTypeValues = ['file', 'markdown', 'link'] as const
export const kbDocVisibilityValues = ['private', 'team', 'department', 'org'] as const
export const kbDocApprovalStatusValues = ['draft', 'pending', 'approved', 'rejected'] as const

export const uuidSchema = z.string().uuid()

export const kbDocListQuerySchema = z.object({
    type: z.enum(kbDocTypeValues).optional(),
    tag: z.string().optional(),
    visibility: z.enum(kbDocVisibilityValues).optional(),
    status: z.enum(kbDocApprovalStatusValues).optional(),
    q: z.string().optional(),
    relatedAssetId: uuidSchema.optional(),
    relatedModel: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['updatedAt', 'title', 'type']).default('updatedAt')
})

const kbDocScopeSchema = z.object({
    relatedAssets: z.array(uuidSchema).default([]),
    relatedModels: z.array(z.object({ vendor: z.string(), model: z.string() })).default([]),
    relatedSites: z.array(z.string()).default([]),
    relatedServices: z.array(z.string()).default([])
})

export const createKbDocSchema = z.object({
    parentId: uuidSchema.optional(),
    type: z.enum(kbDocTypeValues).default('other'),
    title: z.string().min(1),
    summary: z.string().optional(),
    contentType: z.enum(kbDocContentTypeValues).default('file'),
    markdown: z.string().optional(),
    externalUrl: z.string().url().optional(),
    version: z.string().default('1'),
    visibility: z.enum(kbDocVisibilityValues).default('team'),
    tags: z.array(z.string()).default([]),
    scope: kbDocScopeSchema.optional()
})

export const updateKbDocSchema = createKbDocSchema.partial()

export const idParamSchema = z.object({ id: uuidSchema })
export const downloadParamsSchema = z.object({ id: uuidSchema, fileId: uuidSchema })

export const approvalActionSchema = z.object({
    reason: z.string().trim().min(1).optional(),
    note: z.string().trim().optional()
})

export const bulkKbDocSchema = z.object({
    action: z.enum(['tag/add', 'tag/remove', 'setVisibility', 'submitApproval', 'delete']),
    ids: z.array(uuidSchema).min(1),
    tag: z.string().optional(),
    visibility: z.enum(kbDocVisibilityValues).optional(),
    reason: z.string().trim().min(1).optional()
})

export const deleteBodySchema = z.object({
    reason: z.string().trim().min(1).optional()
})
