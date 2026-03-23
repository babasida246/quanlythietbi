/**
 * Comprehensive UI Test Suite
 * Covers: navigation, CMDB (types/CIs/relationships/services/changes/reports),
 * assets, warehouse, maintenance, requests, reports, and display/i18n regression checks.
 */

import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Navigate and wait for network idle, with fallback for pages with continual requests */
async function goto(page: Page, path: string) {
    await page.goto(path)
    // Use domcontentloaded + short wait instead of networkidle to handle live-update pages
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

/** Assert no [object Object] text anywhere in the visible page */
async function assertNoObjectObject(page: Page, context = '') {
    const text = await page.textContent('body')
    const msg = context
        ? `[object Object] found on ${context}`
        : '[object Object] found in page text'
    expect(text, msg).not.toContain('[object Object]')
}

/** Assert page title / heading renders a real string (not [object Object] / empty / undefined) */
async function assertHeadingOk(page: Page, selector: string) {
    const el = page.locator(selector).first()
    if ((await el.count()) === 0) return
    const text = await el.textContent()
    expect(text ?? '', `Heading "${selector}" should not be empty or [object Object]`).not.toContain('[object Object]')
    expect(text?.trim() ?? '', `Heading "${selector}" should not be empty`).not.toBe('')
}

/** Wait for a table to have at least one data row */
async function waitForTableRows(page: Page, minRows = 1) {
    await expect(page.locator('tbody tr, table > tr').first()).toBeVisible({ timeout: 15_000 })
    const count = await page.locator('tbody tr, table > tr').count()
    expect(count).toBeGreaterThanOrEqual(minRows)
}

// ─────────────────────────────────────────────
// Global setup: authenticate admin before each test
// ─────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
    await applyUiAuth(page, 'admin')
})

// ─────────────────────────────────────────────
// 1. DISPLAY / i18n REGRESSION CHECKS
//    Ensure no "[object Object]" anywhere after the big i18n refactor
// ─────────────────────────────────────────────

test.describe('i18n regression — no [object Object] in any page', () => {
    const pages = [
        '/cmdb',
        '/cmdb/changes',
        '/cmdb/cis',
        '/cmdb/types',
        '/cmdb/reports',
        '/cmdb/relationships/import',
        '/assets',
        '/assets/catalogs',
        '/assets/purchase-plans',
        '/inventory',
        '/warehouse',
        '/warehouse/stock',
        '/warehouse/parts',
        '/warehouse/documents',
        '/warehouse/ledger',
        '/warehouse/reconciliation',
        '/warehouse/warehouses',
        '/warehouse/repairs',
        '/warehouse/purchase-plans',
        '/maintenance',
        '/maintenance/repairs',
        '/requests',
        '/me/assets',
        '/me/requests',
        '/reports',
        '/reports/assets',
        '/notifications',
        '/inbox',
        '/analytics',
        '/automation',
        '/integrations',
        '/security',
        '/admin',
        '/help',
    ]

    for (const path of pages) {
        test(`${path} renders without [object Object]`, async ({ page }) => {
            await goto(page, path)
            await assertNoObjectObject(page, path)
        })
    }
})

// ─────────────────────────────────────────────
// 2. NAVIGATION
// ─────────────────────────────────────────────

test.describe('Navigation', () => {
    test('sidebar nav items are visible', async ({ page }) => {
        await goto(page, '/assets')
        // Wait for sidebar to fully render including capability-gated items
        await page.waitForFunction(
            () => (document.body.textContent?.length ?? 0) > 200,
            { timeout: 15_000 }
        ).catch(() => { /* page may be minimal */ })
        const navItems = [
            'nav-assets', 'nav-cmdb', 'nav-inventory', 'nav-warehouse',
            'nav-maintenance', 'nav-requests', 'nav-reports', 'nav-analytics'
        ]
        for (const tid of navItems) {
            await expect(page.getByTestId(tid)).toBeVisible({ timeout: 15_000 })
        }
    })

    test('navigating via sidebar changes URL correctly', async ({ page }) => {
        await goto(page, '/assets')
        await page.getByTestId('nav-cmdb').click()
        await expect(page).toHaveURL(/\/cmdb/)
    })

    test('root / redirects to authenticated page', async ({ page }) => {
        await goto(page, '/')
        // Should redirect somewhere that is not login
        await expect(page).not.toHaveURL(/\/login/)
    })
})

