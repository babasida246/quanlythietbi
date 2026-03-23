import { z } from 'zod'

export const orgIdParamSchema = z.object({
    id: z.string().uuid()
})

export const orgListQuerySchema = z.object({
    search: z.string().optional(),
    parentId: z.string().uuid().nullable().optional(),
    flat: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
})

export const createOrgSchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().max(50).nullable().optional(),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid().nullable().optional()
})

export const updateOrgSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().max(50).nullable().optional(),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid().nullable().optional()
})
