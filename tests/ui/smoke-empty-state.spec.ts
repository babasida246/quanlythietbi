/**
 * smoke-empty-state.spec.ts
 *
 * Playwright smoke scan: duyệt qua các route chính sau khi seed,
 * đảm bảo UI không còn ở trạng thái "empty state" (màn hình trống).
 *
 * Chạy với: npx playwright test tests/ui/smoke-empty-state.spec.ts
 */
import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

// ── helpers ────────────────────────────────────────────────────────────────

/** Locators that signal an empty / no-data state */
const EMPTY_SIGNALS = [
    '.empty-state',
    '[data-testid="empty-state"]',
    '[data-testid="no-data"]',
]

/**
 * Texts that appear only when a list is genuinely empty.
 * We exclude partial phrases like "No data" that may appear in labels for loading.
 */
const EMPTY_TEXTS = [
    'Không có dữ liệu',
    'Không có tài sản',
    'Không có đơn sửa chữa nào',
    'Không có yêu cầu nào',
    'Chưa có dữ liệu',
    'Chưa có linh kiện',
    'No items found',
]

/**
 * Routes to scan.
 * Each entry: { path, label, minRows?, allowEmpty? }
 *
 * minRows: minimum number of visible table rows (<tr> inside <tbody>) expected.
 * allowEmpty: skip the empty-state assertion (e.g. detail pages that need params).
 */
const ROUTES: Array<{
    path: string
    label: string
    minRows?: number
    allowEmpty?: boolean
}> = [
        // Assets module
        { path: '/assets', label: 'Danh sách tài sản', minRows: 1 },
        { path: '/assets/catalogs', label: 'Danh mục (Catalogs)', minRows: 1 },
        // Inventory
        { path: '/inventory', label: 'Phiên kiểm kê', minRows: 0, allowEmpty: true },
        // Warehouse
        { path: '/warehouse/stock', label: 'Kho — tồn kho', minRows: 1 },
        { path: '/warehouse/warehouses', label: 'Kho — danh sách kho', minRows: 1 },
        { path: '/warehouse/documents', label: 'Kho — phiếu nhập/xuất', minRows: 0, allowEmpty: true },
        { path: '/warehouse/parts', label: 'Kho — linh kiện', minRows: 0, allowEmpty: true },
        { path: '/warehouse/reports', label: 'Kho — báo cáo', minRows: 0, allowEmpty: true },
        // CMDB
        { path: '/cmdb', label: 'CMDB — tổng quan', minRows: 1 },
        { path: '/cmdb/cis', label: 'CMDB — CIs', minRows: 1 },
        { path: '/cmdb/services', label: 'CMDB — Services', minRows: 1 },
        { path: '/cmdb/types', label: 'CMDB — CI Types', minRows: 1 },
        { path: '/cmdb/changes', label: 'CMDB — Changes', minRows: 0, allowEmpty: true },
        { path: '/cmdb/reports', label: 'CMDB — Reports', minRows: 0, allowEmpty: true },
        // Maintenance
        { path: '/maintenance', label: 'Bảo trì — phiếu', minRows: 0, allowEmpty: true },
        { path: '/maintenance/repairs', label: 'Bảo trì — đơn sửa chữa', minRows: 0, allowEmpty: true },
        // Requests & My space
        { path: '/requests', label: 'Yêu cầu', minRows: 0, allowEmpty: true },
        { path: '/me/assets', label: 'Tài sản của tôi', minRows: 0, allowEmpty: true },
        { path: '/me/requests', label: 'Yêu cầu của tôi', minRows: 0, allowEmpty: true },
        // Reports
        { path: '/reports/assets', label: 'Báo cáo tài sản', minRows: 0, allowEmpty: true },
        // Inbox & Notifications
        { path: '/inbox', label: 'Hộp thư', minRows: 0, allowEmpty: true },
        { path: '/notifications', label: 'Thông báo', minRows: 0, allowEmpty: true },
        // Purchase plans
        { path: '/assets/purchase-plans', label: 'Kế hoạch mua sắm (asset)', minRows: 0, allowEmpty: true },
        { path: '/warehouse/purchase-plans', label: 'Kế hoạch mua sắm (kho)', minRows: 0, allowEmpty: true },
        // Depreciation (module mới)
        { path: '/depreciation', label: 'Khấu hao tài sản', minRows: 0, allowEmpty: true },
    ]

// ── test suite ──────────────────────────────────────────────────────────────

