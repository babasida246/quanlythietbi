import { expect, test } from '@playwright/test'

function setupStatusPayload(initialized: boolean) {
    return {
        success: true,
        data: {
            initialized,
            version: '1.0.0',
            api: { ok: true, build: '1.0.0' },
            db: { ok: true },
            migrations: { applied: initialized ? 6 : 0, pending: initialized ? 0 : 6, ok: initialized, total: 6 },
            seed: { ok: initialized },
            adminExists: initialized
        }
    }
}

test.describe('Setup Wizard', () => {
    test('loads /setup when system is not initialized', async ({ page }) => {
        await page.route('**/api/setup/status', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(setupStatusPayload(false))
            })
        })

        await page.route('**/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ok' })
            })
        })

        await page.goto('/setup')
        await expect(page.locator('h1')).toContainText(/Khoi tao he thong lan dau|Khởi tạo hệ thống lần đầu|First-time system setup/i)
    })

    test('redirects to /login when setup is initialized', async ({ page }) => {
        await page.route('**/api/setup/status', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(setupStatusPayload(true))
            })
        })

        await page.route('**/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ok' })
            })
        })

        await page.goto('/setup')
        await page.waitForURL('**/login', { timeout: 10_000 })
        await expect(page).toHaveURL(/\/login/)
    })
})
