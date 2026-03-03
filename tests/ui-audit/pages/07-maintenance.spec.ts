/**
 * 07-maintenance.spec.ts
 * Chụp module Bảo trì / Bảo dưỡng
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Bảo trì (Maintenance)', () => {
    test('01 – Danh sách bảo trì (/maintenance)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/maintenance')
        await snap(page, '01-maintenance-list', testInfo.project.name, testInfo)
    })

    test('02 – Thử tạo phiếu bảo trì mới', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/maintenance')

        const newBtn = page.locator('a[href*="/maintenance/new"], button:has-text("Tạo"), button:has-text("Thêm"), button:has-text("New")')
        if (await newBtn.first().isVisible().catch(() => false)) {
            await newBtn.first().click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '02-maintenance-new-form', testInfo.project.name, testInfo)
            await page.goBack()
            await page.waitForLoadState('networkidle')
        }
    })
})
