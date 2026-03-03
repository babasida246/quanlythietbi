/**
 * Automation API Client
 * Workflow rules, notifications, scheduled tasks
 */
import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

// Types
export type AutomationRule = {
    id: string
    name: string
    eventType: string
    conditions: Record<string, unknown>
    actions: Record<string, unknown>
    isActive: boolean
    priority: number
    createdBy: string
    createdAt: string
    updatedAt: string
}

export type Notification = {
    id: string
    userId: string
    type: string
    title: string
    message: string
    isRead: boolean
    readAt: string | null
    relatedEntityType: string | null
    relatedEntityId: string | null
    createdAt: string
}

export type ScheduledTask = {
    id: string
    name: string
    taskType: string
    schedule: string
    config: Record<string, unknown>
    isActive: boolean
    lastRunAt: string | null
    nextRunAt: string | null
    createdAt: string
}

type ApiResponse<T> = { data: T; meta?: Record<string, unknown> }

// Rules
export async function listRules(): Promise<ApiResponse<AutomationRule[]>> {
    return apiJson(`${API_BASE}/v1/automation/rules`, { headers: getAssetHeaders() })
}

export async function createRule(input: Partial<AutomationRule>): Promise<ApiResponse<AutomationRule>> {
    return apiJson(`${API_BASE}/v1/automation/rules`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function updateRule(id: string, patch: Partial<AutomationRule>): Promise<ApiResponse<AutomationRule>> {
    return apiJson(`${API_BASE}/v1/automation/rules/${id}`, {
        method: 'PUT',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
    })
}

export async function deleteRule(id: string): Promise<void> {
    await fetch(`${API_BASE}/v1/automation/rules/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

// Notifications
export async function listNotifications(params: { unreadOnly?: boolean } = {}): Promise<ApiResponse<Notification[]>> {
    const query = buildQuery({ unreadOnly: params.unreadOnly ? 'true' : undefined })
    return apiJson(`${API_BASE}/v1/notifications${query}`, { headers: getAssetHeaders() })
}

export async function markNotificationRead(id: string): Promise<void> {
    await fetch(`${API_BASE}/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

// Scheduled Tasks
export async function listTasks(): Promise<ApiResponse<ScheduledTask[]>> {
    return apiJson(`${API_BASE}/v1/automation/tasks`, { headers: getAssetHeaders() })
}

export async function createTask(input: Partial<ScheduledTask>): Promise<ApiResponse<ScheduledTask>> {
    return apiJson(`${API_BASE}/v1/automation/tasks`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function deleteTask(id: string): Promise<void> {
    await fetch(`${API_BASE}/v1/automation/tasks/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}
