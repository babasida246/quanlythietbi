import { expect, test, type Page } from '@playwright/test';
import { attachConsoleGuard } from './helpers/console-guard';
import { installApiMocks, seedAuthenticatedSession } from './helpers/mock-api';

async function assertNoObjectObject(page: Page) {
  await expect(page.locator('body')).not.toContainText('[object Object]');
}

test.describe('Smoke routes', () => {
  test('login flow works without console/runtime errors', async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await installApiMocks(page);

    await page.goto('/login');
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: /dang nhap/i }).click();

    await expect(page).toHaveURL(/\/me\/assets/);
    await assertNoObjectObject(page);
    guard.assertNoIssues();
  });

  test('main routes are stable and clean', async ({ page }) => {
    // Route transitions may cancel in-flight API calls from the previous page.
    const guard = attachConsoleGuard(page, {
      allowRequestFailures: [
        /GET http:\/\/localhost:3000\/api\/.* -> net::ERR_ABORTED/i,
        /GET http:\/\/127\.0\.0\.1:3001\/api\/.* -> net::ERR_ABORTED/i
      ]
    });
    await installApiMocks(page);
    await seedAuthenticatedSession(page);

    const routes = ['/dashboard', '/assets', '/assets/catalogs', '/cmdb', '/warehouse/stock'];

    for (const path of routes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {});
      await expect(page.locator('body')).toBeVisible();
      await assertNoObjectObject(page);
    }

    guard.assertNoIssues();
  });
});
