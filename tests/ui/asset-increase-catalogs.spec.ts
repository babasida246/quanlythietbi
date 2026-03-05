/**
 * Asset Increase & Catalogs Flow Tests
 * Covers: /assets/asset-increases/new, /assets/catalogs — deeper CRUD
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

test.describe('Asset Increase & Catalogs', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    // ── Asset Increase ──

    test('asset increase page loads form', async ({ page }) => {
        await goto(page, '/assets/asset-increases/new')
        await assertNoObjectObject(page, '/assets/asset-increases/new')

        // Should have form fields
        const inputs = page.locator('input, select, textarea')
        const count = await inputs.count()
        expect(count).toBeGreaterThanOrEqual(1)
    })

    test('asset increase form has selectable options', async ({ page }) => {
        await goto(page, '/assets/asset-increases/new')

        const selects = page.locator('select')
        const selectCount = await selects.count()
        if (selectCount > 0) {
            // At least first select should have options after data load
            const firstSelect = selects.first()
            await expect
                .poll(async () => firstSelect.locator('option').count(), { timeout: 10_000 })
                .toBeGreaterThan(1)
        }
    })

    // ── Catalogs ──

    test('catalogs page loads with seeded data', async ({ page }) => {
        await goto(page, '/assets/catalogs')
        await assertNoObjectObject(page, '/assets/catalogs')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('catalogs page has vendor/category tabs or sections', async ({ page }) => {
        await goto(page, '/assets/catalogs')

        // Look for tabs (vendors, categories, suppliers, etc.)
        const tabs = page.locator(
            '[role="tab"], button:has-text("vendor"), button:has-text("category"), button:has-text("supplier"), button:has-text("Vendor"), button:has-text("Category")'
        )
        const tabCount = await tabs.count()
        if (tabCount > 0) {
            for (let i = 0; i < Math.min(tabCount, 4); i++) {
                await tabs.nth(i).click()
                await page.waitForTimeout(500)
                await assertNoObjectObject(page, `/assets/catalogs tab ${i}`)
            }
        }
    })

    test('catalogs create button opens dialog', async ({ page }) => {
        await goto(page, '/assets/catalogs')

        const createBtn = page.getByTestId('btn-create')
        if ((await createBtn.count()) > 0) {
            await createBtn.click()
            const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first()
            if ((await dialog.count()) > 0) {
                await expect(dialog).toBeVisible({ timeout: 5_000 })
                const dialogText = await dialog.textContent()
                expect(dialogText).not.toContain('[object Object]')
                // Cancel
                const cancelBtn = page.getByTestId('btn-cancel')
                    .or(dialog.getByRole('button', { name: /cancel|close/i }))
                if ((await cancelBtn.count()) > 0) {
                    await cancelBtn.first().click()
                } else {
                    await page.keyboard.press('Escape')
                }
            }
        }
    })

    // ── Inventory ──

    test('inventory list page loads with seeded data', async ({ page }) => {
        await goto(page, '/inventory')
        await assertNoObjectObject(page, '/inventory')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('inventory detail page loads from list', async ({ page }) => {
        await goto(page, '/inventory')

        const firstLink = page.locator('tbody tr a, tbody tr [data-testid*="detail"]').first()
        if ((await firstLink.count()) > 0) {
            await firstLink.click()
            await page.waitForTimeout(2000)
            await assertNoObjectObject(page, 'inventory detail')
            expect(page.url()).toMatch(/\/inventory\//)
        }
    })
})
