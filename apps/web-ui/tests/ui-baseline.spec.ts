import { test, expect } from '@playwright/test';

test.describe('UI Baseline Screenshots', () => {
    test.beforeEach(async ({ page }) => {
        // TODO: Add authentication if needed
        // For now, try direct navigation to test pages
    });

    test('should capture /assets/catalogs page', async ({ page }) => {
        try {
            await page.goto('/assets/catalogs');

            // Wait for the page to load - look for main table or content
            await page.waitForSelector('table', { timeout: 10000 });

            // Wait a bit more for any dynamic content
            await page.waitForTimeout(1000);

            // Take full page screenshot
            await expect(page).toHaveScreenshot('baseline/assets-catalogs.png', {
                fullPage: true,
                animations: 'disabled'
            });
        } catch (error) {
            console.log('Error loading /assets/catalogs:', error);
            // Still take screenshot even if there's an error
            await expect(page).toHaveScreenshot('baseline/assets-catalogs-error.png', {
                fullPage: true,
                animations: 'disabled'
            });
        }
    });

    test('should capture /assets main page', async ({ page }) => {
        try {
            await page.goto('/assets');

            // Wait for main content
            await page.waitForSelector('[data-testid], table, .page-shell', { timeout: 10000 });
            await page.waitForTimeout(1000);

            await expect(page).toHaveScreenshot('baseline/assets-main.png', {
                fullPage: true,
                animations: 'disabled'
            });
        } catch (error) {
            console.log('Error loading /assets:', error);
            await expect(page).toHaveScreenshot('baseline/assets-main-error.png', {
                fullPage: true,
                animations: 'disabled'
            });
        }
    });

    test('should capture /cmdb page', async ({ page }) => {
        try {
            await page.goto('/cmdb');

            await page.waitForSelector('[data-testid], .page-shell, main', { timeout: 10000 });
            await page.waitForTimeout(1000);

            await expect(page).toHaveScreenshot('baseline/cmdb.png', {
                fullPage: true,
                animations: 'disabled'
            });
        } catch (error) {
            console.log('Error loading /cmdb:', error);
            await expect(page).toHaveScreenshot('baseline/cmdb-error.png', {
                fullPage: true,
                animations: 'disabled'
            });
        }
    });

    test('should capture /warehouse page', async ({ page }) => {
        try {
            await page.goto('/warehouse');

            await page.waitForSelector('[data-testid], .page-shell, main', { timeout: 10000 });
            await page.waitForTimeout(1000);

            await expect(page).toHaveScreenshot('baseline/warehouse.png', {
                fullPage: true,
                animations: 'disabled'
            });
        } catch (error) {
            console.log('Error loading /warehouse:', error);
            await expect(page).toHaveScreenshot('baseline/warehouse-error.png', {
                fullPage: true,
                animations: 'disabled'
            });
        }
    });
});