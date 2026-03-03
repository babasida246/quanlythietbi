import { test as base, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ------------------------------------------------------------------ */
/*  Screenshot directory                                               */
/* ------------------------------------------------------------------ */
export const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

/* ------------------------------------------------------------------ */
/*  Helper: chụp full-page screenshot + attach vào report              */
/* ------------------------------------------------------------------ */
export async function snap(
    page: Page,
    name: string,
    projectName: string,
    testInfo: { attach: (name: string, options: { path: string; contentType: string }) => Promise<void> }
): Promise<string> {
    const sanitizedProject = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const dir = path.join(SCREENSHOT_DIR, sanitizedProject)
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${sanitizedName}.png`)

    // Chờ page ổn định (animation, lazy-load…)
    await page.waitForLoadState('domcontentloaded').catch(() => { })
    await page.waitForLoadState('networkidle').catch(() => { })
    await page.waitForTimeout(1000)

    await page.screenshot({ path: filePath, fullPage: true })
    await testInfo.attach(sanitizedName, { path: filePath, contentType: 'image/png' })
    return filePath
}

/* ------------------------------------------------------------------ */
/*  Helper: navigate an toàn – không bị treo ở networkidle            */
/* ------------------------------------------------------------------ */
export async function navigateTo(page: Page, path: string): Promise<void> {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Chờ thêm networkidle nhưng không chặn nếu timeout
    await page.waitForLoadState('networkidle').catch(() => { })
    await page.waitForTimeout(500)
}

/* ------------------------------------------------------------------ */
/*  Custom fixture: authedPage – đăng nhập 1 lần, cache lại state     */
/* ------------------------------------------------------------------ */
type AuditFixtures = {
    authedPage: Page
}

const AUTH_STATE_FILE = path.resolve(__dirname, '.auth-state.json')


export const test = base.extend<AuditFixtures>({
    authedPage: async ({ browser }, use) => {
        // Nếu đã login trước đó → dùng lại state
        if (fs.existsSync(AUTH_STATE_FILE)) {
            const ctx = await browser.newContext({
                storageState: AUTH_STATE_FILE,
                viewport: { width: 1920, height: 1080 }
            })
            const p = await ctx.newPage()
            // Verify auth vẫn còn hiệu lực
            await p.goto('/')
            const url = p.url()
            if (!url.includes('/login')) {
                await use(p)
                await ctx.close()
                return
            }
            // Auth hết hạn → login lại
            await ctx.close()
            fs.unlinkSync(AUTH_STATE_FILE)
        }

        // Login qua form
        const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
        const page = await ctx.newPage()
        await page.goto('/login', { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', 'admin@example.com')
        await page.fill('input[type="password"]', 'Benhvien@121')
        await page.click('button[type="submit"]')

        // Chờ redirect thành công
        await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })
        await page.waitForLoadState('networkidle')

        // Cache lại state
        await ctx.storageState({ path: AUTH_STATE_FILE })
        await use(page)
        await ctx.close()
    }
})

export { expect }
