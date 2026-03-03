#!/usr/bin/env node
/**
 * QuanLyThietBi - Smoke Test Script
 * 
 * Usage:
 *   node scripts/smoke-assets.mjs            # default localhost:3000
 *   node scripts/smoke-assets.mjs http://api:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000'

async function check(label, url, expectedStatus = 200) {
    try {
        const res = await fetch(url)
        const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
        const ok = expected.includes(res.status)
        const body = await res.json().catch(() => res.text())
        console.log(`${ok ? '✅' : '❌'} ${label} — ${res.status} ${ok ? 'OK' : 'FAIL'}`)
        if (!ok) console.log('   ', JSON.stringify(body).slice(0, 200))
        return ok
    } catch (err) {
        console.log(`❌ ${label} — ERROR: ${err.message}`)
        return false
    }
}

async function main() {
    console.log(`\n🔍 Smoke testing QuanLyThietBi API at ${BASE}\n`)

    const results = []

    // Health
    results.push(await check('GET /health', `${BASE}/health`))
    results.push(await check('GET /health/ready', `${BASE}/health/ready`))

    // Root
    results.push(await check('GET /', `${BASE}/`))

    // Assets endpoints (may return 401 if auth required — that's expected, 200 or 401 are ok)
    results.push(await check('GET /api/v1/assets', `${BASE}/api/v1/assets`, [200, 401]))
    results.push(await check('GET /api/v1/assets/catalogs', `${BASE}/api/v1/assets/catalogs`, [200, 401]))
    results.push(await check('GET /api/v1/assets/catalogs/categories', `${BASE}/api/v1/assets/catalogs/categories`, [200, 401]))
    results.push(await check('GET /api/v1/assets/catalogs/vendors', `${BASE}/api/v1/assets/catalogs/vendors`, [200, 401]))
    results.push(await check('GET /api/v1/assets/catalogs/locations', `${BASE}/api/v1/assets/catalogs/locations`, [200, 401]))

    // OpenAPI
    results.push(await check('GET /openapi.json', `${BASE}/openapi.json`))

    console.log(`\n📊 Results: ${results.filter(Boolean).length}/${results.length} passed\n`)
    process.exitCode = results.every(Boolean) ? 0 : 1
}

main()
