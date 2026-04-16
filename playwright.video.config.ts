/**
 * playwright.video.config.ts
 * Cấu hình Playwright chuyên dụng để quay video hướng dẫn sử dụng QLTB.
 *
 * Chạy:
 *   npx playwright test --config playwright.video.config.ts
 *
 * Video được lưu tại:
 *   test-results/…/video.webm
 *
 * Chuyển sang mp4 (cần ffmpeg):
 *   ffmpeg -i video.webm -c:v libx264 -preset fast -crf 20 video-guide.mp4
 */
import { defineConfig, devices } from '@playwright/test'

const webBaseURL = process.env.WEB_BASE_URL  || 'http://127.0.0.1:4011'
const apiBaseURL = process.env.API_BASE_URL  || 'http://127.0.0.1:4010'
const webUrl     = new URL(webBaseURL)
const apiUrl     = new URL(apiBaseURL)

export default defineConfig({
    testDir:       './tests/ui',
    testMatch:     '**/video-guide.spec.ts',
    fullyParallel: false,
    retries:       0,
    workers:       1,
    timeout:       25 * 60 * 1000, // 25 phút

    expect: { timeout: 20_000 },

    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/video-guide' }],
    ],

    use: {
        baseURL:  webBaseURL,
        viewport: { width: 1280, height: 720 },

        // ── Luôn ghi video toàn bộ test ─────────────────────────
        video: {
            mode: 'on',
            size: { width: 1280, height: 720 },
        },

        // ── slowMo: mỗi action cách nhau 500 ms → video mượt ──
        launchOptions: {
            slowMo: 500,
        },

        screenshot: 'off',
        trace:      'off',
    },

    outputDir: 'video-output',

    globalSetup: './tests/global.setup.ts',

    projects: [
        {
            name: 'video-chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
                video: {
                    mode: 'on',
                    size: { width: 1280, height: 720 },
                },
            },
        },
    ],

    webServer: [
        {
            command: `pnpm --filter @qltb/api dev`,
            url:     `${apiBaseURL}/health`,
            timeout: 120_000,
            reuseExistingServer: true,
            env: {
                ...process.env,
                PORT: apiUrl.port || '4010',
                HOST: apiUrl.hostname,
            },
        },
        {
            command: `pnpm --filter @qltb/web-ui exec vite dev --port ${webUrl.port || '4011'} --host ${webUrl.hostname}`,
            url:     `${webBaseURL}/login`,
            timeout: 120_000,
            reuseExistingServer: true,
            env: {
                ...process.env,
                VITE_API_BASE:     `${apiBaseURL}/api`,
                VITE_API_BASE_URL: apiBaseURL,
            },
        },
    ],
})
