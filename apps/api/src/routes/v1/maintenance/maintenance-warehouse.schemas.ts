import { z } from 'zod'

export const warehouseIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const warehouseCreateSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    locationId: z.string().uuid().nullable().optional()
})

export const warehouseUpdateSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    locationId: z.string().uuid().nullable().optional()
})

export const sparePartIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const sparePartCreateSchema = z.object({
    partCode: z.string().min(1),
    name: z.string().min(1),
    category: z.string().optional(),
    uom: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    spec: z.record(z.unknown()).optional(),
    minLevel: z.coerce.number().int().min(0).optional()
})

export const sparePartUpdateSchema = z.object({
    partCode: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    uom: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    spec: z.record(z.unknown()).optional(),
    minLevel: z.coerce.number().int().min(0).optional()
})

export const sparePartListSchema = z.object({
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional()
})

export const stockViewSchema = z.object({
    warehouseId: z.string().uuid().optional(),
    q: z.string().optional(),
    belowMin: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
})

export const stockDocumentIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const stockDocumentLineSchema = z.object({
    lineType: z.enum(['spare_part', 'asset']).default('spare_part'),
    /** Required for spare_part lines */
    partId: z.string().uuid().optional(),
    qty: z.coerce.number().int().min(1),
    unitCost: z.coerce.number().min(0).optional(),
    serialNo: z.string().optional(),
    note: z.string().optional(),
    adjustDirection: z.enum(['plus', 'minus']).optional(),
    specFields: z.record(z.unknown()).nullable().optional(),
    /** Asset lines (receipt): model to create from */
    assetModelId: z.string().uuid().optional(),
    assetCategoryId: z.string().uuid().optional(),
    assetName: z.string().max(255).optional(),
    /** Optional explicit code; auto-generated if omitted */
    assetCode: z.string().max(100).optional(),
    /** Asset lines (issue): the specific asset to deploy */
    assetId: z.string().uuid().optional()
}).superRefine((val, ctx) => {
    if (val.lineType === 'spare_part' && !val.partId) {
        ctx.addIssue({ code: 'custom', path: ['partId'], message: 'partId is required for spare_part lines' })
    }
    if (val.lineType === 'asset' && !val.assetModelId && !val.assetId) {
        ctx.addIssue({ code: 'custom', path: ['assetModelId'], message: 'assetModelId (receipt) or assetId (issue) is required for asset lines' })
    }
})

export const stockDocumentCreateSchema = z.object({
    docType: z.enum(['receipt', 'issue', 'adjust', 'transfer']),
    code: z.string().min(1).optional(),
    warehouseId: z.string().uuid().nullable().optional(),
    targetWarehouseId: z.string().uuid().nullable().optional(),
    docDate: z.string().optional(),
    refType: z.string().optional(),
    refId: z.string().uuid().optional(),
    note: z.string().optional(),
    supplier: z.string().max(255).nullable().optional(),
    submitterName: z.string().max(255).nullable().optional(),
    receiverName: z.string().max(255).nullable().optional(),
    department: z.string().max(255).nullable().optional(),
    /** Destination location for issue documents */
    locationId: z.string().uuid().nullable().optional(),
    lines: z.array(stockDocumentLineSchema).min(1, 'At least one line is required')
})

export const stockDocumentUpdateSchema = z.object({
    docDate: z.string().optional(),
    note: z.string().nullable().optional(),
    warehouseId: z.string().uuid().nullable().optional(),
    targetWarehouseId: z.string().uuid().nullable().optional(),
    supplier: z.string().max(255).nullable().optional(),
    submitterName: z.string().max(255).nullable().optional(),
    receiverName: z.string().max(255).nullable().optional(),
    department: z.string().max(255).nullable().optional(),
    /** Destination location for issue documents */
    locationId: z.string().uuid().nullable().optional(),
    lines: z.array(stockDocumentLineSchema).min(1, 'At least one line is required')
})

export const stockDocumentListSchema = z.object({
    docType: z.enum(['receipt', 'issue', 'adjust', 'transfer']).optional(),
    status: z.enum(['draft', 'submitted', 'approved', 'posted', 'canceled']).optional(),
    warehouseId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
})

export const stockLedgerSchema = z.object({
    partId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
})

export const repairIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const repairCreateSchema = z.object({
    assetId: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    repairType: z.enum(['internal', 'vendor']),
    technicianName: z.string().optional(),
    vendorId: z.string().uuid().optional(),
    laborCost: z.coerce.number().min(0).optional(),
    downtimeMinutes: z.coerce.number().int().min(0).optional()
})

export const repairUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled']).optional(),
    diagnosis: z.string().nullable().optional(),
    resolution: z.string().nullable().optional(),
    repairType: z.enum(['internal', 'vendor']).optional(),
    technicianName: z.string().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    laborCost: z.coerce.number().min(0).optional(),
    partsCost: z.coerce.number().min(0).optional(),
    downtimeMinutes: z.coerce.number().int().min(0).optional()
})

export const repairStatusSchema = z.object({
    status: z.enum(['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled'])
})

export const repairListSchema = z.object({
    assetId: z.string().uuid().optional(),
    ciId: z.string().uuid().optional(),
    status: z.enum(['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled']).optional(),
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
})

export const repairSummarySchema = z.object({
    assetId: z.string().uuid().optional(),
    ciId: z.string().uuid().optional(),
    status: z.enum(['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled']).optional(),
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional()
})

export const repairPartSchema = z.object({
    partId: z.string().uuid().optional(),
    partName: z.string().optional(),
    warehouseId: z.string().uuid().optional(),
    action: z.enum(['replace', 'add', 'remove', 'upgrade']),
    qty: z.coerce.number().int().min(1),
    unitCost: z.coerce.number().min(0).optional(),
    serialNo: z.string().optional(),
    note: z.string().optional()
})

export const attachmentEntitySchema = z.object({
    entityType: z.enum(['repair_order', 'stock_document']),
    entityId: z.string().uuid()
})

export const attachmentIdParamsSchema = z.object({
    id: z.string().uuid()
})

export type WarehouseCreateBody = z.infer<typeof warehouseCreateSchema>
export type WarehouseUpdateBody = z.infer<typeof warehouseUpdateSchema>
export type SparePartCreateBody = z.infer<typeof sparePartCreateSchema>
export type SparePartUpdateBody = z.infer<typeof sparePartUpdateSchema>
export type StockDocumentCreateBody = z.infer<typeof stockDocumentCreateSchema>
export type StockDocumentUpdateBody = z.infer<typeof stockDocumentUpdateSchema>
export type RepairCreateBody = z.infer<typeof repairCreateSchema>
export type RepairUpdateBody = z.infer<typeof repairUpdateSchema>
