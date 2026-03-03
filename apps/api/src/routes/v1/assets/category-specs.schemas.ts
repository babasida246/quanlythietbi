import { z } from 'zod'
import { NormalizeModeValues, SpecFieldTypeValues } from '@qltb/domain'

export const categoryIdParamsSchema = z.object({
    id: z.string().uuid()
})

export const specDefIdParamsSchema = z.object({
    specDefId: z.string().uuid()
})

const specDefBaseSchema = z.object({
    key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
    label: z.string().min(1),
    fieldType: z.enum(SpecFieldTypeValues),
    unit: z.string().nullable().optional(),
    required: z.boolean().optional(),
    enumValues: z.array(z.string().min(1)).nullable().optional(),
    pattern: z.string().nullable().optional(),
    minLen: z.coerce.number().int().nullable().optional(),
    maxLen: z.coerce.number().int().nullable().optional(),
    minValue: z.coerce.number().nullable().optional(),
    maxValue: z.coerce.number().nullable().optional(),
    stepValue: z.coerce.number().nullable().optional(),
    precision: z.coerce.number().int().nullable().optional(),
    scale: z.coerce.number().int().nullable().optional(),
    normalize: z.enum(NormalizeModeValues).nullable().optional(),
    defaultValue: z.unknown().optional(),
    helpText: z.string().nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
    isReadonly: z.boolean().optional(),
    computedExpr: z.string().nullable().optional(),
    isSearchable: z.boolean().optional(),
    isFilterable: z.boolean().optional()
})

export const specDefCreateSchema = specDefBaseSchema
export const specDefUpdateSchema = specDefBaseSchema.partial()

export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>
export type SpecDefIdParams = z.infer<typeof specDefIdParamsSchema>
export type SpecDefCreateBody = z.infer<typeof specDefCreateSchema>
export type SpecDefUpdateBody = z.infer<typeof specDefUpdateSchema>
