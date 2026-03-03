/**
 * License Module - Zod Schemas for validation
 */
import { z } from 'zod';

// License type enum
export const licenseTypeSchema = z.enum([
    'per_seat',
    'per_device',
    'per_user',
    'site_license',
    'unlimited'
]);

// License status enum
export const licenseStatusSchema = z.enum([
    'draft',
    'active',
    'expired',
    'retired'
]);

// Seat assignment type
export const seatAssignmentTypeSchema = z.enum(['user', 'asset']);

// Create license schema
export const createLicenseSchema = z.object({
    licenseCode: z.string().max(100).optional(),
    softwareName: z.string().min(1).max(255),
    supplierId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    licenseType: licenseTypeSchema.default('per_seat'),
    productKey: z.string().optional(),
    seatCount: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0).default(0),
    currency: z.string().length(3).default('VND'),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    warrantyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    invoiceNumber: z.string().max(100).optional(),
    notes: z.string().optional(),
    organizationId: z.string().uuid().optional()
});

// Update license schema
export const updateLicenseSchema = z.object({
    softwareName: z.string().min(1).max(255).optional(),
    supplierId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    licenseType: licenseTypeSchema.optional(),
    productKey: z.string().optional().nullable(),
    seatCount: z.number().int().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    warrantyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    invoiceNumber: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    status: licenseStatusSchema.optional()
});

// Assign seat schema
export const assignSeatSchema = z.object({
    assignmentType: seatAssignmentTypeSchema,
    assignedUserId: z.string().uuid().optional(),
    assignedAssetId: z.string().uuid().optional(),
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

// Revoke seat schema
export const revokeSeatSchema = z.object({
    reason: z.string().optional()
});

// List query schema
export const licenseListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.union([
        licenseStatusSchema,
        z.array(licenseStatusSchema)
    ]).optional(),
    licenseType: licenseTypeSchema.optional(),
    supplierId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    search: z.string().optional(),
    expiringInDays: z.coerce.number().int().min(1).optional(),
    overSeats: z.coerce.boolean().optional(),
    sortBy: z.enum(['softwareName', 'licenseCode', 'expiryDate', 'seatCount', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ID param schema
export const idParamSchema = z.object({
    id: z.string().uuid()
});

// Seat ID param schema
export const seatIdParamSchema = z.object({
    id: z.string().uuid(),
    seatId: z.string().uuid()
});

// Create supplier schema
export const createSupplierSchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    contactName: z.string().max(255).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().max(50).optional(),
    address: z.string().optional(),
    website: z.string().url().optional(),
    notes: z.string().optional()
});

// Update supplier schema
export const updateSupplierSchema = createSupplierSchema.partial();

// Type exports
export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>;
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;
export type RevokeSeatInput = z.infer<typeof revokeSeatSchema>;
export type LicenseListQueryInput = z.infer<typeof licenseListQuerySchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
