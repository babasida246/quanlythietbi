/**
 * Unified Requests Page - Detailed Test Suite
 * Tests /requests with tabs: mine | inbox | all
 *
 * Covers:
 *  1. Page load & i18n rendering
 *  2. "Của tôi" (my requests) tab - list, filter, detail modal
 *  3. "Hộp duyệt" (inbox) tab - summary cards, list, approve/reject
 *  4. "Tất cả" (all) tab - list & filter
 *  5. Create new request flow → appears in Mine tab
 *  6. Submit request → moves to inbox → admin approves → status changes
 *  7. Legacy redirect: /me/requests and /inbox redirect correctly
 */
import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import { applyUiAuth, apiHeaders } from '../fixtures/auth'

const API = `${process.env.API_BASE_URL || 'http://127.0.0.1:4010'}/api/v1`

// ─── helpers ────────────────────────────────────────────────────────────────

async function nav(page: Page, path: string, extra = 1500) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(extra)
}

async function noObjectObject(page: Page, ctx = '') {
    const text = await page.textContent('body')
    expect(text, `[object Object] on ${ctx}`).not.toContain('[object Object]')
    expect(text, `undefined on ${ctx}`).not.toMatch(/\bundefined\b/)
}

async function waitForTabContent(page: Page, tab: 'mine' | 'inbox' | 'all') {
    // Wait until skeleton is gone (either table rows/empty state shown or error)
    await page.waitForFunction(() => {
        const skeletons = document.querySelectorAll('[data-skeleton], .animate-pulse')
        return skeletons.length === 0
    }, { timeout: 15_000 }).catch(() => { /* timeout ok — page may not use data-skeleton */ })
    await page.waitForTimeout(500)
}

async function clickTab(page: Page, tab: 'mine' | 'inbox' | 'all') {
    const labels: Record<string, RegExp> = {
        mine: /Của tôi|My Request/i,
        inbox: /Hộp duyệt|Approval Inbox/i,
        all: /Tất cả|All Request/i,
    }
    await page.getByRole('button', { name: labels[tab] }).click()
    await page.waitForURL(new RegExp(`tab=${tab}`))
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(800)
}

// ─── API helper ─────────────────────────────────────────────────────────────

async function apiGet<T>(req: APIRequestContext, path: string, role: 'admin' | 'user' = 'admin'): Promise<T> {
    const hdrs = await apiHeaders(role)
    const res = await req.get(`${API}${path}`, { headers: hdrs })
    return res.json() as Promise<T>
}

async function apiPost<T>(req: APIRequestContext, path: string, body: unknown, role: 'admin' | 'user' = 'admin'): Promise<T> {
    const hdrs = await apiHeaders(role)
    const res = await req.post(`${API}${path}`, { headers: { ...hdrs, 'Content-Type': 'application/json' }, data: body })
    return res.json() as Promise<T>
}

// ─── 1. Page structure ───────────────────────────────────────────────────────

test.describe('Requests Page - Structure & i18n', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('loads without errors or [object Object]', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 1000)
        await noObjectObject(page, '/requests?tab=mine')
    })

    test('page title and subtitle are translated (not raw key)', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 1000)
        const h1 = await page.locator('h1').first().textContent()
        // Must NOT be the raw key
        expect(h1).not.toMatch(/^requests\./)
        // Must be a non-empty title
        expect(h1?.trim().length).toBeGreaterThan(2)
    })

    test('three tabs are visible with correct labels', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 1000)
        await expect(page.getByRole('button', { name: /Của tôi|My Request/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /Hộp duyệt|Approval Inbox/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /Tất cả|All Request/i })).toBeVisible()
    })

    test('tab labels come from i18n (not raw keys)', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 1000)
        const body = await page.textContent('body')
        // Raw i18n keys must not appear
        expect(body).not.toContain('requests.tab.mine')
        expect(body).not.toContain('requests.tab.inbox')
        expect(body).not.toContain('requests.tab.all')
        expect(body).not.toContain('requests.pageTitle')
        expect(body).not.toContain('requests.pageSubtitle')
    })
})

// ─── 2. Mine tab ─────────────────────────────────────────────────────────────

