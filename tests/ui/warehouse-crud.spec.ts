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

        // Wait for page to load
        await expect(page.getByText('Quan ly kho')).toBeVisible()

        // Should be on warehouses tab by default
        await expect(page.getByText('Kho hang')).toBeVisible()

        // CREATE: Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Fill warehouse form
        await page.locator('#warehouse-name-create').fill(testWarehouseName)

        // Submit create form
        await page.getByTestId('btn-submit').click()

        // Verify creation success
        await expect(page.getByTestId('modal-create')).toBeHidden()
        await expect(page.getByText('Tao moi thanh cong')).toBeVisible()
        await expect(page.getByText(testWarehouseName)).toBeVisible()

        // EDIT: Find the warehouse row and click edit
        const warehouseRow = page.locator('tr', { hasText: testWarehouseName })
        const editId = await warehouseRow.locator('[data-testid^="row-edit-"]').getAttribute('data-testid')
        await warehouseRow.getByTestId(editId!).click()

        await expect(page.getByTestId('modal-edit')).toBeVisible()

        // Edit warehouse form
        await page.locator('#warehouse-name-edit').fill(editedWarehouseName)

        // Submit edit form
        await page.getByTestId('btn-submit').click()

        // Verify edit success
        await expect(page.getByTestId('modal-edit')).toBeHidden()
        await expect(page.getByText('Cap nhat thanh cong')).toBeVisible()
        await expect(page.getByText(editedWarehouseName)).toBeVisible()

        // DELETE: Find the warehouse row and click delete
        const editedWarehouseRow = page.locator('tr', { hasText: editedWarehouseName })
        const deleteId = await editedWarehouseRow.locator('[data-testid^="row-delete-"]').getAttribute('data-testid')
        await editedWarehouseRow.getByTestId(deleteId!).click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()
        await expect(page.getByText(`Bạn có chắc muốn xóa ${editedWarehouseName}?`)).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.getByText('Xoa thanh cong')).toBeVisible()
        await expect(page.getByText(editedWarehouseName)).toBeHidden()
    })

    test('inventory tab functionality', async ({ page }) => {
        // Wait for page to load
        await expect(page.getByText('Quan ly kho')).toBeVisible()

        // Navigate to Inventory tab
        await page.click('button:has-text("Vat tu")')
        await expect(page.getByRole('button', { name: 'Vat tu' })).toBeVisible()

        // Check that create button works
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.getByText('Tao moi Vat tu')).toBeVisible()

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })

    test('stock movements tab functionality', async ({ page }) => {
        // Wait for page to load
        await expect(page.getByText('Quan ly kho')).toBeVisible()

        // Navigate to Stock Movements tab
        await page.click('button:has-text("Nhap xuat")')
        await expect(page.getByText('Nhap xuat')).toBeVisible()

        // Check that create button works
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.getByText('Tao moi Nhap xuat')).toBeVisible()

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })

    test('warehouse form validation works correctly', async ({ page }) => {
        // Wait for page to load
        await expect(page.getByText('Quan ly kho')).toBeVisible()

        // Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Try to submit empty form
        await page.getByTestId('btn-submit').click()

        // Native validation may be handled by the browser; verify modal remains open and no success toast appears.
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.getByText('Tao moi thanh cong')).toHaveCount(0)

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })

    test('all tabs have proper buttons with correct testids', async ({ page }) => {
        // Wait for page to load
        await expect(page.getByText('Quan ly kho')).toBeVisible()

        // Check that required buttons exist
        await expect(page.getByTestId('btn-create')).toBeVisible()
        await expect(page.getByTestId('btn-refresh')).toBeVisible()

        // Test each tab
        const tabs = ['Kho hang', 'Vat tu', 'Nhap xuat']
        for (const tab of tabs) {
            await page.click(`button:has-text("${tab}")`)
            await expect(page.getByRole('button', { name: tab })).toBeVisible()
            await expect(page.getByTestId('btn-create')).toBeVisible()
            await expect(page.getByTestId('btn-refresh')).toBeVisible()
        }
    })
})
