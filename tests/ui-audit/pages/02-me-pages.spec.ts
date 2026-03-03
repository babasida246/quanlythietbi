/**
 * 02-me-pages.spec.ts
 * Chụp các trang cá nhân: Tài sản của tôi, Yêu cầu của tôi
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Trang cá nhân (Me)', () => {
    test('01 – Tài sản của tôi (/me/assets)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/assets')
        await snap(page, '01-me-assets-list', testInfo.project.name, testInfo)

        // Kiểm tra có bảng hoặc danh sách
        const table = page.locator('table')
        if (await table.isVisible().catch(() => false)) {
            await snap(page, '01-me-assets-table-detail', testInfo.project.name, testInfo)
        }
    })

    test('02 – Yêu cầu của tôi (/me/requests)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/requests')
        await snap(page, '02-me-requests-list', testInfo.project.name, testInfo)
    })
})
