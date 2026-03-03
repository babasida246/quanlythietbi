/**
 * Consumables Module - Zod Validation Schemas
 */
import { z } from 'zod';

// ==================== Enums ====================

export const consumableStatusSchema = z.enum(['active', 'inactive', 'discontinued']);
export const issueTypeSchema = z.enum(['user', 'department', 'asset', 'general']);
export const receiptTypeSchema = z.enum(['purchase', 'return', 'transfer', 'adjustment', 'initial']);
export const stockStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock']);

// ==================== Consumable Schemas ====================

export const createConsumableSchema = z.object({
    name: z.string().min(1).max(200),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    modelNumber: z.string().max(100).optional(),
    partNumber: z.string().max(100).optional(),
    imageUrl: z.string().url().max(500).optional(),
    unitOfMeasure: z.string().min(1).max(50),
    quantity: z.number().int().min(0),
    minQuantity: z.number().int().min(0).optional().default(0),
    unitPrice: z.number().min(0).optional().default(0),
    currency: z.string().length(3).optional().default('VND'),
    supplierId: z.string().uuid().optional(),
    purchaseOrder: z.string().max(100).optional(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    locationId: z.string().uuid().optional(),
    locationName: z.string().max(200).optional(),
    notes: z.string().optional(),
    organizationId: z.string().uuid().optional()
});

export const updateConsumableSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    manufacturerId: z.string().uuid().optional().nullable(),
    modelNumber: z.string().max(100).optional().nullable(),
    partNumber: z.string().max(100).optional().nullable(),
    imageUrl: z.string().url().max(500).optional().nullable(),
    unitOfMeasure: z.string().min(1).max(50).optional(),
    minQuantity: z.number().int().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    supplierId: z.string().uuid().optional().nullable(),
    purchaseOrder: z.string().max(100).optional().nullable(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    locationId: z.string().uuid().optional().nullable(),
    locationName: z.string().max(200).optional().nullable(),
    notes: z.string().optional().nullable(),
    status: consumableStatusSchema.optional()
});

// ==================== Issue Schemas ====================

export const issueConsumableSchema = z.object({
    quantity: z.number().int().min(1),
    issueType: issueTypeSchema,
    issuedToUserId: z.string().uuid().optional(),
    issuedToDepartment: z.string().max(200).optional(),
    issuedToAssetId: z.string().uuid().optional(),
    referenceNumber: z.string().max(100).optional(),
    notes: z.string().optional()
}).refine(
    (data) => {
        if (data.issueType === 'user') {
            return !!data.issuedToUserId;
        }
        if (data.issueType === 'department') {
            return !!data.issuedToDepartment;
        }
        if (data.issueType === 'asset') {
            return !!data.issuedToAssetId;
        }
        // 'general' type doesn't require specific recipient
        return true;
    },
    {
        message: 'Must provide appropriate recipient based on issue type'
    }
);

// ==================== Receipt Schemas ====================

export const receiveConsumableSchema = z.object({
    quantity: z.number().int().min(1),
    receiptType: receiptTypeSchema.optional().default('purchase'),
    purchaseOrder: z.string().max(100).optional(),
    unitCost: z.number().min(0).optional(),
    supplierId: z.string().uuid().optional(),
    invoiceNumber: z.string().max(100).optional(),
    notes: z.string().optional()
});

// ==================== Category Schemas ====================

export const createCategorySchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    parentId: z.string().uuid().optional()
});

export const updateCategorySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional()
});

// ==================== Manufacturer Schemas ====================

export const createManufacturerSchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    website: z.string().url().max(500).optional(),
    supportUrl: z.string().url().max(500).optional(),
    supportPhone: z.string().max(50).optional(),
    supportEmail: z.string().email().max(200).optional(),
    notes: z.string().optional()
});

export const updateManufacturerSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    website: z.string().url().max(500).optional().nullable(),
    supportUrl: z.string().url().max(500).optional().nullable(),
    supportPhone: z.string().max(50).optional().nullable(),
    supportEmail: z.string().email().max(200).optional().nullable(),
    notes: z.string().optional().nullable(),
    isActive: z.boolean().optional()
});

// ==================== Query Schemas ====================

export const idParamSchema = z.object({
    id: z.string().uuid()
});

export const issueIdParamSchema = z.object({
    id: z.string().uuid(),
    issueId: z.string().uuid()
});

export const receiptIdParamSchema = z.object({
    id: z.string().uuid(),
    receiptId: z.string().uuid()
});

export const consumableListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(['name', 'createdAt', 'consumableCode', 'quantity', 'unitPrice']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional(),
    status: z.union([
        consumableStatusSchema,
        z.array(consumableStatusSchema)
    ]).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    stockStatus: stockStatusSchema.optional(),
    organizationId: z.string().uuid().optional()
});

export const issueListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    consumableId: z.string().uuid().optional(),
    issueType: z.union([
        issueTypeSchema,
        z.array(issueTypeSchema)
    ]).optional(),
    issuedToUserId: z.string().uuid().optional(),
    issuedToAssetId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const receiptListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    consumableId: z.string().uuid().optional(),
    receiptType: z.union([
        receiptTypeSchema,
        z.array(receiptTypeSchema)
    ]).optional(),
    supplierId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const auditLogQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    action: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// ==================== Type Exports ====================

export type CreateConsumableInput = z.infer<typeof createConsumableSchema>;
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>;
export type IssueConsumableInput = z.infer<typeof issueConsumableSchema>;
export type ReceiveConsumableInput = z.infer<typeof receiveConsumableSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;
export type UpdateManufacturerInput = z.infer<typeof updateManufacturerSchema>;
export type ConsumableListQueryInput = z.infer<typeof consumableListQuerySchema>;
export type IssueListQueryInput = z.infer<typeof issueListQuerySchema>;
export type ReceiptListQueryInput = z.infer<typeof receiptListQuerySchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
