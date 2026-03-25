#!/usr/bin/env node
/**
 * db-seed.mjs — Run all seed SQL files directly against PostgreSQL
 * Usage: node scripts/db-seed.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — PostgreSQL connection string (default: postgresql://postgres:postgres@localhost:5432/qltb)
 */
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { pgConfig } from './_pg-connect.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_DIR = join(__dirname, '..', 'db')
const ROOT = join(__dirname, '..')
const ENV_PATH = join(ROOT, '.env')
const ENV_LOCAL_PATH = join(ROOT, '.env.local')

if (existsSync(ENV_PATH)) config({ path: ENV_PATH })
if (existsSync(ENV_LOCAL_PATH)) config({ path: ENV_LOCAL_PATH, override: true })

const SEED_FILES = [
    'seed-data.sql',            // 1. Foundation: users, locations, vendors
    'seed-assets-management.sql', // 2. Asset catalog: models, warehouses
    'seed-assets.sql',          // 3. Assets (50 units) + transactions
    'seed-accessories.sql',     // 4. Accessories, consumables, components, licenses
    'seed-warehouse.sql',       // 5. Warehouse stock, purchase plans
    'seed-analytics.sql',       // 6. Analytics: reports, dashboards
    'seed-chat-ai.sql',         // 7. AI/Chat: providers, models, channels
    'seed-ops.sql',             // 8. Ops: alerts, notifications, RBAC
    'seed-ad-rbac-resources.sql', // 9. AD RBAC resource directives + role mapping
    'seed-qlts-demo.sql',       // 9. CMDB CIs, wf_definitions (needed by next files)
    'seed-workflows.sql',       // 10. wf_requests + automation (depends on wf_definitions)
    'seed-inventory-audit.sql', // 11. Inventory audit (depends on cmdb_cis)
    'seed-depreciation-2026.sql', // 12. Depreciation schedules + 2026 runs/entries
    'seed-new-features.sql',     // 13. Organizations hierarchy, spare part stock, stock documents, notifications
    'seed-cmdb-config-files.sql', // 14. CMDB config files & version history
]

const client = new pg.Client(pgConfig())
await client.connect()

console.log(`\n🌱  Running ${SEED_FILES.length} seed files...`)

try {
    for (const file of SEED_FILES) {
        const filePath = join(DB_DIR, file)
        const sql = readFileSync(filePath, 'utf8')
        process.stdout.write(`  → ${file} ... `)
        try {
            await client.query(sql)
            console.log('✅')
        } catch (err) {
            console.log('❌')
            console.error(`\nError in ${file}:\n${err.message}`)
            process.exit(1)
        }
    }
} finally {
    await client.end()
}

console.log('\n✅ Seed complete\n')
