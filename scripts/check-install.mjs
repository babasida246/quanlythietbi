#!/usr/bin/env node
// Chay truoc pnpm dev / dev:web / dev:all.
// 1. Kiem tra pnpm-lock.yaml vs node_modules → pnpm install neu can
// 2. Kiem tra dist/ cua tung package → build neu thieu, theo dung thu tu dependency

import { existsSync, statSync, rmSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── 1. Kiem tra va install packages ─────────────────────────────────────────

const nodeModules = resolve(ROOT, 'node_modules')
const lockFile = resolve(ROOT, 'pnpm-lock.yaml')

function needsInstall() {
    if (!existsSync(nodeModules)) return true
    if (existsSync(lockFile)) {
        const lockMtime = statSync(lockFile).mtimeMs
        const nmMtime = statSync(nodeModules).mtimeMs
        if (lockMtime > nmMtime) return true
    }
    return false
}

if (needsInstall()) {
    console.log('[check-install] pnpm-lock.yaml moi hon node_modules — dang chay pnpm install...')
    try {
        execSync('pnpm install', { stdio: 'inherit', cwd: ROOT })
    } catch {
        console.error('[check-install] pnpm install that bai.')
        process.exit(1)
    }
}

// ── 2. Kiem tra va build packages theo thu tu dependency ────────────────────
// Thu tu bat buoc: domain → contracts → infra-postgres → application

const PACKAGES = [
    { name: '@qltb/domain',          dir: 'packages/domain' },
    { name: '@qltb/contracts',       dir: 'packages/contracts' },
    { name: '@qltb/infra-postgres',  dir: 'packages/infra-postgres' },
    { name: '@qltb/application',     dir: 'packages/application' },
]

for (const pkg of PACKAGES) {
    const pkgDir = resolve(ROOT, pkg.dir)
    const distEntry = resolve(pkgDir, 'dist', 'index.js')

    if (!existsSync(distEntry)) {
        console.log(`[check-install] ${pkg.name}: dist/ chua co — dang build...`)

        // Xoa .tsbuildinfo cu: incremental cache co the lam tsc bo qua emit du dist/ khong co
        try {
            for (const f of readdirSync(pkgDir)) {
                if (f.endsWith('.tsbuildinfo')) rmSync(resolve(pkgDir, f))
            }
        } catch { /* bo qua */ }

        try {
            execSync(`pnpm --filter ${pkg.name} build`, { stdio: 'inherit', cwd: ROOT })
        } catch {
            console.error(`[check-install] Build that bai: ${pkg.name}`)
            process.exit(1)
        }

        if (!existsSync(distEntry)) {
            console.error(`[check-install] ${pkg.name}: dist/index.js van khong co sau khi build.`)
            process.exit(1)
        }
    }
}
