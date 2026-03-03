#!/usr/bin/env node
/**
 * db-empty.mjs — Drop all tables and recreate public schema
 * Usage: node scripts/db-empty.mjs
 * Requires DATABASE_URL env variable
 */
import pg from 'pg'

const { Client } = pg
const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'

const c = new Client(url)
await c.connect()
try {
    await c.query('DROP SCHEMA public CASCADE')
    await c.query('CREATE SCHEMA public')
    await c.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    console.log('✅ Database emptied — schema public recreated')
} finally {
    await c.end()
}
