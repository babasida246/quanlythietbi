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
        await expect(page.locator('h1')).toContainText(/My Requests|Yeu cau cua toi|Yêu cầu của tôi/i)

        await page.goto('/requests')
        await expect(page.locator('h1')).toContainText(/Workflow Requests|Yeu cau|Yêu cầu/i)
    })
})
