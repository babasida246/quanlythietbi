/**
 * 14-error-pages.spec.ts
 * Chụp các trang lỗi: 404, forbidden, route không tồn tại
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Error Pages', () => {
    test('01 – Trang 404 (route không tồn tại)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/non-existent-page-abc123')
        await snap(page, '01-error-404', testInfo.project.name, testInfo)
    })

    test('02 – Trang Forbidden (/forbidden)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/forbidden')
        await snap(page, '02-error-forbidden', testInfo.project.name, testInfo)
    })

    test('03 – Trang Logout (/logout)', async ({ page }, testInfo) => {
        await navigateTo(page, '/logout')
        await snap(page, '03-logout-page', testInfo.project.name, testInfo)
    })
})
