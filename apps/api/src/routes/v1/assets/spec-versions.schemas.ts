import { z } from 'zod'

export const specVersionIdParamsSchema = z.object({
    versionId: z.string().uuid()
})

export const categoryIdParamsSchema = z.object({
    id: z.string().uuid()
})

export type SpecVersionIdParams = z.infer<typeof specVersionIdParamsSchema>
export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>
