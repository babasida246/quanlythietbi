import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

test.describe('API Notifications and Inbox', () => {
    test('notifications list and mark read', async ({ request }) => {
        const listResponse = await request.get('/api/v1/notifications?limit=20&offset=0', {
            headers: await apiHeaders('admin')
        })
        expect(listResponse.status()).toBe(200)
        const listBody = await listResponse.json()
        expect(Array.isArray(listBody.data.items)).toBeTruthy()

        if (listBody.data.items.length > 0) {
            const markResponse = await request.post(
                `/api/v1/notifications/${listBody.data.items[0].id}/read`,
                {
                    headers: await apiHeaders('admin'),
                    data: {}
                }
            )
            expect(markResponse.status()).toBe(200)
            const markBody = await markResponse.json()
            expect(markBody.data.read).toBeTruthy()
        }
    })

    test('inbox list, detail and reply', async ({ request }) => {
        const listResponse = await request.get('/api/v1/inbox?limit=20&offset=0', {
            headers: await apiHeaders('admin')
        })
        expect(listResponse.status()).toBe(200)
        const listBody = await listResponse.json()
        expect(Array.isArray(listBody.data.items)).toBeTruthy()
        expect(listBody.data.items.length).toBeGreaterThan(0)

        const threadId = listBody.data.items[0].id as string
        const detailResponse = await request.get(`/api/v1/inbox/${threadId}`, {
            headers: await apiHeaders('admin')
        })
        expect(detailResponse.status()).toBe(200)
        const detailBody = await detailResponse.json()
        expect(detailBody.data.thread.id).toBe(threadId)
        expect(Array.isArray(detailBody.data.messages)).toBeTruthy()

        const replyResponse = await request.post(`/api/v1/inbox/${threadId}/reply`, {
            headers: await apiHeaders('admin'),
            data: {
                content: `E2E reply ${Date.now()}`
            }
        })
        expect(replyResponse.status()).toBe(201)
    })
})
