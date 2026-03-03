import type { ReminderStatus, ReminderType } from '@qltb/domain'

export interface ReminderRecord {
    id: string
    reminderType: ReminderType
    assetId?: string | null
    dueAt: Date
    status: ReminderStatus
    channel: string
    createdAt: Date
    sentAt?: Date | null
    correlationId?: string | null
}

export interface ReminderUpsertInput {
    reminderType: ReminderType
    assetId: string
    dueAt: Date
    status?: ReminderStatus
    channel?: string
    correlationId?: string | null
}

export interface ReminderFilters {
    status?: ReminderStatus
    reminderType?: ReminderType
    page?: number
    limit?: number
}

export interface ReminderPage {
    items: ReminderRecord[]
    total: number
    page: number
    limit: number
}

export interface IReminderRepo {
    upsert(input: ReminderUpsertInput): Promise<ReminderRecord>
    list(filters: ReminderFilters): Promise<ReminderPage>
    listPending(limit: number): Promise<ReminderRecord[]>
    markSent(id: string, sentAt: Date): Promise<ReminderRecord | null>
}
