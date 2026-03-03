import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

test.describe('API Warehouse and Inventory', () => {
    test('warehouse endpoints return data', async ({ request }) => {
        const warehouseResponse = await request.get('/api/v1/warehouses', {
            headers: await apiHeaders('admin')
        })
        expect(warehouseResponse.status()).toBe(200)
        const warehouses = await warehouseResponse.json()
        expect(Array.isArray(warehouses.data)).toBeTruthy()

        const stockView = await request.get('/api/v1/stock/view?page=1&limit=10', {
            headers: await apiHeaders('admin')
        })
        expect(stockView.status()).toBe(200)
        const stockBody = await stockView.json()
        expect(Array.isArray(stockBody.data)).toBeTruthy()
    })

    test('create and update warehouse', async ({ request }) => {
        const code = `E2E-WH-${Date.now()}`
        const createResponse = await request.post('/api/v1/warehouses', {
            headers: await apiHeaders('admin'),
            data: {
                code,
                name: `Warehouse ${code}`
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await createResponse.json()
        expect(created.data.id).toBeTruthy()

        const updateResponse = await request.put(`/api/v1/warehouses/${created.data.id}`, {
            headers: await apiHeaders('admin'),
            data: {
                name: `Warehouse ${code} Updated`
            }
        })
        expect(updateResponse.status()).toBe(200)
        const updated = await updateResponse.json()
        expect(updated.data.name).toContain('Updated')
    })

    test('create and close inventory session', async ({ request }) => {
        const createResponse = await request.post('/api/v1/inventory/sessions', {
            headers: await apiHeaders('admin'),
            data: {
                name: `E2E Session ${Date.now()}`
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await createResponse.json()
        const sessionId = created.data.id as string
        expect(sessionId).toBeTruthy()

        const detailResponse = await request.get(`/api/v1/inventory/sessions/${sessionId}`, {
            headers: await apiHeaders('admin')
        })
        expect(detailResponse.status()).toBe(200)

        const closeResponse = await request.post(`/api/v1/inventory/sessions/${sessionId}/close`, {
            headers: await apiHeaders('admin')
        })
        expect(closeResponse.status()).toBe(200)
    })
})
