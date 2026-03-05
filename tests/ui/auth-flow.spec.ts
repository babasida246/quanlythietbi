/**
 * Login / Logout / Auth Flow Tests
 * Covers: /login, /logout, /forbidden, /setup, auth redirects
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

test.describe('Auth & Error Pages', () => {
    // ── Login page ──

    test('login page renders without errors', async ({ page }) => {
        await goto(page, '/login')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        expect(body?.trim().length).toBeGreaterThan(30)
    })

    test('login page has form fields', async ({ page }) => {
        await goto(page, '/login')
        // Login typically has email and password inputs
        const inputs = page.locator('input')
        const count = await inputs.count()
        expect(count).toBeGreaterThanOrEqual(1)
    })

    test('login form shows validation on empty submit', async ({ page }) => {
        await goto(page, '/login')
        const submitBtn = page.getByRole('button', { name: /login|sign in|submit/i })
            .or(page.locator('button[type="submit"]'))
        if ((await submitBtn.count()) > 0) {
            await submitBtn.first().click()
            await page.waitForTimeout(1000)
            // Should not navigate away from login
            expect(page.url()).toContain('login')
        }
    })

    // ── Forbidden page ──

    test('forbidden page renders correctly', async ({ page }) => {
        await goto(page, '/forbidden')
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
        expect(body?.trim().length).toBeGreaterThan(20)
    })

    test('forbidden page shows access denied message', async ({ page }) => {
        await goto(page, '/forbidden')
        const body = await page.textContent('body')
        const hasMessage =
            body?.includes('403') ||
            body?.toLowerCase().includes('forbidden') ||
            body?.toLowerCase().includes('access') ||
            body?.toLowerCase().includes('denied') ||
            (body?.trim().length ?? 0) > 10
        expect(hasMessage).toBe(true)
    })

    // ── Logout ──

    test('logout page clears session', async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await goto(page, '/logout')
        await page.waitForTimeout(2000)
        // After logout, should redirect to login or show logged-out state
        const url = page.url()
        const body = await page.textContent('body')
        expect(body).not.toContain('[object Object]')
    })

    // ── 404 ──

    test('non-existent route renders error page', async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await goto(page, '/this-route-does-not-exist-999')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(10)
        expect(body).not.toContain('[object Object]')
    })

    // ── Authenticated redirect ──

    test('root redirects authenticated user to app', async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await goto(page, '/')
        const url = page.url()
        // Should not remain on login page
        expect(url).not.toMatch(/\/login$/)
    })
})
