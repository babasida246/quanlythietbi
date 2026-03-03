/**
 * Components Module - Zod Validation Schemas
 * Request validation for component management endpoints
 */

import { z } from 'zod';

// ==================== Enums ====================

export const componentStatusSchema = z.enum(['active', 'inactive', 'discontinued']);
export const stockStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock']);
export const assignmentStatusSchema = z.enum(['installed', 'removed']);
export const componentTypeSchema = z.enum([
    'ram',
    'ssd',
    'hdd',
    'cpu',
    'gpu',
    'psu',
    'motherboard',
    'network_card',
    'other'
]);
export const removalReasonSchema = z.enum(['upgrade', 'repair', 'decommission']);
export const postRemovalActionSchema = z.enum(['restock', 'dispose']);
export const receiptTypeSchema = z.enum(['purchase', 'restock', 'transfer', 'adjustment', 'initial']);

// ==================== Component Schemas ====================

export const createComponentSchema = z.object({
    componentCode: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    modelNumber: z.string().max(100).nullish(),
    categoryId: z.string().uuid().nullish(),
    manufacturerId: z.string().uuid().nullish(),
    componentType: componentTypeSchema,
    specifications: z.string().nullish(),
    imageUrl: z.string().url().max(500).nullish(),
    totalQuantity: z.number().int().min(0).default(0),
    availableQuantity: z.number().int().min(0).optional(),
    minQuantity: z.number().int().min(0).default(0),
    unitPrice: z.number().min(0).default(0),
    currency: z.string().length(3).default('VND'),
    supplierId: z.string().uuid().nullish(),
    purchaseOrder: z.string().max(100).nullish(),
    purchaseDate: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
    locationName: z.string().max(200).nullish(),
    organizationId: z.string().uuid().nullish(),
    notes: z.string().nullish(),
    status: componentStatusSchema.default('active')
}).refine(
    (data) => {
        const available = data.availableQuantity ?? data.totalQuantity;
        return available <= data.totalQuantity;
    },
    { message: 'Available quantity cannot exceed total quantity', path: ['availableQuantity'] }
);

export const updateComponentSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    modelNumber: z.string().max(100).nullish(),
    categoryId: z.string().uuid().nullish(),
    manufacturerId: z.string().uuid().nullish(),
    componentType: componentTypeSchema.optional(),
    specifications: z.string().nullish(),
    imageUrl: z.string().url().max(500).nullish(),
    minQuantity: z.number().int().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    supplierId: z.string().uuid().nullish(),
    purchaseOrder: z.string().max(100).nullish(),
    purchaseDate: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
    locationName: z.string().max(200).nullish(),
    notes: z.string().nullish(),
    status: componentStatusSchema.optional()
});

// ==================== Assignment Schemas ====================

export const installComponentSchema = z.object({
    componentId: z.string().uuid(),
    quantity: z.number().int().min(1),
    serialNumbers: z.array(z.string()).nullish(),
    assetId: z.string().uuid(),
    installationNotes: z.string().nullish()
}).refine(
    (data) => {
        // If serial numbers provided, count must match quantity
        if (data.serialNumbers && data.serialNumbers.length > 0) {
            return data.serialNumbers.length === data.quantity;
        }
        return true;
    },
    { message: 'Serial numbers count must match quantity', path: ['serialNumbers'] }
);

export const removeComponentSchema = z.object({
    assignmentId: z.string().uuid(),
    removalReason: removalReasonSchema,
    postRemovalAction: postRemovalActionSchema,
    removalNotes: z.string().nullish()
});

// ==================== Receipt Schema ====================

export const receiveComponentSchema = z.object({
    componentId: z.string().uuid(),
    quantity: z.number().int().min(1),
    serialNumbers: z.array(z.string()).nullish(),
    receiptType: receiptTypeSchema,
    supplierId: z.string().uuid().nullish(),
    purchaseOrder: z.string().max(100).nullish(),
    unitCost: z.number().min(0).nullish(),
    referenceNumber: z.string().max(100).nullish(),
    referenceType: z.string().max(50).nullish(),
    referenceId: z.string().uuid().nullish(),
    notes: z.string().nullish()
}).refine(
    (data) => {
        // If serial numbers provided, count must match quantity
        if (data.serialNumbers && data.serialNumbers.length > 0) {
            return data.serialNumbers.length === data.quantity;
        }
        return true;
    },
    { message: 'Serial numbers count must match quantity', path: ['serialNumbers'] }
);

// ==================== Category Schemas ====================

export const createCategorySchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().nullish(),
    parentId: z.string().uuid().nullish(),
    isActive: z.boolean().default(true)
});

export const updateCategorySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().nullish(),
    parentId: z.string().uuid().nullish(),
    isActive: z.boolean().optional()
});

// ==================== Manufacturer Schemas ====================

export const createManufacturerSchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    website: z.string().url().max(500).nullish(),
    supportUrl: z.string().url().max(500).nullish(),
    supportPhone: z.string().max(50).nullish(),
    supportEmail: z.string().email().max(200).nullish(),
    notes: z.string().nullish(),
    isActive: z.boolean().default(true)
});

export const updateManufacturerSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    website: z.string().url().max(500).nullish(),
    supportUrl: z.string().url().max(500).nullish(),
    supportPhone: z.string().max(50).nullish(),
    supportEmail: z.string().email().max(200).nullish(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional()
});

// ==================== Query Schemas ====================

export const componentListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    componentType: z.union([componentTypeSchema, z.array(componentTypeSchema)]).optional(),
    categoryId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    status: z.union([componentStatusSchema, z.array(componentStatusSchema)]).optional(),
    locationId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    stockStatus: z.union([stockStatusSchema, z.array(stockStatusSchema)]).optional(),
    organizationId: z.string().uuid().optional(),
    sortBy: z.enum(['name', 'componentCode', 'createdAt', 'availableQuantity', 'componentType']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const assignmentListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    componentId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    status: z.union([assignmentStatusSchema, z.array(assignmentStatusSchema)]).optional(),
    installedBy: z.string().uuid().optional(),
    removalReason: z.union([removalReasonSchema, z.array(removalReasonSchema)]).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['installedAt', 'removedAt', 'componentCode', 'assetTag']).default('installedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const receiptListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    componentId: z.string().uuid().optional(),
    receiptType: z.union([receiptTypeSchema, z.array(receiptTypeSchema)]).optional(),
    supplierId: z.string().uuid().optional(),
    receivedBy: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['receivedAt', 'quantity', 'componentCode']).default('receivedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const categoryListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    parentId: z.string().uuid().nullish(),
    isActive: z.coerce.boolean().optional()
});

export const manufacturerListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional()
});

// ==================== Path Parameter Schemas ====================

export const idParamSchema = z.object({
    id: z.string().uuid()
});

export const componentIdParamSchema = z.object({
    componentId: z.string().uuid()
});

export const assignmentIdParamSchema = z.object({
    assignmentId: z.string().uuid()
});

export const assetIdParamSchema = z.object({
    assetId: z.string().uuid()
});

// ==================== Type Exports ====================

export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type InstallComponentInput = z.infer<typeof installComponentSchema>;
export type RemoveComponentInput = z.infer<typeof removeComponentSchema>;
export type ReceiveComponentInput = z.infer<typeof receiveComponentSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;
export type UpdateManufacturerInput = z.infer<typeof updateManufacturerSchema>;
export type ComponentListQueryInput = z.infer<typeof componentListQuerySchema>;
export type AssignmentListQueryInput = z.infer<typeof assignmentListQuerySchema>;
export type ReceiptListQueryInput = z.infer<typeof receiptListQuerySchema>;
