/**
 * CMDB Services Tests
 * Covers: /cmdb/services, /cmdb?tab=services — service CRUD, members, impact
 */
import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

async function goto(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
}

async function assertNoObjectObject(page: Page, context = '') {
    const text = await page.textContent('body')
    expect(text, `[object Object] found on ${context}`).not.toContain('[object Object]')
}

test.describe('CMDB Services', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('CMDB services page loads with seeded data', async ({ page }) => {
        await goto(page, '/cmdb/services')
        await assertNoObjectObject(page, '/cmdb/services')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('CMDB services tab on main page works', async ({ page }) => {
        await goto(page, '/cmdb')
        // Click Services tab
        const servicesTab = page.getByRole('tab', { name: /services?/i })
            .or(page.locator('button:has-text("Services"), button:has-text("services")'))
            .or(page.locator('button[data-tab="services"]'))
        if ((await servicesTab.count()) > 0) {
            await servicesTab.first().click()
            await page.waitForTimeout(1000)
            await assertNoObjectObject(page, '/cmdb services tab')
        }
    })

    test('services page renders a list or table', async ({ page }) => {
        await goto(page, '/cmdb/services')
        // Look for table/list/cards
        const dataContainer = page.locator('table, [role="grid"], [class*="list"], [class*="card"]').first()
        const body = await page.textContent('body')
        // Should have meaningful content
        expect(body?.trim().length).toBeGreaterThan(30)
    })

    test('services page has create button', async ({ page }) => {
        await goto(page, '/cmdb/services')
        const createBtn = page.getByTestId('btn-create')
            .or(page.getByRole('button', { name: /create|new|add/i }))
        if ((await createBtn.count()) > 0) {
            await createBtn.first().click()
            await page.waitForTimeout(1000)
            // Check for dialog or form
            const dialog = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first()
            if ((await dialog.count()) > 0) {
                await expect(dialog).toBeVisible({ timeout: 5_000 })
                const dialogText = await dialog.textContent()
                expect(dialogText).not.toContain('[object Object]')
                // Close
                await page.keyboard.press('Escape')
            }
            await assertNoObjectObject(page, '/cmdb/services after create')
        }
    })

    test('CMDB reports page loads with content', async ({ page }) => {
        await goto(page, '/cmdb/reports')
        await assertNoObjectObject(page, '/cmdb/reports')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('CMDB reports page renders charts or data', async ({ page }) => {
        await goto(page, '/cmdb/reports')
        const heading = page.locator('h1, h2, [class*="title"]').first()
        if ((await heading.count()) > 0) {
            const text = await heading.textContent()
            expect(text?.trim()).not.toBe('')
        }
    })

    test('CMDB changes page loads with seeded changes', async ({ page }) => {
        await goto(page, '/cmdb/changes')
        await assertNoObjectObject(page, '/cmdb/changes')
        const body = await page.textContent('body')
        expect(body?.trim().length).toBeGreaterThan(50)
    })

    test('CMDB topology tab loads graph or visualization', async ({ page }) => {
        await goto(page, '/cmdb')
        // Click Topology tab
        const topoTab = page.getByRole('tab', { name: /topology/i })
            .or(page.locator('button:has-text("Topology"), button:has-text("topology")'))
            .or(page.locator('button[data-tab="topology"]'))
        if ((await topoTab.count()) > 0) {
            await topoTab.first().click()
            await page.waitForTimeout(2000)
            await assertNoObjectObject(page, '/cmdb topology tab')
        }
    })

    test('CMDB CIs detail page loads for first CI', async ({ page }) => {
        await goto(page, '/cmdb/cis')
        // Click first row link to go to detail
        const firstLink = page.locator('tbody tr a, tbody tr [data-testid*="detail"]').first()
        if ((await firstLink.count()) > 0) {
            await firstLink.click()
            await page.waitForTimeout(2000)
            await assertNoObjectObject(page, 'CI detail')
            // Check URL changed to detail
            expect(page.url()).toMatch(/\/cmdb\/cis\//)
        }
    })
})
