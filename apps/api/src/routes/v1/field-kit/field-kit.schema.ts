import { z } from 'zod'

export const deviceParamSchema = z.object({
    deviceId: z.string().min(1)
})

export const runQuickCheckSchema = z.object({
    deviceId: z.string().min(1),
    vendor: z.enum(['cisco', 'mikrotik', 'fortigate', 'generic']),
    ticketId: z.string().min(1)
})

export const generatePlaybookSchema = z.object({
    deviceId: z.string().min(1),
    vendor: z.enum(['cisco', 'mikrotik', 'fortigate', 'generic']),
    scenario: z.enum(['loss', 'loop', 'packet-loss', 'slow'])
})

export const snippetsQuerySchema = z.object({
    vendor: z.enum(['cisco', 'mikrotik', 'fortigate', 'generic', 'any']).optional()
})

export const createSnapshotSchema = z.object({
    deviceId: z.string().min(1),
    quickCheckId: z.string().uuid().optional(),
    notes: z.string().optional(),
    ticketId: z.string().min(1)
})

export const connectivitySchema = z.object({
    deviceId: z.string().min(1),
    vendor: z.enum(['cisco', 'mikrotik', 'fortigate', 'generic'])
})

export const createNoteSchema = z.object({
    deviceId: z.string().min(1),
    author: z.string().min(1),
    message: z.string().min(1),
    attachments: z.array(z.string()).default([]),
    ticketId: z.string().min(1)
})

export const createApprovalSchema = z.object({
    deviceId: z.string().min(1),
    requestedBy: z.string().min(1),
    reason: z.string().min(1),
    ticketId: z.string().min(1)
})

export const createAuditEventSchema = z.object({
    deviceId: z.string().min(1),
    actor: z.string().min(1),
    type: z.string().min(1),
    detail: z.string().min(1),
    ticketId: z.string().optional()
})
