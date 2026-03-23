#!/usr/bin/env node
/**
 * scripts/playwright-report-to-md.mjs
 *
 * Đọc playwright-report/results.json (json reporter) và xuất ra
 * docs/playwright-results.md với bảng tóm tắt + chi tiết lỗi.
 *
 * Cách dùng:
 *   node scripts/playwright-report-to-md.mjs [input] [output]
 *
 * Mặc định:
 *   input  = playwright-report/results.json
 *   output = docs/playwright-results.md
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

const inputFile  = process.argv[2] ?? resolve(ROOT, 'playwright-report/results.json')
const outputFile = process.argv[3] ?? resolve(ROOT, 'docs/playwright-results.md')

if (!existsSync(inputFile)) {
    console.error(`[error] File không tồn tại: ${inputFile}`)
    console.error('Hãy chạy "pnpm test:e2e" trước để sinh results.json')
    process.exit(1)
}

// ── Parse JSON ────────────────────────────────────────────────────────────────

/** @type {PlaywrightResults} */
const data = JSON.parse(readFileSync(inputFile, 'utf8'))

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str = '') {
    return String(str).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

function fmtDuration(ms) {
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
    if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`
    return `${ms}ms`
}

function fmtDate(isoStr) {
    if (!isoStr) return '—'
    try {
        return new Date(isoStr).toLocaleString('vi-VN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
    } catch {
        return isoStr
    }
}

function statusIcon(status) {
    switch (status) {
        case 'passed':   return '✅'
        case 'failed':   return '❌'
        case 'timedOut': return '⏱️'
        case 'skipped':  return '⏭️'
        case 'interrupted': return '🛑'
        default:         return '🔵'
    }
}

// ── Collect all test results ──────────────────────────────────────────────────

/**
 * Recursively walk suite tree and collect leaf test items.
 * Returns array of { project, file, suite, title, status, duration, error }
 */
function collectTests(suites, projectName = '', filePath = '', suitePath = []) {
    const results = []
    for (const suite of suites ?? []) {
        const currentFile = suite.file ?? filePath
        const currentSuite = [...suitePath, suite.title].filter(Boolean)

        // Leaf specs
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                const result = test.results?.[0] ?? {}
                const status = result.status ?? (test.status === 'skipped' ? 'skipped' : 'unknown')
                const error = result.error?.message ?? result.error?.value ?? ''
                results.push({
                    project: projectName || test.projectName || '',
                    file: currentFile,
                    suite: currentSuite.join(' › '),
                    title: spec.title,
                    fullTitle: [...currentSuite, spec.title].join(' › '),
                    status,
                    duration: result.duration ?? 0,
                    error: error.replace(/\x1b\[[0-9;]*m/g, '').trim(), // strip ANSI
                    retry: result.retry ?? 0,
                })
            }
        }

        // Recurse into child suites
        results.push(...collectTests(suite.suites, projectName, currentFile, currentSuite))
    }
    return results
}

// Playwright JSON: top-level has `suites` (one per project/file combo)
// Each suite may have `project` or carry it in test.projectName
const allTests = []
for (const suite of data.suites ?? []) {
    const project = suite.project?.name ?? suite.title ?? ''
    allTests.push(...collectTests([suite], project))
}

// ── Compute stats ─────────────────────────────────────────────────────────────

const stats = data.stats ?? {}
const totalDurationMs = stats.duration ?? allTests.reduce((s, t) => s + t.duration, 0)

const passed   = allTests.filter(t => t.status === 'passed').length
const failed   = allTests.filter(t => ['failed', 'timedOut', 'interrupted'].includes(t.status)).length
const skipped  = allTests.filter(t => t.status === 'skipped').length
const total    = allTests.length
const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0'

const failedTests = allTests.filter(t => ['failed', 'timedOut', 'interrupted'].includes(t.status))

// ── Group by file for per-file summary ────────────────────────────────────────

const byFile = new Map()
for (const t of allTests) {
    const key = t.file || '(unknown)'
    if (!byFile.has(key)) byFile.set(key, [])
    byFile.get(key).push(t)
}

// Sort: failed files first, then alphabetical
const sortedFiles = [...byFile.entries()].sort(([aFile, aTests], [bFile, bTests]) => {
    const aFail = aTests.some(t => ['failed','timedOut','interrupted'].includes(t.status)) ? 0 : 1
    const bFail = bTests.some(t => ['failed','timedOut','interrupted'].includes(t.status)) ? 0 : 1
    return aFail - bFail || aFile.localeCompare(bFile)
})

// ── Build Markdown ────────────────────────────────────────────────────────────

const lines = []

const runDate = fmtDate(stats.startTime)

lines.push(`# Kết quả kiểm thử Playwright`)
lines.push(``)
lines.push(`> Ngày chạy: **${runDate}**  `)
lines.push(`> Thời gian thực thi: **${fmtDuration(totalDurationMs)}**  `)
lines.push(`> File nguồn: \`${inputFile.replace(ROOT + '\\', '').replace(ROOT + '/', '')}\``)
lines.push(``)
lines.push(`---`)
lines.push(``)

// ── Tổng quan ─────────────────────────────────────────────────────────────────
lines.push(`## 1. Tổng quan`)
lines.push(``)
lines.push(`| Chỉ số | Giá trị |`)
lines.push(`|---|---|`)
lines.push(`| Tổng số test | **${total}** |`)
lines.push(`| ✅ Passed | **${passed}** |`)
lines.push(`| ❌ Failed | **${failed}** |`)
lines.push(`| ⏭️ Skipped | **${skipped}** |`)
lines.push(`| Tỉ lệ pass | **${passRate} %** |`)
lines.push(`| Thời gian | ${fmtDuration(totalDurationMs)} |`)
lines.push(``)

// ── Kết quả theo file ─────────────────────────────────────────────────────────
lines.push(`---`)
lines.push(``)
lines.push(`## 2. Kết quả theo spec file`)
lines.push(``)
lines.push(`| Status | Spec file | Total | ✅ | ❌ | ⏭️ |`)
lines.push(`|---|---|---|---|---|---|`)

for (const [file, tests] of sortedFiles) {
    const fileTotal   = tests.length
    const filePassed  = tests.filter(t => t.status === 'passed').length
    const fileFailed  = tests.filter(t => ['failed','timedOut','interrupted'].includes(t.status)).length
    const fileSkipped = tests.filter(t => t.status === 'skipped').length
    const icon = fileFailed > 0 ? '❌' : fileSkipped === fileTotal ? '⏭️' : '✅'
    const shortFile = file.replace(/^.*[/\\]tests[/\\]/, 'tests/').replace(/\\/g, '/')
    lines.push(`| ${icon} | \`${shortFile}\` | ${fileTotal} | ${filePassed} | ${fileFailed} | ${fileSkipped} |`)
}

lines.push(``)

// ── Chi tiết lỗi ──────────────────────────────────────────────────────────────
if (failedTests.length > 0) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## 3. Chi tiết lỗi (${failedTests.length} tests)`)
    lines.push(``)

    failedTests.forEach((t, i) => {
        const icon = t.status === 'timedOut' ? '⏱️' : '❌'
        const shortFile = t.file.replace(/^.*[/\\]tests[/\\]/, 'tests/').replace(/\\/g, '/')
        lines.push(`### ${icon} ${i + 1}. ${esc(t.fullTitle || t.title)}`)
        lines.push(``)
        lines.push(`| | |`)
        lines.push(`|---|---|`)
        lines.push(`| **Project** | ${esc(t.project)} |`)
        lines.push(`| **File** | \`${shortFile}\` |`)
        lines.push(`| **Status** | ${t.status} |`)
        lines.push(`| **Duration** | ${fmtDuration(t.duration)} |`)
        if (t.retry > 0) {
            lines.push(`| **Retries** | ${t.retry} |`)
        }
        lines.push(``)
        if (t.error) {
            lines.push(`**Error:**`)
            lines.push(`\`\`\``)
            // Limit error to 20 lines to avoid huge output
            const errorLines = t.error.split('\n').slice(0, 20)
            lines.push(errorLines.join('\n'))
            lines.push(`\`\`\``)
            lines.push(``)
        }
    })
} else {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## 3. Chi tiết lỗi`)
    lines.push(``)
    lines.push(`> ✅ Không có lỗi nào!`)
    lines.push(``)
}

// ── Danh sách tất cả tests ────────────────────────────────────────────────────
lines.push(`---`)
lines.push(``)
lines.push(`## 4. Danh sách tất cả tests`)
lines.push(``)
lines.push(`| Status | Project | Test | Duration |`)
lines.push(`|---|---|---|---|`)

for (const t of allTests) {
    const icon = statusIcon(t.status)
    const shortTitle = esc(t.fullTitle || t.title).substring(0, 80)
    lines.push(`| ${icon} | ${esc(t.project)} | ${shortTitle} | ${fmtDuration(t.duration)} |`)
}

lines.push(``)
lines.push(`---`)
lines.push(``)
lines.push(`*Generated by \`scripts/playwright-report-to-md.mjs\`*`)

// ── Write output ──────────────────────────────────────────────────────────────

writeFileSync(outputFile, lines.join('\n'), 'utf8')
console.log(`✅ Đã xuất: ${outputFile}`)
console.log(`   ${total} tests — ${passed} passed, ${failed} failed, ${skipped} skipped (${passRate}%)`)
