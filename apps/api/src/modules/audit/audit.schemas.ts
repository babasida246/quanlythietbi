/**
 * Audit Module - Zod Validation Schemas
 * Module: 07-AUDIT (Asset Audit/Inventory Check)
 */

import { z } from 'zod';

// ==================== Enum Schemas ====================

export const auditTypeSchema = z.enum(['full', 'partial', 'spot_check']);

export const auditStatusSchema = z.enum([
    'draft',
    'in_progress',
    'reviewing',
    'completed',
    'cancelled',
]);

export const auditItemStatusSchema = z.enum([
    'pending',
    'found',
    'missing',
    'misplaced',
    'condition_issue',
]);

export const resolutionStatusSchema = z.enum([
    'unresolved',
    'resolved',
    'pending_action',
    'ignored',
]);

export const unregisteredAssetActionSchema = z.enum([
    'register',
    'investigate',
    'dispose',
]);

// ==================== Create/Update Schemas ====================

export const createAuditSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name must be 200 characters or less'),
    auditType: auditTypeSchema,
    scopeDescription: z.string().min(1, 'Scope description is required'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD')
        .optional(),
    notes: z.string().optional(),
    locationIds: z
        .array(z.string().uuid('Invalid location ID'))
        .min(1, 'At least one location is required'),
    categoryIds: z.array(z.string().uuid('Invalid category ID')).optional(),
    auditorIds: z
        .array(z.string().uuid('Invalid auditor ID'))
        .min(1, 'At least one auditor is required'),
    auditorAssignments: z
        .array(
            z.object({
                userId: z.string().uuid('Invalid user ID'),
                locationId: z.string().uuid('Invalid location ID').optional(),
                isLead: z.boolean().optional(),
            })
        )
        .optional(),
    organizationId: z.string().uuid('Invalid organization ID').optional(),
    createdBy: z.string().uuid('Invalid user ID'),
});

export const updateAuditSchema = z.object({
    name: z.string().max(200, 'Name must be 200 characters or less').optional(),
    scopeDescription: z.string().optional(),
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD')
        .optional(),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD')
        .nullable()
        .optional(),
    notes: z.string().nullable().optional(),
});

export const startAuditSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    startedBy: z.string().uuid('Invalid user ID'),
});

export const completeAuditSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    completedBy: z.string().uuid('Invalid user ID'),
    completionNotes: z.string().optional(),
    overrideIncomplete: z.boolean().optional(),
});

export const cancelAuditSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    cancelledBy: z.string().uuid('Invalid user ID'),
    reason: z.string().optional(),
});

// ==================== Audit Item Schemas ====================

export const auditItemSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    assetId: z.string().uuid('Invalid asset ID'),
    auditStatus: auditItemStatusSchema,
    actualLocationId: z.string().uuid('Invalid location ID').optional(),
    actualUserId: z.string().uuid('Invalid user ID').optional(),
    actualCondition: z.string().optional(),
    notes: z.string().optional(),
    auditedBy: z.string().uuid('Invalid user ID'),
});

export const bulkAuditItemSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    items: z
        .array(
            z.object({
                assetId: z.string().uuid('Invalid asset ID'),
                auditStatus: auditItemStatusSchema,
                actualLocationId: z.string().uuid('Invalid location ID').optional(),
                notes: z.string().optional(),
            })
        )
        .min(1, 'At least one item is required'),
    auditedBy: z.string().uuid('Invalid user ID'),
});

export const resolveDiscrepancySchema = z.object({
    itemId: z.string().uuid('Invalid item ID'),
    resolutionAction: z.string().min(1, 'Resolution action is required'),
    updateAssetLocation: z.boolean().optional(),
    resolvedBy: z.string().uuid('Invalid user ID'),
});

// ==================== Unregistered Asset Schemas ====================

export const createUnregisteredAssetSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    temporaryId: z.string().min(1, 'Temporary ID is required').max(50),
    description: z.string().min(1, 'Description is required'),
    serialNumber: z.string().max(100).optional(),
    locationFoundId: z.string().uuid('Invalid location ID').optional(),
    locationFoundText: z.string().max(200).optional(),
    condition: z.string().max(50).optional(),
    photoPath: z.string().optional(),
    action: unregisteredAssetActionSchema.optional(),
    actionNotes: z.string().optional(),
    foundBy: z.string().uuid('Invalid user ID'),
});

export const updateUnregisteredAssetSchema = z.object({
    description: z.string().optional(),
    serialNumber: z.string().max(100).nullable().optional(),
    condition: z.string().max(50).nullable().optional(),
    action: unregisteredAssetActionSchema.optional(),
    actionNotes: z.string().nullable().optional(),
});

