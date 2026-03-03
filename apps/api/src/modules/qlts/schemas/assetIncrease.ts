import { z } from 'zod'

export const AssetIncreaseStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled'])

export const IncreaseTypeSchema = z.enum(['purchase', 'donation', 'transfer_in', 'found', 'other'])

export const AssetIncreaseLineSchema = z.object({
    lineNo: z.number().int().positive(),
    assetCode: z.string().optional(),
    assetName: z.string().min(1),
    categoryId: z.string().uuid().optional(),
    modelId: z.string().uuid().optional(),
    serialNumber: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    unit: z.string().optional(),
    originalCost: z.number().nonnegative(),
    currentValue: z.number().nonnegative().optional(),
    locationId: z.string().uuid().optional(),
    locationName: z.string().optional(),
    custodianId: z.string().uuid().optional(),
    custodianName: z.string().optional(),
    acquisitionDate: z.coerce.date().optional(),
    inServiceDate: z.coerce.date().optional(),
    warrantyEndDate: z.coerce.date().optional(),
    specs: z.record(z.unknown()).optional(),
    note: z.string().optional()
})

export const CreateAssetIncreaseSchema = z.object({
    docDate: z.coerce.date(),
    increaseType: IncreaseTypeSchema,
    orgUnitId: z.string().uuid().optional(),
    orgUnitName: z.string().optional(),
    vendorId: z.string().uuid().optional(),
    invoiceNo: z.string().optional(),
    invoiceDate: z.coerce.date().optional(),
    currency: z.string().length(3).default('VND'),
    purchasePlanDocId: z.string().uuid().optional(),
    note: z.string().optional(),
    lines: z.array(AssetIncreaseLineSchema).min(1)
})

export const UpdateAssetIncreaseSchema = z.object({
    docDate: z.coerce.date().optional(),
    increaseType: IncreaseTypeSchema.optional(),
    orgUnitId: z.string().uuid().optional(),
    orgUnitName: z.string().optional(),
    vendorId: z.string().uuid().optional(),
    invoiceNo: z.string().optional(),
    invoiceDate: z.coerce.date().optional(),
    note: z.string().optional(),
    lines: z.array(AssetIncreaseLineSchema).optional()
})

export const ListAssetIncreasesQuerySchema = z.object({
    status: AssetIncreaseStatusSchema.optional(),
    increaseType: IncreaseTypeSchema.optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
})

export const SubmitAssetIncreaseSchema = z.object({
    approvers: z.array(z.string().uuid()).min(1).max(3)
})

export type CreateAssetIncreaseInput = z.infer<typeof CreateAssetIncreaseSchema>
export type UpdateAssetIncreaseInput = z.infer<typeof UpdateAssetIncreaseSchema>
export type ListAssetIncreasesQuery = z.infer<typeof ListAssetIncreasesQuerySchema>
export type SubmitAssetIncreaseInput = z.infer<typeof SubmitAssetIncreaseSchema>
