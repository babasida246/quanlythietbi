import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('UI Notifications and Inbox', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('notifications page loads and supports mark read', async ({ page }) => {
        await page.goto('/notifications')
        await expect(page.locator('h1')).toContainText(/Notifications|Thong bao|Thông báo/i)

        const markButtons = page.locator('button', { hasText: /Mark read|Danh dau da doc|đã đọc/i })
        if (await markButtons.count()) {
            await markButtons.first().click()
        }
    })

    test('inbox page opens approval detail when items exist', async ({ page }) => {
        await page.goto('/inbox')
        await expect(page.locator('h1')).toContainText(/Inbox|Hop phe duyet|Hộp/i)

        const detailButtons = page.locator('[data-testid^="row-edit-"]')
        if ((await detailButtons.count()) === 0) {
            const table = page.locator('table')
            if ((await table.count()) > 0) {
                await expect(table.first()).toBeVisible()
            } else {
                await expect(page.getByText(/Khong co du lieu|Không có dữ liệu|Khong the tai hop phe duyet/i)).toBeVisible()
            }
            return
        }

        await detailButtons.first().click()
        await expect(page.getByTestId('modal-approval-detail')).toBeVisible()
        await expect(page.locator('#approval-comment')).toBeVisible()
        await page.locator('#approval-comment').fill(`Playwright approval note ${Date.now()}`)
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-approval-detail')).toBeHidden()
    })
})
