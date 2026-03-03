/**
 * 12-ui-interactions.spec.ts
 * Test & chụp các tương tác UI phổ biến: modal, dropdown, filter, search, pagination, dialog
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Tương tác UI chung', () => {

    test('01 – Search / Filter trên trang Assets', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets')

        // Tìm ô search
        const searchInput = page.locator('input[placeholder*="ìm"], input[placeholder*="earch"], input[type="search"], input[name="q"]').first()
        if (await searchInput.isVisible().catch(() => false)) {
            await searchInput.fill('test')
            await page.waitForTimeout(1000)
            await snap(page, '01-assets-search-active', testInfo.project.name, testInfo)
            await searchInput.clear()
        }

        // Filter/dropdown
        const filterBtn = page.locator('button:has-text("Lọc"), button:has-text("Filter"), [data-testid*="filter"]').first()
        if (await filterBtn.isVisible().catch(() => false)) {
            await filterBtn.click()
            await page.waitForTimeout(500)
            await snap(page, '01b-assets-filter-open', testInfo.project.name, testInfo)
        }
    })

    test('02 – Dialog / Modal (thử tạo mới assets)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets')

        const createBtn = page.locator('button:has-text("Thêm"), button:has-text("Tạo"), button:has-text("New"), button:has-text("Add"), a:has-text("Thêm"), a:has-text("Tạo")').first()
        if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click()
            await page.waitForTimeout(1000)
            await snap(page, '02-assets-create-dialog', testInfo.project.name, testInfo)

            // Đóng dialog nếu có nút close
            const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Đóng"), button:has-text("Hủy"), button:has-text("Cancel"), [data-testid="close"]').first()
            if (await closeBtn.isVisible().catch(() => false)) {
                await closeBtn.click()
                await page.waitForTimeout(500)
            }
        }
    })

    test('03 – Pagination trên danh sách', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets')

        // Tìm nút phân trang
        const pagination = page.locator('nav[aria-label*="pagination"], .pagination, [data-testid*="pagination"]').first()
        if (await pagination.isVisible().catch(() => false)) {
            await snap(page, '03-pagination-visible', testInfo.project.name, testInfo)

            // Click trang 2 nếu có
            const page2 = pagination.locator('button:has-text("2"), a:has-text("2")').first()
            if (await page2.isVisible().catch(() => false)) {
                await page2.click()
                await page.waitForLoadState('networkidle')
                await page.waitForTimeout(1000)
                await snap(page, '03b-pagination-page-2', testInfo.project.name, testInfo)
            }
        }

        // Next button
        const nextBtn = page.locator('button:has-text("Next"), button:has-text("Sau"), button[aria-label="Next"]').first()
        if (await nextBtn.isVisible().catch(() => false) && await nextBtn.isEnabled()) {
            await nextBtn.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)
            await snap(page, '03c-pagination-next', testInfo.project.name, testInfo)
        }
    })

    test('04 – Dropdown menu (user profile)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/assets')

        // Tìm avatar / user menu
        const userMenu = page.locator('[data-testid*="user"], [data-testid*="avatar"], button:has(.avatar), .user-menu, [aria-label*="User"], [aria-label*="user"]').first()
        if (await userMenu.isVisible().catch(() => false)) {
            await userMenu.click()
            await page.waitForTimeout(500)
            await snap(page, '04-user-dropdown-open', testInfo.project.name, testInfo)
        }
    })

    test('05 – Table column sorting', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/assets')

        const sortableHeader = page.locator('table thead th[aria-sort], table thead th button, table thead th.sortable').first()
        if (await sortableHeader.isVisible().catch(() => false)) {
            await sortableHeader.click()
            await page.waitForTimeout(1000)
            await snap(page, '05-table-sorted', testInfo.project.name, testInfo)
        }
    })

    test('06 – Responsive: thu sidebar', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/assets')
        await snap(page, '06a-sidebar-full-width', testInfo.project.name, testInfo)

        // Thu nhỏ viewport
        await page.setViewportSize({ width: 768, height: 1024 })
        await page.waitForTimeout(1000)
        await snap(page, '06b-sidebar-tablet-view', testInfo.project.name, testInfo)

        await page.setViewportSize({ width: 375, height: 812 })
        await page.waitForTimeout(1000)
        await snap(page, '06c-sidebar-mobile-view', testInfo.project.name, testInfo)

        // Mở hamburger menu nếu có
        const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [data-testid*="menu-toggle"], .hamburger').first()
        if (await hamburger.isVisible().catch(() => false)) {
            await hamburger.click()
            await page.waitForTimeout(500)
            await snap(page, '06d-mobile-menu-open', testInfo.project.name, testInfo)
        }

        // Reset viewport
        await page.setViewportSize({ width: 1920, height: 1080 })
    })
})