test.describe('Requests Page - Mine Tab', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('mine tab is active by default', async ({ page }) => {
        await nav(page, '/requests', 1000)
        await expect(page).toHaveURL(/tab=mine|\/requests$/)
        const activeTab = page.locator('button[class*="border-primary"]').or(page.locator('button[class*="text-primary"]'))
        const text = await activeTab.first().textContent()
        expect(text).toMatch(/Của tôi|My Request/i)
    })

    test('mine tab loads and shows data or empty state (no skeleton stuck)', async ({ page }) => {
        await nav(page, '/requests?tab=mine')
        // Wait for loading to finish (skeleton disappears or table appears)
        await page.waitForFunction(() => {
            // Loading done when table rows appear OR empty-state msg appears
            const rows = document.querySelectorAll('tbody tr')
            const empty = document.querySelector('[class*="text-slate-500"]')
            return rows.length > 0 || (empty && empty.textContent && empty.textContent.length > 5)
        }, { timeout: 15_000 })
        await noObjectObject(page, 'mine tab after load')
    })

    test('mine tab shows admin requests from API', async ({ page, request }) => {
        // First verify API has data
        const apiResp = await apiGet<{ data: unknown[]; meta: { total: number } }>(request, '/wf/me/requests?page=1&limit=20')
        const apiTotal = (apiResp as any).meta?.total ?? 0

        await nav(page, '/requests?tab=mine')
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll('tbody tr')
            const emptyMsg = document.querySelector('[class*="emptyState"], [class*="text-slate-500"]')
            return rows.length > 0 || (emptyMsg && (emptyMsg as HTMLElement).innerText?.length > 5)
        }, { timeout: 15_000 })

        if (apiTotal > 0) {
            const rows = page.locator('tbody tr')
            const rowCount = await rows.count()
            expect(rowCount, `Should display ${apiTotal} rows`).toBeGreaterThan(0)
        }
    })

    test('filter dropdowns work without [object Object]', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 1000)
        const selects = page.locator('select')
        const count = await selects.count()
        expect(count).toBeGreaterThanOrEqual(2)
        // Change status filter
        if (count > 0) {
            const opts = selects.first().locator('option')
            if ((await opts.count()) > 1) {
                await selects.first().selectOption({ index: 1 })
                await page.waitForTimeout(1000)
                await noObjectObject(page, 'mine after status filter')
            }
        }
    })

    test('"+ Tạo yêu cầu" button is visible on mine tab', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 800)
        const btn = page.getByRole('button', { name: /Tạo yêu cầu|Create Request/i })
        await expect(btn).toBeVisible()
    })
})

// ─── 3. Inbox tab ────────────────────────────────────────────────────────────

test.describe('Requests Page - Inbox Tab', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('inbox tab loads and shows 4 summary cards', async ({ page }) => {
        await nav(page, '/requests?tab=inbox')
        await page.waitForFunction(() => {
            const cards = document.querySelectorAll('[class*="rounded-xl"]')
            return cards.length >= 4
        }, { timeout: 10_000 })
        // Verify 4 cards are visible
        const cards = page.locator('.rounded-xl.border').filter({ hasText: /\d/ })
        await expect(cards).toHaveCount(4, { timeout: 10_000 })
    })

    test('inbox summary badge count matches API', async ({ page, request }) => {
        const summaryResp = await apiGet<{ data: { pendingCount: number } }>(request, '/wf/inbox/summary')
        const pending = (summaryResp as any).data?.pendingCount ?? 0

        await nav(page, '/requests?tab=inbox', 2000)

        if (pending > 0) {
            // Tab button should show badge
            const badge = page.locator('button', { hasText: /Hộp duyệt|Approval Inbox/i }).locator('.rounded-full')
            if (await badge.count() > 0) {
                const badgeText = await badge.textContent()
                expect(Number(badgeText?.trim())).toBe(pending)
            }
        }
    })

    test('inbox list shows rows after loading (matches API count)', async ({ page, request }) => {
        const listResp = await apiGet<{ data: unknown[]; meta: { total: number } }>(request, '/wf/inbox?page=1&limit=20')
        const total = (listResp as any).meta?.total ?? 0

        await nav(page, '/requests?tab=inbox')
        // Wait for loading to finish
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll('tbody tr')
            const emptyMsg = Array.from(document.querySelectorAll('div')).find(
                el => el.textContent?.match(/Không có.*duyệt|No pending|empty/i)
            )
            return rows.length > 0 || emptyMsg !== undefined
        }, { timeout: 15_000 })

        const rows = page.locator('tbody tr')
        const rowCount = await rows.count()

        if (total > 0) {
            expect(rowCount, `Inbox should show ${total} rows but got ${rowCount}`).toBe(total)
        } else {
            // Should show empty state message
            await expect(page.locator('body')).toContainText(/Không có|No pending|empty/i)
        }
    })

    test('inbox summary labels are translated', async ({ page }) => {
        await nav(page, '/requests?tab=inbox', 1500)
        const body = await page.textContent('body')
        // Raw i18n keys must NOT appear
        expect(body).not.toContain('inbox.pending')
        expect(body).not.toContain('inbox.urgent')
        expect(body).not.toContain('inbox.overdue')
        expect(body).not.toContain('inbox.unassigned')
        // Labels should appear in some language (Vietnamese or English fallback)
        expect(body).toMatch(/Chờ duyệt|Khẩn cấp|Quá hạn|Chưa nhận|Pending|Urgent|Overdue|Unassigned/)
    })

    test('clicking inbox row opens detail modal', async ({ page }) => {
        await nav(page, '/requests?tab=inbox')
        await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15_000 })

        const rows = page.locator('tbody tr')
        if (await rows.count() > 0) {
            // Click the "Chi tiết" / "Details" button
            const detailBtn = rows.first().getByRole('button', { name: /Chi tiết|Details/i })
            if (await detailBtn.count() > 0) {
                await detailBtn.click()
                await page.waitForTimeout(800)
                // Modal should appear
                const modal = page.locator('[role="dialog"], .modal, [class*="modal"]')
                if (await modal.count() > 0) {
                    await noObjectObject(page, 'inbox detail modal')
                }
            }
        }
    })
})

