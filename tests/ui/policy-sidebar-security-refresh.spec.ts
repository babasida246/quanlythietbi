import { expect, test } from '@playwright/test'

test.describe('Policy behavior - Security nav before/after refresh', () => {
    test('login admin, check Security nav and route before/after refresh', async ({ page }) => {
        const effectivePermCalls: Array<{ status: number; url: string; at: number }> = []

        page.on('response', (res) => {
            const url = res.url()
            if (url.includes('/api/v1/admin/permissions/effective/system-users/')) {
                effectivePermCalls.push({ status: res.status(), url, at: Date.now() })
            }
        })

        await page.goto('/login')
        await page.waitForLoadState('domcontentloaded')

        await page.locator('#login-email').fill('admin@example.com')
        await page.locator('#login-password').fill('Benhvien@121')
        await page.getByRole('button', { name: /dang nhap|sign in/i }).click()

        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
        await page.waitForLoadState('networkidle')

        const securityNav = page.getByTestId('nav-security')
        const countBefore = await securityNav.count()
        const visibleBefore = countBefore > 0 ? await securityNav.first().isVisible() : false

        let accessBefore = false
        if (visibleBefore) {
            await securityNav.first().click()
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(800)
            accessBefore = page.url().includes('/security') && !page.url().includes('/forbidden')
        } else {
            await page.goto('/security')
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(800)
            accessBefore = page.url().includes('/security') && !page.url().includes('/forbidden')
        }

        const storageBefore = await page.evaluate(() => ({
            userRole: localStorage.getItem('userRole'),
            effectivePermCache: sessionStorage.getItem('qltb_effective_perms_v1')
        }))

        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle')

        const countAfter = await securityNav.count()
        const visibleAfter = countAfter > 0 ? await securityNav.first().isVisible() : false

        await page.goto('/security')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(800)
        const accessAfter = page.url().includes('/security') && !page.url().includes('/forbidden')

        const storageAfter = await page.evaluate(() => ({
            userRole: localStorage.getItem('userRole'),
            effectivePermCache: sessionStorage.getItem('qltb_effective_perms_v1')
        }))

        console.log('POLICY_CHECK_RESULT', JSON.stringify({
            visibleBefore,
            accessBefore,
            visibleAfter,
            accessAfter,
            effectivePermCalls,
            storageBefore,
            storageAfter,
            finalUrl: page.url()
        }))

        expect(storageAfter.userRole).toBeTruthy()
        expect(effectivePermCalls.length).toBeGreaterThan(0)
    })
})
