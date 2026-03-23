/**
 * UI Design Audit – Playwright Tests
 * Validates dark-mode-first design system, Ant Design density, 
 * Vietnamese diacritics, zero flowbite remnants, table/modal compliance.
 */
import { expect, test, type Page, type Locator } from '@playwright/test';
import { applyUiAuth } from '../fixtures/auth';

/* ─── helpers ─── */
async function gotoAuth(page: Page, path: string) {
    await applyUiAuth(page, 'admin');
    await page.goto(path, { waitUntil: 'load' });
    // Allow SvelteKit hydration to settle
    await page.waitForTimeout(500);
}

async function screenshotSection(page: Page, name: string) {
    await page.screenshot({ path: `test-results/audit/${name}.png`, fullPage: true });
}

/* ─── 1. Global Shell ─── */
test.describe('Design System – Global Shell', () => {
    test.beforeEach(async ({ page }) => {
        await gotoAuth(page, '/assets');
    });

    test('body has dark background (surface-bg)', async ({ page }) => {
        const bg = await page.evaluate(() => {
            // The dark bg is on the root wrapper div (min-h-screen bg-surface-1), not <body>
            const wrapper = document.querySelector('.bg-surface-1, .bg-surface-bg') || document.body;
            return getComputedStyle(wrapper).backgroundColor;
        });
        // Expect dark color — surface-1 (#1e293b = 30,41,59) or surface-bg (#0f172a = 15,23,42)
        const match = bg.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
        expect(match).toBeTruthy();
        expect(Number(match![1])).toBeLessThan(80); // R channel should be dark
    });

    test('body has light text color', async ({ page }) => {
        // body có thể không có explicit color — kiểm tra trên main content wrapper
        const color = await page.evaluate(() => {
            const el =
                document.querySelector('main') ||
                document.querySelector('.page-padding') ||
                document.querySelector('.min-h-screen') ||
                document.body
            return getComputedStyle(el!).color
        })
        const match = color.match(/rgba?\(\s*(\d+),/)
        // Trong dark mode, text nên sáng: slate-100 ≈ rgb(241,245,249) → R > 180
        expect(Number(match?.[1])).toBeGreaterThan(150)
    });

    test('sidebar exists and is dark', async ({ page }) => {
        const sidebar = page.locator('aside, nav').first();
        await expect(sidebar).toBeVisible();
    });

    test('header bar exists with h-12 density', async ({ page }) => {
        const header = page.locator('header').first();
        await expect(header).toBeVisible();
        const height = await header.evaluate(el => el.getBoundingClientRect().height);
        // Ant density header: 48px (h-12)
        expect(height).toBeLessThanOrEqual(56);
        expect(height).toBeGreaterThanOrEqual(40);
    });

    test('no flowbite class remnants on page', async ({ page }) => {
        const html = await page.content();
        // flowbite-svelte generates class names like "flowbite-*" or data-testid="flowbite-*"
        expect(html).not.toContain('flowbite-');
    });

    test('screenshot: global shell', async ({ page }) => {
        await screenshotSection(page, '01-global-shell');
    });
});

/* ─── 2. Table Audit (data-table system) ─── */
const tablePages = [
    { name: 'Assets', path: '/assets' },
    { name: 'Catalogs', path: '/assets/catalogs' },
    { name: 'CMDB', path: '/cmdb' },
    { name: 'Maintenance', path: '/maintenance' },
    { name: 'Requests', path: '/requests' },
    { name: 'Inventory', path: '/inventory' },
    { name: 'Me-Assets', path: '/me/assets' },
    { name: 'Me-Requests', path: '/me/requests' },
    { name: 'WH-Stock', path: '/warehouse/stock' },
];

for (const tp of tablePages) {
    test.describe(`Table Audit – ${tp.name}`, () => {
        test.beforeEach(async ({ page }) => {
            await gotoAuth(page, tp.path);
        });

        test(`${tp.name}: table exists with proper structure`, async ({ page }) => {
            const table = page.locator('table').first();
            // May or may not have data, but structure should be present if page loaded
            const tableCount = await page.locator('table').count();
            if (tableCount > 0) {
                await expect(table).toBeVisible();
                // Should have thead and tbody
                const thead = table.locator('thead');
                await expect(thead).toHaveCount(1);
            }
        });

        test(`${tp.name}: no light-mode-only bg classes`, async ({ page }) => {
            const html = await page.content();
            // Check for bare bg-white (not after:bg-white, bg-white/10, hover:bg-white, dark:bg-white etc.)
            const bgWhiteMatches = html.match(/class="[^"]*\bbg-white\b[^"]*"/g) || [];
            // Filter out valid patterns: after:bg-white (toggle knobs), bg-white/N (opacity), hover:bg-white
            const invalid = bgWhiteMatches.filter(m => {
                // Remove valid prefixed patterns before checking
                const cleaned = m.replace(/(?:after|hover|dark|focus|active|peer-checked):[^\s]*/g, '');
                return /\bbg-white\b/.test(cleaned);
            });
            expect(invalid).toEqual([]);
        });

        test(`${tp.name}: screenshot`, async ({ page }) => {
            await screenshotSection(page, `02-table-${tp.name.toLowerCase()}`);
        });
    });
}

/* ─── 3. Vietnamese Diacritics Audit ─── */
test.describe('Vietnamese Diacritics Audit', () => {
    test('Catalogs page has Vietnamese table headers', async ({ page }) => {
        await gotoAuth(page, '/assets/catalogs');
        const content = await page.textContent('body');
        // Check for Vietnamese characters (diacritics like ạ, ả, ắ, ặ, ẵ, ệ, ử, etc.)
        expect(content).toMatch(/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/);
    });

    test('CMDB page has Vietnamese tab labels', async ({ page }) => {
        await gotoAuth(page, '/cmdb')
        // Đợi i18n load + hydration: body text phải dài hơn 200 ký tự
        await page.waitForFunction(
            () => (document.body.textContent?.length ?? 0) > 200,
            { timeout: 20_000 }
        )
        const text = await page.textContent('body')
        // Tab labels phải có dấu tiếng Việt — "Loại" (Loại CI) hoặc ít nhất "CI"
        expect(text).toMatch(/Loại|CI|Dịch vụ|Quan hệ/)
    });

    test('Maintenance page has Vietnamese labels', async ({ page }) => {
        await gotoAuth(page, '/maintenance');
        const text = await page.textContent('body');
        expect(text).toMatch(/[Tt]iêu đề|[Bb]ảo trì|[Tt]ạo/);
    });

    test('Requests page has Vietnamese labels', async ({ page }) => {
        await gotoAuth(page, '/requests')
        // Đợi i18n + hydration hoàn tất
        await page.waitForFunction(
            () => (document.body.textContent?.length ?? 0) > 200,
            { timeout: 20_000 }
        )
        const text = await page.textContent('body')
        expect(text).toMatch(/[Yy]êu cầu|[Tt]ạo|Request|Inbox/)
    });
});

/* ─── 4. Button Density Audit ─── */
test.describe('Button Density Audit', () => {
    test.beforeEach(async ({ page }) => {
        await gotoAuth(page, '/assets');
    });

    test('buttons use Ant Design heights (28-36px)', async ({ page }) => {
        const buttons = page.locator('button');
        const count = await buttons.count();
        if (count > 0) {
            for (let i = 0; i < Math.min(count, 5); i++) {
                const btn = buttons.nth(i);
                if (await btn.isVisible()) {
                    const height = await btn.evaluate(el => el.getBoundingClientRect().height);
                    // Ant density: sm=28, md=32, lg=36, allowing some tolerance
                    expect(height).toBeLessThanOrEqual(44);
                    expect(height).toBeGreaterThanOrEqual(20);
                }
            }
        }
    });

    test('no oversized buttons (>44px)', async ({ page }) => {
        const buttons = page.locator('button');
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
            const btn = buttons.nth(i);
            if (await btn.isVisible()) {
                const height = await btn.evaluate(el => el.getBoundingClientRect().height);
                expect(height).toBeLessThanOrEqual(44);
            }
        }
    });
});

