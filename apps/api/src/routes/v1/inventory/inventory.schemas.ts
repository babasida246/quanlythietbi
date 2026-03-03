import { z } from 'zod'
import { InventorySessionStatusValues } from '@qltb/domain'

export const inventorySessionCreateSchema = z.object({
    name: z.string().min(1),
    locationId: z.string().uuid().optional(),
    startedAt: z.coerce.date().optional(),
    status: z.enum(InventorySessionStatusValues).optional()
})

export const inventorySessionListSchema = z.object({
    status: z.enum(InventorySessionStatusValues).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const inventorySessionIdSchema = z.object({
    id: z.string().uuid()
})

export const inventoryScanSchema = z.object({
    assetId: z.string().uuid().optional(),
    assetCode: z.string().min(1).optional(),
    scannedLocationId: z.string().uuid().nullable().optional(),
    note: z.string().optional()
}).refine(value => Boolean(value.assetId || value.assetCode), {
    message: 'assetId or assetCode required',
    path: ['assetId']
})

export type InventorySessionCreateBody = z.infer<typeof inventorySessionCreateSchema>
export type InventorySessionListQuery = z.infer<typeof inventorySessionListSchema>
export type InventorySessionIdParams = z.infer<typeof inventorySessionIdSchema>
export type InventoryScanBody = z.infer<typeof inventoryScanSchema>
