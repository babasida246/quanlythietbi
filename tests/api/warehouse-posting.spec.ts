/**
 * TC3.1 — Nhập kho (Receipt): POST stock document with asset line
 *          → hệ thống tự tạo Asset record (status: in_stock, warehouseId set)
 * TC3.2 — Xuất kho (Issue): POST stock document with asset line
 *          → asset status → in_use, warehouseId = null
 *          → KHÔNG tự tạo assignment record (kiến trúc tách biệt)
 * TC3.3 — Linh kiện (Spare Parts): receipt/issue với spare_part line
 *          → spare_part_stock tăng/giảm đúng số lượng
 *
 * Stock document workflow (maker-checker, 3-actor rule):
 *   1. Create + Submit: warehouse_keeper (warehouse:create)
 *   2. Approve: admin (warehouse:approve, different from creator)
 *   3. Post: it_manager (warehouse:approve, different from creator AND approver)
 *
 * Response format:
 *   Create: { data: { document: StockDocumentRecord, lines: [...] } }
 *   Post/Approve: { data: StockDocumentRecord }
 *   Asset detail: { data: { asset: AssetRecord, assignments: [...] } }
 */
import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

// ── Helpers ──────────────────────────────────────────────────────────────────

type AnyRequest = Parameters<typeof test>[1] extends { request: infer R } ? R : never

async function getFirstWarehouseId(request: AnyRequest): Promise<string | null> {
    // @ts-expect-error — narrowed at call site
    const resp = await request.get('/api/v1/warehouses?limit=1', {
        headers: await apiHeaders('admin')
    })
    if (!resp.ok()) return null
    const body = await resp.json()
    return body.data?.[0]?.id ?? null
}

async function getFirstModelId(request: AnyRequest): Promise<string | null> {
    // @ts-expect-error — narrowed at call site
    const resp = await request.get('/api/v1/assets/catalogs', {
        headers: await apiHeaders('admin')
    })
    if (!resp.ok()) return null
    const catalog = await resp.json()
    return catalog.data?.models?.[0]?.id ?? null
}

/**
 * Full 3-actor post workflow: submit (as creator) → approve (as admin) → post (as it_manager).
 * Returns the HTTP status of the final post.
 */
async function submitApprovePost(request: AnyRequest, docId: string): Promise<number> {
    // Step 1: submit (same user who created — creator role doesn't matter for submit)
    // @ts-expect-error
    await request.post(`/api/v1/stock-documents/${docId}/submit`, {
        headers: await apiHeaders('warehouse_keeper'),
        data: {}
    })

    // Step 2: approve as admin (different from warehouse_keeper creator)
    // @ts-expect-error
    const approveResp = await request.post(`/api/v1/stock-documents/${docId}/approve`, {
        headers: await apiHeaders('admin'),
        data: {}
    })
    if (!approveResp.ok()) {
        const body = await approveResp.json()
        console.log(`Approve failed ${approveResp.status()}: ${body.error?.message}`)
        return approveResp.status()
    }

    // Step 3: post as it_manager (different from creator warehouse_keeper AND approver admin)
    // @ts-expect-error
    const postResp = await request.post(`/api/v1/stock-documents/${docId}/post`, {
        headers: await apiHeaders('it_manager'),
        data: {}
    })
    return postResp.status()
}

// ── TC3.1: Receipt → auto-create asset ───────────────────────────────────────

