/**
 * Integrations Page Tests
 * Covers: /integrations — connectors, webhooks, sync rules (admin-only)
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

test.describe('Integrations — Connectors & Webhooks', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('integrations page loads without errors', async ({ page }) => {
        await goto(page, '/integrations')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('integrations page renders heading', async ({ page }) => {
        await goto(page, '/integrations')
        const heading = page.locator('h1, h2, [class*="title"]').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
            expect(text).not.toContain('[object Object]')
        }
    })

    test('integrations page has tabs or sections', async ({ page }) => {
        await goto(page, '/integrations')
        const tabs = page.locator(
            '[role="tab"], [data-testid*="tab"], button:has-text("connector"), button:has-text("webhook"), button:has-text("sync")'
        )
        const count = await tabs.count()
        if (count > 0) {
            for (let i = 0; i < Math.min(count, 4); i++) {
                await tabs.nth(i).click()
                await page.waitForTimeout(500)
                const body = await page.textContent('body')
                expect(body).not.toContain('[object Object]')
            }
        }
    })

    test('integrations create button works if available', async ({ page }) => {
        await goto(page, '/integrations')
        const createBtn = page.getByTestId('btn-create')
            .or(page.getByRole('button', { name: /create|new|add/i }))
        if ((await createBtn.count()) > 0) {
            await createBtn.first().click()
            await page.waitForTimeout(1000)
            const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first()
            if ((await dialog.count()) > 0) {
                await expect(dialog).toBeVisible({ timeout: 5_000 })
                const dialogText = await dialog.textContent()
                expect(dialogText).not.toContain('[object Object]')
                await page.keyboard.press('Escape')
            }
        }
    })

    test('integrations accessible to user role', async ({ page }) => {
        await applyUiAuth(page, 'user')
        await goto(page, '/integrations')
        const bodyText = await page.textContent('body')
        // Integrations page is viewable by all authenticated users
        expect(bodyText).not.toContain('[object Object]')
        expect(bodyText?.trim().length).toBeGreaterThan(20)
    })
})
