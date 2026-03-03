import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

type AssetListResponse = {
    data: Array<{
        id: string
        modelId: string
    }>
}

test.describe('API Assets', () => {
    test('GET /api/v1/assets returns asset list', async ({ request }) => {
        const response = await request.get('/api/v1/assets?page=1&limit=20', {
            headers: await apiHeaders('admin')
        })
        expect(response.status()).toBe(200)

        const body = (await response.json()) as AssetListResponse
        expect(Array.isArray(body.data)).toBeTruthy()
        expect(body.data.length).toBeGreaterThan(0)
    })

    test('POST /api/v1/assets creates and updates an asset', async ({ request }) => {
        const listResponse = await request.get('/api/v1/assets?page=1&limit=1', {
            headers: await apiHeaders('admin')
        })
        expect(listResponse.status()).toBe(200)
        const listBody = (await listResponse.json()) as AssetListResponse
        expect(listBody.data.length).toBeGreaterThan(0)

        const modelId = listBody.data[0].modelId
        const assetCode = `E2E-ASSET-${Date.now()}`
        const createResponse = await request.post('/api/v1/assets', {
            headers: await apiHeaders('admin'),
            data: {
                assetCode,
                modelId,
                status: 'in_stock',
                notes: 'playwright-api-create'
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await createResponse.json()
        expect(created.data.id).toBeTruthy()

        const getResponse = await request.get(`/api/v1/assets/${created.data.id}`, {
            headers: await apiHeaders('admin')
        })
        expect(getResponse.status()).toBe(200)

        const updateResponse = await request.put(`/api/v1/assets/${created.data.id}`, {
            headers: await apiHeaders('admin'),
            data: {
                notes: 'playwright-api-updated'
            }
        })
        expect(updateResponse.status()).toBe(200)
        const updated = await updateResponse.json()
        expect(updated.data.notes).toContain('playwright-api-updated')
    })

    test('POST /api/v1/assets validates payload and permissions', async ({ request }) => {
        const invalidPayload = await request.post('/api/v1/assets', {
            headers: await apiHeaders('admin'),
            data: {
                assetCode: ''
            }
        })
        expect(invalidPayload.status()).toBe(400)

        const noAuth = await request.get('/api/v1/assets')
        expect(noAuth.status()).toBe(401)

        const forbidden = await request.post('/api/v1/assets', {
            headers: await apiHeaders('user'),
            data: {
                assetCode: 'E2E-FORBIDDEN',
                modelId: '11111111-1111-4111-8111-111111111111'
            }
        })
        expect(forbidden.status()).toBe(403)
    })
})
