import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

// Ánh xạ testId → path THEO ĐÚNG AppSidebar.svelte hiện tại
const navExpectations: Array<{ testId: string; path: string }> = [
    { testId: 'nav-my-assets',         path: '/me/assets' },
    { testId: 'nav-my-requests',        path: '/me/requests' },
    { testId: 'nav-notifications',      path: '/notifications' },
    { testId: 'nav-inbox',              path: '/inbox' },
    { testId: 'nav-assets',             path: '/assets' },
    { testId: 'nav-catalogs',           path: '/assets/catalogs' },
    { testId: 'nav-cmdb',               path: '/cmdb' },
    { testId: 'nav-inventory',          path: '/inventory' },
    { testId: 'nav-warehouse',          path: '/warehouse/stock' },
    { testId: 'nav-maintenance',        path: '/maintenance' },
    { testId: 'nav-requests',           path: '/requests' },
    { testId: 'nav-reports',            path: '/reports' },         // nav-asset-reports không tồn tại
    { testId: 'nav-warehouse-reports',  path: '/warehouse/reports' },
]

// Các testId cũ (legacy) không còn tồn tại trong sidebar
const removedTestIds = [
    'nav-chat', 'nav-stats', 'nav-models', 'nav-tools', 'nav-devices', 'nav-asset-reports'
]

test.describe('UI Navigation — Sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await page.goto('/me/assets')
        // Đợi sidebar render hoàn chỉnh
        await expect(page.getByTestId('nav-my-assets')).toBeVisible({ timeout: 15_000 })
    })

    test('tất cả nav items cần thiết đều hiển thị', async ({ page }) => {
        for (const item of navExpectations) {
            await expect(
                page.getByTestId(item.testId),
                `Sidebar item ${item.testId} phải hiển thị`
            ).toBeVisible({ timeout: 10_000 })
        }
    })

    test('các testId legacy đã bị xóa không còn tồn tại', async ({ page }) => {
        for (const testId of removedTestIds) {
            await expect(
                page.locator(`[data-testid="${testId}"]`),
                `Legacy item ${testId} không được xuất hiện`
            ).toHaveCount(0)
        }
    })

    test('click từng nav item điều hướng đúng path', async ({ page }) => {
        for (const item of navExpectations) {
            const link = page.getByTestId(item.testId)
            await expect(link).toBeVisible({ timeout: 8_000 })
            await link.click()
            // Dùng waitForURL với regex match toàn bộ path — tránh timeout do sub-menu
            await page.waitForURL(
                (url) => url.pathname.startsWith(item.path) || url.pathname === item.path,
                { timeout: 15_000 }
            )
        }
    })
})