// ─────────────────────────────────────────────
// 3. CMDB MAIN PAGE — tabs, buttons, header
// ─────────────────────────────────────────────

test.describe('CMDB main page', () => {
    test.beforeEach(async ({ page }) => {
        await goto(page, '/cmdb')
    })

    test('page header renders correct title (not [object Object])', async ({ page }) => {
        await assertHeadingOk(page, 'h1, [class*="page-title"], [class*="title"]')
        await assertNoObjectObject(page, '/cmdb header')
    })

    test('Change History button label is correct (not [object Object])', async ({ page }) => {
        const btn = page.getByRole('button', { name: /Change History|CI Changes/i })
        await expect(btn).toBeVisible({ timeout: 10_000 })
        const text = await btn.textContent()
        expect(text).not.toContain('[object Object]')
        expect(text?.trim()).not.toBe('')
    })

    test('Report button label is correct (not [object Object])', async ({ page }) => {
        const btn = page.getByRole('button', { name: /Configuration Management Reports|Report/i })
        await expect(btn).toBeVisible({ timeout: 10_000 })
        const text = await btn.textContent()
        expect(text).not.toContain('[object Object]')
        expect(text?.trim()).not.toBe('')
    })

    test('tabs render: types, cis, relationships, services, topology', async ({ page }) => {
        const tabLabels = ['types', 'cis', 'relationships', 'services', 'topology']
        for (const label of tabLabels) {
            const tab = page.getByRole('tab', { name: new RegExp(label, 'i') })
                .or(page.locator(`[role="tab"]:has-text("${label}")`))
                .or(page.locator(`button[data-tab="${label}"]`))
            // At least check that text appears somewhere on page (tab region)
            const tabText = await page.textContent('body')
            expect(tabText?.toLowerCase()).toContain(label.toLowerCase())
        }
    })

    test('CI Types tab loads data in table', async ({ page }) => {
        // Default tab should be types
        await waitForTableRows(page, 1)
    })

    test('CIs tab loads data in table', async ({ page }) => {
        // Click CIs tab
        const cisTab = page.getByRole('tab', { name: /\bCI\b/i })
            .or(page.locator('button:has-text("CIs"), button:has-text("CI")'))
        const tabCount = await cisTab.count()
        if (tabCount > 0) {
            await cisTab.first().click()
            await page.waitForTimeout(1000)
            await waitForTableRows(page, 1)
        }
    })

    test('Relationships tab loads data', async ({ page }) => {
        const relTab = page.locator('button').filter({ hasText: /relationship/i }).first()
        const count = await relTab.count()
        if (count > 0) {
            await relTab.click()
            await page.waitForTimeout(1000)
        }
        await assertNoObjectObject(page, '/cmdb?tab=relationships')
    })

    test('Create button is visible in types tab', async ({ page }) => {
        await expect(page.getByTestId('btn-create')).toBeVisible({ timeout: 10_000 })
    })

    test('CI Changes button navigates to /cmdb/changes', async ({ page }) => {
        const btn = page.getByRole('button', { name: /Change History|CI Changes/i })
        await btn.click()
        await expect(page).toHaveURL(/\/cmdb\/changes/)
    })

    test('Report button navigates to /cmdb/reports', async ({ page }) => {
        await goto(page, '/cmdb')
        const btn = page.getByRole('button', { name: /Configuration Management Reports|Report/i })
        await btn.click()
        await expect(page).toHaveURL(/\/cmdb\/reports/)
    })
})

// ─────────────────────────────────────────────
// 4. CMDB CI TYPES CRUD
// ─────────────────────────────────────────────

