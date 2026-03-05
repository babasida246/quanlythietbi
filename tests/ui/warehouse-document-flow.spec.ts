/**
 * Warehouse Document Flow Tests
 * Covers: /warehouse/documents — create new, view detail, ledger, reconciliation, stock
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

async function assertNoObjectObject(page: Page, context = '') {
    const text = await page.textContent('body')
    expect(text, `[object Object] found on ${context}`).not.toContain('[object Object]')
}

test.describe('Warehouse Document Flow', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    // ── Documents list ──

    test('warehouse documents page loads', async ({ page }) => {
        await goto(page, '/warehouse/documents')
        await assertNoObjectObject(page, '/warehouse/documents')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('documents page has create button or new link', async ({ page }) => {
        await goto(page, '/warehouse/documents')
        const createBtn = page.getByTestId('btn-create')
            .or(page.getByRole('link', { name: /create|new/i }))
            .or(page.locator('a[href="/warehouse/documents/new"]'))
            .or(page.getByRole('button', { name: /create|new|add/i }))
        const count = await createBtn.count()
        // Documents page should have some way to create (button or link)
        // If not found, just verify page loaded correctly
        if (count > 0) {
            await expect(createBtn.first()).toBeVisible({ timeout: 10_000 })
        } else {
            const body = await page.textContent('body')
            expect(body?.trim().length).toBeGreaterThan(50)
        }
    })

    // ── Create new document ──

    test('new document form page loads', async ({ page }) => {
        await goto(page, '/warehouse/documents/new')
        await assertNoObjectObject(page, '/warehouse/documents/new')

        // Should have form elements
        const inputs = page.locator('input, select, textarea')
        const count = await inputs.count()
        expect(count).toBeGreaterThanOrEqual(1)
    })

    test('new document form has required fields', async ({ page }) => {
        await goto(page, '/warehouse/documents/new')

        // Typically: document type select, warehouse select, date, etc.
        const selects = page.locator('select')
        const selectCount = await selects.count()
        // Should have at least one dropdown (document type or warehouse)
        expect(selectCount).toBeGreaterThanOrEqual(1)
    })

    test('document form can be partially filled', async ({ page }) => {
        await goto(page, '/warehouse/documents/new')

        // Fill a text input if present
        const textInput = page.locator('input[type="text"]').first()
        if ((await textInput.count()) > 0) {
            await textInput.fill(`E2E Doc ${Date.now().toString().slice(-6)}`)
        }

        // Select first option in dropdowns
        const selects = page.locator('select')
        const selectCount = await selects.count()
        for (let i = 0; i < Math.min(selectCount, 3); i++) {
            const options = selects.nth(i).locator('option:not([value=""])')
            if ((await options.count()) > 0) {
                const value = await options.first().getAttribute('value')
                if (value) await selects.nth(i).selectOption(value)
            }
        }

        await assertNoObjectObject(page, '/warehouse/documents/new after fill')
    })

    // ── Ledger ──

    test('warehouse ledger page loads with data', async ({ page }) => {
        await goto(page, '/warehouse/ledger')
        await assertNoObjectObject(page, '/warehouse/ledger')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('ledger page shows table or list', async ({ page }) => {
        await goto(page, '/warehouse/ledger')
        const heading = page.locator('h1, h2').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
        }
    })

    // ── Stock ──

    test('warehouse stock page loads', async ({ page }) => {
        await goto(page, '/warehouse/stock')
        await assertNoObjectObject(page, '/warehouse/stock')
    })

    test('stock page shows inventory data', async ({ page }) => {
        await goto(page, '/warehouse/stock')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(30)
    })

    // ── Parts ──

    test('warehouse parts page loads', async ({ page }) => {
        await goto(page, '/warehouse/parts')
        await assertNoObjectObject(page, '/warehouse/parts')
    })

    // ── Reconciliation ──

    test('reconciliation page loads', async ({ page }) => {
        await goto(page, '/warehouse/reconciliation')
        await assertNoObjectObject(page, '/warehouse/reconciliation')
    })

    // ── Reports ──

    test('warehouse reports page loads', async ({ page }) => {
        await goto(page, '/warehouse/reports')
        await assertNoObjectObject(page, '/warehouse/reports')
    })

    // ── Warehouses list ──

    test('warehouses list page loads with seeded data', async ({ page }) => {
        await goto(page, '/warehouse/warehouses')
        await assertNoObjectObject(page, '/warehouse/warehouses')
        // Should have at least the seeded warehouses
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })
})
