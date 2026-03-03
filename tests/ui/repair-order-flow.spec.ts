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
        await page.goto('/warehouse/repairs')
        await expect(page.getByRole('heading', { name: 'Repair Orders' })).toBeVisible()

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
        await page.locator('tr', { hasText: uniqueTitle }).getByRole('button', { name: 'Chi tiet' }).click()

        await expect(page.getByRole('heading', { name: 'Repair Order Detail' })).toBeVisible()
        await expect(page.getByText(uniqueTitle)).toBeVisible()

        await page.getByTestId('repair-part-name').fill(partName)
        await page.getByTestId('repair-part-qty').fill(partQty)
        await page.getByTestId('repair-part-unit-cost').fill(partUnitCost)
        await page.getByTestId('repair-part-note').fill('playwright-flow')
        await page.getByTestId('repair-part-submit').click()

        await expect(page.getByText('Da them linh kien')).toBeVisible()
        await expect(page.getByRole('cell', { name: partName })).toBeVisible()

        await page.getByTestId('repair-status-select').selectOption('closed')
        await page.getByTestId('repair-status-submit').click()
        await expect(page.getByText('Da cap nhat trang thai')).toBeVisible()

        await page.getByTestId('repair-detail-back').click()
        await expect(page).toHaveURL(/\/warehouse\/repairs$/)

        await page.getByTestId('repairs-filter-q').fill(uniqueTitle)
        await page.getByTestId('repairs-filter-apply').click()

        const filteredRow = page.locator('tr', { hasText: uniqueTitle })
        await expect(filteredRow).toBeVisible()
        await expect(filteredRow.getByText('closed')).toBeVisible()

        await expect(page.getByTestId('repair-summary-total')).toContainText('1')
        await expect(page.getByTestId('repair-summary-closed')).toContainText('1')
        await expect(page.getByTestId('repair-summary-total-cost')).toContainText(expectedTotalCost)
    })
})
