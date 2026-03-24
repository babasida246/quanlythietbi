import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('Repair Order Flow (P3)', () => {
    test('create repair -> add part -> close -> summary reflects update', async ({ page }) => {
        const uniqueTitle = `E2E Repair ${Date.now()}`
        const partName = `E2E Fan ${Date.now().toString().slice(-4)}`
        const partQty = '2'
        const partUnitCost = '123'
        const expectedTotalCost = '246'

        await applyUiAuth(page, 'admin')
        // /warehouse/repairs redirects to /maintenance/repairs
        await page.goto('/maintenance/repairs')
        // Heading: "Đơn Sửa Chữa" (VI) — check via h2 which always renders
        await expect(page.locator('h2').first()).toBeVisible({ timeout: 15_000 })

        await page.getByTestId('repairs-create-toggle').click()
        await expect(page.getByTestId('repairs-create-form')).toBeVisible()

        const assetSelect = page.getByTestId('repair-create-asset')
        await expect.poll(async () => {
            return await assetSelect.locator('option').count()
        }).toBeGreaterThan(1)

        const firstAssetValue = await assetSelect.locator('option:not([value=""])').first().getAttribute('value')
        expect(firstAssetValue).toBeTruthy()

        await assetSelect.selectOption(firstAssetValue!)
        await page.getByTestId('repair-create-title').fill(uniqueTitle)
        await page.getByTestId('repair-create-submit').click()

        await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 15_000 })
        // Button text "Chi tiết" (with diacritics) — use regex to match
        await page.locator('tr', { hasText: uniqueTitle }).locator('button:has-text("Chi tiết")').click()

        // Detail page heading: "Chi tiết đơn sửa chữa"
        await expect(page.locator('h2').first()).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText(uniqueTitle)).toBeVisible()

        await page.getByTestId('repair-part-name').fill(partName)
        await page.getByTestId('repair-part-qty').fill(partQty)
        await page.getByTestId('repair-part-unit-cost').fill(partUnitCost)
        await page.getByTestId('repair-part-note').fill('playwright-flow')
        await page.getByTestId('repair-part-submit').click()

        // actionSuccess text is hardcoded without diacritics
        await expect(page.getByText('Da them linh kien')).toBeVisible()
        await expect(page.getByRole('cell', { name: partName })).toBeVisible()

        await page.getByTestId('repair-status-select').selectOption('closed')
        await page.getByTestId('repair-status-submit').click()
        await expect(page.getByText('Da cap nhat trang thai')).toBeVisible()

        await page.getByTestId('repair-detail-back').click()
        // Back button navigates to /maintenance/repairs (not /warehouse/repairs)
        await expect(page).toHaveURL(/\/maintenance\/repairs$/, { timeout: 8_000 })

        await page.getByTestId('repairs-filter-q').fill(uniqueTitle)
        await page.getByTestId('repairs-filter-apply').click()

        const filteredRow = page.locator('tr', { hasText: uniqueTitle })
        await expect(filteredRow).toBeVisible()
        // Status "closed" → "Đã đóng" in VI — use regex
        await expect(filteredRow.locator('.badge, span').filter({ hasText: /Đã đóng|closed/i })).toBeVisible()

        await expect(page.getByTestId('repair-summary-total')).toContainText('1')
        await expect(page.getByTestId('repair-summary-closed')).toContainText('1')
        await expect(page.getByTestId('repair-summary-total-cost')).toContainText(expectedTotalCost)
    })
})
