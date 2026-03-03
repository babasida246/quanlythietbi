/**
 * 11-admin-setup.spec.ts
 * Chụp trang Admin và Setup
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Admin & Setup', () => {
    test('01 – Trang Admin (/admin)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/admin')
        await snap(page, '01-admin-page', testInfo.project.name, testInfo)

        // Scroll xem toàn bộ
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(500)
        await snap(page, '01b-admin-page-scrolled', testInfo.project.name, testInfo)
    })

    test('02 – Trang Setup (/setup)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/setup')
        await snap(page, '02-setup-page', testInfo.project.name, testInfo)
    })
})
