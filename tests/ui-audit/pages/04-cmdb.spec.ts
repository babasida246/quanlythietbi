/**
 * 04-cmdb.spec.ts
 * Chụp toàn bộ module CMDB: CI, Services, Types, Changes, Relationships, Reports
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module CMDB', () => {
    test('01 – Trang chính CMDB (/cmdb)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb')
        await snap(page, '01-cmdb-main', testInfo.project.name, testInfo)
    })

    test('02 – Danh sách CI (/cmdb/cis)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb/cis')
        await snap(page, '02-cmdb-cis-list', testInfo.project.name, testInfo)

        // Xem chi tiết CI đầu tiên nếu có
        const firstRow = page.locator('table tbody tr').first()
        if (await firstRow.isVisible().catch(() => false)) {
            await firstRow.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '02b-cmdb-ci-detail', testInfo.project.name, testInfo)
            await page.goBack()
            await page.waitForLoadState('networkidle')
        }
    })

    test('03 – Dịch vụ CMDB (/cmdb/services)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb/services')
        await snap(page, '03-cmdb-services', testInfo.project.name, testInfo)
    })

    test('04 – Loại CI (/cmdb/types)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb/types')
        await snap(page, '04-cmdb-types', testInfo.project.name, testInfo)
    })

    test('05 – Quản lý thay đổi (/cmdb/changes)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb/changes')
        await snap(page, '05-cmdb-changes', testInfo.project.name, testInfo)
    })

    test('06 – Quan hệ CI (/cmdb/relationships)', async ({ authedPage: page }, testInfo) => {
        // Route này chỉ có import/ subfolder, thử navigate
        await navigateTo(page, '/cmdb/relationships/import')
        await snap(page, '06-cmdb-relationships-import', testInfo.project.name, testInfo)
    })

    test('07 – Báo cáo CMDB (/cmdb/reports)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/cmdb/reports')
        await snap(page, '07-cmdb-reports', testInfo.project.name, testInfo)
    })
})
