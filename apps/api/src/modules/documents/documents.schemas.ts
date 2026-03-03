/**
 * Documents Module - Schemas & Types
 */
import { z } from 'zod'

export const documentTypeValues = [
    'sop',
    'howto',
    'policy',
    'template',
    'diagram',
    'report',
    'certificate',
    'other'
] as const

export const documentContentTypeValues = ['file', 'markdown', 'link'] as const
export const documentVisibilityValues = ['private', 'team', 'department', 'org'] as const
export const approvalStatusValues = ['draft', 'pending', 'approved', 'rejected'] as const

export const uuidSchema = z.string().uuid()

export const documentFileSchema = z.object({
    id: uuidSchema,
    storageKey: z.string(),
    filename: z.string(),
    sha256: z.string().nullable().optional(),
    size: z.number().int().nonnegative().nullable().optional(),
    mime: z.string().nullable().optional(),
    createdAt: z.string().datetime().optional()
})

export const documentScopeSchema = z.object({
    relatedAssets: z.array(uuidSchema).default([]),
    relatedModels: z.array(z.object({ vendor: z.string(), model: z.string() })).default([]),
    relatedSites: z.array(z.string()).default([]),
    relatedServices: z.array(z.string()).default([])
})

export const documentApprovalSchema = z.object({
    status: z.enum(approvalStatusValues),
    requestedBy: uuidSchema.nullable().optional(),
    approvedBy: uuidSchema.nullable().optional(),
    approvedAt: z.string().datetime().nullable().optional(),
    reason: z.string().nullable().optional()
})

export const documentSchema = z.object({
    id: uuidSchema,
    parentId: uuidSchema.nullable().optional(),
    type: z.enum(documentTypeValues),
    title: z.string(),
    summary: z.string().nullable().optional(),
    contentType: z.enum(documentContentTypeValues),
    markdown: z.string().nullable().optional(),
    externalUrl: z.string().url().nullable().optional(),
    files: z.array(documentFileSchema).default([]),
    scope: documentScopeSchema,
    version: z.string(),
    visibility: z.enum(documentVisibilityValues),
    approval: documentApprovalSchema,
    tags: z.array(z.string()).default([]),
    createdBy: uuidSchema.nullable().optional(),
    updatedBy: uuidSchema.nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

export type Document = z.infer<typeof documentSchema>

export const documentListQuerySchema = z.object({
    type: z.enum(documentTypeValues).optional(),
    tag: z.string().optional(),
    visibility: z.enum(documentVisibilityValues).optional(),
    status: z.enum(approvalStatusValues).optional(),
    q: z.string().optional(),
    relatedAssetId: uuidSchema.optional(),
    relatedModel: z.string().optional(), // format: vendor|model or free-text
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['updatedAt', 'title', 'type']).default('updatedAt')
})

export type DocumentListQueryInput = z.infer<typeof documentListQuerySchema>

export const createDocumentSchema = z.object({
    parentId: uuidSchema.optional(),
    type: z.enum(documentTypeValues).default('other'),
    title: z.string().min(1),
    summary: z.string().optional(),
    contentType: z.enum(documentContentTypeValues).default('file'),
    markdown: z.string().optional(),
    externalUrl: z.string().url().optional(),
    version: z.string().default('1'),
    visibility: z.enum(documentVisibilityValues).default('team'),
    tags: z.array(z.string()).default([]),
    scope: documentScopeSchema.optional()
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const updateDocumentSchema = createDocumentSchema.partial()
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

export const idParamSchema = z.object({ id: uuidSchema })
export type IdParam = z.infer<typeof idParamSchema>

export const downloadParamsSchema = z.object({
    id: uuidSchema,
    fileId: uuidSchema
})

export type DownloadParams = z.infer<typeof downloadParamsSchema>

export const approvalActionSchema = z.object({
    reason: z.string().trim().min(1).optional(),
    note: z.string().trim().optional()
})

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>

export const bulkDocumentsSchema = z.object({
    action: z.enum(['tag/add', 'tag/remove', 'setVisibility', 'submitApproval', 'delete']),
    ids: z.array(uuidSchema).min(1),
    tag: z.string().optional(),
    visibility: z.enum(documentVisibilityValues).optional(),
    reason: z.string().trim().min(1).optional()
})

export type BulkDocumentsInput = z.infer<typeof bulkDocumentsSchema>

