import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:4010'
const webBaseURL = process.env.WEB_BASE_URL || 'http://127.0.0.1:4011'
const apiUrl = new URL(apiBaseURL)
const webUrl = new URL(webBaseURL)
// Khi chạy local với Docker stack đã sẵn, playwright tái sử dụng server thay vì tự khởi động
const reuseServer = !isCi

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: isCi,
    retries: isCi ? 2 : 0,
    timeout: 60_000,
    expect: {
        timeout: 10_000
    },
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }]
    ],
    use: {
        baseURL: webBaseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    globalSetup: './tests/global.setup.ts',
    globalTeardown: './tests/global.teardown.ts',
    projects: [
        {
            name: 'api',
            testDir: './tests/api',
            testMatch: '**/*.spec.ts',
            use: {
                baseURL: apiBaseURL
            }
        },
        {
            name: 'chromium',
            testDir: './tests/ui',
            testMatch: '**/*.spec.ts',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: webBaseURL
            }
        }
    ],
    webServer: [
        {
            command: 'pnpm --filter @qltb/api dev',
            url: `${apiBaseURL}/health`,
            timeout: 120_000,
            reuseExistingServer: reuseServer,
            env: {
                ...process.env,
                PORT: apiUrl.port || '4010',
                HOST: apiUrl.hostname
            }
        },
        {
            command: `pnpm --filter @qltb/web-ui exec vite dev --port ${webUrl.port || '4011'} --host ${webUrl.hostname}`,
            url: `${webBaseURL}/login`,
            timeout: 120_000,
            reuseExistingServer: reuseServer,
            env: {
                ...process.env,
                VITE_API_BASE: `${apiBaseURL}/api`,
                VITE_API_BASE_URL: apiBaseURL
            }
        }
    ]
})
