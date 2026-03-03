import { z } from 'zod'
import { ReminderStatusValues, ReminderTypeValues } from '@qltb/domain'

export const reminderListSchema = z.object({
    status: z.enum(ReminderStatusValues).optional(),
    reminderType: z.enum(ReminderTypeValues).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
})

export const reminderRunSchema = z.object({
    days: z.array(z.coerce.number().int().positive()).optional()
})

export type ReminderListQuery = z.infer<typeof reminderListSchema>
export type ReminderRunBody = z.infer<typeof reminderRunSchema>
