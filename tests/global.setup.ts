import type { FullConfig } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { seedAll } from './seed/seed'

async function waitFor(url: string, timeoutMs = 60_000): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url)
            if (response.ok) return
        } catch {
            // keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error(`Timed out waiting for ${url}`)
}

type SetupStatusResponse = {
    success?: boolean
    data?: {
        initialized: boolean
        migrations: { ok: boolean; pending: number }
        seed: { ok: boolean }
    }
}

type SetupJobResponse = {
    success?: boolean
    data?: {
        jobId?: string
        status?: 'running' | 'success' | 'failed'
        logs?: string[]
        error?: string
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const bodyText = await response.text()

    let json: unknown = {}
    if (bodyText) {
        try {
            json = JSON.parse(bodyText)
        } catch {
            json = bodyText
        }
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} at ${url}: ${bodyText}`)
    }

    return json as T
}

function lockedMigrationFallbackPaths(): string[] {
    return [
        path.resolve(process.cwd(), 'packages/infra-postgres/src/migrations/040_cmdb_change_management.sql'),
        path.resolve(process.cwd(), 'packages/infra-postgres/src/migrations/041_cmdb_relationship_type_column_alignment.sql'),
        path.resolve(process.cwd(), 'packages/infra-postgres/src/migrations/042_asset_status_catalogs.sql'),
        path.resolve(process.cwd(), 'db/migrations/069_stock_document_recipient_ou.sql'),
        path.resolve(process.cwd(), 'db/migrations/071_location_ou_link.sql'),
        path.resolve(process.cwd(), 'db/migrations/073_category_item_type.sql')
    ]
}

function sanitizeSql(rawSql: string): string {
    return rawSql
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('\\'))
        .filter((line) => !/set_config\(\s*'search_path'\s*,\s*''\s*,\s*false\s*\)/i.test(line))
        .join('\n')
        .trim()
}

async function applyLockedMigrationsDirectly(): Promise<void> {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
    const client = new pg.Client({ connectionString })
    await client.connect()
    try {
        for (const filePath of lockedMigrationFallbackPaths()) {
            const sql = sanitizeSql(await readFile(filePath, 'utf8'))
            if (!sql) continue
            await client.query('BEGIN')
            try {
                await client.query(sql)
                await client.query('COMMIT')
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined)
                throw error
            }
        }
    } finally {
        await client.end().catch(() => undefined)
    }
}

async function waitForSetupJob(apiBaseUrl: string, jobId: string, timeoutMs = 5 * 60_000): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        const job = await fetchJson<SetupJobResponse>(`${apiBaseUrl}/api/setup/jobs/${jobId}`)
        const status = job.data?.status
        if (status === 'success') return

        if (status === 'failed') {
            const logs = job.data?.logs?.slice(-20).join('\n') ?? ''
            const message = job.data?.error ?? 'unknown setup job error'
            throw new Error(`Setup job ${jobId} failed: ${message}\n${logs}`)
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    throw new Error(`Timed out waiting for setup job ${jobId}`)
}

async function runSetupJob(apiBaseUrl: string, kind: 'migrate' | 'seed'): Promise<void> {
    const trigger = await fetchJson<SetupJobResponse>(`${apiBaseUrl}/api/setup/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
    })

    const jobId = trigger.data?.jobId
    if (!jobId) {
        throw new Error(`Setup ${kind} did not return jobId`)
    }

    await waitForSetupJob(apiBaseUrl, jobId)
}

async function ensureSetupReady(apiBaseUrl: string): Promise<void> {
    const status = await fetchJson<SetupStatusResponse>(`${apiBaseUrl}/api/setup/status`)
    const data = status.data
    if (!data) {
        throw new Error('Invalid setup status payload')
    }

    if (!data.migrations.ok || data.migrations.pending > 0) {
        try {
            await runSetupJob(apiBaseUrl, 'migrate')
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const setupLocked =
                data.initialized &&
                (message.includes('HTTP 403') || message.toLowerCase().includes('setup has already been finalized'))

            if (!setupLocked) {
                throw error
            }

            console.warn('[playwright global.setup] setup migrate locked after finalize; applying fallback assets migrations directly')
            await applyLockedMigrationsDirectly()
        }
    }

    if (data.initialized) {
        return
    }

    const afterMigrate = await fetchJson<SetupStatusResponse>(`${apiBaseUrl}/api/setup/status`)
    if (!afterMigrate.data?.seed.ok) {
        await runSetupJob(apiBaseUrl, 'seed')
    }
}

async function applyIdempotentPatches(): Promise<void> {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
    const client = new pg.Client({ connectionString })
    await client.connect()
    try {
        // Migration 071: add ou_id to locations (idempotent — IF NOT EXISTS guards)
        await client.query(`
            ALTER TABLE locations
            ADD COLUMN IF NOT EXISTS ou_id UUID REFERENCES org_units(id) ON DELETE SET NULL
        `)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_locations_ou_id
            ON locations(ou_id) WHERE ou_id IS NOT NULL
        `)
    } catch {
        // Ignore errors (e.g. org_units doesn't exist yet in this env)
    }
    try {
        // Migration 069: add recipient_ou_id to stock_documents (idempotent)
        await client.query(`
            ALTER TABLE stock_documents
            ADD COLUMN IF NOT EXISTS recipient_ou_id UUID REFERENCES org_units(id) ON DELETE SET NULL
        `)
    } catch {
        // Ignore errors (e.g. org_units doesn't exist yet in this env)
    }
    try {
        // Migration 073: add item_type to asset_categories (idempotent — IF NOT EXISTS guards)
        await client.query(`
            ALTER TABLE asset_categories
            ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'asset'
        `)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_asset_categories_item_type ON asset_categories(item_type)
        `)
    } catch {
        // Ignore errors
    } finally {
        await client.end().catch(() => undefined)
    }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:4010'
    await waitFor(apiBaseUrl + '/health')
    await waitFor(process.env.WEB_BASE_URL || 'http://127.0.0.1:4011/login')
    await ensureSetupReady(apiBaseUrl)
    await applyIdempotentPatches()
    await seedAll()
}
