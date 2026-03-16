#!/usr/bin/env node
/**
 * Smoke test: verify role-based access to /warehouse/stock in UI guard layer.
 *
 * Usage:
 *   node scripts/smoke-warehouse-role-access.mjs
 *   node scripts/smoke-warehouse-role-access.mjs http://127.0.0.1:5173
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] || process.env.WEB_BASE_URL || 'http://127.0.0.1:5173'

const ROLE_CASES = [
    { role: 'warehouse_keeper', expectedAllowed: true },
    { role: 'storekeeper', expectedAllowed: true },
    { role: 'warehouse_staff', expectedAllowed: true }
]

async function runCase(browser, roleCase) {
    const context = await browser.newContext()

    // Keep the smoke test focused on UI route guards, not backend availability/auth refresh.
    await context.route('**/api/**', async (route) => {
        const url = route.request().url()

        if (url.includes('/api/v1/admin/ad-rbac/me/effective-permissions')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: { allowed: [], denied: [] } })
            })
            return
        }

        if (url.includes('/api/setup/org')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { name: 'QLTB', shortName: 'QB' }
                })
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [] })
        })
    })

    await context.addInitScript(({ role }) => {
        localStorage.setItem('authToken', 'smoke-token')
        localStorage.setItem('userEmail', `${role}@smoke.local`)
        localStorage.setItem('userRole', role)
    }, { role: roleCase.role })

    const page = await context.newPage()

    try {
        await page.goto(`${BASE}/warehouse/stock`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(800)

        const currentUrl = page.url()
        const pathname = new URL(currentUrl).pathname
        const blocked = pathname.startsWith('/login') || pathname.startsWith('/forbidden')
        const allowed = !blocked
        const pass = allowed === roleCase.expectedAllowed

        console.log(`${pass ? '✅' : '❌'} role=${roleCase.role} -> ${pathname} (${allowed ? 'ALLOWED' : 'BLOCKED'})`)

        await context.close()
        return pass
    } catch (error) {
        console.log(`❌ role=${roleCase.role} -> ERROR: ${error instanceof Error ? error.message : String(error)}`)
        await context.close()
        return false
    }
}

async function main() {
    const browser = await chromium.launch({ headless: true })
    try {
        console.log(`\n🔍 Smoke role-access check for /warehouse/stock at ${BASE}\n`)

        const results = []
        for (const roleCase of ROLE_CASES) {
            results.push(await runCase(browser, roleCase))
        }

        const passed = results.filter(Boolean).length
        console.log(`\n📊 Result: ${passed}/${results.length} passed\n`)
        process.exitCode = results.every(Boolean) ? 0 : 1
    } finally {
        await browser.close()
    }
}

main()