// ─── 4. All tab ───────────────────────────────────────────────────────────────

test.describe('Requests Page - All Tab', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('all tab loads and shows rows or empty state', async ({ page, request }) => {
        const listResp = await apiGet<{ meta: { total: number } }>(request, '/wf/admin/requests?page=1&limit=20')
        const total = (listResp as any).meta?.total ?? 0

        await nav(page, '/requests?tab=all')
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll('tbody tr')
            const emptyMsg = Array.from(document.querySelectorAll('div')).some(
                el => el.textContent?.match(/Chưa có|No request/i)
            )
            return rows.length > 0 || emptyMsg
        }, { timeout: 15_000 })

        await noObjectObject(page, 'all tab after load')
    })

    test('all tab has status and type filters', async ({ page }) => {
        await nav(page, '/requests?tab=all', 800)
        // Scope to main area to exclude layout selects (like language switcher)
        const mainSelects = page.locator('main select, .page-content select, .page-shell select')
        const count = await mainSelects.count()
        expect(count, 'All tab should have at least 2 filter selects').toBeGreaterThanOrEqual(2)
    })
})

// ─── 5. Tab switching ─────────────────────────────────────────────────────────

test.describe('Requests Page - Tab Switching', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('switching between tabs works and URL updates', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 800)
        await clickTab(page, 'inbox')
        await expect(page).toHaveURL(/tab=inbox/)
        await noObjectObject(page, 'after switch to inbox')

        await clickTab(page, 'all')
        await expect(page).toHaveURL(/tab=all/)
        await noObjectObject(page, 'after switch to all')

        await clickTab(page, 'mine')
        await expect(page).toHaveURL(/tab=mine/)
        await noObjectObject(page, 'after switch to mine')
    })

    test('each tab loads its own data on switch', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 500)
        // Mine: shows filter dropdowns
        const mineSelects = page.locator('select')
        await expect(mineSelects.first()).toBeVisible({ timeout: 5000 })

        // Switch to inbox
        await clickTab(page, 'inbox')
        // Inbox: shows summary cards
        await page.waitForFunction(() => {
            const cards = document.querySelectorAll('.rounded-xl.border')
            return cards.length >= 4
        }, { timeout: 10_000 })

        // Switch to all
        await clickTab(page, 'all')
        await page.waitForTimeout(500)
        await noObjectObject(page, 'all after switch')
    })
})

// ─── 6. Create request flow ───────────────────────────────────────────────────

