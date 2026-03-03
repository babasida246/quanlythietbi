/**
 * Depreciation Module - Zod Validation Schemas
 */

import { z } from 'zod';

// Enums
export const depreciationMethodSchema = z.enum([
    'straight_line',
    'declining_balance',
    'double_declining',
    'sum_of_years',
    'units_of_production',
]);

export const scheduleStatusSchema = z.enum(['active', 'fully_depreciated', 'stopped']);
export const runTypeSchema = z.enum(['monthly', 'adjustment', 'closing']);
export const runStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

// ==================== Schedule Schemas ====================

// Create schedule schema
export const createScheduleSchema = z.object({
    assetId: z.string().uuid(),
    depreciationMethod: depreciationMethodSchema,
    originalCost: z.number().positive('Original cost must be positive'),
    salvageValue: z.number().nonnegative('Salvage value must be non-negative').optional().default(0),
    usefulLifeYears: z.number().int().positive('Useful life must be at least 1 year'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    notes: z.string().max(1000).optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid(),
}).refine(data => data.salvageValue === undefined || data.salvageValue <= data.originalCost, {
    message: 'Salvage value must be less than or equal to original cost',
    path: ['salvageValue'],
});

// Update schedule schema
export const updateScheduleSchema = z.object({
    notes: z.string().max(1000).optional(),
    updatedBy: z.string().uuid(),
});

// Stop schedule schema
export const stopScheduleSchema = z.object({
    scheduleId: z.string().uuid(),
    stoppedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    stoppedReason: z.string().max(500).optional(),
    updatedBy: z.string().uuid(),
});

// ==================== Run Schemas ====================

// Run depreciation schema
export const runDepreciationSchema = z.object({
    periodYear: z.number().int().min(2000).max(2100),
    periodMonth: z.number().int().min(1).max(12),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid(),
});

// Post entries schema
export const postEntriesSchema = z.object({
    entryIds: z.array(z.string().uuid()).min(1),
    postedBy: z.string().uuid(),
});

// ==================== Adjustment Schemas ====================

// Create adjustment schema
export const createAdjustmentSchema = z.object({
    scheduleId: z.string().uuid(),
    periodYear: z.number().int().min(2000).max(2100),
    periodMonth: z.number().int().min(1).max(12),
    adjustmentAmount: z.number(),
    adjustmentReason: z.string().min(1).max(500),
    createdBy: z.string().uuid(),
});

// ==================== Query Schemas ====================

// Schedule list query schema
export const scheduleListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    status: scheduleStatusSchema.optional(),
    method: depreciationMethodSchema.optional(),
    categoryId: z.string().uuid().optional(),
    endingSoon: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.string().optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Entry list query schema
export const entryListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    scheduleId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    periodYear: z.coerce.number().int().optional(),
    periodMonth: z.coerce.number().int().min(1).max(12).optional(),
    isPosted: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.string().optional().default('period_year'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Run list query schema
export const runListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    periodYear: z.coerce.number().int().optional(),
    status: runStatusSchema.optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.string().optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ==================== Route Parameter Schemas ====================

// ID parameter schema
export const idParamSchema = z.object({
    id: z.string().uuid(),
});

// Schedule ID parameter schema
export const scheduleIdParamSchema = z.object({
    scheduleId: z.string().uuid(),
});

// Entry ID parameter schema
export const entryIdParamSchema = z.object({
    entryId: z.string().uuid(),
});

// Run ID parameter schema
export const runIdParamSchema = z.object({
    runId: z.string().uuid(),
});

// Period parameter schema
export const periodParamSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

// ==================== Preview Schemas ====================

// Preview schedule schema
export const previewScheduleSchema = z.object({
    originalCost: z.number().positive(),
    salvageValue: z.number().nonnegative().optional().default(0),
    usefulLifeYears: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    depreciationMethod: depreciationMethodSchema,
});

// ==================== Setting Schemas ====================

// Update setting schema
export const updateSettingSchema = z.object({
    settingValue: z.string(),
    updatedBy: z.string().uuid(),
});

// Setting key parameter schema
export const settingKeyParamSchema = z.object({
    key: z.string().min(1).max(100),
});
