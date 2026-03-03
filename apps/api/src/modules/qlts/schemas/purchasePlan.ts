import { z } from 'zod'

export const PurchasePlanStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled'])

export const PurchasePlanLineSchema = z.object({
    lineNo: z.number().int().positive(),
    modelId: z.string().uuid().optional(),
    modelName: z.string().min(1),
    categoryId: z.string().uuid().optional(),
    quantity: z.number().int().positive(),
    unit: z.string().optional(),
    estimatedCost: z.number().nonnegative(),
    suggestionReason: z.string().optional(),
    currentStock: z.number().int().nonnegative().optional(),
    minStock: z.number().int().nonnegative().optional(),
    daysUntilStockout: z.number().int().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    note: z.string().optional()
})

export const CreatePurchasePlanSchema = z.object({
    docDate: z.coerce.date(),
    fiscalYear: z.number().int().min(2020).max(2100),
    orgUnitId: z.string().uuid().optional(),
    orgUnitName: z.string().optional(),
    requiredByDate: z.coerce.date().optional(),
    purpose: z.string().optional(),
    note: z.string().optional(),
    lines: z.array(PurchasePlanLineSchema).min(1)
})

export const UpdatePurchasePlanSchema = z.object({
    docDate: z.coerce.date().optional(),
    fiscalYear: z.number().int().min(2020).max(2100).optional(),
    orgUnitId: z.string().uuid().optional(),
    orgUnitName: z.string().optional(),
    requiredByDate: z.coerce.date().optional(),
    purpose: z.string().optional(),
    note: z.string().optional(),
    lines: z.array(PurchasePlanLineSchema).optional()
})

export const ListPurchasePlansQuerySchema = z.object({
    status: PurchasePlanStatusSchema.optional(),
    fiscalYear: z.coerce.number().int().optional(),
    orgUnitId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
})

export const SubmitPurchasePlanSchema = z.object({
    approvers: z.array(z.string().uuid()).min(1).max(5)
})

export const ApproveRejectSchema = z.object({
    approvalId: z.string().uuid(),
    note: z.string().optional()
})

export type CreatePurchasePlanInput = z.infer<typeof CreatePurchasePlanSchema>
export type UpdatePurchasePlanInput = z.infer<typeof UpdatePurchasePlanSchema>
export type ListPurchasePlansQuery = z.infer<typeof ListPurchasePlansQuerySchema>
export type SubmitPurchasePlanInput = z.infer<typeof SubmitPurchasePlanSchema>
export type ApproveRejectInput = z.infer<typeof ApproveRejectSchema>
