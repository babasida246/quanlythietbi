/**
 * 10-notifications-inbox.spec.ts
 * Chụp trang Thông báo và Hộp thư đến
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Thông báo & Hộp thư', () => {
    test('01 – Thông báo (/notifications)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/notifications')
        await snap(page, '01-notifications', testInfo.project.name, testInfo)
    })

    test('02 – Hộp thư đến (/inbox)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/inbox')
        await snap(page, '02-inbox-list', testInfo.project.name, testInfo)

        // Mở tin nhắn đầu tiên nếu có
        const firstItem = page.locator('table tbody tr, [data-testid*="inbox-item"], .inbox-item, li').first()
        if (await firstItem.isVisible().catch(() => false)) {
            await firstItem.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '02b-inbox-detail', testInfo.project.name, testInfo)
        }
    })
})
