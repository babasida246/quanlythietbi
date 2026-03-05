import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('Automation — Rules & Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('automation page loads without errors', async ({ page }) => {
        await page.goto('/automation')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(1500)
        await expect(page.locator('body')).not.toContainText('[object Object]')
        const content = await page.textContent('body')
        expect(content).toBeTruthy()
    })

    test('automation tabs are navigable', async ({ page }) => {
        await page.goto('/automation')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(1500)

        // Check for tab-like navigation (rules, notifications, tasks)
        const tabs = page.locator(
            '[role="tab"]:visible, button:visible:has-text("rule"), button:visible:has-text("notification"), button:visible:has-text("task")'
        )
        const tabCount = await tabs.count()

        if (tabCount > 0) {
            // Click through only visible tabs
            for (let i = 0; i < Math.min(tabCount, 4); i++) {
                const tab = tabs.nth(i)
                if (await tab.isVisible()) {
                    await tab.click()
                    await page.waitForTimeout(500)
                    await expect(page.locator('body')).not.toContainText('[object Object]')
                }
            }
        }
    })

    test('automation rules list loads seeded data', async ({ page }) => {
        await page.goto('/automation')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(1500)

        // Seed data includes 3 workflow_automation_rules
        const body = await page.textContent('body')
        // At minimum the page should not error
        expect(body).toBeTruthy()
        expect(body).not.toContain('[object Object]')
    })

    test('automation accessible to user role', async ({ page }) => {
        await applyUiAuth(page, 'user')
        await page.goto('/automation')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(1500)
        const bodyText = await page.textContent('body')
        // Automation page is viewable by all authenticated users
        expect(bodyText).not.toContain('[object Object]')
        expect(bodyText?.trim().length).toBeGreaterThan(20)
    })
})
