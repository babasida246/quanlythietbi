/**
 * playwright.video.config.ts
 * Cấu hình Playwright chuyên dụng để quay video hướng dẫn sử dụng.
 *
 * Chạy: npx playwright test --config playwright.video.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const webBaseURL = process.env.WEB_DEMO_URL || process.env.WEB_BASE_URL || 'http://localhost:5173'
const apiBaseURL = process.env.API_BASE_URL || 'http://localhost:3000'

export default defineConfig({
    testDir: './tests',
    timeout: 300_000,   // 5 phút mỗi test (video chậm)
    expect: { timeout: 15_000 },
    fullyParallel: false,
    retries: 0,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/video-guide' }]
    ],
    use: {
        baseURL: webBaseURL,
        trace: 'off',
        screenshot: 'off',
        video: {
            mode: 'on',
            size: { width: 1920, height: 1080 }
        },
        // Viewport 1920×1080
        viewport: { width: 1920, height: 1080 },
        // Hiển thị chuột trong video
        launchOptions: {
            args: ['--start-maximized'],
            slowMo: 0
        }
    },
    outputDir: 'video-output',
    projects: [
        {
            name: 'video-guide',
            testMatch: '**/video-guide.spec.ts',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
                video: {
                    mode: 'on',
                    size: { width: 1920, height: 1080 }
                }
            }
        }
    ],
    webServer: [
        {
            command: 'pnpm --filter @qltb/api dev',
            url: `${apiBaseURL}/health`,
            timeout: 120_000,
            reuseExistingServer: true,
            stdout: 'ignore',
            stderr: 'ignore'
        },
        {
            command: `pnpm --filter @qltb/web-ui dev --port 5173 --host 127.0.0.1`,
            url: `${webBaseURL}`,
            timeout: 120_000,
            reuseExistingServer: true,
            stdout: 'ignore',
            stderr: 'ignore'
        }
    ]
})
