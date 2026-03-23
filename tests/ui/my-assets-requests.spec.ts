import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('UI MY scope pages', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('my assets supports search/filter and detail navigation', async ({ page }) => {
        await page.goto('/me/assets')
        await expect(page.locator('h1')).toContainText(/My assets|Tai san cua toi|Tài sản của tôi/i)

        await page.locator('#my-assets-status').selectOption('in_stock')
        await page.getByRole('button', { name: /Search|Tim|Tìm/i }).click()

        const viewLink = page.locator('a[href^="/assets/"]').first()
        if (await viewLink.count()) {
            await viewLink.click()
            await expect(page).toHaveURL(/\/assets\/.+/)
        }
    })

    test('my requests and requests pages load', async ({ page }) => {
        await page.goto('/me/requests')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(800)
        // h1 shows either i18n value ("Yêu cầu của tôi") or isLoading fallback ("My Requests")
        await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

        await page.goto('/requests')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(800)
        // h1 shows "Quy trình nghiệp vụ" (vi) or "Requests" (isLoading fallback)
        await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })
    })
})
