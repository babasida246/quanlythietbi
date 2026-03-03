/**
 * 06-warehouse.spec.ts
 * Chụp toàn bộ module Kho: Stock, Warehouses, Documents, Parts, Repairs, Ledger, Reports
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Module Kho (Warehouse)', () => {
    test('01 – Trang chính kho (/warehouse)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse')
        await snap(page, '01-warehouse-main', testInfo.project.name, testInfo)
    })

    test('02 – Tồn kho (/warehouse/stock)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/stock')
        await snap(page, '02-warehouse-stock', testInfo.project.name, testInfo)
    })

    test('03 – Danh sách kho (/warehouse/warehouses)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/warehouses')
        await snap(page, '03-warehouse-warehouses', testInfo.project.name, testInfo)
    })

    test('04 – Chứng từ kho (/warehouse/documents)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/documents')
        await snap(page, '04-warehouse-documents', testInfo.project.name, testInfo)

        // Thử tạo chứng từ mới
        const newBtn = page.locator('a[href*="/documents/new"], button:has-text("Tạo"), button:has-text("Thêm"), button:has-text("New")')
        if (await newBtn.first().isVisible().catch(() => false)) {
            await newBtn.first().click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '04b-warehouse-document-new', testInfo.project.name, testInfo)
            await page.goBack()
            await page.waitForLoadState('networkidle')
        }
    })

    test('05 – Chi tiết chứng từ (nếu có)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/documents')
        // Chờ bảng ổn định
        await page.waitForTimeout(2000)
        const firstLink = page.locator('table tbody tr a[href]').first()
        if (await firstLink.isVisible().catch(() => false)) {
            const href = await firstLink.getAttribute('href')
            if (href) {
                await navigateTo(page, href)
                await snap(page, '05-warehouse-document-detail', testInfo.project.name, testInfo)
            }
        } else {
            // Fallback: chụp trang danh sách
            await snap(page, '05-warehouse-documents-no-link', testInfo.project.name, testInfo)
        }
    })

    test('06 – Vật tư/Phụ tùng (/warehouse/parts)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/parts')
        await snap(page, '06-warehouse-parts', testInfo.project.name, testInfo)
    })

    test('07 – Sửa chữa (/warehouse/repairs)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/repairs')
        await snap(page, '07-warehouse-repairs', testInfo.project.name, testInfo)

        // Thử mở form sửa chữa mới
        const newBtn = page.locator('a[href*="/repairs/new"], button:has-text("Tạo"), button:has-text("New")')
        if (await newBtn.first().isVisible().catch(() => false)) {
            await newBtn.first().click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '07b-warehouse-repair-new', testInfo.project.name, testInfo)
            await page.goBack()
            await page.waitForLoadState('networkidle')
        }
    })

    test('08 – Chi tiết sửa chữa (nếu có)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/repairs')
        const firstRow = page.locator('table tbody tr').first()
        if (await firstRow.isVisible().catch(() => false)) {
            await firstRow.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            if (page.url().includes('/repairs/')) {
                await snap(page, '08-warehouse-repair-detail', testInfo.project.name, testInfo)
            }
        }
    })

    test('09 – Sổ kho (/warehouse/ledger)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/ledger')
        await snap(page, '09-warehouse-ledger', testInfo.project.name, testInfo)
    })

    test('10 – Báo cáo kho (/warehouse/reports)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/warehouse/reports')
        await snap(page, '10-warehouse-reports', testInfo.project.name, testInfo)
    })
})
