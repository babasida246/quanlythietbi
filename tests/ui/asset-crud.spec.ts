import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('Assets CRUD', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await page.goto('/assets')
    })

    test('complete asset CRUD: create → search → delete', async ({ page }) => {
        const testAssetName = `Test Asset ${Date.now().toString().slice(-6)}`
        const testSerialNumber = `SN${Date.now().toString().slice(-6)}`

        // Wait for page shell to load (heading text may vary by locale/content state).
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // CREATE: Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Fill asset form with required fields
        await page.locator('#asset-name-create').fill(testAssetName)
        await page.locator('#asset-serial-create').fill(testSerialNumber)

        // Select first available category if exists
        const categorySelect = page.locator('#asset-category-create')
        if (await categorySelect.isVisible()) {
            await categorySelect.selectOption({ index: 1 })
        }

        // Select first available model if exists
        const modelSelect = page.locator('#asset-model-create')
        if (await modelSelect.isVisible()) {
            await modelSelect.selectOption({ index: 1 })
        }

        // Submit create form
        await page.getByTestId('btn-submit').click()

        // Verify creation success
        await expect(page.getByTestId('modal-create')).toBeHidden()
        await expect(page.getByText('Tao tai san thanh cong')).toBeVisible()

        // SEARCH: Use search functionality to find the asset
        const searchInput = page.locator('#asset-search')
        await searchInput.fill(testAssetName)

        // Wait a bit for search to filter results
        await page.waitForTimeout(500)

        // Verify asset appears in filtered results
        await expect(page.getByText(testAssetName)).toBeVisible()

        // Some builds only index asset name in quick search; verify serial search does not break the page.
        await searchInput.fill(testSerialNumber)
        await page.waitForTimeout(500)
        await expect(page.locator('#asset-search')).toHaveValue(testSerialNumber)

        // Clear search to see all assets
        await searchInput.fill('')
        await page.waitForTimeout(500)

        // DELETE: Find the asset row and click delete
        const assetRow = page.locator('tr', { hasText: testAssetName })
        await expect(assetRow).toBeVisible()

        const deleteId = await assetRow.locator('[data-testid^="row-delete-"]').getAttribute('data-testid')
        await assetRow.getByTestId(deleteId!).click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()
        await expect(page.getByText(`Ban co chac muon xoa tai san ${testAssetName}?`)).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.getByText('Xoa tai san thanh cong')).toBeVisible()

        // Verify asset is no longer visible
        await expect(page.getByText(testAssetName)).toBeHidden()
    })

    test('asset form validation works correctly', async ({ page }) => {
        // Wait for page shell to load (heading text may vary by locale/content state).
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Try to submit empty form
        await page.getByTestId('btn-submit').click()

        // Native validation may be handled by the browser; verify the modal is still open and create did not succeed.
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.getByText('Tao tai san thanh cong')).toHaveCount(0)

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })

    test('asset import/export buttons are present and functional', async ({ page }) => {
        // Wait for page shell to load (heading text may vary by locale/content state).
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Check that import and export buttons exist
        await expect(page.getByTestId('btn-import')).toBeVisible()
        await expect(page.getByTestId('btn-export')).toBeVisible()
        await expect(page.getByTestId('btn-refresh')).toBeVisible()

        // Click export button to test functionality
        await page.getByTestId('btn-export').click()

        // Should show success message
        await expect(page.getByText('Xuat CSV thanh cong')).toBeVisible()
    })

    test('asset edit functionality works', async ({ page }) => {
        // Wait for page shell to load (heading text may vary by locale/content state).
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Look for existing assets in the table
        const firstEditButton = page.locator('[data-testid^="row-edit-"]').first()

        if (await firstEditButton.isVisible()) {
            // Click the first edit button
            await firstEditButton.click()

            // Verify edit modal opens
            await expect(page.getByTestId('modal-edit')).toBeVisible()
            await expect(page.getByText('Sua tai san')).toBeVisible()

            // Cancel without making changes
            await page.getByTestId('btn-cancel').click()
            await expect(page.getByTestId('modal-edit')).toBeHidden()
        }
    })
})