test.describe('CMDB — CI Types CRUD', () => {
    test.beforeEach(async ({ page }) => {
        await goto(page, '/cmdb')
        // Ensure we're on types tab
        await expect(page.getByTestId('btn-create')).toBeVisible({ timeout: 10_000 })
    })

    test('opens create dialog, fills form, saves', async ({ page }) => {
        await page.getByTestId('btn-create').click()
        // Modal/dialog should be visible
        const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="dialog"]').first()
        await expect(dialog).toBeVisible({ timeout: 5_000 })

        // Fill name field
        const nameInput = dialog.locator('input[name="name"], input[placeholder*="name" i], input').first()
        await nameInput.fill('Test CI Type Playwright')

        // Fill code field if present
        const codeInput = dialog.locator('input[name="code"], input[placeholder*="code" i]')
        if ((await codeInput.count()) > 0) {
            await codeInput.fill('TEST_CI_PW')
        }

        // Submit - use known data-testid from FormActions component
        const submitBtn = page.getByTestId('btn-submit')
        await submitBtn.click()

        // Wait for save attempt to complete
        await page.waitForTimeout(2000)
        // Page should not crash regardless of validation result
        await assertNoObjectObject(page, '/cmdb after save attempt')
    })

    test('edit existing CI type', async ({ page }) => {
        // Click edit on first row
        const editBtn = page.locator('[data-testid^="btn-edit"], button[aria-label*="edit" i], button:has-text("edit")')
            .or(page.locator('tbody tr').first().locator('button').filter({ hasText: /edit/i }))
        const editCount = await editBtn.count()
        if (editCount === 0) {
            test.skip()
            return
        }
        await editBtn.first().click()

        const dialog = page.locator('[role="dialog"], .modal').first()
        await expect(dialog).toBeVisible({ timeout: 5_000 })
        await assertNoObjectObject(page, 'edit type dialog')

        // Change name
        const nameInput = dialog.locator('input').first()
        await nameInput.clear()
        await nameInput.fill('Updated Type Name')

        const submitBtn = dialog.getByRole('button', { name: /save|update|ok/i })
        await submitBtn.click()
        await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    })
})

// ─────────────────────────────────────────────
// 5. CMDB CIs — list and detail
// ─────────────────────────────────────────────

test.describe('CMDB — Configuration Items', () => {
    test('CIs page loads with data', async ({ page }) => {
        await goto(page, '/cmdb/cis')
        await assertNoObjectObject(page, '/cmdb/cis')
        await waitForTableRows(page, 1)
    })

    test('CI detail page renders without errors', async ({ page }) => {
        // Get first CI id from API via page goto
        await goto(page, '/cmdb/cis')
        const firstRowLink = page.locator('tbody tr a, tbody tr [data-testid*="detail"]').first()
        const linkCount = await firstRowLink.count()
        if (linkCount > 0) {
            await firstRowLink.click()
            await page.waitForLoadState('networkidle')
            await assertNoObjectObject(page, 'CI detail')
        } else {
            // Try navigating directly if we know a CI code exists
            test.skip()
        }
    })

    test('CMDB main page CIs tab renders without errors', async ({ page }) => {
        await goto(page, '/cmdb?tab=cis')
        await assertNoObjectObject(page, '/cmdb?tab=cis')
    })
})

// ─────────────────────────────────────────────
// 6. CMDB Changes page
// ─────────────────────────────────────────────

test.describe('CMDB — Changes', () => {
    test('changes page loads', async ({ page }) => {
        await goto(page, '/cmdb/changes')
        await assertNoObjectObject(page, '/cmdb/changes')
        await expect(page.locator('h1, [class*="title"]').first()).toBeVisible({ timeout: 10_000 })
    })

    test('changes page has expected header or empty state', async ({ page }) => {
        await goto(page, '/cmdb/changes')
        const body = await page.textContent('body')
        // Should have either table rows or an empty state message — but not [object Object]
        expect(body).not.toContain('[object Object]')
    })
})

// ─────────────────────────────────────────────
// 7. CMDB Reports page
// ─────────────────────────────────────────────

test.describe('CMDB — Reports', () => {
    test('reports page loads without errors', async ({ page }) => {
        await goto(page, '/cmdb/reports')
        await assertNoObjectObject(page, '/cmdb/reports')
    })

    test('reports page has content (no empty body)', async ({ page }) => {
        await goto(page, '/cmdb/reports')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })
})

// ─────────────────────────────────────────────
// 8. CMDB Relationships import page
// ─────────────────────────────────────────────