export const registerUnregisteredAssetSchema = z.object({
    unregisteredId: z.string().uuid('Invalid unregistered asset ID'),
    assetData: z.object({
        assetTag: z.string().min(1, 'Asset tag is required'),
        name: z.string().min(1, 'Name is required'),
        categoryId: z.string().uuid('Invalid category ID'),
        modelId: z.string().uuid('Invalid model ID').optional(),
        locationId: z.string().uuid('Invalid location ID').optional(),
        serialNumber: z.string().optional(),
    }),
    registeredBy: z.string().uuid('Invalid user ID'),
});

// ==================== Auditor Management Schemas ====================

export const assignAuditorSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    userId: z.string().uuid('Invalid user ID'),
    locationId: z.string().uuid('Invalid location ID').optional(),
    isLead: z.boolean().optional(),
});

export const removeAuditorSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    userId: z.string().uuid('Invalid user ID'),
});

// ==================== Query Schemas ====================

export const auditListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    status: z
        .union([auditStatusSchema, z.array(auditStatusSchema)])
        .optional(),
    auditType: auditTypeSchema.optional(),
    locationId: z.string().uuid('Invalid location ID').optional(),
    startDateFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    startDateTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    search: z.string().optional(),
    sortBy: z
        .enum(['name', 'start_date', 'status', 'progress', 'created_at'])
        .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    organizationId: z.string().uuid('Invalid organization ID').optional(),
});

export const auditItemListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    auditStatus: z
        .union([auditItemStatusSchema, z.array(auditItemStatusSchema)])
        .optional(),
    resolutionStatus: resolutionStatusSchema.optional(),
    locationId: z.string().uuid('Invalid location ID').optional(),
    auditorId: z.string().uuid('Invalid auditor ID').optional(),
    search: z.string().optional(),
    sortBy: z
        .enum(['asset_tag', 'audit_status', 'audited_at', 'resolution_status'])
        .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const discrepancyQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    auditStatus: z.array(auditItemStatusSchema).optional(),
    resolutionStatus: resolutionStatusSchema.optional(),
    sortBy: z.enum(['asset_tag', 'audit_status', 'audited_at']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const unregisteredAssetQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    action: unregisteredAssetActionSchema.optional(),
    sortBy: z.enum(['found_at', 'temporary_id', 'action']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ==================== Route Parameter Schemas ====================

export const auditIdParamSchema = z.object({
    id: z.string().uuid('Invalid audit ID'),
});

export const auditItemIdParamSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    itemId: z.string().uuid('Invalid item ID'),
});

export const unregisteredAssetIdParamSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    unregisteredId: z.string().uuid('Invalid unregistered asset ID'),
});

export const scanAssetSchema = z.object({
    auditId: z.string().uuid('Invalid audit ID'),
    assetTag: z.string().min(1, 'Asset tag is required'),
    scannedBy: z.string().uuid('Invalid user ID'),
});

// ==================== Type Exports ====================

export type CreateAuditInput = z.infer<typeof createAuditSchema>;
export type UpdateAuditInput = z.infer<typeof updateAuditSchema>;
export type StartAuditInput = z.infer<typeof startAuditSchema>;
export type CompleteAuditInput = z.infer<typeof completeAuditSchema>;
export type CancelAuditInput = z.infer<typeof cancelAuditSchema>;
export type AuditItemInput = z.infer<typeof auditItemSchema>;
export type BulkAuditItemInput = z.infer<typeof bulkAuditItemSchema>;
export type ResolveDiscrepancyInput = z.infer<typeof resolveDiscrepancySchema>;
export type CreateUnregisteredAssetInput = z.infer<typeof createUnregisteredAssetSchema>;
export type UpdateUnregisteredAssetInput = z.infer<typeof updateUnregisteredAssetSchema>;
export type RegisterUnregisteredAssetInput = z.infer<typeof registerUnregisteredAssetSchema>;
export type AssignAuditorInput = z.infer<typeof assignAuditorSchema>;
export type RemoveAuditorInput = z.infer<typeof removeAuditorSchema>;
export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>;
export type AuditItemListQueryInput = z.infer<typeof auditItemListQuerySchema>;
export type DiscrepancyQueryInput = z.infer<typeof discrepancyQuerySchema>;
export type UnregisteredAssetQueryInput = z.infer<typeof unregisteredAssetQuerySchema>;
export type ScanAssetInput = z.infer<typeof scanAssetSchema>;
