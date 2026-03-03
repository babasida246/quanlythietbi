import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/console-guard';
import { installApiMocks, seedAuthenticatedSession } from './helpers/mock-api';

test.describe('Assets CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page);
  });

  test('create -> search -> delete asset without console errors', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/assets', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByTestId('btn-create').click();
    await expect(page.getByTestId('modal-create')).toBeVisible();
    await page.getByLabel('Ten tai san *').fill('QA Asset Name');
    await page.getByLabel('Ma tai san').fill('QA-ASSET-123');
    await page.getByLabel('Mau ma').selectOption('model-7420');
    await page.getByTestId('btn-submit').click();

    await expect(page.locator('tbody')).toContainText('QA-ASSET-123');
    await page.getByLabel('Tim kiem').fill('QA-ASSET-123');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('QA-ASSET-123');

    const createdRow = page.locator('tbody tr', { hasText: 'QA-ASSET-123' }).first();
    await createdRow.locator('[data-testid^="row-delete-"]').click();
    await expect(page.getByTestId('modal-delete')).toBeVisible();
    await page.getByTestId('btn-submit').click();
    await expect(page.locator('tbody')).not.toContainText('QA-ASSET-123');

    await expect(page.locator('body')).not.toContainText('[object Object]');
    guard.assertNoIssues();
  });
});