test.describe('Smoke — không còn empty-state sau khi seed', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    // ── individual route tests ─────────────────────────────────────────────
    for (const route of ROUTES) {
        test(`${route.label} [${route.path}]`, async ({ page }) => {
            await page.goto(route.path)

            // Wait until network is idle (data fetched)
            await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
                // networkidle can time-out on SSE; continue anyway
            })

            // Đợi content render — không dùng hardcode timeout, dùng waitForFunction
            await page.waitForFunction(
                () => (document.body.textContent?.length ?? 0) > 50,
                { timeout: 10_000 }
            ).catch(() => { /* trang có thể không có text dài */ })

            if (!route.allowEmpty) {
                // 1. No empty-state CSS class / testid
                for (const selector of EMPTY_SIGNALS) {
                    const emptyEl = page.locator(selector).first()
                    const isVisible = await emptyEl.isVisible().catch(() => false)
                    expect(isVisible, `Empty-state element "${selector}" visible on ${route.path}`).toBe(false)
                }

                // 2. No empty-state text
                for (const text of EMPTY_TEXTS) {
                    const found = await page.locator(`text="${text}"`).first().isVisible().catch(() => false)
                    expect(found, `Empty text "${text}" visible on ${route.path}`).toBe(false)
                }
            }

            // 3. Minimum row count
            if ((route.minRows ?? 0) > 0) {
                const tbody = page.locator('tbody tr').first()
                await expect(tbody, `At least 1 table row on ${route.path}`).toBeVisible({ timeout: 8_000 })

                if (route.minRows! > 1) {
                    const count = await page.locator('tbody tr').count()
                    expect(count, `Expected ≥${route.minRows} rows on ${route.path}`).toBeGreaterThanOrEqual(route.minRows!)
                }
            }

            // 4. Page-level: no error boundary / JS crash
            const crashText = page.locator('text=/Internal Server Error|Unexpected error|HTTP 500|Error 500|failed to fetch/i')
            const crashed = await crashText.first().isVisible().catch(() => false)
            expect(crashed, `Error/crash text on ${route.path}`).toBe(false)
        })
    }

    // ── aggregated summary test ────────────────────────────────────────────
    test('Tổng hợp: tất cả route data-required không còn empty-state', async ({ page }) => {
        const results: Array<{ route: string; label: string; status: 'ok' | 'empty' | 'error' }> = []

        const dataRoutes = ROUTES.filter((r) => !r.allowEmpty && (r.minRows ?? 0) > 0)

        for (const route of dataRoutes) {
            try {
                await applyUiAuth(page, 'admin')
                await page.goto(route.path)
                await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => { })
                await page.waitForTimeout(600)

                let isEmpty = false
                for (const sel of EMPTY_SIGNALS) {
                    if (await page.locator(sel).first().isVisible().catch(() => false)) {
                        isEmpty = true
                        break
                    }
                }
                if (!isEmpty) {
                    for (const text of EMPTY_TEXTS) {
                        if (await page.locator(`text="${text}"`).first().isVisible().catch(() => false)) {
                            isEmpty = true
                            break
                        }
                    }
                }

                const tbody = page.locator('tbody tr').first()
                const hasRows = await tbody.isVisible({ timeout: 3_000 }).catch(() => false)

                results.push({
                    route: route.path,
                    label: route.label,
                    status: isEmpty || !hasRows ? 'empty' : 'ok',
                })
            } catch (err) {
                results.push({ route: route.path, label: route.label, status: 'error' })
            }
        }

        // Print summary table
        console.log('\n📊 Smoke scan kết quả:\n')
        console.log('Route'.padEnd(35) + 'Status')
        console.log('─'.repeat(50))
        for (const r of results) {
            const icon = r.status === 'ok' ? '✅' : r.status === 'empty' ? '❌' : '⚠️ '
            console.log(`${r.route.padEnd(35)} ${icon} ${r.label}`)
        }

        const failed = results.filter((r) => r.status !== 'ok')
        if (failed.length > 0) {
            console.log(`\n❌ ${failed.length} route vẫn còn empty-state:\n`)
            failed.forEach((r) => console.log(`  - ${r.route} (${r.label})`))
        } else {
            console.log('\n✅ Tất cả route đều có dữ liệu!\n')
        }

        expect(failed, `${failed.length} route còn empty-state: ${failed.map((r) => r.route).join(', ')}`).toHaveLength(0)
    })
})
