import { z } from 'zod'

export const catalogIdParamsSchema = z.object({
    id: z.string().uuid()
})

const vendorBase = z.object({
    name: z.string().min(1),
    taxCode: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    address: z.string().nullable().optional()
})

export const vendorCreateSchema = vendorBase
export const vendorUpdateSchema = vendorBase.partial()

const categoryBase = z.object({
    name: z.string().min(1)
})

export const categoryCreateSchema = categoryBase
export const categoryUpdateSchema = categoryBase.partial()

const modelBase = z.object({
    model: z.string().min(1),
    brand: z.string().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    specVersionId: z.string().uuid().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    spec: z.record(z.unknown()).nullable().optional()
})

export const modelCreateSchema = modelBase
export const modelUpdateSchema = modelBase.partial()

export const modelSearchQuerySchema = z.object({
    categoryId: z.string().uuid().optional(),
    specFilters: z.string().optional()
})

const locationBase = z.object({
    name: z.string().min(1),
    parentId: z.string().uuid().nullable().optional(),
    organizationId: z.string().uuid().nullable().optional(),
    ouId: z.string().uuid().nullable().optional()
})

export const locationCreateSchema = locationBase
export const locationUpdateSchema = locationBase.partial()

const statusCatalogBase = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    isTerminal: z.boolean().optional(),
    color: z.string().nullable().optional()
})

export const statusCatalogCreateSchema = statusCatalogBase
export const statusCatalogUpdateSchema = statusCatalogBase.partial()

export type VendorCreateBody = z.infer<typeof vendorCreateSchema>
export type VendorUpdateBody = z.infer<typeof vendorUpdateSchema>
export type CategoryCreateBody = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateBody = z.infer<typeof categoryUpdateSchema>
export type ModelCreateBody = z.infer<typeof modelCreateSchema>
export type ModelUpdateBody = z.infer<typeof modelUpdateSchema>
export type ModelSearchQuery = z.infer<typeof modelSearchQuerySchema>
export type LocationCreateBody = z.infer<typeof locationCreateSchema>
export type LocationUpdateBody = z.infer<typeof locationUpdateSchema>
export type StatusCatalogCreateBody = z.infer<typeof statusCatalogCreateSchema>
export type StatusCatalogUpdateBody = z.infer<typeof statusCatalogUpdateSchema>
