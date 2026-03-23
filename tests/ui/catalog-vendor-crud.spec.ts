import { expect, test } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

test.describe('Catalog Vendor CRUD', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
        await page.goto('/assets/catalogs')
    })

    test('complete vendor CRUD: create → edit → delete', async ({ page }) => {
        const testVendorName = `Test Vendor ${Date.now().toString().slice(-6)}`
        const editedVendorName = `${testVendorName} - Edited`
        const testTaxCode = 'TAX123456'
        const testPhone = '+84123456789'
        const testEmail = 'vendor@example.com'
        const testAddress = '123 Test Street, Test City'

        // Wait for tabs to render (i18n may show "Vendors" in EN or "Nhà cung cấp" in VI)
        const vendorTab = page.locator('[role="tab"]').filter({ hasText: /Vendors|Nhà cung cấp/i })
        await expect(vendorTab).toBeVisible({ timeout: 15_000 })
        await vendorTab.click()

        // CREATE: Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Fill vendor form
        await page.locator('#vendor-name-create').fill(testVendorName)
        await page.locator('#vendor-tax-create').fill(testTaxCode)
        await page.locator('#vendor-phone-create').fill(testPhone)
        await page.locator('#vendor-email-create').fill(testEmail)
        await page.locator('#vendor-address-create').fill(testAddress)

        // Submit create form
        await page.getByTestId('btn-submit').click()

        // Verify creation success (covers both EN and VI locales)
        await expect(page.getByTestId('modal-create')).toBeHidden()
        await expect(page.locator('text=/Tạo mới thành công|Created successfully/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(testVendorName)).toBeVisible()

        // EDIT: Find the vendor row and click edit
        const vendorRow = page.locator('tr', { hasText: testVendorName })
        const editBtn = vendorRow.locator('[data-testid^="row-edit-"]')
        await editBtn.click()

        await expect(page.getByTestId('modal-edit')).toBeVisible()

        // Edit vendor form
        await page.locator('#vendor-name-edit').fill(editedVendorName)
        await page.locator('#vendor-phone-edit').fill('+84987654321')

        // Submit edit form
        await page.getByTestId('btn-submit').click()

        // Verify edit success
        await expect(page.getByTestId('modal-edit')).toBeHidden()
        await expect(page.locator('text=/Cập nhật thành công|Updated successfully/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(editedVendorName)).toBeVisible()

        // DELETE: Find the vendor row and click delete
        const editedVendorRow = page.locator('tr', { hasText: editedVendorName })
        const deleteBtn = editedVendorRow.locator('[data-testid^="row-delete-"]')
        await deleteBtn.click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()
        // Delete confirmation text works in either locale
        await expect(page.locator(`text=/Are you sure you want to delete ${editedVendorName}|Bạn có chắc muốn xóa ${editedVendorName}/i`)).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.locator('text=/Xóa thành công|Deleted successfully/i').first()).toBeVisible({ timeout: 8_000 })
        await expect(page.getByText(editedVendorName)).toBeHidden()
    })

    test('vendor form validation works correctly', async ({ page }) => {
        // Wait for tabs to render
        const vendorTab = page.locator('[role="tab"]').filter({ hasText: /Vendors|Nhà cung cấp/i })
        await expect(vendorTab).toBeVisible({ timeout: 15_000 })
        await vendorTab.click()

        // Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Try to submit empty form
        await page.getByTestId('btn-submit').click()

        // Native validation may be handled by the browser; verify modal remains open and no success toast appears.
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.locator('text=/Tạo mới thành công|Created successfully/i')).toHaveCount(0)

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })
})
