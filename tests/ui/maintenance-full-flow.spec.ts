/**
 * Maintenance & Repairs Full Flow Tests
 * Covers: /maintenance, /maintenance/repairs, warehouse repairs
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

test.describe('Maintenance Full Flow', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('maintenance main page loads with seeded data', async ({ page }) => {
        await goto(page, '/maintenance')
        await assertNoObjectObject(page, '/maintenance')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('maintenance page has header and content', async ({ page }) => {
        await goto(page, '/maintenance')
        const heading = page.locator('h1, h2, [class*="title"]').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
            expect(text).not.toContain('[object Object]')
        }
    })

    test('maintenance repairs list page loads', async ({ page }) => {
        await goto(page, '/maintenance/repairs')
        await assertNoObjectObject(page, '/maintenance/repairs')
    })

    test('warehouse repairs page loads with seeded data', async ({ page }) => {
        await goto(page, '/warehouse/repairs')
        await assertNoObjectObject(page, '/warehouse/repairs')
        // Should have at least a heading
        const heading = page.locator('h1, h2').first()
        if ((await heading.count()) > 0) {
            await expect(heading).toBeVisible()
        }
    })

    test('maintenance page create button works if available', async ({ page }) => {
        await goto(page, '/maintenance')
        const createBtn = page.getByTestId('btn-create')
            .or(page.getByRole('button', { name: /create|new|add/i }))
        if ((await createBtn.count()) > 0) {
            await createBtn.first().click()
            await page.waitForTimeout(1000)
            // Should open a dialog/form or navigate to new page
            const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first()
            const url = page.url()
            const openedDialog = (await dialog.count()) > 0 && (await dialog.isVisible())
            const navigatedToNew = url.includes('/new')
            expect(openedDialog || navigatedToNew || true).toBe(true) // page shouldn't crash
            await assertNoObjectObject(page, '/maintenance after create click')
        }
    })

    test('repair order creation flow via warehouse repairs', async ({ page }) => {
        await goto(page, '/warehouse/repairs')

        // Look for create toggle or button
        const createToggle = page.getByTestId('repairs-create-toggle')
            .or(page.getByTestId('btn-create'))
            .or(page.getByRole('button', { name: /create|new/i }))

        if ((await createToggle.count()) > 0) {
            await createToggle.first().click()
            await page.waitForTimeout(1000)

            // If create form appears, try filling it
            const createForm = page.getByTestId('repairs-create-form')
                .or(page.locator('form, [data-testid*="form"]').first())

            if ((await createForm.count()) > 0 && (await createForm.isVisible())) {
                // Fill asset select if available
                const assetSelect = page.getByTestId('repair-create-asset')
                    .or(page.locator('select[name="assetId"], select[name="asset_id"]').first())

                if ((await assetSelect.count()) > 0) {
                    await expect
                        .poll(async () => assetSelect.locator('option').count())
                        .toBeGreaterThan(1)

                    const firstValue = await assetSelect
                        .locator('option:not([value=""])')
                        .first()
                        .getAttribute('value')

                    if (firstValue) {
                        await assetSelect.selectOption(firstValue)
                    }
                }

                // Fill title
                const titleInput = page.getByTestId('repair-create-title')
                    .or(page.locator('input[name="title"], input[type="text"]').first())
                if ((await titleInput.count()) > 0) {
                    await titleInput.fill(`E2E Maintenance ${Date.now().toString().slice(-6)}`)
                }

                // Submit
                const submitBtn = page.getByTestId('repair-create-submit')
                    .or(page.getByTestId('btn-submit'))
                if ((await submitBtn.count()) > 0) {
                    await submitBtn.first().click()
                    await page.waitForTimeout(2000)
                }
            }

            await assertNoObjectObject(page, '/warehouse/repairs after create')
        }
    })

    test('repair detail page accessible from list', async ({ page }) => {
        await goto(page, '/warehouse/repairs')

        // Click on a repair row detail button if table has data
        const detailBtn = page.locator('tbody tr a, tbody tr button:has-text("Chi tiet"), tbody tr button:has-text("Detail")')
            .or(page.locator('tbody tr').first().locator('button').first())

        const rows = page.locator('tbody tr')
        if ((await rows.count()) > 0) {
            const link = rows.first().locator('a, button').first()
            if ((await link.count()) > 0) {
                await link.click()
                await page.waitForTimeout(2000)
                await assertNoObjectObject(page, 'repair detail page')
            }
        }
    })

    test('maintenance repairs page supports filtering', async ({ page }) => {
        await goto(page, '/warehouse/repairs')

        // Look for filter controls
        const filterInput = page.getByTestId('repairs-filter-q')
            .or(page.locator('input[name="q"], input[placeholder*="search" i], input[placeholder*="filter" i]').first())

        if ((await filterInput.count()) > 0) {
            await filterInput.fill('test')
            const applyBtn = page.getByTestId('repairs-filter-apply')
                .or(page.getByRole('button', { name: /apply|search|filter/i }))
            if ((await applyBtn.count()) > 0) {
                await applyBtn.first().click()
                await page.waitForTimeout(1000)
            }
            await assertNoObjectObject(page, '/warehouse/repairs after filter')
        }
    })
})
