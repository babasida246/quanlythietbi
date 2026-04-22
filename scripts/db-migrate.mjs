#!/usr/bin/env node
/**
 * db-migrate.mjs — Run migration SQL files against PostgreSQL.
 *
 * Usage: node scripts/db-migrate.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — PostgreSQL connection string (default: postgresql://postgres:postgres@localhost:5432/qltb)
 *
 * Schema squashed 2026-04-07: schema.sql chứa toàn bộ schema baseline.
 * Migration mới đặt tại db/migrations/065_xxx.sql và thêm entry vào MIGRATIONS bên dưới.
 */
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { pgConfig } from './_pg-connect.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DB_MIGRATIONS = join(ROOT, 'db', 'migrations')
const ENV_PATH = join(ROOT, '.env')
const ENV_LOCAL_PATH = join(ROOT, '.env.local')

if (existsSync(ENV_PATH)) config({ path: ENV_PATH })
if (existsSync(ENV_LOCAL_PATH)) config({ path: ENV_LOCAL_PATH, override: true })


// Strip psql meta-commands (\i, \echo, \set, \connect, etc.) and BOM — mirrors setup.service.ts executeSqlFile()
function stripMetaCommands(sql) {
    return sql
        .replace(/^\uFEFF/, '')
        .replace(/^\\[a-zA-Z!?:].*/gm, '')
        .trim()
}

// Schema squashed 2026-04-07: tất cả migrations 007–20260326 đã được gom vào schema.sql.
// Thêm migration mới: db/migrations/065_xxx.sql và thêm entry vào đây.
const MIGRATIONS = [
    // Baseline squashed schema (thay thế toàn bộ migration chain cũ)
    { label: 'schema.sql', path: join(ROOT, 'packages', 'infra-postgres', 'src', 'schema.sql') },

    // Migrations mới thêm vào đây (từ 065_xxx.sql trở đi)
    { label: '065_equipment_groups.sql', path: join(DB_MIGRATIONS, '065_equipment_groups.sql') },
    { label: '066_asset_model_attachments.sql', path: join(DB_MIGRATIONS, '066_asset_model_attachments.sql') },
]

const client = new pg.Client(pgConfig())
await client.connect()

// Tạo bảng tracking migrations nếu chưa có
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

// Lấy danh sách migrations đã chạy
const { rows: applied_rows } = await client.query('SELECT label FROM schema_migrations')
const applied_set = new Set(applied_rows.map(r => r.label))

console.log(`\n📦  Running ${MIGRATIONS.length} migrations...`)
let applied = 0
let skipped = 0

try {
    for (const { label, path: filePath } of MIGRATIONS) {
        const rawSql = readFileSync(filePath, 'utf8')
        const sql = stripMetaCommands(rawSql)
        process.stdout.write(`  → ${label} ... `)
        // Bỏ qua nếu đã được apply
        if (applied_set.has(label)) {
            console.log('⏭  (already applied)')
            skipped++
            continue
        }
        if (!sql) {
            console.log('⏭  (empty after stripping)')
            continue
        }
        try {
            await client.query(sql)
            // schema.sql sets search_path='' — restore it for subsequent migrations
            if (label === 'schema.sql') {
                await client.query("SET search_path TO public")
            }
            // Ghi lại migration đã apply
            await client.query('INSERT INTO schema_migrations (label) VALUES ($1) ON CONFLICT DO NOTHING', [label])
            console.log('✅')
            applied++
        } catch (err) {
            // Các lỗi "already exists" (42P07=duplicate_table, 42701=duplicate_column,
            // 42710=duplicate_object, 42P16=invalid_table_definition) được coi là đã apply
            const ignoreCodes = new Set(['42P07', '42701', '42710', '42P16', '23505'])
            if (ignoreCodes.has(err.code)) {
                console.log('⚠️  (already exists, marking applied)')
                await client.query('INSERT INTO schema_migrations (label) VALUES ($1) ON CONFLICT DO NOTHING', [label])
                skipped++
            } else {
                console.log('❌')
                console.error(`\nError in ${label}:\n${err.message}`)
                process.exit(1)
            }
        }
    }
} finally {
    await client.end()
}

console.log(`\n✅ Migrations complete — ${applied} applied, ${skipped} skipped/${MIGRATIONS.length} total\n`)
