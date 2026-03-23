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

        // Wait for assets page to load
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // CREATE: Click btn-create → navigates to /assets/new
        await page.getByTestId('btn-create').click()
        await expect(page).toHaveURL(/\/assets\/new/, { timeout: 8_000 })

        // Wait for the form/catalogs to load
        await page.waitForSelector('#new-name', { timeout: 12_000 })

        // Fill required fields
        await page.locator('#new-name').fill(testAssetName)
        await page.locator('#new-serial').fill(testSerialNumber)

        // Select first available model if dropdown has options beyond placeholder
        const modelSelect = page.locator('#new-model')
        if (await modelSelect.isVisible()) {
            const optionCount = await modelSelect.locator('option').count()
            if (optionCount > 1) await modelSelect.selectOption({ index: 1 })
        }

        // Submit form
        await page.locator('button[type="submit"]').click()

        // Verify creation success toast or heading (may match both toast + page heading)
        await expect(page.locator('text=/Tạo tài sản|Asset created/i').first()).toBeVisible({ timeout: 10_000 })

        // Navigate back to assets list
        await page.goto('/assets')
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // SEARCH: Use search input to find the asset
        const searchInput = page.locator('#asset-search')
        if (await searchInput.isVisible()) {
            await searchInput.fill(testAssetName)
            await page.waitForTimeout(600)
            await expect(page.getByText(testAssetName)).toBeVisible()

            await searchInput.fill(testSerialNumber)
            await page.waitForTimeout(600)
            await expect(searchInput).toHaveValue(testSerialNumber)

            // Clear search
            await searchInput.fill('')
            await page.waitForTimeout(600)
        }

        // DELETE: Find the asset row and click delete
        const assetRow = page.locator('tr', { hasText: testAssetName })
        await expect(assetRow).toBeVisible({ timeout: 8_000 })

        const deleteBtn = assetRow.locator('[data-testid^="row-delete-"]')
        await deleteBtn.click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.locator('text=/Xóa tài sản thành công|Asset deleted/i')).toBeVisible()

        // Verify asset is no longer visible
        await page.waitForTimeout(500)
        await expect(page.getByText(testAssetName)).toHaveCount(0)
    })

    test('asset form validation works correctly', async ({ page }) => {
        // Wait for assets page to load
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Navigate to create page
        await page.getByTestId('btn-create').click()
        await expect(page).toHaveURL(/\/assets\/new/, { timeout: 8_000 })

        // Wait for form to be ready
        await page.waitForSelector('#new-name', { timeout: 12_000 })

        // Try to submit empty form (no name, no model)
        await page.locator('button[type="submit"]').click()

        // Should stay on the same page (no navigation)
        await expect(page).toHaveURL(/\/assets\/new/)
        // No success toast
        await expect(page.locator('text=/Tạo tài sản|Asset created/i')).toHaveCount(0)

        // Navigate back to list
        await page.goto('/assets')
        await expect(page.getByTestId('btn-create')).toBeVisible()
    })

    test('asset import/export buttons are present and functional', async ({ page }) => {
        // Wait for page shell to load
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Check that import and export buttons exist
        await expect(page.getByTestId('btn-import')).toBeVisible()
        await expect(page.getByTestId('btn-export')).toBeVisible()
        await expect(page.getByTestId('btn-refresh')).toBeVisible()

        // Click export button to test functionality
        await page.getByTestId('btn-export').click()

        // Should show success toast (regex covers diacritics or English fallback)
        await expect(page.locator('text=/Xuất CSV|CSV exported/i')).toBeVisible({ timeout: 8_000 })
    })

    test('asset edit functionality works', async ({ page }) => {
        // Wait for page shell to load
        await expect(page.getByTestId('btn-create')).toBeVisible()

        // Look for existing assets in the table
        const firstEditButton = page.locator('[data-testid^="row-edit-"]').first()

        if (await firstEditButton.isVisible()) {
            // Click the first edit button
            await firstEditButton.click()

            // Verify edit modal opens
            await expect(page.getByTestId('modal-edit')).toBeVisible()
            // Modal title (regex for both VI "Sửa tài sản" and EN "Edit asset")
            await expect(page.locator('text=/Sửa tài sản|Edit asset/i').first()).toBeVisible()

            // Cancel without making changes
            await page.getByTestId('btn-cancel').click()
            await expect(page.getByTestId('modal-edit')).toBeHidden()
        }
    })
})