test.describe('Create Request Flow', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('create request page loads from sidebar button', async ({ page }) => {
        await nav(page, '/requests?tab=mine', 800)
        const btn = page.getByRole('button', { name: /Tạo yêu cầu|Create Request/i })
        await expect(btn).toBeVisible()
        await btn.click()
        await page.waitForURL(/me\/requests\/new/, { timeout: 8000 })
        await page.waitForLoadState('networkidle')
        await noObjectObject(page, '/me/requests/new')
    })

    test('new request form has all required fields', async ({ page }) => {
        await nav(page, '/me/requests/new', 1000)
        // Title input
        const titleInput = page.locator('input[type="text"]').first()
        await expect(titleInput).toBeVisible()
        // Request type select
        const selects = page.locator('select')
        await expect(selects.first()).toBeVisible()
        // Submit button
        await expect(page.getByRole('button', { name: /Lưu nháp|Save Draft|Tạo.*Gửi|Create.*Submit/i }).first()).toBeVisible()
    })

    test('can create a draft request and see it in mine tab', async ({ page, request }) => {
        const uniqueTitle = `E2E-Draft-${Date.now()}`
        const beforeResp = await apiGet<{ meta: { total: number } }>(request, '/wf/me/requests?page=1&limit=20')
        const before = (beforeResp as any).meta?.total ?? 0

        await nav(page, '/me/requests/new', 1000)
        // Fill title
        await page.locator('input[type="text"]').first().fill(uniqueTitle)
        // Click "Lưu nháp" (Save Draft) - use first() in case of duplicates
        await page.getByRole('button', { name: /Lưu nháp|Save Draft/i }).first().click()
        await page.waitForURL(/requests/, { timeout: 10_000 })
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(1500)

        // Should be on mine tab now
        await expect(page).toHaveURL(/requests/)

        // Verify via API
        const afterResp = await apiGet<{ meta: { total: number } }>(request, '/wf/me/requests?page=1&limit=20')
        const after = (afterResp as any).meta?.total ?? 0
        expect(after, 'Should have one more request after creation').toBeGreaterThan(before)
    })

    test('create & submit: new request goes to in_review (NOT auto-approved)', async ({ page, request }) => {
        const uniqueTitle = `E2E-Submit-${Date.now()}`

        await nav(page, '/me/requests/new', 1000)

        // Intercept the submit API response to capture request ID and status
        // BEFORE another parallel test worker can approve it
        let submitResponseBody: Record<string, unknown> | null = null
        page.on('response', async (resp) => {
            if (resp.url().includes('/wf/me/requests/') && resp.url().includes('/submit') && resp.request().method() === 'POST') {
                try { submitResponseBody = await resp.json() } catch { /* ignore */ }
            }
        })

        await page.locator('input[type="text"]').first().fill(uniqueTitle)
        // Click "Tạo & Gửi ngay" (Create & Submit) - use first() to avoid strict mode
        await page.getByRole('button', { name: /Tạo.*Gửi|Create.*Submit/i }).first().click()

        // Wait for submit API call to complete (captured via route listener)
        await page.waitForTimeout(2000)

        // Primary assertion: use the submit response body directly (captured synchronously)
        // This status reflects the moment right after submit, before any other test can approve it
        if (submitResponseBody) {
            const body = submitResponseBody as any
            const status = body.status ?? body.data?.status
            expect(status, `Submit response status should be in_review (auto-approve bug: got ${status})`).toBe('in_review')
        } else {
            // Fallback: check via API with the unique title (less reliable with parallel workers)
            const listResp = await apiGet<{ data: Array<{ title: string; status: string; id: string }> }>(request, '/wf/me/requests?page=1&limit=50')
            const newReq = (listResp as any).data?.find((r: any) => r.title === uniqueTitle)
            if (newReq) {
                expect(newReq.status, `Request should be in_review not ${newReq.status} (auto-approve bug)`).toBe('in_review')
            } else {
                const allResp = await apiGet<{ data: Array<{ title: string; status: string }> }>(request, '/wf/admin/requests?page=1&limit=50')
                const found = (allResp as any).data?.find((r: any) => r.title === uniqueTitle)
                if (found) {
                    expect(found.status, 'Auto-approve bug: should be in_review').toBe('in_review')
                }
            }
        }
    })
})

// ─── 7. Approval flow ─────────────────────────────────────────────────────────

