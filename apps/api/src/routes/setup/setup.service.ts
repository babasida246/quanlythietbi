import { createHash } from 'crypto'
import path from 'path'
import { promises as fs } from 'fs'

import type { PgClient } from '@qltb/infra-postgres'
import { hashPassword } from '../../shared/security/password.js'

export type SetupStatus = {
    initialized: boolean
    version: string
    api: { ok: boolean; build?: string }
    db: { ok: boolean }
    migrations: { applied: number; pending: number; ok: boolean; total: number }
    seed: { ok: boolean; lastRunAt?: string }
    adminExists: boolean
}

export type SetupAdminInput = {
    fullName: string
    email: string
    username?: string
    password: string
    locale?: 'vi' | 'en'
}

export type SetupFinalizeInput = {
    allowSkipSeed?: boolean
    completedBy?: string
}

type MigrationFile = {
    fileName: string
    filePath: string
    checksum: string
    isBaseSchema: boolean
}

type AppMetaValue = Record<string, unknown> | string | number | boolean | null

export class SetupService {
    private readonly rootDir: string
    private readonly appVersion: string

    constructor(
        private readonly pgClient: PgClient,
        options?: {
            rootDir?: string
            appVersion?: string
        }
    ) {
        this.rootDir = options?.rootDir ?? process.cwd()
        this.appVersion = options?.appVersion ?? '1.0.0'
    }

    private buildRootCandidates(): string[] {
        const visited = new Set<string>()
        const bases = [this.rootDir, process.cwd()]

        for (const base of bases) {
            let current = path.resolve(base)
            for (let depth = 0; depth < 8; depth += 1) {
                visited.add(current)
                const parent = path.dirname(current)
                if (parent === current) break
                current = parent
            }
        }

        return Array.from(visited)
    }

    private async getRepoRoot(): Promise<string> {
        const candidates = this.buildRootCandidates()

        for (const candidate of candidates) {
            if (await this.pathExists(path.join(candidate, 'pnpm-workspace.yaml'))) {
                return candidate
            }
        }

        for (const candidate of candidates) {
            if (await this.pathExists(path.join(candidate, 'packages'))) {
                return candidate
            }
        }

        return path.resolve(this.rootDir)
    }

    private async resolveRepoFile(relativeParts: string[]): Promise<string | null> {
        const repoRoot = await this.getRepoRoot()
        const primary = path.join(repoRoot, ...relativeParts)
        if (await this.pathExists(primary)) {
            return primary
        }

        for (const candidate of this.buildRootCandidates()) {
            const filePath = path.join(candidate, ...relativeParts)
            if (await this.pathExists(filePath)) {
                return filePath
            }
        }

        return null
    }

    async getStatus(): Promise<SetupStatus> {
        await this.ensureSetupTables()

        const [initialized, dbOk, migrations, seedMeta, adminExists] = await Promise.all([
            this.getInitializedState(),
            this.isDbReachable(),
            this.getMigrationStatus(),
            this.readMeta<{ ok?: boolean; lastRunAt?: string }>('setup.seed'),
            this.hasAdminUser()
        ])

        return {
            initialized: initialized.initialized,
            version: this.appVersion,
            api: { ok: true, build: this.appVersion },
            db: { ok: dbOk },
            migrations,
            seed: {
                ok: seedMeta?.ok === true,
                ...(seedMeta?.lastRunAt ? { lastRunAt: String(seedMeta.lastRunAt) } : {})
            },
            adminExists
        }
    }

    async isSetupLocked(): Promise<boolean> {
        await this.ensureSetupTables()
        const initialized = await this.getInitializedState()
        return initialized.initialized
    }

