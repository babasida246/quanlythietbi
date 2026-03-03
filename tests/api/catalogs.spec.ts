import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

test.describe('API Catalogs', () => {
    test('GET /api/v1/assets/catalogs returns catalog payload', async ({ request }) => {
        const response = await request.get('/api/v1/assets/catalogs', {
            headers: await apiHeaders('admin')
        })
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.data).toHaveProperty('categories')
        expect(body.data).toHaveProperty('vendors')
        expect(body.data).toHaveProperty('models')
        expect(body.data).toHaveProperty('locations')
    })

    test('Vendors CRUD works', async ({ request }) => {
        const unique = `E2E Vendor ${Date.now()}`
        const createResponse = await request.post('/api/v1/assets/catalogs/vendors', {
            headers: await apiHeaders('admin'),
            data: {
                name: unique,
                email: 'e2e-vendor@seed.local',
                phone: '0000000000'
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await createResponse.json()
        expect(created.data.id).toBeTruthy()

        const updateResponse = await request.put(`/api/v1/assets/catalogs/vendors/${created.data.id}`, {
            headers: await apiHeaders('admin'),
            data: {
                name: `${unique} Updated`
            }
        })
        expect(updateResponse.status()).toBe(200)
        const updated = await updateResponse.json()
        expect(updated.data.name).toContain('Updated')

        const deleteResponse = await request.delete(`/api/v1/assets/catalogs/vendors/${created.data.id}`, {
            headers: await apiHeaders('admin')
        })
        expect(deleteResponse.status()).toBe(200)
    })
})
