import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('Warehouse CRUD', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await page.goto('/warehouse/warehouses')
    })

    test('complete warehouse CRUD: create → edit → delete', async ({ page }) => {
        const testWarehouseName = `Test Warehouse ${Date.now().toString().slice(-6)}`
        const editedWarehouseName = `${testWarehouseName} - Edited`

        // Wait for page to load (h1 is "Quản lý kho" with diacritics)
        await expect(page.locator('text=/Quản lý kho|Quan ly kho/i').first()).toBeVisible({ timeout: 10_000 })

        // Should be on "Kho hàng" tab by default (warehouses tab)
        await expect(page.locator('text=/Kho hàng/i').first()).toBeVisible()

        // CREATE: Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Fill warehouse name field
        await page.locator('#warehouse-name-create').fill(testWarehouseName)

        // Submit create form
        await page.getByTestId('btn-submit').click()

        // Verify creation success
        await expect(page.getByTestId('modal-create')).toBeHidden()
        await expect(page.locator('text=/Tạo kho thành công|created/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(testWarehouseName)).toBeVisible()

        // EDIT: Find the warehouse row and click edit
        const warehouseRow = page.locator('tr', { hasText: testWarehouseName })
        const editBtn = warehouseRow.locator('[data-testid^="row-edit-"]')
        await editBtn.click()

        await expect(page.getByTestId('modal-edit')).toBeVisible()

        // Edit warehouse name
        await page.locator('#warehouse-name-edit').fill(editedWarehouseName)

        // Submit edit form
        await page.getByTestId('btn-submit').click()

        // Verify edit success
        await expect(page.getByTestId('modal-edit')).toBeHidden()
        await expect(page.locator('text=/Cập nhật kho thành công|updated/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(editedWarehouseName)).toBeVisible()

        // DELETE: Find the edited warehouse row and click delete
        const editedWarehouseRow = page.locator('tr', { hasText: editedWarehouseName })
        const deleteBtn = editedWarehouseRow.locator('[data-testid^="row-delete-"]')
        await deleteBtn.click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.locator('text=/Xóa kho thành công|deleted/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(editedWarehouseName)).toBeHidden()
    })

    test('stock (tồn kho) tab is accessible', async ({ page }) => {
        // Wait for page to load
        await expect(page.locator('text=/Quản lý kho|Quan ly kho/i').first()).toBeVisible({ timeout: 10_000 })

        // Navigate to the stock (Tồn kho) tab
        await page.click('button:has-text("Tồn kho")')
        await expect(page.locator('button:has-text("Tồn kho")').first()).toBeVisible()

        // btn-refresh should exist in stock tab
        await expect(page.getByTestId('btn-refresh')).toBeVisible()
    })

    test('assets tab (tài sản trong kho) is accessible', async ({ page }) => {
        // Wait for page to load
        await expect(page.locator('text=/Quản lý kho|Quan ly kho/i').first()).toBeVisible({ timeout: 10_000 })

        // Navigate to assets tab
        await page.click('button:has-text("Tài sản trong kho")')
        await expect(page.locator('button:has-text("Tài sản trong kho")').first()).toBeVisible()
    })

    test('warehouse form validation works correctly', async ({ page }) => {
        // Wait for page to load
        await expect(page.locator('text=/Quản lý kho|Quan ly kho/i').first()).toBeVisible({ timeout: 10_000 })

        // Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Try to submit empty form
        await page.getByTestId('btn-submit').click()

        // Modal should remain visible (validation prevents submission)
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.locator('text=/Tạo kho thành công|created/i')).toHaveCount(0)

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })

    test('all tabs have correct labels and buttons', async ({ page }) => {
        // Wait for page to load
        await expect(page.locator('text=/Quản lý kho|Quan ly kho/i').first()).toBeVisible({ timeout: 10_000 })

        // Check that all three tabs exist with correct Vietnamese labels
        await expect(page.locator('button:has-text("Kho hàng")')).toBeVisible()
        await expect(page.locator('button:has-text("Tồn kho")')).toBeVisible()
        await expect(page.locator('button:has-text("Tài sản trong kho")')).toBeVisible()

        // Warehouses tab: btn-create and btn-refresh should be visible
        await page.click('button:has-text("Kho hàng")')
        await expect(page.getByTestId('btn-create')).toBeVisible()
        await expect(page.getByTestId('btn-refresh')).toBeVisible()

        // Stock tab: btn-refresh should be visible (no btn-create on stock tab)
        await page.click('button:has-text("Tồn kho")')
        await expect(page.getByTestId('btn-refresh')).toBeVisible()
    })
})