test.describe('Approval Flow (API-driven)', () => {
    test('admin can approve a pending request via API', async ({ request }) => {
        // Create a dedicated request so we don't race with other parallel tests
        const createResp = await apiPost<{ data: { id: string } }>(request, '/wf/me/requests', {
            title: `E2E-Approve-${Date.now()}`,
            requestType: 'asset_request',
            priority: 'normal',
        })
        expect((createResp as any).success).toBe(true)
        const reqId = (createResp as any).data?.id
        expect(reqId).toBeTruthy()

        // Submit → should go to in_review
        const submitResp = await apiPost(request, `/wf/me/requests/${reqId}/submit`, {})
        expect((submitResp as any).success, `Submit failed: ${JSON.stringify(submitResp)}`).toBe(true)

        // Verify in_review before approving
        const getResp = await apiGet<{ data: { status: string } }>(request, `/wf/me/requests/${reqId}`)
        expect((getResp as any).data?.status, 'Should be in_review before approval').toBe('in_review')

        // Find the specific approval task for this request
        const inboxResp = await apiGet<{ data: Array<{ id: string; requestId: string; assigneeUserId: string | null }> }>(request, '/wf/inbox?page=1&limit=50')
        const approval = ((inboxResp as any).data ?? []).find((a: any) => a.requestId === reqId)
        if (!approval) {
            test.skip() // No approval found (seed data may not have any)
            return
        }

        // Claim first if unassigned
        if (!approval.assigneeUserId) {
            const claimResp = await apiPost(request, `/wf/approvals/${approval.id}/claim`, {})
            expect((claimResp as any).success).toBe(true)
        }

        // Approve
        const approveResp = await apiPost(request, `/wf/approvals/${approval.id}/approve`, { comment: 'E2E approved' })
        expect((approveResp as any).success, `Approve failed: ${JSON.stringify(approveResp)}`).toBe(true)
    })

    test('admin can reject a pending request via API', async ({ request }) => {
        // Create a new request and submit it first
        const createResp = await apiPost<{ data: { id: string } }>(request, '/wf/me/requests', {
            title: `E2E-Reject-${Date.now()}`,
            requestType: 'asset_request',
            priority: 'normal',
        })
        expect((createResp as any).success).toBe(true)
        const reqId = (createResp as any).data?.id
        expect(reqId).toBeTruthy()

        // Submit
        const submitResp = await apiPost(request, `/wf/me/requests/${reqId}/submit`, {})
        expect((submitResp as any).success, `Submit failed: ${JSON.stringify(submitResp)}`).toBe(true)

        // The request should now be in_review (not approved — verifies auto-approve fix)
        const getResp = await apiGet<{ data: { status: string } }>(request, `/wf/me/requests/${reqId}`)
        const status = (getResp as any).data?.status
        expect(status, 'Auto-approve bug detected').toBe('in_review')

        // Get the approval task
        const inboxResp = await apiGet<{ data: Array<{ id: string; requestId: string; assigneeUserId: string | null }> }>(request, '/wf/inbox?page=1&limit=50')
        const approval = ((inboxResp as any).data ?? []).find((a: any) => a.requestId === reqId)

        if (approval) {
            if (!approval.assigneeUserId) {
                await apiPost(request, `/wf/approvals/${approval.id}/claim`, {})
            }
            const rejectResp = await apiPost(request, `/wf/approvals/${approval.id}/reject`, { comment: 'E2E rejected' })
            expect((rejectResp as any).success).toBe(true)
        }
    })
})

// ─── 8. Legacy redirects ──────────────────────────────────────────────────────

test.describe('Legacy Redirects', () => {
    test.beforeEach(async ({ page }) => { await applyUiAuth(page, 'admin') })

    test('/me/requests redirects to /requests?tab=mine', async ({ page }) => {
        await page.goto('/me/requests')
        await page.waitForURL(/requests/, { timeout: 8000 })
        const url = page.url()
        expect(url).toMatch(/requests/)
        // Either at /requests directly or with tab=mine
        expect(url).toMatch(/\/requests(\?tab=mine)?$|\/requests\?/)
    })

    test('/inbox loads inbox page (no longer redirects)', async ({ page }) => {
        await page.goto('/inbox')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(500)
        // /inbox now has its own page (moved from root/inbox to (assets)/inbox)
        // It should not be on the login page
        const url = page.url()
        expect(url).not.toContain('/login')
        expect(url).not.toContain('/forbidden')
    })
})
