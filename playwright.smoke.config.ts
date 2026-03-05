/**
 * playwright.smoke.config.ts
 *
 * Config ringan cho smoke scan — không cần global setup / teardown.
 * Dùng server đang chạy (reuse existing).
 *
 * Chạy với:
 *   pnpm exec playwright test --config=playwright.smoke.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const webBaseURL = process.env.WEB_BASE_URL || 'http://127.0.0.1:5173'
const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3000'

export default defineConfig({
    testDir: './tests/ui',
    testMatch: 'smoke-empty-state.spec.ts',
    fullyParallel: false,        // tuần tự để dễ đọc log
    retries: 1,
    timeout: 60_000,
    expect: { timeout: 12_000 },
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }]
    ],
    use: {
        baseURL: webBaseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    // Reuse whatever server is already running — no webServer block needed.
    // Set PLAYWRIGHT_REUSE_SERVER=0 to disable.
})
