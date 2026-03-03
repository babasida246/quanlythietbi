import { readLocal, writeLocal } from './storage'

export type NotificationSeverity = 'info' | 'warning' | 'critical'

export type AdminNotification = {
    id: string
    title: string
    message: string
    severity: NotificationSeverity
    source?: string
    createdAt: string
    acknowledged?: boolean
}

const STORAGE_KEY = 'admin.notifications.v1'

const fallbackNotifications: AdminNotification[] = []

function createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `ntf_${Math.random().toString(36).slice(2)}`
}

export function loadNotifications(): AdminNotification[] {
    return readLocal<AdminNotification[]>(STORAGE_KEY, fallbackNotifications)
}

export function saveNotifications(items: AdminNotification[]): void {
    writeLocal(STORAGE_KEY, items)
}

export function pushNotification(input: Omit<AdminNotification, 'id' | 'createdAt' | 'acknowledged'> & { acknowledged?: boolean }): AdminNotification {
    const next: AdminNotification = {
        id: createId(),
        createdAt: new Date().toISOString(),
        acknowledged: false,
        ...input
    }
    const current = loadNotifications()
    saveNotifications([next, ...current].slice(0, 200))
    return next
}

export function acknowledgeNotification(id: string): void {
    const current = loadNotifications()
    const next = current.map((item) => (item.id === id ? { ...item, acknowledged: true } : item))
    saveNotifications(next)
}

export function clearNotifications(): void {
    saveNotifications([])
}
