/**
 * Checkout Module - Zod Validation Schemas
 * Request validation for checkout/checkin operations
 */

import { z } from 'zod';

// ==================== Base Schemas ====================

export const checkoutTypeSchema = z.enum(['user', 'location', 'asset']);
export const checkoutStatusSchema = z.enum(['checked_out', 'checked_in']);
export const checkoutConditionSchema = z.enum(['good', 'damaged', 'needs_maintenance']);
export const nextActionSchema = z.enum(['available', 'maintenance', 'retire']);
export const dueStatusSchema = z.enum(['on_track', 'due_soon', 'overdue', 'indefinite']);

// ==================== Checkout Schemas ====================

export const checkoutAssetSchema = z.object({
    assetId: z.string().uuid('Invalid asset ID'),
    checkoutType: checkoutTypeSchema,
    targetUserId: z.string().uuid('Invalid user ID').nullish(),
    targetLocationId: z.string().uuid('Invalid location ID').nullish(),
    targetAssetId: z.string().uuid('Invalid target asset ID').nullish(),
    expectedCheckinDate: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .nullish(),
    checkoutNotes: z.string().max(2000, 'Notes too long').nullish(),
    organizationId: z.string().uuid('Invalid organization ID').nullish(),
    checkedOutBy: z.string().uuid('Invalid user ID'),
}).refine(
    (data) => {
        // Validate that the appropriate target is provided based on checkout type
        if (data.checkoutType === 'user' && !data.targetUserId) {
            return false;
        }
        if (data.checkoutType === 'location' && !data.targetLocationId) {
            return false;
        }
        if (data.checkoutType === 'asset' && !data.targetAssetId) {
            return false;
        }
        return true;
    },
    {
        message: 'Target must match checkout type: user requires targetUserId, location requires targetLocationId, asset requires targetAssetId',
    }
);

export const checkinAssetSchema = z.object({
    checkoutId: z.string().uuid('Invalid checkout ID'),
    checkinCondition: checkoutConditionSchema,
    nextAction: nextActionSchema,
    checkinNotes: z.string().max(2000, 'Notes too long').nullish(),
    checkedInBy: z.string().uuid('Invalid user ID'),
});

export const extendCheckoutSchema = z.object({
    checkoutId: z.string().uuid('Invalid checkout ID'),
    newExpectedDate: z.string()
        .refine(val => !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .refine(val => new Date(val) > new Date(), {
            message: 'New expected date must be in the future',
        }),
    extensionReason: z.string().max(1000, 'Reason too long').nullish(),
    notes: z.string().max(2000, 'Notes too long').nullish(),
    extendedBy: z.string().uuid('Invalid user ID'),
});

export const transferAssetSchema = z.object({
    checkoutId: z.string().uuid('Invalid checkout ID'),
    toUserId: z.string().uuid('Invalid user ID'),
    newExpectedCheckinDate: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .nullish(),
    transferReason: z.string().max(1000, 'Reason too long').nullish(),
    notes: z.string().max(2000, 'Notes too long').nullish(),
    transferredBy: z.string().uuid('Invalid user ID'),
});

// ==================== Query Schemas ====================

export const checkoutListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(200).optional(),
    status: z.union([
        checkoutStatusSchema,
        z.array(checkoutStatusSchema),
    ]).optional(),
    checkoutType: z.union([
        checkoutTypeSchema,
        z.array(checkoutTypeSchema),
    ]).optional(),
    dueStatus: z.union([
        dueStatusSchema,
        z.array(dueStatusSchema),
    ]).optional(),
    assetId: z.string().uuid().optional(),
    targetUserId: z.string().uuid().optional(),
    targetLocationId: z.string().uuid().optional(),
    checkedOutBy: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
    dateFrom: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    dateTo: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    sortBy: z.enum(['checkoutDate', 'expectedCheckinDate', 'checkoutCode', 'assetTag']).default('checkoutDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const checkoutHistoryQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    assetId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    dateFrom: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    dateTo: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    sortBy: z.enum(['checkoutDate', 'checkinDate']).default('checkoutDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const extensionListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    checkoutId: z.string().uuid().optional(),
    extendedBy: z.string().uuid().optional(),
    dateFrom: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    dateTo: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
});

export const transferListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    fromUserId: z.string().uuid().optional(),
    toUserId: z.string().uuid().optional(),
    transferredBy: z.string().uuid().optional(),
    dateFrom: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
    dateTo: z.string()
        .refine(val => !val || !isNaN(Date.parse(val)), {
            message: 'Invalid date format',
        })
        .optional(),
});

// ==================== Param Schemas ====================

export const checkoutIdParamSchema = z.object({
    id: z.string().uuid('Invalid checkout ID'),
});

export const assetIdParamSchema = z.object({
    assetId: z.string().uuid('Invalid asset ID'),
});

export const userIdParamSchema = z.object({
    userId: z.string().uuid('Invalid user ID'),
});

// ==================== Export Types ====================

export type CheckoutAssetInput = z.infer<typeof checkoutAssetSchema>;
export type CheckinAssetInput = z.infer<typeof checkinAssetSchema>;
export type ExtendCheckoutInput = z.infer<typeof extendCheckoutSchema>;
export type TransferAssetInput = z.infer<typeof transferAssetSchema>;
export type CheckoutListQueryInput = z.infer<typeof checkoutListQuerySchema>;
export type CheckoutHistoryQueryInput = z.infer<typeof checkoutHistoryQuerySchema>;
export type ExtensionListQueryInput = z.infer<typeof extensionListQuerySchema>;
export type TransferListQueryInput = z.infer<typeof transferListQuerySchema>;
