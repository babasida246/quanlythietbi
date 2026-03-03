/**
 * Labels Module - Zod Validation Schemas
 */

import { z } from 'zod';

// Enums
export const labelTypeSchema = z.enum(['barcode', 'qrcode', 'combined']);
export const sizePresetSchema = z.enum(['small', 'medium', 'large', 'custom']);
export const barcodeTypeSchema = z.enum(['code128', 'code39', 'qrcode', 'datamatrix', 'ean13']);
export const printJobStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']);
export const outputTypeSchema = z.enum(['pdf', 'direct', 'preview']);

// Layout element schema
export const layoutElementSchema = z.object({
    type: z.enum(['text', 'barcode', 'qrcode', 'image', 'line', 'rectangle']),
    field: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    color: z.string().optional(),
    rotation: z.number().optional(),
});

// Label layout schema
export const labelLayoutSchema = z.object({
    elements: z.array(layoutElementSchema),
    backgroundColor: z.string().optional(),
    borderWidth: z.number().optional(),
    borderColor: z.string().optional(),
    padding: z.number().optional(),
});

// ==================== Template Schemas ====================

// Create template schema
export const createTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    labelType: labelTypeSchema,
    sizePreset: sizePresetSchema,
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    layout: labelLayoutSchema.optional(),
    fields: z.array(z.string()).min(1),
    barcodeType: barcodeTypeSchema.optional(),
    includeLogo: z.boolean().optional(),
    includeCompanyName: z.boolean().optional(),
    fontFamily: z.string().max(50).optional(),
    fontSize: z.number().int().positive().max(72).optional(),
    isDefault: z.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid(),
});

// Update template schema
export const updateTemplateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    labelType: labelTypeSchema.optional(),
    sizePreset: sizePresetSchema.optional(),
    widthMm: z.number().positive().optional(),
    heightMm: z.number().positive().optional(),
    layout: labelLayoutSchema.optional(),
    fields: z.array(z.string()).min(1).optional(),
    barcodeType: barcodeTypeSchema.optional(),
    includeLogo: z.boolean().optional(),
    includeCompanyName: z.boolean().optional(),
    fontFamily: z.string().max(50).optional(),
    fontSize: z.number().int().positive().max(72).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    updatedBy: z.string().uuid(),
});

// ==================== Print Job Schemas ====================

// Create print job schema
export const createPrintJobSchema = z.object({
    templateId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(500),
    copiesPerAsset: z.number().int().positive().max(10).optional().default(1),
    printerName: z.string().max(100).optional(),
    paperSize: z.string().max(50).optional(),
    outputType: outputTypeSchema.optional().default('pdf'),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid(),
});

// Update print job status schema
export const updatePrintJobStatusSchema = z.object({
    status: printJobStatusSchema,
    errorMessage: z.string().optional(),
    outputUrl: z.string().url().optional(),
});

// ==================== Settings Schemas ====================

// Update setting schema
export const updateSettingSchema = z.object({
    settingValue: z.string(),
    updatedBy: z.string().uuid(),
});

// ==================== Query Schemas ====================

// Template list query schema
export const templateListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    labelType: labelTypeSchema.optional(),
    isActive: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.string().optional().default('name'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Print job list query schema
export const printJobListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    status: printJobStatusSchema.optional(),
    templateId: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.string().optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ==================== Route Parameter Schemas ====================

// ID parameter schema
export const idParamSchema = z.object({
    id: z.string().uuid(),
});

// Template ID parameter schema
export const templateIdParamSchema = z.object({
    templateId: z.string().uuid(),
});

// Job ID parameter schema
export const jobIdParamSchema = z.object({
    jobId: z.string().uuid(),
});

// Setting key parameter schema
export const settingKeyParamSchema = z.object({
    key: z.string().min(1).max(100),
});

// ==================== Bulk Operation Schemas ====================

// Clone template schema
export const cloneTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    createdBy: z.string().uuid(),
});

// Preview labels schema
export const previewLabelsSchema = z.object({
    templateId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(10),
});

// Validate assets schema
export const validateAssetsSchema = z.object({
    templateId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1),
});
