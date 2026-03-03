import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/console-guard';
import { installApiMocks, seedAuthenticatedSession } from './helpers/mock-api';

test.describe('Assets catalogs', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page);
  });

  test('loads page with CRUD actions and no object rendering errors', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/assets/catalogs');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('[object Object]');

    await page.getByTestId('btn-create').click();
    await page.getByLabel('Ten danh muc *').fill('Storage');
    await page.getByTestId('btn-submit').click();
    await expect(page.getByRole('cell', { name: 'Storage' })).toBeVisible();
    await expect(page.locator('[data-testid^="row-edit-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="row-delete-"]').first()).toBeVisible();

    await expect(page.locator('body')).not.toContainText('[object Object]');

    await page.getByRole('button', { name: /Nha cung cap|Nhà cung cấp/i }).click();
    await expect(page.locator('body')).not.toContainText('[object Object]');
    await expect(page.locator('[data-testid^="row-edit-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="row-delete-"]').first()).toBeVisible();

    await page.getByRole('button', { name: /Mau ma|Mẫu mã/i }).click();
    await expect(page.locator('body')).toContainText(/Latitude 7420|Model/i);

    await page.getByRole('button', { name: /Trang thai|Trạng thái/i }).click();

    await expect(page.locator('body')).not.toContainText('[object Object]');
    guard.assertNoIssues();
  });
});