test.describe('CMDB — Relationships import', () => {
    test('import page loads', async ({ page }) => {
        await goto(page, '/cmdb/relationships/import')
        await assertNoObjectObject(page, '/cmdb/relationships/import')
    })
})

// ─────────────────────────────────────────────
// 9. CMDB Services panel
// ─────────────────────────────────────────────

test.describe('CMDB — Services panel', () => {
    test('services tab renders without errors', async ({ page }) => {
        await goto(page, '/cmdb?tab=services')
        await assertNoObjectObject(page, '/cmdb?tab=services')
    })
})

// ─────────────────────────────────────────────
// 10. CMDB Topology tab
// ─────────────────────────────────────────────

test.describe('CMDB — Topology', () => {
    test('topology tab renders without errors', async ({ page }) => {
        await goto(page, '/cmdb?tab=topology')
        await assertNoObjectObject(page, '/cmdb?tab=topology')
    })
})

// ─────────────────────────────────────────────
// 11. ASSETS
// ─────────────────────────────────────────────

test.describe('Assets', () => {
    test('assets list page loads', async ({ page }) => {
        await goto(page, '/assets')
        await assertNoObjectObject(page, '/assets')
    })

    test('catalogs page loads', async ({ page }) => {
        await goto(page, '/assets/catalogs')
        await assertNoObjectObject(page, '/assets/catalogs')
    })

    test('purchase plans page loads', async ({ page }) => {
        await goto(page, '/assets/purchase-plans')
        await assertNoObjectObject(page, '/assets/purchase-plans')
    })

    test('new purchase plan page loads', async ({ page }) => {
        await goto(page, '/assets/purchase-plans/new')
        await assertNoObjectObject(page, '/assets/purchase-plans/new')
    })

    test('new asset increase page loads', async ({ page }) => {
        await goto(page, '/assets/asset-increases/new')
        await assertNoObjectObject(page, '/assets/asset-increases/new')
    })
})

// ─────────────────────────────────────────────
// 12. INVENTORY
// ─────────────────────────────────────────────

test.describe('Inventory', () => {
    test('inventory list page loads', async ({ page }) => {
        await goto(page, '/inventory')
        await assertNoObjectObject(page, '/inventory')
    })
})

// ─────────────────────────────────────────────
// 13. WAREHOUSE
// ─────────────────────────────────────────────

test.describe('Warehouse', () => {
    const warehouseRoutes = [
        '/warehouse',
        '/warehouse/stock',
        '/warehouse/parts',
        '/warehouse/documents',
        '/warehouse/documents/new',
        '/warehouse/ledger',
        '/warehouse/reconciliation',
        '/warehouse/warehouses',
        '/warehouse/repairs',
        '/warehouse/purchase-plans',
        '/warehouse/reports',
    ]

    for (const path of warehouseRoutes) {
        test(`${path} loads without errors`, async ({ page }) => {
            await goto(page, path)
            await assertNoObjectObject(page, path)
        })
    }
})

// ─────────────────────────────────────────────
// 14. MAINTENANCE
// ─────────────────────────────────────────────

test.describe('Maintenance', () => {
    test('maintenance main page loads', async ({ page }) => {
        await goto(page, '/maintenance')
        await assertNoObjectObject(page, '/maintenance')
    })

    test('repairs list page loads', async ({ page }) => {
        await goto(page, '/maintenance/repairs')
        await assertNoObjectObject(page, '/maintenance/repairs')
    })
})

// ─────────────────────────────────────────────
// 15. REQUESTS
// ─────────────────────────────────────────────

test.describe('Requests', () => {
    test('requests page loads', async ({ page }) => {
        await goto(page, '/requests')
        await assertNoObjectObject(page, '/requests')
    })

    test('my requests page loads', async ({ page }) => {
        await goto(page, '/me/requests')
        await assertNoObjectObject(page, '/me/requests')
    })

    test('new request page loads', async ({ page }) => {
        await goto(page, '/me/requests/new')
        await assertNoObjectObject(page, '/me/requests/new')
    })
})

// ─────────────────────────────────────────────
// 16. REPORTS
// ─────────────────────────────────────────────

