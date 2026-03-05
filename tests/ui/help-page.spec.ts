/**
 * Help Page Smoke Test
 * Covers: /help — basic rendering, content presence
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

test.describe('Help Page', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('help page loads without errors', async ({ page }) => {
        await goto(page, '/help')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        expect(body?.trim().length).toBeGreaterThan(20)
    })

    test('help page renders heading', async ({ page }) => {
        await goto(page, '/help')
        const heading = page.locator('h1, h2, [class*="title"]').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
            expect(text).not.toContain('[object Object]')
        }
    })

    test('help page is accessible by regular user', async ({ page }) => {
        await applyUiAuth(page, 'user')
        await goto(page, '/help')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        // Should not be forbidden
        expect(page.url()).not.toContain('forbidden')
    })
})
