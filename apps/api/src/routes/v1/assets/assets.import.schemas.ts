import { z } from 'zod'
import { AssetStatusValues } from '@qltb/domain'

const importRowSchema = z.object({
    assetCode: z.string().min(1),
    modelId: z.string().uuid(),
    serialNo: z.string().optional(),
    macAddress: z.string().optional(),
    mgmtIp: z.string().optional(),
    hostname: z.string().optional(),
    vlanId: z.coerce.number().int().optional(),
    switchName: z.string().optional(),
    switchPort: z.string().optional(),
    locationId: z.string().uuid().optional(),
    status: z.enum(AssetStatusValues).optional(),
    purchaseDate: z.coerce.date().optional(),
    warrantyEnd: z.coerce.date().optional(),
    vendorId: z.string().uuid().optional(),
    notes: z.string().optional()
})

export const assetImportPreviewSchema = z.object({
    rows: z.array(importRowSchema).min(1)
})

export const assetImportCommitSchema = assetImportPreviewSchema

export type AssetImportPreviewBody = z.infer<typeof assetImportPreviewSchema>
export type AssetImportCommitBody = z.infer<typeof assetImportCommitSchema>
