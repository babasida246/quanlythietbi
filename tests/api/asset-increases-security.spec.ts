import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

test.describe('API Asset Increases Security', () => {
    test('GET /api/v1/assets/asset-increases rejects SQL-like filter payload', async ({ request }) => {
        const response = await request.get("/api/v1/assets/asset-increases?status=draft'%20OR%201=1%20--&page=1&limit=20", {
            headers: await apiHeaders('admin')
        })

        expect(response.status()).toBe(400)
    })

    test('GET /api/v1/assets/asset-increases accepts valid filter payload', async ({ request }) => {
        const response = await request.get('/api/v1/assets/asset-increases?status=draft&page=1&limit=20', {
            headers: await apiHeaders('admin')
        })

        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(Array.isArray(body.data)).toBeTruthy()
    })
})