    async runMigrations(log: (line: string) => void): Promise<{ applied: number; skipped: number; total: number }> {
        await this.ensureSetupTables()
        const plan = await this.getMigrationPlan()
        if (plan.length === 0) {
            throw new Error('No migration files found in migration plan')
        }

        const existingRows = await this.getMigrationRunRows(plan.map((item) => item.fileName))
        let businessTablesExist = await this.hasBusinessTables()

        let applied = 0
        let skipped = 0

        if (businessTablesExist && existingRows.size === 0) {
            log('Detected existing schema/data without migration tracking; bootstrapping setup_migration_runs as skipped')
            for (const item of plan) {
                await this.recordMigrationRun(item, 'skipped', null)
                skipped += 1
                log(`SKIP ${item.fileName} (bootstrap existing database)`)
            }

            await this.upsertMeta('setup.migrations', {
                lastRunAt: new Date().toISOString(),
                ok: true,
                planSize: plan.length,
                bootstrapSkipped: true
            })

            return { applied, skipped, total: plan.length }
        }

        for (const item of plan) {
            const previous = existingRows.get(item.fileName)
            const alreadyDone =
                previous &&
                previous.checksum === item.checksum &&
                (previous.status === 'applied' || previous.status === 'skipped')

            if (alreadyDone) {
                skipped += 1
                log(`SKIP ${item.fileName} (already ${previous?.status})`)
                continue
            }

            if (item.isBaseSchema && businessTablesExist) {
                skipped += 1
                log(`SKIP ${item.fileName} (database is not empty)`)
                await this.recordMigrationRun(item, 'skipped', null)
                continue
            }

            try {
                log(`RUN  ${item.fileName}`)
                await this.executeSqlFile(item.filePath)
                await this.recordMigrationRun(item, 'applied', null)
                applied += 1
                businessTablesExist = true
                log(`OK   ${item.fileName}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)

                const checkViolationOnExistingData =
                    businessTablesExist && /is violated by some row/i.test(errorMessage)
                if (checkViolationOnExistingData) {
                    skipped += 1
                    await this.recordMigrationRun(item, 'skipped', errorMessage)
                    log(`SKIP ${item.fileName} (existing data check violation; treated as already migrated)`)
                    continue
                }

                await this.recordMigrationRun(item, 'failed', errorMessage)
                log(`FAIL ${item.fileName}: ${errorMessage}`)
                throw new Error(`Migration failed at ${item.fileName}: ${errorMessage}`)
            }
        }

        await this.upsertMeta('setup.migrations', {
            lastRunAt: new Date().toISOString(),
            ok: true,
            planSize: plan.length
        })

        return { applied, skipped, total: plan.length }
    }

    async runSeed(log: (line: string) => void): Promise<{ ok: boolean; lastRunAt: string }> {
        await this.ensureSetupTables()

        const seedFiles = [
            ['db', 'seed-data.sql'],
            ['db', 'seed-assets-management.sql'],
            ['db', 'seed-assets.sql'],
            ['db', 'seed-qlts-demo.sql'],
        ]

        for (const parts of seedFiles) {
            const filePath = await this.resolveRepoFile(parts)
            const fileName = parts[parts.length - 1]
            if (!filePath) {
                throw new Error(`Seed file not found: ${parts.join('/')}`)
            }

            log(`RUN  ${fileName}`)
            try {
                await this.executeSeedFile(filePath, log)
                log(`OK   ${fileName}`)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                log(`FAIL ${fileName}: ${message}`)
                throw new Error(`Seed failed at ${fileName}: ${message}`)
            }
        }

        const lastRunAt = new Date().toISOString()
        await this.upsertMeta('setup.seed', { ok: true, lastRunAt })
        log('OK   all seed files completed')
        return { ok: true, lastRunAt }
    }

    private async executeSeedFile(filePath: string, log: (line: string) => void): Promise<void> {
        const rawSql = await fs.readFile(filePath, 'utf8')
        // Strip psql meta-commands (\echo, \i, \set, etc.) and BOM
        const sql = rawSql
            .replace(/^\uFEFF/, '')
            .split(/\r?\n/)
            .filter((line) => !line.trim().startsWith('\\'))
            .filter((line) => !/set_config\(\s*'search_path'\s*,\s*''\s*,\s*false\s*\)/i.test(line))
            .join('\n')
            .trim()

        if (!sql) {
            log(`SKIP ${filePath} (empty after stripping meta-commands)`)
            return
        }

        await this.pgClient.transaction(async (client) => {
            await client.query(sql)
            await client.query(`SET search_path TO public`)
        })
    }

    async createFirstAdmin(input: SetupAdminInput): Promise<{ userId: string; email: string; username: string | null; role: 'admin' }> {
        await this.ensureSetupTables()

        const usersTableExists = await this.tableExists('users')
        if (!usersTableExists) {
            throw new Error('Users table not found. Run migrations first.')
        }

        const initialized = await this.getInitializedState()
        if (initialized.initialized) {
            const existingAdmin = await this.hasAdminUser()
            if (existingAdmin) {
                throw new Error('Setup is already finalized. Creating admin is blocked.')
            }
        }

        const email = input.email.trim().toLowerCase()
        const username = input.username?.trim() || null

        const existingByEmail = await this.pgClient.query<{ id: string }>(
            `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
            [email]
        )
        if (existingByEmail.rows.length > 0) {
            throw new Error('Email already exists')
        }

        if (username) {
            const existingByUsername = await this.pgClient.query<{ id: string }>(
                `SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1`,
                [username]
            )
            if (existingByUsername.rows.length > 0) {
                throw new Error('Username already exists')
            }
        }

        const passwordHash = await hashPassword(input.password)

        const userResult = await this.pgClient.query<{
            id: string
            email: string
            username: string | null
            role: string
        }>(
            `
            INSERT INTO users (
                email,
                name,
                username,
                password_hash,
                role,
                is_active,
                tier,
                status,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, 'admin', true, 'enterprise', 'active', NOW(), NOW())
            RETURNING id, email, username, role
            `,
            [email, input.fullName.trim(), username, passwordHash]
        )

        const created = userResult.rows[0]
        await this.ensureAdminRoleBindings()
        await this.upsertMeta('setup.admin', {
            userId: created.id,
            email: created.email,
            locale: input.locale ?? 'vi',
            createdAt: new Date().toISOString()
        })

        return {
            userId: created.id,
            email: created.email,
            username: created.username,
            role: 'admin'
        }
    }

    async finalizeSetup(input: SetupFinalizeInput): Promise<{ completedAt: string; completedBy: string; version: string }> {
        await this.ensureSetupTables()
        const status = await this.getStatus()

        const issues: string[] = []
        if (!status.db.ok) {
            issues.push('Database is not reachable')
        }
        if (!status.migrations.ok) {
            issues.push('Migrations are not complete')
        }
        if (!status.seed.ok && !input.allowSkipSeed) {
            issues.push('Seed data has not been completed')
        }
        if (!status.adminExists) {
            issues.push('Admin account does not exist')
        }

        if (issues.length > 0) {
            throw new Error(issues.join('; '))
        }

        const completedAt = new Date().toISOString()
        const completedBy = input.completedBy ?? (await this.getLatestAdminIdentifier()) ?? 'setup-wizard'

        await this.upsertMeta('setup.initialized', {
            completedAt,
            completedBy,
            version: this.appVersion
        })

        return { completedAt, completedBy, version: this.appVersion }
    }

    private async ensureSetupTables(): Promise<void> {
        await this.pgClient.query(`
            CREATE TABLE IF NOT EXISTS public.app_meta (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)

        await this.pgClient.query(`
            CREATE TABLE IF NOT EXISTS public.setup_migration_runs (
                file_name TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('applied', 'skipped', 'failed')),
                error TEXT,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    }

    private async isDbReachable(): Promise<boolean> {
        try {
            await this.pgClient.query('SELECT 1')
            return true
        } catch {
            return false
        }
    }

    private async getInitializedState(): Promise<{ initialized: boolean; completedAt?: string; completedBy?: string; version?: string }> {
        const meta = await this.readMeta<{ completedAt?: string; completedBy?: string; version?: string }>('setup.initialized')
        if (!meta || !meta.completedAt) {
            return { initialized: false }
        }

        return {
            initialized: true,
            completedAt: meta.completedAt,
            completedBy: meta.completedBy,
            version: meta.version
        }
    }

    private async getMigrationStatus(): Promise<{ applied: number; pending: number; ok: boolean; total: number }> {
        await this.ensureSetupTables()

        const plan = await this.getMigrationPlan()
        if (plan.length === 0) {
            return { applied: 0, pending: 0, ok: true, total: 0 }
        }

        const fileNames = plan.map((item) => item.fileName)
        const result = await this.pgClient.query<{ file_name: string; status: string }>(
            `
            SELECT file_name, status
            FROM public.setup_migration_runs
            WHERE file_name = ANY($1::text[])
            `,
            [fileNames]
        )

        const done = result.rows.filter((row) => row.status === 'applied' || row.status === 'skipped').length
        const pending = Math.max(plan.length - done, 0)

        return {
            applied: done,
            pending,
            ok: pending === 0,
            total: plan.length
        }
    }

    private async hasAdminUser(): Promise<boolean> {
        const usersTableExists = await this.tableExists('users')
        if (!usersTableExists) return false

        const result = await this.pgClient.query<{ total: number }>(
            `
            SELECT COUNT(*)::int AS total
            FROM users
            WHERE lower(role) = 'admin'
              AND COALESCE(is_active, true) = true
              AND COALESCE(status, 'active') = 'active'
              AND COALESCE(password_hash, '') ~ '^\\$2[aby]\\$'
            `
        )

        return (result.rows[0]?.total ?? 0) > 0
    }

    private async getLatestAdminIdentifier(): Promise<string | null> {
        const usersTableExists = await this.tableExists('users')
        if (!usersTableExists) return null

        const result = await this.pgClient.query<{ email: string | null; username: string | null }>(
            `
            SELECT email, username
            FROM users
            WHERE lower(role) = 'admin'
              AND COALESCE(password_hash, '') ~ '^\\$2[aby]\\$'
            ORDER BY created_at DESC
            LIMIT 1
            `
        )

        const latest = result.rows[0]
        if (!latest) return null
        return latest.email ?? latest.username ?? null
    }

    private async ensureAdminRoleBindings(): Promise<void> {
        const rolesTableExists = await this.tableExists('roles')
        if (!rolesTableExists) return

        await this.pgClient.query(
            `
            INSERT INTO roles (name, slug, description, is_system)
            VALUES
                ('Administrator',        'admin',            'Full system access',                        true),
                ('IT Asset Manager',     'it_asset_manager', 'Manage all assets and IT resources',        true),
                ('Warehouse Keeper',     'warehouse_keeper', 'Manage warehouse and consumables',           true),
                ('Technician',           'technician',       'Perform maintenance and repair tasks',       true),
                ('Requester',            'requester',        'Submit requests and view own assets',        true),
                ('Viewer',               'viewer',           'Read-only access across all modules',        true)
            ON CONFLICT (slug) DO NOTHING
            `
        )

        const permissionsTableExists = await this.tableExists('permissions')
        const rolePermissionsTableExists = await this.tableExists('role_permissions')
        if (!permissionsTableExists || !rolePermissionsTableExists) return

        // ── Seed toàn bộ 55 permissions ──────────────────────────────────────────
        await this.pgClient.query(
            `
            INSERT INTO permissions (name, resource, action, description) VALUES
                ('assets:read',          'assets',        'read',    'View assets'),
                ('assets:create',        'assets',        'create',  'Create assets'),
                ('assets:update',        'assets',        'update',  'Update assets'),
                ('assets:delete',        'assets',        'delete',  'Delete assets'),
                ('assets:export',        'assets',        'export',  'Export asset data'),
                ('assets:import',        'assets',        'import',  'Import assets from file'),
                ('assets:assign',        'assets',        'assign',  'Assign assets to users'),
                ('categories:read',      'categories',    'read',    'View asset categories'),
                ('categories:manage',    'categories',    'manage',  'Manage asset categories and specs'),
                ('cmdb:read',            'cmdb',          'read',    'View CMDB records'),
                ('cmdb:create',          'cmdb',          'create',  'Create CMDB records'),
                ('cmdb:update',          'cmdb',          'update',  'Update CMDB records'),
                ('cmdb:delete',          'cmdb',          'delete',  'Delete CMDB records'),
                ('warehouse:read',       'warehouse',     'read',    'View warehouse and receipts'),
                ('warehouse:create',     'warehouse',     'create',  'Create warehouse receipts'),
                ('warehouse:approve',    'warehouse',     'approve', 'Approve warehouse receipts'),
                ('inventory:read',       'inventory',     'read',    'View inventory and audits'),
                ('inventory:create',     'inventory',     'create',  'Create inventory audits'),
                ('inventory:manage',     'inventory',     'manage',  'Manage and close inventory audits'),
                ('licenses:read',        'licenses',      'read',    'View licenses'),
                ('licenses:manage',      'licenses',      'manage',  'Manage software licenses'),
                ('accessories:read',     'accessories',   'read',    'View accessories'),
                ('accessories:manage',   'accessories',   'manage',  'Manage accessories'),
                ('consumables:read',     'consumables',   'read',    'View consumables'),
                ('consumables:manage',   'consumables',   'manage',  'Manage consumables'),
                ('components:read',      'components',    'read',    'View components'),
                ('components:manage',    'components',    'manage',  'Manage components'),
                ('checkout:read',        'checkout',      'read',    'View checkouts'),
                ('checkout:create',      'checkout',      'create',  'Create checkout requests'),
                ('checkout:approve',     'checkout',      'approve', 'Approve checkout requests'),
                ('requests:read',        'requests',      'read',    'View workflow requests'),
                ('requests:create',      'requests',      'create',  'Create workflow requests'),
                ('requests:approve',     'requests',      'approve', 'Approve workflow requests'),
                ('maintenance:read',     'maintenance',   'read',    'View maintenance orders'),
                ('maintenance:create',   'maintenance',   'create',  'Create maintenance orders'),
                ('maintenance:manage',   'maintenance',   'manage',  'Manage and close maintenance orders'),
                ('reports:read',         'reports',       'read',    'View reports'),
                ('reports:export',       'reports',       'export',  'Export reports'),
                ('analytics:read',       'analytics',     'read',    'View analytics dashboards'),
                ('depreciation:read',    'depreciation',  'read',    'View depreciation schedules'),
                ('depreciation:manage',  'depreciation',  'manage',  'Manage depreciation'),
                ('labels:read',          'labels',        'read',    'View asset labels'),
                ('labels:manage',        'labels',        'manage',  'Print and manage labels'),
                ('documents:read',       'documents',     'read',    'View documents'),
                ('documents:upload',     'documents',     'upload',  'Upload documents'),
                ('documents:delete',     'documents',     'delete',  'Delete documents'),
                ('automation:read',      'automation',    'read',    'View automation rules'),
                ('automation:manage',    'automation',    'manage',  'Manage automation rules'),
                ('integrations:read',    'integrations',  'read',    'View integrations'),
                ('integrations:manage',  'integrations',  'manage',  'Manage integrations'),
                ('security:read',        'security',      'read',    'View security settings'),
                ('security:manage',      'security',      'manage',  'Manage security settings'),
                ('admin:users',          'admin',         'users',   'Manage users'),
                ('admin:roles',          'admin',         'roles',   'Manage roles and permissions'),
                ('admin:settings',       'admin',         'settings','Manage system settings')
            ON CONFLICT (name) DO NOTHING
            `
        )

        // ── Assign permissions to roles ───────────────────────────────────────────
        // Admin: all permissions
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
            WHERE r.slug = 'admin'
            ON CONFLICT DO NOTHING
            `
        )

        // it_asset_manager: all except admin:* and security:manage
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
            WHERE r.slug = 'it_asset_manager'
              AND p.name NOT IN ('admin:users','admin:roles','admin:settings','security:manage')
            ON CONFLICT DO NOTHING
            `
        )

        // warehouse_keeper
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'warehouse_keeper'
              AND p.name IN (
                'assets:read','assets:create','assets:update','assets:export',
                'categories:read',
                'warehouse:read','warehouse:create',
                'inventory:read','inventory:create',
                'accessories:read','accessories:manage',
                'consumables:read','consumables:manage',
                'components:read','components:manage',
                'requests:read','requests:create',
                'maintenance:read',
                'reports:read','reports:export',
                'depreciation:read',
                'labels:read','labels:manage',
                'documents:read','documents:upload'
              )
            ON CONFLICT DO NOTHING
            `
        )

        // technician
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'technician'
              AND p.name IN (
                'assets:read','categories:read','cmdb:read',
                'warehouse:read','inventory:read',
                'accessories:read','consumables:read',
                'components:read','components:manage',
                'checkout:read','checkout:create',
                'requests:read','requests:create',
                'maintenance:read','maintenance:create','maintenance:manage',
                'reports:read','labels:read',
                'documents:read','documents:upload'
              )
            ON CONFLICT DO NOTHING
            `
        )

        // requester
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'requester'
              AND p.name IN (
                'assets:read','categories:read','licenses:read',
                'checkout:read','checkout:create',
                'requests:read','requests:create',
                'maintenance:read','maintenance:create',
                'reports:read','documents:read'
              )
            ON CONFLICT DO NOTHING
            `
        )

        // viewer: read-only
        await this.pgClient.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'viewer'
              AND p.action = 'read'
            ON CONFLICT DO NOTHING
            `
        )
    }

