import { expect, test } from '@playwright/test'

test.describe('API Health', () => {
    test('GET /health returns ok', async ({ request }) => {
        const response = await request.get('/health')
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.status).toBe('ok')
    })

    test('GET /api/setup/status returns setup metadata', async ({ request }) => {
        const response = await request.get('/api/setup/status')
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.success).toBeTruthy()
        expect(body.data).toHaveProperty('initialized')
        expect(body.data).toHaveProperty('db')
        expect(body.data).toHaveProperty('migrations')
        expect(body.data).toHaveProperty('seed')
    })
})
