/**
 * 03-assets.spec.ts
 * Chụp toàn bộ module Quản lý Tài sản: danh sách, chi tiết, danh mục, kế hoạch mua sắm
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Quản lý Tài sản', () => {
    test('01 – Danh sách tài sản (/assets)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets')
        await snap(page, '01-assets-list', testInfo.project.name, testInfo)

        // Thử click vào dòng đầu tiên để xem chi tiết
        const firstRow = page.locator('table tbody tr').first()
        if (await firstRow.isVisible().catch(() => false)) {
            await firstRow.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '01b-assets-first-row-detail', testInfo.project.name, testInfo)
            await page.goBack()
            await page.waitForLoadState('networkidle')
        }
    })

    test('02 – Trang chi tiết tài sản (/assets/[id])', async ({ authedPage: page }, testInfo) => {
        // Đi tới danh sách trước để lấy link chi tiết
        await navigateTo(page, '/assets')

        const detailLink = page.locator('table tbody tr a, table tbody tr[data-href]').first()
        if (await detailLink.isVisible().catch(() => false)) {
            await detailLink.click()
            await page.waitForLoadState('networkidle')
            await snap(page, '02-asset-detail-page', testInfo.project.name, testInfo)

            // Scroll xuống để chụp phần dưới
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForTimeout(500)
            await snap(page, '02b-asset-detail-scrolled', testInfo.project.name, testInfo)
        } else {
            // Nếu không có data, chụp trang trống
            await snap(page, '02-asset-detail-no-data', testInfo.project.name, testInfo)
        }
    })

    test('03 – Danh mục tài sản (/assets/catalogs)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets/catalogs')
        await snap(page, '03-assets-catalogs', testInfo.project.name, testInfo)
    })

    test('04 – Kế hoạch mua sắm (/assets/purchase-plans)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets/purchase-plans')
        await snap(page, '04-assets-purchase-plans', testInfo.project.name, testInfo)
    })

    test('05 – Tạo kế hoạch mua sắm mới (/assets/purchase-plans/new)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets/purchase-plans/new')
        await snap(page, '05-assets-purchase-plan-new', testInfo.project.name, testInfo)
    })

    test('06 – Tăng tài sản (/assets/asset-increases/new)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets/asset-increases/new')
        await snap(page, '06-assets-increase-new', testInfo.project.name, testInfo)
    })
})
