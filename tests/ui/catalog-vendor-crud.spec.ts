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

        // Navigate to Vendors tab
        await page.click('button:has-text("Nhà cung cấp")')
        await expect(page.getByText('Nhà cung cấp')).toBeVisible()

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

        // Verify creation success
        await expect(page.getByTestId('modal-create')).toBeHidden()
        await expect(page.getByText('Tạo mới thành công')).toBeVisible()
        await expect(page.getByText(testVendorName)).toBeVisible()

        // EDIT: Find the vendor row and click edit
        const vendorRow = page.locator('tr', { hasText: testVendorName })
        const vendorId = await vendorRow.locator('[data-testid^="row-edit-"]').getAttribute('data-testid')
        await vendorRow.getByTestId(vendorId!).click()

        await expect(page.getByTestId('modal-edit')).toBeVisible()

        // Edit vendor form
        await page.locator('#vendor-name-edit').fill(editedVendorName)
        await page.locator('#vendor-phone-edit').fill('+84987654321')

        // Submit edit form
        await page.getByTestId('btn-submit').click()

        // Verify edit success
        await expect(page.getByTestId('modal-edit')).toBeHidden()
        await expect(page.getByText('Cập nhật thành công')).toBeVisible()
        await expect(page.getByText(editedVendorName)).toBeVisible()

        // DELETE: Find the vendor row and click delete
        const editedVendorRow = page.locator('tr', { hasText: editedVendorName })
        const deleteId = await editedVendorRow.locator('[data-testid^="row-delete-"]').getAttribute('data-testid')
        await editedVendorRow.getByTestId(deleteId!).click()

        await expect(page.getByTestId('modal-delete')).toBeVisible()
        await expect(page.getByText(`Bạn có chắc muốn xóa ${editedVendorName}?`)).toBeVisible()

        // Confirm deletion
        await page.getByTestId('btn-submit').click()

        // Verify deletion success
        await expect(page.getByTestId('modal-delete')).toBeHidden()
        await expect(page.getByText('Xóa thành công')).toBeVisible()
        await expect(page.getByText(editedVendorName)).toBeHidden()
    })

    test('vendor form validation works correctly', async ({ page }) => {
        // Navigate to Vendors tab
        await page.click('button:has-text("Nhà cung cấp")')

        // Open create modal
        await page.getByTestId('btn-create').click()
        await expect(page.getByTestId('modal-create')).toBeVisible()

        // Try to submit empty form
        await page.getByTestId('btn-submit').click()

        // Native validation may be handled by the browser; verify modal remains open and no success toast appears.
        await expect(page.getByTestId('modal-create')).toBeVisible()
        await expect(page.getByText('Tạo mới thành công')).toHaveCount(0)

        // Cancel modal
        await page.getByTestId('btn-cancel').click()
        await expect(page.getByTestId('modal-create')).toBeHidden()
    })
})
