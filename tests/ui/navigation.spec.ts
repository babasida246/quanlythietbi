import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

const navExpectations: Array<{ testId: string; path: string }> = [
    { testId: 'nav-my-assets', path: '/me/assets' },
    { testId: 'nav-my-requests', path: '/me/requests' },
    { testId: 'nav-notifications', path: '/notifications' },
    { testId: 'nav-inbox', path: '/inbox' },
    { testId: 'nav-assets', path: '/assets' },
    { testId: 'nav-catalogs', path: '/assets/catalogs' },
    { testId: 'nav-cmdb', path: '/cmdb' },
    { testId: 'nav-inventory', path: '/inventory' },
    { testId: 'nav-warehouse', path: '/warehouse/stock' },
    { testId: 'nav-maintenance', path: '/maintenance' },
    { testId: 'nav-requests', path: '/requests' },
    { testId: 'nav-asset-reports', path: '/reports/assets' },
    { testId: 'nav-warehouse-reports', path: '/warehouse/reports' }
]

test.describe('UI Navigation (MY + ASSETS)', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await page.goto('/me/assets')
    })

    test('sidebar includes only MY + ASSETS test ids', async ({ page }) => {
        for (const item of navExpectations) {
            await expect(page.getByTestId(item.testId)).toBeVisible()
        }

        await expect(page.locator('[data-testid="nav-chat"]')).toHaveCount(0)
        await expect(page.locator('[data-testid="nav-stats"]')).toHaveCount(0)
        await expect(page.locator('[data-testid="nav-models"]')).toHaveCount(0)
        await expect(page.locator('[data-testid="nav-tools"]')).toHaveCount(0)
        await expect(page.locator('[data-testid="nav-devices"]')).toHaveCount(0)
    })

    test('clicking each sidebar item routes to expected path', async ({ page }) => {
        for (const item of navExpectations) {
            await page.getByTestId(item.testId).click()
            await expect(page).toHaveURL(new RegExp(`${item.path.replace('/', '\\/')}`))
        }
    })
})
