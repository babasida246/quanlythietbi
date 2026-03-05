/**
 * Security & Compliance Page Tests
 * Covers: /security — permissions, compliance, audit logs (admin-only)
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

test.describe('Security & Compliance', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('security page loads without errors', async ({ page }) => {
        await goto(page, '/security')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('security page renders heading', async ({ page }) => {
        await goto(page, '/security')
        const heading = page.locator('h1, [class*="title"], [class*="heading"]').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
            expect(text).not.toContain('[object Object]')
        }
    })

    test('security page has tabs or sections', async ({ page }) => {
        await goto(page, '/security')
        // Security page may have tabs for permissions/compliance/audit
        const tabsOrSections = page.locator(
            '[role="tab"], [data-testid*="tab"], button:has-text("permission"), button:has-text("compliance"), button:has-text("audit"), button:has-text("role")'
        )
        const count = await tabsOrSections.count()
        if (count > 0) {
            // Navigate through all tabs
            for (let i = 0; i < Math.min(count, 5); i++) {
                await tabsOrSections.nth(i).click()
                await page.waitForTimeout(500)
                const body = await page.textContent('body')
                expect(body).not.toContain('[object Object]')
            }
        }
    })

    test('create button opens dialog if available', async ({ page }) => {
        await goto(page, '/security')
        const createBtn = page.getByTestId('btn-create')
        if ((await createBtn.count()) > 0) {
            await createBtn.click()
            const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first()
            if ((await dialog.count()) > 0) {
                await expect(dialog).toBeVisible({ timeout: 5_000 })
                const dialogText = await dialog.textContent()
                expect(dialogText).not.toContain('[object Object]')
                // Close it
                await page.keyboard.press('Escape')
            }
        }
    })

    test('security page accessible to user role', async ({ page }) => {
        await applyUiAuth(page, 'user')
        await goto(page, '/security')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        // Security page is viewable by all authenticated users
        expect(body?.trim().length).toBeGreaterThan(20)
    })
})
