import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/console-guard';
import { installApiMocks, seedAuthenticatedSession } from './helpers/mock-api';

test.describe('I18n', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page);
  });

  test('navigation labels render correctly in EN and VI', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/assets');
    await page.waitForLoadState('domcontentloaded');

    const languageSelect = page.getByLabel('Select language');
    await languageSelect.selectOption('en');
    await expect(page.locator('body')).toContainText('Assets');

    await languageSelect.selectOption('vi');
    await expect(page.locator('body')).toContainText('Tài sản');

    await expect(page.locator('body')).not.toContainText('[object Object]');
    guard.assertNoIssues();
  });
});