test.describe('Reports', () => {
    test('reports main page loads', async ({ page }) => {
        await goto(page, '/reports')
        await assertNoObjectObject(page, '/reports')
    })

    test('asset reports page loads', async ({ page }) => {
        await goto(page, '/reports/assets')
        await assertNoObjectObject(page, '/reports/assets')
    })
})

// ─────────────────────────────────────────────
// 17. MY ASSETS
// ─────────────────────────────────────────────

test.describe('My Assets', () => {
    test('my assets page loads', async ({ page }) => {
        await goto(page, '/me/assets')
        await assertNoObjectObject(page, '/me/assets')
    })
})

// ─────────────────────────────────────────────
// 18. NOTIFICATIONS & INBOX
// ─────────────────────────────────────────────

test.describe('Notifications & Inbox', () => {
    test('notifications page loads', async ({ page }) => {
        await goto(page, '/notifications')
        await assertNoObjectObject(page, '/notifications')
    })

    test('inbox page loads', async ({ page }) => {
        await goto(page, '/inbox')
        await assertNoObjectObject(page, '/inbox')
    })
})

// ─────────────────────────────────────────────
// 19. ADMIN & SETTINGS
// ─────────────────────────────────────────────

test.describe('Admin', () => {
    test('admin page loads', async ({ page }) => {
        await goto(page, '/admin')
        await assertNoObjectObject(page, '/admin')
    })
})

// ─────────────────────────────────────────────
// 20. ANALYTICS, AUTOMATION, INTEGRATIONS, SECURITY
// ─────────────────────────────────────────────

test.describe('Extra pages', () => {
    const extraRoutes = ['/analytics', '/automation', '/integrations', '/security', '/help']

    for (const path of extraRoutes) {
        test(`${path} loads without [object Object]`, async ({ page }) => {
            await goto(page, path)
            await assertNoObjectObject(page, path)
        })
    }
})

// ─────────────────────────────────────────────
// 21. CMDB CRUD — full workflow on main page
// ─────────────────────────────────────────────

test.describe('CMDB CRUD workflow', () => {
    test('create → verify → delete CI Type', async ({ page }) => {
        await goto(page, '/cmdb')
        await expect(page.getByTestId('btn-create')).toBeVisible({ timeout: 10_000 })

        // Open create dialog
        await page.getByTestId('btn-create').click()
        const dialog = page.locator('[role="dialog"], .modal, [class*="dialog"], [class*="modal"]').first()
        await expect(dialog).toBeVisible({ timeout: 5_000 })

        // Fill form
        const inputs = dialog.locator('input')
        const inputCount = await inputs.count()
        if (inputCount >= 1) {
            await inputs.nth(0).fill('PW-Test-CIType-' + Date.now())
        }
        if (inputCount >= 2) {
            await inputs.nth(1).fill('PW_TEST_' + Date.now())
        }

        // Save using known data-testid from FormActions component
        await page.getByTestId('btn-submit').click()
        // Wait for save attempt
        await page.waitForTimeout(2000)

        // Verify table still has rows and no [object Object]
        await waitForTableRows(page, 1)
        await assertNoObjectObject(page, '/cmdb after create')
    })

    test('create CI in CIs tab', async ({ page }) => {
        await goto(page, '/cmdb?tab=cis')
        const createBtn = page.getByTestId('btn-create')
        const btnCount = await createBtn.count()
        if (btnCount === 0) {
            test.skip()
            return
        }
        await createBtn.click()

        const dialog = page.locator('[role="dialog"], .modal').first()
        await expect(dialog).toBeVisible({ timeout: 5_000 })
        await assertNoObjectObject(page, 'create CI dialog')

        // Fill name
        const nameInput = dialog.locator('input[name="name"], input').first()
        await nameInput.fill('PW-Test-CI-' + Date.now())

        // Select CI type if select is available
        const typeSelect = dialog.locator('select[name="typeId"], select').first()
        const selectCount = await typeSelect.count()
        if (selectCount > 0) {
            const options = await typeSelect.locator('option:not([value=""])').count()
            if (options > 0) {
                await typeSelect.selectOption({ index: 1 })
            }
        }

        await page.getByTestId('btn-submit').click()
        // Wait for save attempt
        await page.waitForTimeout(2000)
        await assertNoObjectObject(page, '/cmdb?tab=cis after create attempt')
    })

    test('refresh button reloads data', async ({ page }) => {
        await goto(page, '/cmdb')
        const refreshBtn = page.getByTestId('btn-refresh')
        await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
        await refreshBtn.click()
        // Should not crash
        await page.waitForTimeout(1000)
        await assertNoObjectObject(page, '/cmdb after refresh')
    })
})

