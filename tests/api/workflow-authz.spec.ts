import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

test.describe('API Workflow and AuthZ', () => {
    test('user role cannot approve workflow requests', async ({ request }) => {
        // User can create requests (requests:create permission), but cannot approve
        const approveResponse = await request.post('/api/v1/wf/approvals/00000000-0000-4000-8000-000000000000/approve', {
            headers: await apiHeaders('user'),
            data: {}
        })
        // Should be 403 (no requests:approve permission) or 400/404 – never 200
        expect(approveResponse.status()).not.toBe(200)
        expect([403, 404]).toContain(approveResponse.status())
    })

    test('admin creates and submits workflow request', async ({ request }) => {
        // Create a draft request
        const createResponse = await request.post('/api/v1/wf/me/requests', {
            headers: await apiHeaders('admin'),
            data: {
                title: 'E2E Test Request',
                requestType: 'asset_request',
                priority: 'normal',
                payload: { e2e: true, source: 'playwright' }
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await createResponse.json()
        const id = created.data.id as string
        expect(id).toBeTruthy()
        expect(created.data.status).toBe('draft')

        // Submit the request
        const submitResponse = await request.post(`/api/v1/wf/me/requests/${id}/submit`, {
            headers: await apiHeaders('admin'),
            data: {}
        })
        expect(submitResponse.status()).toBe(200)
        const submitted = await submitResponse.json()
        expect(['submitted', 'in_review', 'approved']).toContain(submitted.data.status)
    })
})
