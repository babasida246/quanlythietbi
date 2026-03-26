/**
 * Labels Module - Zod Validation Schemas
 * Moved from apps/api/src/modules/labels/labels.schemas.ts
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

// ==================== Settings Schemas ====================

export const updateSettingSchema = z.object({
    settingValue: z.string(),
    updatedBy: z.string().uuid(),
});

// ==================== Query Schemas ====================

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

export const idParamSchema = z.object({
    id: z.string().uuid(),
});

export const settingKeyParamSchema = z.object({
    key: z.string().min(1).max(100),
});

// ==================== Bulk Operation Schemas ====================

export const cloneTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    createdBy: z.string().uuid(),
});

export const previewLabelsSchema = z.object({
    templateId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(10),
});

export const validateAssetsSchema = z.object({
    templateId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1),
});

// ==================== Shared Document Template Schemas ====================

export const createDocumentTemplateSchema = z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    module: z.string().min(1).max(50).optional(),
    htmlContent: z.string().min(1),
    fields: z.array(z.string().min(1)).optional(),
    title: z.string().max(200).optional(),
    changeNote: z.string().max(2000).optional(),
    organizationId: z.string().uuid().optional(),
});

export const updateDocumentTemplateSchema = z.object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    module: z.string().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
});

export const documentTemplateListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    module: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    isActive: z.coerce.boolean().optional(),
    includeVersions: z.coerce.boolean().optional().default(true),
    search: z.string().optional(),
});

export const createDocumentTemplateVersionSchema = z.object({
    title: z.string().max(200).optional(),
    htmlContent: z.string().min(1),
    fields: z.array(z.string().min(1)).optional(),
    changeNote: z.string().max(2000).optional(),
});

export const publishDocumentTemplateVersionSchema = z.object({
    versionId: z.string().uuid(),
});

export const rollbackDocumentTemplateVersionSchema = z.object({
    versionId: z.string().uuid(),
    changeNote: z.string().max(2000).optional(),
});
