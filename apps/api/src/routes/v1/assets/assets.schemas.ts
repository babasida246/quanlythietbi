import { z } from 'zod'
import { AssetStatusValues, AssigneeTypeValues, MaintenanceSeverityValues, MaintenanceStatusValues } from '@qltb/domain'

export const assetIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const assetSearchSchema = z.object({
    query: z.string().min(1).optional(),
    status: z.enum(AssetStatusValues).optional(),
    categoryId: z.string().uuid().optional(),
    modelId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    warrantyExpiringDays: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    sort: z.enum(['newest', 'asset_code_asc', 'asset_code_desc', 'warranty_end_asc']).optional(),
    export: z.enum(['csv']).optional()
})

export const assetCreateSchema = z.object({
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
    warehouseId: z.string().uuid().nullable().optional(),
    status: z.enum(AssetStatusValues).optional(),
    purchaseDate: z.coerce.date().optional(),
    warrantyEnd: z.coerce.date().optional(),
    vendorId: z.string().uuid().optional(),
    notes: z.string().optional(),
    spec: z.record(z.unknown()).optional()
})

export const assetUpdateSchema = assetCreateSchema.partial().extend({
    assetCode: z.string().min(1).optional()
})

export const assignmentSchema = z.object({
    assigneeType: z.enum(AssigneeTypeValues),
    assigneeId: z.string().min(1),
    assigneeName: z.string().min(1),
    assignedAt: z.coerce.date().optional(),
    note: z.string().optional()
})

export const returnSchema = z.object({
    note: z.string().optional()
})

export const moveSchema = z.object({
    locationId: z.string().uuid()
})

export const statusSchema = z.object({
    status: z.enum(AssetStatusValues)
})

export const timelineSchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const maintenanceListSchema = z.object({
    assetId: z.string().uuid().optional(),
    status: z.enum(MaintenanceStatusValues).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const maintenanceOpenSchema = z.object({
    assetId: z.string().uuid(),
    title: z.string().min(1),
    severity: z.enum(MaintenanceSeverityValues),
    diagnosis: z.string().optional(),
    resolution: z.string().optional()
})

export const maintenanceUpdateSchema = z.object({
    status: z.enum(MaintenanceStatusValues),
    diagnosis: z.string().optional(),
    resolution: z.string().optional(),
    closedAt: z.coerce.date().optional()
})

export type AssetSearchQuery = z.infer<typeof assetSearchSchema>
export type AssetCreateBody = z.infer<typeof assetCreateSchema>
export type AssetUpdateBody = z.infer<typeof assetUpdateSchema>
export type AssignmentBody = z.infer<typeof assignmentSchema>
export type ReturnBody = z.infer<typeof returnSchema>
export type MoveBody = z.infer<typeof moveSchema>
export type StatusBody = z.infer<typeof statusSchema>
export type TimelineQuery = z.infer<typeof timelineSchema>
export type MaintenanceListQuery = z.infer<typeof maintenanceListSchema>
export type MaintenanceOpenBody = z.infer<typeof maintenanceOpenSchema>
export type MaintenanceUpdateBody = z.infer<typeof maintenanceUpdateSchema>
