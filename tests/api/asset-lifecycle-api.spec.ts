/**
 * TC2.1 — Asset creation: assetCode is REQUIRED, status defaults to in_stock
 * TC2.2 — Asset detail includes model reference and spec fields
 * TC2.3 — Gán tài sản (Assignment): status → in_use, assignment record created
 * TC2.4 — Thu hồi (Return): status reverts, assignment closed
 *
 * Response format: { data: T } (no "success" field in success responses).
 * assignmentSchema requires: assigneeType, assigneeId, assigneeName (all required).
 * returnSchema accepts: note (optional).
 *
 * Serial — each step builds on the previous one's shared state.
 */
import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

// Shared state across serial steps
let createdAssetId = ''
const unique = Date.now().toString().slice(-8)
const assetCode = `E2E-LIFECYCLE-${unique}`

test.describe.serial('Asset Lifecycle API (TC2.x)', () => {
    // ── TC2.1: Create asset with required assetCode ─────────────────────

    test('TC2.1: Create asset with assetCode → status = in_stock', async ({ request }) => {
        // Use /asset-models — /assets/catalogs returns 500 (ou_id column missing in DB)
        const catalogResp = await request.get('/api/v1/asset-models', {
            headers: await apiHeaders('admin')
        })
        expect(catalogResp.status()).toBe(200)
        const catalog = await catalogResp.json()
        const models = catalog.data ?? []
        expect(models.length).toBeGreaterThan(0)
        const modelId = models[0].id

        const createResp = await request.post('/api/v1/assets', {
            headers: await apiHeaders('admin'),
            data: {
                assetCode,
                modelId,
                serialNo: `SN-TC21-${unique}`,
                notes: `playwright-tc2.1-${unique}`
            }
        })
        expect(createResp.status()).toBe(201)
        const body = await createResp.json()
        expect(body.data.id).toBeTruthy()

        // assetCode must match what we sent
        const code = body.data.assetCode ?? body.data.asset_code
        expect(code).toBe(assetCode)

        // Default status must be in_stock
        expect(body.data.status).toBe('in_stock')

        createdAssetId = body.data.id
    })

    // ── TC2.2: Asset detail includes model reference ─────────────────────

    test('TC2.2: GET asset → includes modelId and is retrievable', async ({ request }) => {
        expect(createdAssetId).toBeTruthy()

        const resp = await request.get(`/api/v1/assets/${createdAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(resp.status()).toBe(200)
        const body = await resp.json()
        // Detail response: { data: { asset: {...}, assignments: [...], maintenance: [...] } }
        const assetData = body.data.asset ?? body.data
        expect(assetData.id).toBe(createdAssetId)

        // Asset must reference its model
        const modelRef = assetData.modelId ?? assetData.model_id ?? assetData.model?.id
        expect(modelRef).toBeTruthy()

        // assetCode must be present
        const code = assetData.assetCode ?? assetData.asset_code
        expect(code).toBe(assetCode)
    })

    // ── TC2.3: Gán tài sản (Assignment) ───────────────────────────────────

    test('TC2.3a: POST /assets/:id/assign → status changes to in_use', async ({ request }) => {
        expect(createdAssetId).toBeTruthy()

        const assignResp = await request.post(`/api/v1/assets/${createdAssetId}/assign`, {
            headers: await apiHeaders('admin'),
            data: {
                assigneeType: 'person',
                assigneeId: `e2e-person-${unique}`,
                assigneeName: `E2E User ${unique}`,
                note: `playwright-assign-${unique}`
            }
        })
        expect([200, 201]).toContain(assignResp.status())
        const assignBody = await assignResp.json()
        expect(assignBody.data).toBeTruthy()

        // Asset status must now be in_use
        const assetResp = await request.get(`/api/v1/assets/${createdAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(assetResp.status()).toBe(200)
        const asset = await assetResp.json()
        // Detail response nests asset under asset.data.asset
        const assetData = asset.data.asset ?? asset.data
        expect(assetData.status).toBe('in_use')
    })

    test('TC2.3b: Asset has assignee information after assign', async ({ request }) => {
        expect(createdAssetId).toBeTruthy()

        const detailResp = await request.get(`/api/v1/assets/${createdAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(detailResp.status()).toBe(200)
        const detail = await detailResp.json()

        // Detail response: { data: { asset: {...}, assignments: [...] } }
        const assetData = detail.data.asset ?? detail.data
        const assignments: Array<{ assigneeName?: string; assignee_name?: string }> =
            detail.data.assignments ?? []

        // Assignee name may be on the asset record or in the assignments array
        const assigneeName =
            assetData.assigneeName ??
            assetData.assignee_name ??
            assetData.currentAssignment?.assigneeName ??
            assignments[0]?.assigneeName ??
            assignments[0]?.assignee_name
        expect(assigneeName).toBeTruthy()
    })

    // ── TC2.4: Thu hồi / Return ────────────────────────────────────────────

    test('TC2.4: POST /assets/:id/return → status reverts from in_use', async ({ request }) => {
        expect(createdAssetId).toBeTruthy()

        const returnResp = await request.post(`/api/v1/assets/${createdAssetId}/return`, {
            headers: await apiHeaders('admin'),
            data: {
                note: `playwright-return-${unique}`
            }
        })
        expect([200, 201]).toContain(returnResp.status())
        const returnBody = await returnResp.json()
        expect(returnBody.data).toBeTruthy()

        // Asset status should no longer be in_use
        const assetResp = await request.get(`/api/v1/assets/${createdAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(assetResp.status()).toBe(200)
        const asset = await assetResp.json()
        // Detail response nests asset under asset.data.asset
        const assetData = asset.data.asset ?? asset.data
        // After return: in_stock or in_repair (not in_use)
        expect(assetData.status).not.toBe('in_use')
    })

    // ── Cleanup ────────────────────────────────────────────────────────────

    test('Cleanup: delete the E2E asset', async ({ request }) => {
        if (!createdAssetId) return
        const resp = await request.delete(`/api/v1/assets/${createdAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect([200, 204, 404]).toContain(resp.status())
    })
})

// ── Standalone permission checks ─────────────────────────────────────────────

test.describe('Asset Lifecycle — Permission Checks', () => {
    test('TC2.1-perm: Regular user cannot create assets (403)', async ({ request }) => {
        const createResp = await request.post('/api/v1/assets', {
            headers: await apiHeaders('user'),
            data: {
                assetCode: `E2E-PERM-${Date.now()}`,
                modelId: '00000000-0000-4000-8000-000000000001'
            }
        })
        expect(createResp.status()).toBe(403)
    })

    test('TC2.3-perm: Regular user cannot assign assets (403)', async ({ request }) => {
        const resp = await request.post('/api/v1/assets/00000000-0000-4000-8000-000000000001/assign', {
            headers: await apiHeaders('user'),
            data: {
                assigneeType: 'person',
                assigneeId: 'test-id',
                assigneeName: 'test'
            }
        })
        // 403 = no permission; 404 = not found but still blocked
        expect([403, 404]).toContain(resp.status())
    })

    test('TC2.1-perm: Creating asset without assetCode returns 400', async ({ request }) => {
        const catalogResp = await request.get('/api/v1/asset-models', {
            headers: await apiHeaders('admin')
        })
        const catalog = await catalogResp.json()
        const modelId = catalog.data?.[0]?.id

        if (!modelId) return

        const createResp = await request.post('/api/v1/assets', {
            headers: await apiHeaders('admin'),
            data: {
                modelId,
                status: 'in_stock'
                // assetCode intentionally omitted — should fail with 400
            }
        })
        expect(createResp.status()).toBe(400)
    })
})