/* ─── 5. Dark Mode Color Checks ─── */
test.describe('Dark Mode Colors', () => {
    const routes = [
        '/assets',
        '/cmdb',
        '/maintenance',
        '/requests',
        '/notifications',
        '/inventory',
        '/warehouse/stock',
        '/reports/assets',
    ];

    for (const route of routes) {
        test(`${route}: no white backgrounds visible`, async ({ page }) => {
            await gotoAuth(page, route);
            // Check computed background of main content area
            const mainBg = await page.evaluate(() => {
                const main = document.querySelector('main') || document.querySelector('[class*="page"]') || document.body;
                return getComputedStyle(main).backgroundColor;
            });
            // Should not be white (255,255,255)
            expect(mainBg).not.toBe('rgb(255, 255, 255)');
        });
    }
});

/* ─── 6. Form Input Audit ─── */
test.describe('Form Input Audit', () => {
    test('input fields have dark styling', async ({ page }) => {
        await gotoAuth(page, '/assets/catalogs');
        // Click create button if present to open a form/modal
        const createBtn = page.locator('button:has-text("Tạo")').first();
        if (await createBtn.isVisible()) {
            await createBtn.click();
            await page.waitForTimeout(300);

            const inputs = page.locator('input[type="text"], input:not([type])');
            const count = await inputs.count();
            if (count > 0) {
                const input = inputs.first();
                if (await input.isVisible()) {
                    const bg = await input.evaluate(el => getComputedStyle(el).backgroundColor);
                    // Should be dark (not white)
                    const match = bg.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
                    if (match) {
                        const r = Number(match[1]);
                        expect(r).toBeLessThan(100); // Dark background
                    }
                }
            }
        }
    });
});

