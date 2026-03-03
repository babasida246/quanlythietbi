/**
 * 05-inventory.spec.ts
 * Chụp module Kiểm kê (Inventory)
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Kiểm kê (Inventory)', () => {
    test('01 – Danh sách kiểm kê (/inventory)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/inventory')
        await snap(page, '01-inventory-list', testInfo.project.name, testInfo)
    })

    test('02 – Chi tiết phiên kiểm kê (nếu có)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/inventory')

        const firstRow = page.locator('table tbody tr a, table tbody tr').first()
        if (await firstRow.isVisible().catch(() => false)) {
            await firstRow.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            // Chỉ chụp nếu URL đổi (nghĩa là có navigate)
            if (page.url().includes('/inventory/')) {
                await snap(page, '02-inventory-detail', testInfo.project.name, testInfo)
            }
        }
    })
})
