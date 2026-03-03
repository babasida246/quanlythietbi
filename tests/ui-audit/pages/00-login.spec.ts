/**
 * 00-login.spec.ts
 * Test & chụp màn hình trang đăng nhập và quy trình đăng nhập
 */
import { test, expect, snap, navigateTo } from '../fixtures'

test.describe('Trang đăng nhập', () => {
    test('01 – Hiển thị form login', async ({ page }, testInfo) => {
        await navigateTo(page, '/login')
        await expect(page.locator('h1')).toBeVisible()
        await snap(page, '01-login-form', testInfo.project.name, testInfo)
    })

    test('02 – Login với thông tin sai → hiển thị lỗi', async ({ page }, testInfo) => {
        await navigateTo(page, '/login')
        await page.fill('input[type="email"]', 'wrong@example.com')
        await page.fill('input[type="password"]', 'wrongpassword')
        await page.click('button[type="submit"]')
        // Chờ thông báo lỗi
        await page.waitForTimeout(2000)
        await snap(page, '02-login-error', testInfo.project.name, testInfo)
    })

    test('03 – Login thành công với admin', async ({ page }, testInfo) => {
        await navigateTo(page, '/login')
        await page.fill('input[type="email"]', 'admin@example.com')
        await page.fill('input[type="password"]', 'Benhvien@121')
        await snap(page, '03-login-filled', testInfo.project.name, testInfo)

        await page.click('button[type="submit"]')
        await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })
        await page.waitForLoadState('networkidle')
        await snap(page, '04-login-success-redirect', testInfo.project.name, testInfo)
    })
})
