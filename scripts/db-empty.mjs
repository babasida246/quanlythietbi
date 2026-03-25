#!/usr/bin/env node
/**
 * db-empty.mjs — Drop all tables and recreate public schema
 * Usage: node scripts/db-empty.mjs
 * Requires DATABASE_URL env variable
 */
import pg from 'pg'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { pgConfig } from './_pg-connect.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const envPath = resolve(rootDir, '.env')
const envLocalPath = resolve(rootDir, '.env.local')

if (existsSync(envPath)) config({ path: envPath })
if (existsSync(envLocalPath)) config({ path: envLocalPath, override: true })

const { Client } = pg

const c = new Client(pgConfig())
await c.connect()
try {
    await c.query('DROP SCHEMA public CASCADE')
    await c.query('CREATE SCHEMA public')
    await c.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    console.log('✅ Database emptied — schema public recreated')
} finally {
    await c.end()
}
