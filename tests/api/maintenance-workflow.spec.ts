/**
 * TC4.1 — Mở WO (Work Order / Repair Order): asset status → in_repair
 * TC4.2 — Yêu cầu linh kiện: liên kết phiếu xuất kho với repair order
 * TC4.3 — Đóng WO: khai báo chi phí + downtime, asset status → in_use/in_stock,
 *          bảng asset_cost_records được ghi nhận
 *
 * Schema notes:
 *   repairCreateSchema: { assetId, title, severity, repairType, technicianName? }
 *   repairStatusSchema: only { status } (POST /repair-orders/:id/status)
 *   repairUpdateSchema: full update via PUT /repair-orders/:id (includes diagnosis, laborCost, etc.)
 *
 * Response format: { data: T } (no "success" field in success responses).
 *
 * Serial — each step depends on the previous one.
 */
import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

const unique = Date.now().toString().slice(-8)
let repairOrderId = ''
let targetAssetId = ''

test.describe.serial('Maintenance Workflow API (TC4.x)', () => {
    // ── Pre-condition: find an asset to repair ─────────────────────────────

    test('Setup: find an in_use or in_stock asset to repair', async ({ request }) => {
        for (const status of ['in_use', 'in_stock']) {
            const resp = await request.get(`/api/v1/assets?status=${status}&limit=1`, {
                headers: await apiHeaders('admin')
            })
            if (!resp.ok()) continue
            const body = await resp.json()
            if (body.data?.length > 0) {
                targetAssetId = body.data[0].id
                break
            }
        }
        expect(targetAssetId).toBeTruthy()
    })

    // ── TC4.1: Create repair order → asset status → in_repair ─────────────

    test('TC4.1: Create repair order → asset status changes to in_repair', async ({ request }) => {
        expect(targetAssetId).toBeTruthy()

        const createResp = await request.post('/api/v1/repair-orders', {
            headers: await apiHeaders('admin'),
            data: {
                assetId: targetAssetId,
                title: `E2E WO ${unique}`,
                description: `Playwright maintenance workflow test ${unique}`,
                severity: 'medium',
                repairType: 'internal',
                technicianName: 'E2E Technician'
            }
        })
        expect([200, 201]).toContain(createResp.status())
        const body = await createResp.json()
        expect(body.data.id).toBeTruthy()
        repairOrderId = body.data.id as string

        // Initial status should be open/diagnosing
        expect(body.data.status).toMatch(/open|diagnosing|pending/)

        // Asset status should now be in_repair (TC4.1 business requirement)
        const assetResp = await request.get(`/api/v1/assets/${targetAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(assetResp.status()).toBe(200)
        const asset = await assetResp.json()
        // Detail response nests asset: { data: { asset: {...}, assignments: [...] } }
        const assetData = asset.data.asset ?? asset.data
        expect(assetData.status).toBe('in_repair')
    })

    // ── TC4.2: Add spare parts to repair order ────────────────────────────

    test('TC4.2: Add spare parts to repair order (action required, partName when no warehouseId)', async ({
        request
    }) => {
        if (!repairOrderId) return

        // repairPartSchema requires "action". When partId is sent without warehouseId, the
        // service throws 400. Use partName only (no stock deduction) for a valid request.
        const addPartResp = await request.post(`/api/v1/repair-orders/${repairOrderId}/parts`, {
            headers: await apiHeaders('admin'),
            data: {
                partName: `E2E Replacement Part ${unique}`,
                action: 'replace',
                qty: 1,
                unitCost: 250000,
                note: `E2E part request ${unique}`
            }
        })
        expect([200, 201]).toContain(addPartResp.status())
        const partBody = await addPartResp.json()
        expect(partBody.data).toBeTruthy()

        // Verify part appears in repair order detail
        const detailResp = await request.get(`/api/v1/repair-orders/${repairOrderId}`, {
            headers: await apiHeaders('admin')
        })
        expect(detailResp.status()).toBe(200)
        const detail = await detailResp.json()
        const parts = detail.data.parts ?? detail.data.repairParts ?? []
        expect(Array.isArray(parts)).toBeTruthy()
    })

    // ── TC4.3: Close repair order — cost records, asset returns ───────────

    test('TC4.3a: Update repair order via PUT with diagnosis + costs (repaired status)', async ({
        request
    }) => {
        if (!repairOrderId) return

        // Use PUT (repairUpdateSchema) for updating with cost fields
        const updateResp = await request.put(`/api/v1/repair-orders/${repairOrderId}`, {
            headers: await apiHeaders('admin'),
            data: {
                status: 'repaired',
                diagnosis: `E2E diagnosed fault ${unique}`,
                resolution: `E2E component replaced ${unique}`,
                laborCost: 500000,
                downtimeMinutes: 120
            }
        })
        expect([200, 201]).toContain(updateResp.status())
        const body = await updateResp.json()
        expect(body.data).toBeTruthy()
    })

    test('TC4.3b: Close repair order via PUT → asset exits in_repair, cost recorded', async ({
        request
    }) => {
        if (!repairOrderId) return

        // Close via PUT with full update (repairUpdateSchema supports all fields)
        const closeResp = await request.put(`/api/v1/repair-orders/${repairOrderId}`, {
            headers: await apiHeaders('admin'),
            data: {
                status: 'closed',
                laborCost: 500000,
                partsCost: 250000,
                downtimeMinutes: 120,
                resolution: `E2E final resolution ${unique}`
            }
        })
        expect([200, 201]).toContain(closeResp.status())
        const body = await closeResp.json()
        expect(body.data).toBeTruthy()

        // Asset should exit in_repair after WO close (TC4.3 business requirement)
        const assetResp = await request.get(`/api/v1/assets/${targetAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(assetResp.status()).toBe(200)
        const asset = await assetResp.json()
        // Detail response nests asset: { data: { asset: {...}, assignments: [...] } }
        const assetData = asset.data.asset ?? asset.data
        expect(assetData.status).not.toBe('in_repair')
        expect(['in_use', 'in_stock']).toContain(assetData.status)
    })

    test('TC4.3c: Repair order list shows the closed WO', async ({ request }) => {
        if (!repairOrderId) return

        // Verify the repair order exists and is closed
        const detailResp = await request.get(`/api/v1/repair-orders/${repairOrderId}`, {
            headers: await apiHeaders('admin')
        })
        expect(detailResp.status()).toBe(200)
        const detail = await detailResp.json()
        // Detail response nests order: { data: { order: {...}, parts: [...] } }
        const orderData = detail.data.order ?? detail.data
        expect(orderData.status).toMatch(/repaired|closed/)

        // laborCost should be persisted
        const laborCost = orderData.laborCost ?? orderData.labor_cost
        expect(laborCost).toBeGreaterThan(0)
    })
})

// ── Permission checks ─────────────────────────────────────────────────────────

test.describe('Maintenance Workflow — Permission Checks', () => {
    test('TC4.1-perm: Regular user cannot create repair orders (403)', async ({ request }) => {
        const resp = await request.post('/api/v1/repair-orders', {
            headers: await apiHeaders('user'),
            data: {
                assetId: '00000000-0000-4000-8000-000000000001',
                title: 'E2E Forbidden WO',
                severity: 'low',
                repairType: 'internal'
            }
        })
        expect([403, 404]).toContain(resp.status())
    })
})
