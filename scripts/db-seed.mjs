#!/usr/bin/env node
/**
 * db-seed.mjs — Run all seed SQL files directly against PostgreSQL
 * Usage: node scripts/db-seed.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — PostgreSQL connection string (default: postgresql://postgres:postgres@localhost:5432/qltb)
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_DIR = join(__dirname, '..', 'db')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'

const SEED_FILES = [
    'seed-data.sql',
    'seed-assets-management.sql',
    'seed-qlts-demo.sql',
]

const client = new pg.Client(DATABASE_URL)
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
