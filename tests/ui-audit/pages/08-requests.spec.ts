/**
 * 08-requests.spec.ts
 * Chụp module Yêu cầu (Requests): danh sách, tạo mới, chi tiết
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Yêu cầu (Requests)', () => {
    test('01 – Danh sách yêu cầu (/requests)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/requests')
        await snap(page, '01-requests-list', testInfo.project.name, testInfo)
    })

    test('02 – Form tạo yêu cầu mới (/requests/new)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/requests/new')
        await snap(page, '02-requests-new-form', testInfo.project.name, testInfo)

        // Scroll xuống xem toàn bộ form
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(500)
        await snap(page, '02b-requests-new-form-scrolled', testInfo.project.name, testInfo)
    })

    test('03 – Chi tiết yêu cầu (nếu có)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/requests')
        const firstRow = page.locator('table tbody tr').first()
        if (await firstRow.isVisible().catch(() => false)) {
            await firstRow.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            if (page.url().includes('/requests/')) {
                await snap(page, '03-request-detail', testInfo.project.name, testInfo)

                // Scroll xem toàn bộ chi tiết
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                await page.waitForTimeout(500)
                await snap(page, '03b-request-detail-scrolled', testInfo.project.name, testInfo)
            }
        }
    })
})
