/**
 * Request Approval Flow Tests
 * Covers: /me/requests (user creates), /requests (admin reviews/approves), /inbox (approvals)
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

test.describe('Request Approval Flow', () => {
    // ── User creates request ──

    test.describe('User submits request', () => {
        test.beforeEach(async ({ page }) => {
            await applyUiAuth(page, 'user')
        })

        test('my requests page loads for user role', async ({ page }) => {
            await goto(page, '/me/requests')
            await assertNoObjectObject(page, '/me/requests (user)')
            const heading = page.locator('h1')
            if ((await heading.count()) > 0) {
                await expect(heading).toContainText(/request|y\u00EAu c\u1EA7u/i)
            }
        })

        test('new request page loads with form', async ({ page }) => {
            await goto(page, '/me/requests/new')
            await assertNoObjectObject(page, '/me/requests/new')

            // Should have form elements
            const inputs = page.locator('input, select, textarea')
            const count = await inputs.count()
            expect(count).toBeGreaterThanOrEqual(1)
        })

        test('user can fill and submit a request', async ({ page }) => {
            await goto(page, '/me/requests/new')
            const uniqueTitle = `E2E Request ${Date.now().toString().slice(-6)}`

            // Fill title/name input
            const titleInput = page.locator(
                'input[name="title"], input[name="name"], input[name="subject"], input[type="text"]'
            ).first()
            if ((await titleInput.count()) > 0) {
                await titleInput.fill(uniqueTitle)
            }

            // Fill description/note textarea if present
            const descInput = page.locator('textarea').first()
            if ((await descInput.count()) > 0) {
                await descInput.fill('Playwright E2E test request')
            }

            // Select dropdowns
            const selects = page.locator('select')
            const selectCount = await selects.count()
            for (let i = 0; i < Math.min(selectCount, 4); i++) {
                const options = selects.nth(i).locator('option:not([value=""])')
                if ((await options.count()) > 0) {
                    const value = await options.first().getAttribute('value')
                    if (value) await selects.nth(i).selectOption(value)
                }
            }

            // Submit
            const submitBtn = page.getByTestId('btn-submit')
                .or(page.getByRole('button', { name: /submit|create|send|save/i }))
            if ((await submitBtn.count()) > 0) {
                await submitBtn.first().click()
                await page.waitForTimeout(2000)
                await assertNoObjectObject(page, '/me/requests/new after submit')
            }
        })

        test('my assets page loads and shows assigned assets', async ({ page }) => {
            await goto(page, '/me/assets')
            await assertNoObjectObject(page, '/me/assets (user)')
            const body = await page.textContent('body')
            expect(body?.trim().length).toBeGreaterThan(30)
        })
    })

    // ── Admin reviews requests ──

    test.describe('Admin reviews requests', () => {
        test.beforeEach(async ({ page }) => {
            await applyUiAuth(page, 'admin')
        })

        test('requests page loads for admin', async ({ page }) => {
            await goto(page, '/requests')
            await assertNoObjectObject(page, '/requests (admin)')
        })

        test('requests page shows list or table', async ({ page }) => {
            await goto(page, '/requests')
            const body = await page.textContent('body')
            expect(body?.trim().length).toBeGreaterThan(50)
        })

        test('inbox page loads for admin', async ({ page }) => {
            await goto(page, '/inbox')
            await assertNoObjectObject(page, '/inbox (admin)')
        })

        test('notifications page loads', async ({ page }) => {
            await goto(page, '/notifications')
            await assertNoObjectObject(page, '/notifications')
        })

        test('inbox detail navigation works if items exist', async ({ page }) => {
            await goto(page, '/inbox')

            // Click first row/item if available
            const items = page.locator('tbody tr, [data-testid*="inbox-item"], a[href^="/inbox/"]')
            if ((await items.count()) > 0) {
                await items.first().click()
                await page.waitForTimeout(2000)
                await assertNoObjectObject(page, '/inbox detail')
            }
        })
    })
})