    private async upsertMeta(key: string, value: AppMetaValue): Promise<void> {
        await this.pgClient.query(
            `
            INSERT INTO public.app_meta (key, value, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `,
            [key, JSON.stringify(value)]
        )
    }

    private async readMeta<T extends AppMetaValue>(key: string): Promise<T | null> {
        const result = await this.pgClient.query<{ value: T }>(
            `SELECT value FROM public.app_meta WHERE key = $1 LIMIT 1`,
            [key]
        )
        if (result.rows.length === 0) return null
        return result.rows[0].value
    }

    private async tableExists(tableName: string): Promise<boolean> {
        const result = await this.pgClient.query<{ found: boolean }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = $1
            ) AS found
            `,
            [tableName]
        )

        return result.rows[0]?.found === true
    }

    private async hasBusinessTables(): Promise<boolean> {
        const result = await this.pgClient.query<{ total: number }>(
            `
            SELECT COUNT(*)::int AS total
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('app_meta', 'setup_migration_runs')
            `
        )
        return (result.rows[0]?.total ?? 0) > 0
    }

    private async getMigrationPlan(): Promise<MigrationFile[]> {
        const repoRoot = await this.getRepoRoot()
        const bundlePath = await this.resolveRepoFile(['packages', 'infra-postgres', 'src', 'migrations', 'assets', '000_assets_bundle.sql'])
        const baseSchemaPath = await this.resolveRepoFile(['packages', 'infra-postgres', 'src', 'schema.sql'])

        const rawPaths: Array<{ filePath: string; isBaseSchema: boolean }> = []
        if (baseSchemaPath && (await this.pathExists(baseSchemaPath))) {
            rawPaths.push({ filePath: baseSchemaPath, isBaseSchema: true })
        }

        if (bundlePath && (await this.pathExists(bundlePath))) {
            const content = await fs.readFile(bundlePath, 'utf8')
            const bundleDir = path.dirname(bundlePath)
            for (const line of content.split(/\r?\n/)) {
                const match = line.match(/^\s*\\i\s+(.+)\s*$/)
                if (!match) continue

                const includeRaw = match[1].trim().replace(/^['"]|['"]$/g, '')
                const resolved = includeRaw.startsWith('/app/')
                    ? path.join(repoRoot, includeRaw.slice('/app/'.length))
                    : path.resolve(bundleDir, includeRaw)

                rawPaths.push({ filePath: resolved, isBaseSchema: false })
            }
        }

        const normalized: MigrationFile[] = []
        const seen = new Set<string>()

        for (const item of rawPaths) {
            const absolutePath = path.normalize(item.filePath)
            if (seen.has(absolutePath)) continue
            if (!(await this.pathExists(absolutePath))) continue

            const rawSql = await fs.readFile(absolutePath, 'utf8')
            const checksum = createHash('sha256').update(rawSql).digest('hex')
            const relativeName = path.relative(repoRoot, absolutePath).replaceAll('\\', '/')
            const fileName = relativeName.startsWith('..') ? path.basename(absolutePath) : relativeName

            normalized.push({
                fileName,
                filePath: absolutePath,
                checksum,
                isBaseSchema: item.isBaseSchema
            })
            seen.add(absolutePath)
        }

        return normalized
    }

    private async getMigrationRunRows(
        fileNames: string[]
    ): Promise<Map<string, { checksum: string; status: string }>> {
        if (fileNames.length === 0) return new Map()

        const result = await this.pgClient.query<{ file_name: string; checksum: string; status: string }>(
            `
            SELECT file_name, checksum, status
            FROM public.setup_migration_runs
            WHERE file_name = ANY($1::text[])
            `,
            [fileNames]
        )

        return new Map(
            result.rows.map((row) => [
                row.file_name,
                {
                    checksum: row.checksum,
                    status: row.status
                }
            ])
        )
    }

    private async recordMigrationRun(item: MigrationFile, status: 'applied' | 'skipped' | 'failed', error: string | null): Promise<void> {
        await this.pgClient.query(
            `
            INSERT INTO public.setup_migration_runs (file_name, checksum, status, error, applied_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (file_name)
            DO UPDATE SET
                checksum = EXCLUDED.checksum,
                status = EXCLUDED.status,
                error = EXCLUDED.error,
                applied_at = EXCLUDED.applied_at
            `,
            [item.fileName, item.checksum, status, error]
        )
    }

    private sanitizeSql(rawSql: string): string {
        return rawSql
            .replace(/^\uFEFF/, '')
            .split(/\r?\n/)
            .filter((line) => !line.trim().startsWith('\\'))
            .filter((line) => !/set_config\(\s*'search_path'\s*,\s*''\s*,\s*false\s*\)/i.test(line))
            .join('\n')
    }

    private async executeSqlFile(filePath: string): Promise<void> {
        const rawSql = await fs.readFile(filePath, 'utf8')
        const sql = this.sanitizeSql(rawSql).trim()
        if (!sql) return

        await this.pgClient.transaction(async (client) => {
            await client.query(sql)
            await client.query(`SET search_path TO public`)
        })
    }

    private async pathExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath)
            return true
        } catch {
            return false
        }
    }
}
