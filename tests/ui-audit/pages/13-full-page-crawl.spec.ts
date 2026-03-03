/**
 * 13-full-page-crawl.spec.ts
 * Crawl tự động: duyệt qua TẤT CẢ các link nội bộ tìm được trên trang,
 * chụp screenshot mỗi trang unique nhằm bắt những trang chưa được liệt kê thủ công.
 */
import { test, expect, snap } from '../fixtures'

/** Tất cả route tĩnh đã biết của ứng dụng */
const KNOWN_ROUTES = [
    '/',
    '/login',
    '/setup',
    '/me/assets',
    '/me/requests',
    '/notifications',
    '/inbox',
    '/assets',
    '/assets/catalogs',
    '/assets/purchase-plans',
    '/assets/purchase-plans/new',
    '/assets/asset-increases/new',
    '/cmdb',
    '/cmdb/cis',
    '/cmdb/services',
    '/cmdb/types',
    '/cmdb/changes',
    '/cmdb/relationships/import',
    '/cmdb/reports',
    '/inventory',
    '/warehouse',
    '/warehouse/stock',
    '/warehouse/warehouses',
    '/warehouse/documents',
    '/warehouse/documents/new',
    '/warehouse/parts',
    '/warehouse/repairs',
    '/warehouse/ledger',
    '/warehouse/reports',
    '/maintenance',
    '/requests',
    '/requests/new',
    '/reports/assets',
    '/admin',
]

test.describe('Full-page crawl – Quét mọi trang', () => {
    test('Crawl và chụp từng known route', async ({ authedPage: page }, testInfo) => {
        test.setTimeout(600_000) // 10 phút cho crawl
        const visited = new Set<string>()
        const discoveredLinks = new Set<string>()

        /** Re-login nếu bị redirect về /login */
        async function ensureAuth(): Promise<void> {
            const currentUrl = page.url()
            if (currentUrl.includes('/login')) {
                await page.fill('input[type="email"]', 'admin@example.com')
                await page.fill('input[type="password"]', 'Benhvien@121')
                await page.click('button[type="submit"]')
                await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15_000 })
                await page.waitForTimeout(1000)
            }
        }

        for (const route of KNOWN_ROUTES) {
            if (visited.has(route)) continue
            visited.add(route)

            if (page.isClosed()) {
                console.warn('⚠ Page closed, stopping known routes crawl')
                break
            }

            try {
                const response = await page.goto(route, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15_000
                })
                // Chờ thêm networkidle nhưng không block
                await page.waitForLoadState('networkidle').catch(() => { })
                await page.waitForTimeout(500)

                // Re-login nếu auth hết hạn
                await ensureAuth()

                const status = response?.status() ?? 0
                const currentUrl = new URL(page.url())
                const actualPath = currentUrl.pathname

                // Chụp screenshot
                const safeName = route.replace(/\//g, '_').replace(/^_/, '') || 'root'
                await snap(
                    page,
                    `crawl-${safeName}`,
                    testInfo.project.name,
                    testInfo
                )

                // Thu thập thêm link nội bộ từ trang  
                const links = await page.$$eval('a[href]', (anchors) =>
                    anchors
                        .map((a) => a.getAttribute('href'))
                        .filter((href): href is string =>
                            !!href &&
                            href.startsWith('/') &&
                            !href.startsWith('//') &&
                            !href.includes('logout')
                        )
                )

                for (const link of links) {
                    // Chuẩn hóa: bỏ query string
                    const clean = link.split('?')[0].split('#')[0]
                    if (clean && !visited.has(clean)) {
                        discoveredLinks.add(clean)
                    }
                }

                console.log(`✓ ${route} → ${status} (actual: ${actualPath})`)
            } catch (err) {
                console.warn(`✗ ${route} → ERROR: ${err}`)
            }
        }

        // Duyệt thêm các link mới phát hiện được (tối đa 10 trang, chỉ chọn 1 mẫu cho mỗi pattern)
        let extraCount = 0
        const visitedPatterns = new Set<string>()
        for (const link of discoveredLinks) {
            if (visited.has(link) || extraCount >= 10) continue

            // Nhóm theo pattern: /inventory/UUID → /inventory/[id]
            const pattern = link.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[id]')
            if (visitedPatterns.has(pattern)) continue
            visitedPatterns.add(pattern)

            visited.add(link)
            extraCount++

            // Kiểm tra page còn sống không
            if (page.isClosed()) {
                console.warn('⚠ Page closed, stopping discovered crawl')
                break
            }

            try {
                const response = await page.goto(link, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10_000
                })
                await page.waitForLoadState('networkidle').catch(() => { })
                await page.waitForTimeout(500)

                // Re-login nếu auth hết hạn
                await ensureAuth()

                const status = response?.status() ?? 0
                const safeName = link.replace(/\//g, '_').replace(/^_/, '') || 'discovered'
                await snap(
                    page,
                    `crawl-discovered-${safeName}`,
                    testInfo.project.name,
                    testInfo
                )
                console.log(`✓ [discovered] ${link} → ${status}`)
            } catch (err) {
                console.warn(`✗ [discovered] ${link} → ERROR: ${err}`)
            }
        }

        // Log summary
        console.log(`\n=== CRAWL SUMMARY ===`)
        console.log(`Known routes visited: ${KNOWN_ROUTES.length}`)
        console.log(`Discovered links: ${discoveredLinks.size}`)
        console.log(`Extra pages crawled: ${extraCount}`)
        console.log(`Total unique pages: ${visited.size}`)
    })
})
