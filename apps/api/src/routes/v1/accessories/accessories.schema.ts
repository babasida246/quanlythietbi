/**
 * Accessories Module - Zod Validation Schemas
 * Request validation for accessories API
 */
import { z } from 'zod';

// ==================== Base Schemas ====================

export const accessoryStatusSchema = z.enum(['active', 'inactive', 'discontinued']);
export const stockStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock']);
export const checkoutStatusSchema = z.enum(['checked_out', 'partially_returned', 'returned']);
export const assignmentTypeSchema = z.enum(['user', 'asset']);
export const adjustmentTypeSchema = z.enum([
    'purchase',
    'return_to_supplier',
    'lost',
    'damaged',
    'inventory_adjustment',
    'initial_stock',
    'transfer_in',
    'transfer_out'
]);

// ==================== ID Params ====================

export const idParamSchema = z.object({
    id: z.string().uuid()
});

export const checkoutIdParamSchema = z.object({
    id: z.string().uuid(),
    checkoutId: z.string().uuid()
});

// ==================== Accessory Schemas ====================

export const createAccessorySchema = z.object({
    accessoryCode: z.string().max(50).optional(),
    name: z.string().min(1).max(200),
    modelNumber: z.string().max(100).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    imageUrl: z.string().url().max(1000).optional(),
    totalQuantity: z.number().int().min(0),
    minQuantity: z.number().int().min(0).optional().default(0),
    unitPrice: z.number().min(0).optional().default(0),
    currency: z.string().max(10).optional().default('VND'),
    supplierId: z.string().uuid().optional(),
    purchaseOrder: z.string().max(100).optional(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    locationId: z.string().uuid().optional(),
    locationName: z.string().max(200).optional(),
    notes: z.string().optional(),
    organizationId: z.string().uuid().optional()
});

export const updateAccessorySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    modelNumber: z.string().max(100).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    manufacturerId: z.string().uuid().optional().nullable(),
    imageUrl: z.string().url().max(1000).optional().nullable(),
    minQuantity: z.number().int().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    currency: z.string().max(10).optional(),
    supplierId: z.string().uuid().optional().nullable(),
    purchaseOrder: z.string().max(100).optional().nullable(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    locationId: z.string().uuid().optional().nullable(),
    locationName: z.string().max(200).optional().nullable(),
    notes: z.string().optional().nullable(),
    status: accessoryStatusSchema.optional()
});

// ==================== Checkout Schemas ====================

export const checkoutAccessorySchema = z.object({
    quantity: z.number().int().min(1),
    assignmentType: assignmentTypeSchema,
    assignedUserId: z.string().uuid().optional(),
    assignedAssetId: z.string().uuid().optional(),
    expectedCheckinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional()
}).refine(
    (data) => {
        if (data.assignmentType === 'user') {
            return !!data.assignedUserId;
        }
        if (data.assignmentType === 'asset') {
            return !!data.assignedAssetId;
        }
        return false;
    },
    {
        message: 'Must provide assignedUserId for user type or assignedAssetId for asset type'
    }
);

export const checkinAccessorySchema = z.object({
    quantityReturned: z.number().int().min(1),
    notes: z.string().optional()
});

// ==================== Stock Adjustment Schemas ====================

export const adjustStockSchema = z.object({
    adjustmentType: adjustmentTypeSchema,
    quantityChange: z.number().int().refine(val => val !== 0, {
        message: 'Quantity change cannot be zero'
    }),
    referenceNumber: z.string().max(100).optional(),
    reason: z.string().optional(),
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

export const accessoryListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(['name', 'accessoryCode', 'createdAt', 'availableQuantity', 'totalQuantity']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional(),
    status: z.union([
        accessoryStatusSchema,
        z.array(accessoryStatusSchema)
    ]).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    stockStatus: stockStatusSchema.optional(),
    organizationId: z.string().uuid().optional()
});

export const checkoutListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    accessoryId: z.string().uuid().optional(),
    assignedUserId: z.string().uuid().optional(),
    assignedAssetId: z.string().uuid().optional(),
    status: z.union([
        checkoutStatusSchema,
        z.array(checkoutStatusSchema)
    ]).optional(),
    isOverdue: z.coerce.boolean().optional()
});

export const auditLogQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    action: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// ==================== Type Exports ====================

export type CreateAccessoryInput = z.infer<typeof createAccessorySchema>;
export type UpdateAccessoryInput = z.infer<typeof updateAccessorySchema>;
export type CheckoutAccessoryInput = z.infer<typeof checkoutAccessorySchema>;
export type CheckinAccessoryInput = z.infer<typeof checkinAccessorySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;
export type UpdateManufacturerInput = z.infer<typeof updateManufacturerSchema>;
export type AccessoryListQueryInput = z.infer<typeof accessoryListQuerySchema>;
export type CheckoutListQueryInput = z.infer<typeof checkoutListQuerySchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
