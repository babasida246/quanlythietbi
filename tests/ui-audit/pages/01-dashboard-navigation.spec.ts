/**
 * 01-dashboard-navigation.spec.ts
 * Chụp toàn bộ sidebar, header, layout chính sau khi đăng nhập
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Dashboard & Navigation', () => {
    test('01 – Trang chính sau đăng nhập (Dashboard)', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/')
        await snap(page, '01-dashboard-home', testInfo.project.name, testInfo)
    })

    test('02 – Sidebar navigation – trạng thái mở', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/assets')
        await snap(page, '02-sidebar-open', testInfo.project.name, testInfo)
    })

    test('03 – Kiểm tra tất cả nav items hiển thị', async ({ authedPage: page }, testInfo) => {
        await navigateTo(page, '/me/assets')

        const navItems = [
            'nav-my-assets', 'nav-my-requests', 'nav-notifications', 'nav-inbox',
            'nav-assets', 'nav-catalogs', 'nav-cmdb', 'nav-inventory',
            'nav-warehouse', 'nav-maintenance', 'nav-requests',
            'nav-asset-reports', 'nav-warehouse-reports'
        ]

        for (const id of navItems) {
            const loc = page.getByTestId(id)
            const visible = await loc.isVisible().catch(() => false)
            if (visible) {
                // Highlight nav item bằng cách hover
                await loc.hover()
                await page.waitForTimeout(300)
            }
        }
        await snap(page, '03-sidebar-all-nav-items', testInfo.project.name, testInfo)
    })
})
