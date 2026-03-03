#!/usr/bin/env node
/**
 * db-setup.mjs — Full database setup via the Setup API
 * Steps: 1) Empty DB  2) Migrate  3) Seed
 *
 * Prerequisites: API server must be running (pnpm dev)
 * Usage: node scripts/db-setup.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — PostgreSQL connection string  (default: postgresql://postgres:postgres@localhost:5432/qltb)
 *   API_URL       — Base URL of the API server     (default: http://localhost:3000)
 */
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')
const POLL_INTERVAL = 1000   // ms between job status polls
const MAX_WAIT = 120000 // ms max wait per job

// ─── Helpers ─────────────────────────────────────────────────────────
async function apiPost(path) {
    const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`POST ${path} failed: ${JSON.stringify(json)}`)
    return json
}

async function apiGet(path) {
    const res = await fetch(`${API_URL}${path}`)
    const json = await res.json()
    if (!res.ok) throw new Error(`GET ${path} failed: ${JSON.stringify(json)}`)
    return json
}

async function waitForJob(jobId, label) {
    const start = Date.now()
    while (Date.now() - start < MAX_WAIT) {
        const { data } = await apiGet(`/api/setup/jobs/${jobId}`)
        if (data.status === 'success') {
            console.log(`  ✅ ${label} — success`, data.result ?? '')
            return data
        }
        if (data.status === 'failed') {
            console.error(`  ❌ ${label} — failed`, data.error ?? data.result ?? '')
            process.exit(1)
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL))
    }
    console.error(`  ⏰ ${label} — timed out after ${MAX_WAIT / 1000}s`)
    process.exit(1)
}

// ─── Step 1: Empty database ─────────────────────────────────────────
console.log('\n🗄️  Step 1/3 — Emptying database...')
const { Client } = pg
const c = new Client(DATABASE_URL)
await c.connect()
try {
    await c.query('DROP SCHEMA public CASCADE')
    await c.query('CREATE SCHEMA public')
    await c.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    console.log('  ✅ Database emptied — schema public recreated')
} finally {
    await c.end()
}

// Give the API a moment to detect the fresh state
await new Promise(r => setTimeout(r, 1000))

// ─── Step 2: Migrate ────────────────────────────────────────────────
console.log('\n📦  Step 2/3 — Running migrations...')
const migrateResp = await apiPost('/api/setup/migrate')
await waitForJob(migrateResp.data.jobId, 'Migrate')

// ─── Step 3: Seed ───────────────────────────────────────────────────
console.log('\n🌱  Step 3/3 — Seeding data...')
const seedResp = await apiPost('/api/setup/seed')
await waitForJob(seedResp.data.jobId, 'Seed')

console.log('\n🎉  Database setup complete!\n')
