/**
 * 09-reports.spec.ts
 * Chụp module Báo cáo: Báo cáo tài sản, Báo cáo kho  
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Báo cáo (Reports)', () => {
    test('01 – Báo cáo tài sản (/reports/assets)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/reports/assets')
        await snap(page, '01-reports-assets', testInfo.project.name, testInfo)

        // Scroll xem biểu đồ / bảng bên dưới
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(500)
        await snap(page, '01b-reports-assets-scrolled', testInfo.project.name, testInfo)
    })

    test('02 – Báo cáo kho (/warehouse/reports)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/reports')
        await snap(page, '02-warehouse-reports', testInfo.project.name, testInfo)

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(500)
        await snap(page, '02b-warehouse-reports-scrolled', testInfo.project.name, testInfo)
    })
})