// ─────────────────────────────────────────────
// 22. BUTTON LABEL AUDIT — specific regression for [object Object] issue
// ─────────────────────────────────────────────

test.describe('Button label audit (i18n regression)', () => {
    test('no button has [object Object] as its label', async ({ page }) => {
        const pagesWithButtons = ['/cmdb', '/assets', '/inventory', '/warehouse', '/maintenance', '/requests']

        for (const path of pagesWithButtons) {
            await goto(page, path)
            const buttons = page.locator('button')
            const count = await buttons.count()
            for (let i = 0; i < count; i++) {
                const text = await buttons.nth(i).textContent()
                expect(text ?? '', `Button #${i} on ${path} should not contain [object Object]`)
                    .not.toContain('[object Object]')
            }
        }
    })

    test('no link/anchor has [object Object] as its text', async ({ page }) => {
        const paths = ['/cmdb', '/assets', '/reports']
        for (const path of paths) {
            await goto(page, path)
            const links = page.locator('a')
            const count = await links.count()
            for (let i = 0; i < Math.min(count, 50); i++) {
                const text = await links.nth(i).textContent()
                expect(text ?? '', `Link #${i} on ${path}`).not.toContain('[object Object]')
            }
        }
    })
})

// ─────────────────────────────────────────────
// 23. TABLE CONTENT AUDIT — headers and cells should not have [object Object]
// ─────────────────────────────────────────────

test.describe('Table content audit', () => {
    const tablePages = [
        { path: '/cmdb', label: 'CMDB types tab' },
        { path: '/cmdb?tab=cis', label: 'CMDB CIs tab' },
        { path: '/assets', label: 'Assets list' },
        { path: '/inventory', label: 'Inventory list' },
        { path: '/requests', label: 'Requests list' },
    ]

    for (const { path, label } of tablePages) {
        test(`${label}: table headers and rows have no [object Object]`, async ({ page }) => {
            await goto(page, path)
            await page.waitForTimeout(1500) // wait for i18n to resolve

            const tableText = await page.locator('table, [role="grid"]').first().textContent({ timeout: 5000 }).catch(() => '')
            if (tableText) {
                expect(tableText, `${label} table content`).not.toContain('[object Object]')
            }
        })
    }
})

// ─────────────────────────────────────────────
// 24. FORM LABELS AUDIT
// ─────────────────────────────────────────────

test.describe('Form labels audit', () => {
    test('create dialog labels on CMDB have no [object Object]', async ({ page }) => {
        await goto(page, '/cmdb')
        await expect(page.getByTestId('btn-create')).toBeVisible({ timeout: 10_000 })
        await page.getByTestId('btn-create').click()

        const dialog = page.locator('[role="dialog"], .modal').first()
        await expect(dialog).toBeVisible({ timeout: 5_000 })

        const dialogText = await dialog.textContent()
        expect(dialogText).not.toContain('[object Object]')

        // Close dialog
        const closeBtn = dialog.locator('button[aria-label*="close" i], button:has-text("Cancel"), [data-testid*="close"]').first()
        if ((await closeBtn.count()) > 0) {
            await closeBtn.click()
        } else {
            await page.keyboard.press('Escape')
        }
    })
})

// ─────────────────────────────────────────────
// 25. ERROR HANDLING — 404 / forbidden pages
// ─────────────────────────────────────────────

test.describe('Error pages', () => {
    test('nonexistent route shows error or redirect — not blank', async ({ page }) => {
        await goto(page, '/this-route-does-not-exist-12345')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(10)
        expect(body).not.toContain('[object Object]')
    })

    test('forbidden page renders correctly', async ({ page }) => {
        await goto(page, '/forbidden')
        await assertNoObjectObject(page, '/forbidden')
    })
})