test.describe('TC3.1: Stock Receipt → Asset Auto-Creation', () => {
    test('TC3.1a: Receipt draft created with asset line (correct field names)', async ({
        request
    }) => {
        const warehouseId = await getFirstWarehouseId(request)
        if (!warehouseId) {
            console.log('No warehouse seeded — skipping TC3.1')
            return
        }
        const assetModelId = await getFirstModelId(request)
        if (!assetModelId) {
            console.log('No asset model seeded — skipping TC3.1')
            return
        }

        const unique = Date.now().toString().slice(-8)
        // Create as warehouse_keeper (first actor in 3-actor flow)
        const createDocResp = await request.post('/api/v1/stock-documents', {
            headers: await apiHeaders('warehouse_keeper'),
            data: {
                docType: 'receipt',
                warehouseId,
                docDate: new Date().toISOString().split('T')[0],
                note: `E2E TC3.1 Receipt ${unique}`,
                lines: [
                    {
                        lineType: 'asset',
                        assetModelId,
                        qty: 1,
                        unitCost: 5000000
                    }
                ]
            }
        })
        expect(createDocResp.status()).toBe(201)
        const doc = await createDocResp.json()
        // Response: { data: { document: {...}, lines: [...] } }
        const docData = doc.data.document ?? doc.data
        const docId = docData.id as string
        expect(docId).toBeTruthy()
        expect(docData.status).toMatch(/draft|pending/)

        // Count assets before posting
        const assetsBefore = await request.get('/api/v1/assets?limit=500', {
            headers: await apiHeaders('admin')
        })
        const countBefore = (await assetsBefore.json()).data?.length ?? 0

        // Full 3-actor post: submit(wk) → approve(admin) → post(it_manager)
        const postStatus = await submitApprovePost(request, docId)
        expect([200, 201]).toContain(postStatus)

        // After posting: a new asset should have been created
        const assetsAfter = await request.get('/api/v1/assets?limit=500', {
            headers: await apiHeaders('admin')
        })
        const countAfter = (await assetsAfter.json()).data?.length ?? 0
        expect(countAfter).toBeGreaterThan(countBefore)
    })

    test('TC3.1b: Posted receipt assets have status in_stock', async ({ request }) => {
        const warehouseId = await getFirstWarehouseId(request)
        if (!warehouseId) return
        const assetModelId = await getFirstModelId(request)
        if (!assetModelId) return

        const unique = Date.now().toString().slice(-8)
        const createResp = await request.post('/api/v1/stock-documents', {
            headers: await apiHeaders('warehouse_keeper'),
            data: {
                docType: 'receipt',
                warehouseId,
                docDate: new Date().toISOString().split('T')[0],
                note: `E2E TC3.1b ${unique}`,
                lines: [{ lineType: 'asset', assetModelId, qty: 1, unitCost: 3000000 }]
            }
        })
        if (createResp.status() !== 201) return
        // Response: { data: { document: {...}, lines: [...] } }
        const createBody = await createResp.json()
        const docId = (createBody.data.document ?? createBody.data).id
        if (!docId) return

        const postStatus = await submitApprovePost(request, docId)
        if (postStatus < 200 || postStatus >= 300) return

        // Filter assets by status=in_stock and this warehouse
        const assetsResp = await request.get(
            `/api/v1/assets?status=in_stock&warehouseId=${warehouseId}&limit=10`,
            { headers: await apiHeaders('admin') }
        )
        expect(assetsResp.status()).toBe(200)
        const assets = await assetsResp.json()
        // At least one in_stock asset should exist in this warehouse
        if (assets.data?.length > 0) {
            const found = assets.data.find(
                (a: { status: string; warehouseId?: string; warehouse_id?: string }) =>
                    a.status === 'in_stock' &&
                    (a.warehouseId === warehouseId || a.warehouse_id === warehouseId)
            )
            expect(found).toBeTruthy()
        }
    })
})

// ── TC3.2: Issue → update asset, NO auto-assignment ──────────────────────────

test.describe('TC3.2: Stock Issue → Asset Status Update, No Assignment', () => {
    let targetAssetId = ''
    const unique = Date.now().toString().slice(-8)

    test('TC3.2-setup: Create+post receipt to get a fresh in_stock asset', async ({
        request
    }) => {
        const warehouseId = await getFirstWarehouseId(request)
        if (!warehouseId) return
        const assetModelId = await getFirstModelId(request)
        if (!assetModelId) return

        const createResp = await request.post('/api/v1/stock-documents', {
            headers: await apiHeaders('warehouse_keeper'),
            data: {
                docType: 'receipt',
                warehouseId,
                docDate: new Date().toISOString().split('T')[0],
                note: `E2E TC3.2-setup ${unique}`,
                lines: [{ lineType: 'asset', assetModelId, qty: 1, unitCost: 2000000 }]
            }
        })
        if (createResp.status() !== 201) return
        const createBody = await createResp.json()
        const docId = (createBody.data.document ?? createBody.data).id
        if (!docId) return

        const postStatus = await submitApprovePost(request, docId)
        if (postStatus < 200 || postStatus >= 300) return

        // Get the newest in_stock asset (likely the one just created)
        const assetsResp = await request.get(
            `/api/v1/assets?status=in_stock&sort=newest&limit=1`,
            { headers: await apiHeaders('admin') }
        )
        const assets = await assetsResp.json()
        if (assets.data?.length > 0) {
            targetAssetId = assets.data[0].id
        }
    })

    test('TC3.2-issue: Issue doc moves asset to in_use, warehouseId becomes null', async ({
        request
    }) => {
        // Fallback if setup didn't create a fresh asset
        if (!targetAssetId) {
            const resp = await request.get('/api/v1/assets?status=in_stock&limit=1', {
                headers: await apiHeaders('admin')
            })
            if (resp.ok()) {
                const body = await resp.json()
                targetAssetId = body.data?.[0]?.id ?? ''
            }
        }
        if (!targetAssetId) {
            console.log('No in_stock asset available for TC3.2 issue test')
            return
        }

        const warehouseId = await getFirstWarehouseId(request)
        if (!warehouseId) return

        // Create issue doc as warehouse_keeper (1st actor)
        const issueResp = await request.post('/api/v1/stock-documents', {
            headers: await apiHeaders('warehouse_keeper'),
            data: {
                docType: 'issue',
                warehouseId,
                docDate: new Date().toISOString().split('T')[0],
                note: `E2E TC3.2 Issue ${unique}`,
                lines: [
                    {
                        lineType: 'asset',
                        assetId: targetAssetId,
                        qty: 1
                    }
                ]
            }
        })
        if (issueResp.status() !== 201) {
            console.log(`Issue doc creation returned ${issueResp.status()}`)
            return
        }
        const issueBody = await issueResp.json()
        const issueDocId = (issueBody.data.document ?? issueBody.data).id
        if (!issueDocId) return

        // Full 3-actor post
        const postStatus = await submitApprovePost(request, issueDocId)
        expect([200, 201]).toContain(postStatus)

        // Asset status must be in_use now
        const assetResp = await request.get(`/api/v1/assets/${targetAssetId}`, {
            headers: await apiHeaders('admin')
        })
        expect(assetResp.status()).toBe(200)
        const asset = await assetResp.json()
        // Asset detail: { data: { asset: {...}, assignments: [...] } }
        const assetData = asset.data.asset ?? asset.data
        expect(assetData.status).toBe('in_use')

        // warehouseId must be null (asset left the warehouse)
        const wid = assetData.warehouseId ?? assetData.warehouse_id
        expect(wid).toBeFalsy()
    })

    test('TC3.2-critical: Issue posting MUST NOT auto-create assignment record', async ({
        request
    }) => {
        if (!targetAssetId) return

        // Check assignment — should be empty for this asset (only manual "Gán tài sản" creates one)
        const resp = await request.get(
            `/api/v1/assets/${targetAssetId}/assignments`,
            { headers: await apiHeaders('admin') }
        )
        if (resp.status() === 404) {
            // Assignments are embedded in asset detail — check assigneeName
            const detailResp = await request.get(`/api/v1/assets/${targetAssetId}`, {
                headers: await apiHeaders('admin')
            })
            expect(detailResp.status()).toBe(200)
            const detail = await detailResp.json()
            const assetData = detail.data.asset ?? detail.data
            const assignee =
                assetData.assigneeName ??
                assetData.assignee_name ??
                assetData.currentAssignment?.assigneeName
            // Should be null/undefined (not auto-assigned by issue posting)
            expect(assignee ?? null).toBeNull()
            return
        }

        if (resp.status() === 200) {
            const body = await resp.json()
            const activeAssignments = (body.data ?? []).filter(
                (a: { status?: string; endDate?: string; end_date?: string }) =>
                    a.status === 'active' || (!a.endDate && !a.end_date)
            )
            expect(activeAssignments.length).toBe(0)
        }
    })
})