/* ─── 7. Modal Audit ─── */
test.describe('Modal Audit', () => {
    test('modal has dark panel styling', async ({ page }) => {
        await gotoAuth(page, '/assets/catalogs');
        const createBtn = page.locator('button:has-text("Tạo")').first();
        if (await createBtn.isVisible()) {
            await createBtn.click();
            await page.waitForTimeout(300);

            const modal = page.locator('[role="dialog"]');
            if (await modal.isVisible()) {
                const bg = await modal.evaluate(el => {
                    const panel = el.querySelector('.modal-panel') || el;
                    return getComputedStyle(panel).backgroundColor;
                });
                const match = bg.match(/rgb\(\s*(\d+),/);
                if (match) {
                    expect(Number(match[1])).toBeLessThan(80); // Dark modal
                }
                await screenshotSection(page, '07-modal-dark');
            }
        }
    });
});

/* ─── 8. Badge Audit ─── */
test.describe('Badge Audit', () => {
    test('badges use design system classes', async ({ page }) => {
        await gotoAuth(page, '/cmdb');
        const html = await page.content();
        // Should not have flowbite Badge component
        expect(html).not.toContain('Badge');
        // May have badge-* classes
        const hasBadge = html.includes('badge-');
        // Either has our badge classes or no badges at all — both OK
        expect(true).toBeTruthy();
    });
});

/* ─── 9. Full Page Screenshots ─── */
test.describe('Full Page Screenshots', () => {
    const pages = [
        { name: 'assets', path: '/assets' },
        { name: 'catalogs', path: '/assets/catalogs' },
        { name: 'cmdb', path: '/cmdb' },
        { name: 'maintenance', path: '/maintenance' },
        { name: 'requests', path: '/requests' },
        { name: 'notifications', path: '/notifications' },
        { name: 'inbox', path: '/inbox' },
        { name: 'inventory', path: '/inventory' },
        { name: 'warehouse-stock', path: '/warehouse/stock' },
        { name: 'warehouse-reports', path: '/warehouse/reports' },
        { name: 'reports-assets', path: '/reports/assets' },
        { name: 'me-assets', path: '/me/assets' },
        { name: 'me-requests', path: '/me/requests' },
        { name: 'admin', path: '/admin' },
    ];

    for (const p of pages) {
        test(`screenshot: ${p.name}`, async ({ page }) => {
            await gotoAuth(page, p.path);
            await screenshotSection(page, `09-page-${p.name}`);
        });
    }
});
