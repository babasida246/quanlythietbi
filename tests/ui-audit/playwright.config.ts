import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Playwright config dành riêng cho bộ test audit UI/UX.
 * Chạy: npx playwright test --config tests/ui-audit/playwright.config.ts
 *
 * Screenshot sẽ được lưu vào: tests/ui-audit/screenshots/
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3001'

export default defineConfig({
    testDir: '.',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,          // chạy tuần tự để tránh conflict session
    retries: 0,
    timeout: 120_000,
    expect: {
        timeout: 15_000
    },
    reporter: [
        ['list'],
        ['html', {
            open: 'never',
            outputFolder: path.resolve(__dirname, 'report')
        }]
    ],
    use: {
        baseURL,
        screenshot: 'on',
        trace: 'on',
        video: 'on',
        viewport: { width: 1920, height: 1080 },
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
    },
    outputDir: path.resolve(__dirname, 'test-results'),
    projects: [
        {
            name: 'Desktop-Chrome-FullHD',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            }
        },
        {
            name: 'Tablet-Landscape',
            use: {
                ...devices['iPad Pro 11 landscape'],
            }
        },
    ]
})