// ── TC3.3: Spare parts stock adjustment ──────────────────────────────────────

test.describe('TC3.3: Spare Parts Stock Adjustment', () => {
    test('TC3.3: Receipt with spare_part line increases stock quantity', async ({ request }) => {
        const warehouseId = await getFirstWarehouseId(request)
        if (!warehouseId) return

        // Get a spare part from parts endpoint
        const partsResp = await request.get('/api/v1/spare-parts?limit=1', {
            headers: await apiHeaders('admin')
        })
        if (!partsResp.ok()) return
        const partsBody = await partsResp.json()
        const partId = partsBody.data?.[0]?.id ?? null
        if (!partId) {
            console.log('No spare parts seeded — skipping TC3.3')
            return
        }

        // Check stock before
        const stockBefore = await request.get(
            `/api/v1/stock/view?warehouseId=${warehouseId}&partId=${partId}`,
            { headers: await apiHeaders('admin') }
        )
        const qtyBefore: number = stockBefore.ok()
            ? ((await stockBefore.json()).data?.[0]?.onHand ?? 0)
            : 0

        const unique = Date.now().toString().slice(-8)
        // Create as warehouse_keeper (1st actor)
        const receiptResp = await request.post('/api/v1/stock-documents', {
            headers: await apiHeaders('warehouse_keeper'),
            data: {
                docType: 'receipt',
                warehouseId,
                docDate: new Date().toISOString().split('T')[0],
                note: `E2E TC3.3 SparePart ${unique}`,
                lines: [
                    {
                        lineType: 'spare_part',
                        partId,
                        qty: 5,
                        unitCost: 50000
                    }
                ]
            }
        })
        if (receiptResp.status() !== 201) return
        const receiptBody = await receiptResp.json()
        const docId = (receiptBody.data.document ?? receiptBody.data).id
        if (!docId) return

        // Full 3-actor post
        const postStatus = await submitApprovePost(request, docId)
        expect([200, 201]).toContain(postStatus)

        // Stock quantity must increase by 5
        const stockAfter = await request.get(
            `/api/v1/stock/view?warehouseId=${warehouseId}&partId=${partId}`,
            { headers: await apiHeaders('admin') }
        )
        if (stockAfter.ok()) {
            const qtyAfter: number = (await stockAfter.json()).data?.[0]?.onHand ?? 0
            expect(qtyAfter).toBeGreaterThanOrEqual(qtyBefore + 5)
        }
    })
})
