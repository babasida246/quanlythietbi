import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

const legacyPaths = ['/profile', '/chat', '/stats', '/models', '/devices', '/changes', '/rulepacks', '/tools']

test.describe('Legacy Route Behavior', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    for (const path of legacyPaths) {
        test(`legacy path ${path} redirects to /me/assets`, async ({ page }) => {
            await page.goto(path)
            await expect(page).toHaveURL(/\/me\/assets/)
        })
    }

    test('unknown route renders not found state', async ({ page }) => {
        await page.goto('/this-route-does-not-exist')
        await expect(page.locator('text=404')).toBeVisible()
        await expect(page.locator('text=Back to My assets')).toBeVisible()
    })
})
