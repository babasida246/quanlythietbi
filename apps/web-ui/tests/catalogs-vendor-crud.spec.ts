import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/console-guard';
import { installApiMocks, seedAuthenticatedSession } from './helpers/mock-api';

test.describe('Catalogs vendor CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page);
  });

  test('create -> edit -> delete vendor without console errors', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/assets/catalogs');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Nha cung cap|Nhà cung cấp/i }).click();

    await page.getByTestId('btn-create').click();
    await expect(page.getByTestId('modal-create')).toBeVisible();
    await page.getByLabel('Ten nha cung cap *').fill('Acme QA');
    await page.getByTestId('btn-submit').click();
    await expect(page.locator('tbody')).toContainText('Acme QA');

    const createdRow = page.locator('tbody tr', { hasText: 'Acme QA' }).first();
    await createdRow.locator('[data-testid^="row-edit-"]').click();
    await expect(page.getByTestId('modal-edit')).toBeVisible();
    await page.getByLabel('Ten nha cung cap *').fill('Acme QA Updated');
    await page.getByTestId('btn-submit').click();
    await expect(page.locator('tbody')).toContainText('Acme QA Updated');

    const updatedRow = page.locator('tbody tr', { hasText: 'Acme QA Updated' }).first();
    await updatedRow.locator('[data-testid^="row-delete-"]').click();
    await expect(page.getByTestId('modal-delete')).toBeVisible();
    await page.getByTestId('btn-submit').click();
    await expect(page.locator('tbody')).not.toContainText('Acme QA Updated');

    await expect(page.locator('body')).not.toContainText('[object Object]');
    guard.assertNoIssues();
  });
});
