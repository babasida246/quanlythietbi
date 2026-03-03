import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders } from './assets'

type ApiEnvelope<T> = {
    data: T
}

export type NotificationItem = {
    id: string
    type: string
    title: string
    body: string
    status: string
    createdAt: string
    dueAt: string | null
    read: boolean
}

export type InboxThread = {
    id: string
    title: string
    status: string
    ownerId: string
    messageCount: number
    updatedAt: string
    lastMessageAt: string | null
    lastMessage: string | null
}

export type InboxMessage = {
    id: string
    role: string
    content: string
    model: string | null
    provider: string | null
    createdAt: string
}

export async function listNotifications(limit = 20, offset = 0): Promise<{
    items: NotificationItem[]
    total: number
    limit: number
    offset: number
}> {
    const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
    })

    const response = await apiJson<
        ApiEnvelope<{
            items: NotificationItem[]
            total: number
            limit: number
            offset: number
        }>
    >(`${API_BASE}/v1/notifications?${query.toString()}`, {
        headers: getAssetHeaders()
    })

    return response.data
}

export async function markNotificationRead(id: string): Promise<{ id: string; read: boolean; readAt: string }> {
    const response = await apiJson<ApiEnvelope<{ id: string; read: boolean; readAt: string }>>(
        `${API_BASE}/v1/notifications/${id}/read`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAssetHeaders()
            },
            body: JSON.stringify({})
        }
    )

    return response.data
}

export async function listInbox(limit = 20, offset = 0): Promise<{
    items: InboxThread[]
    total: number
    limit: number
    offset: number
}> {
    const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
    })

    const response = await apiJson<
        ApiEnvelope<{
            items: InboxThread[]
            total: number
            limit: number
            offset: number
        }>
    >(`${API_BASE}/v1/inbox?${query.toString()}`, {
        headers: getAssetHeaders()
    })

    return response.data
}

export async function getInboxThread(id: string): Promise<{
    thread: {
        id: string
        title: string
        status: string
        ownerId: string
        messageCount: number
        createdAt: string
        updatedAt: string
    }
    messages: InboxMessage[]
}> {
    const response = await apiJson<
        ApiEnvelope<{
            thread: {
                id: string
                title: string
                status: string
                ownerId: string
                messageCount: number
                createdAt: string
                updatedAt: string
            }
            messages: InboxMessage[]
        }>
    >(`${API_BASE}/v1/inbox/${id}`, {
        headers: getAssetHeaders()
    })

    return response.data
}

export async function sendInboxReply(id: string, content: string): Promise<InboxMessage> {
    const response = await apiJson<ApiEnvelope<InboxMessage>>(`${API_BASE}/v1/inbox/${id}/reply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAssetHeaders()
        },
        body: JSON.stringify({ content })
    })

    return response.data
}
