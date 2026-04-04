/**
 * Environment Configuration
 * Validates and exports environment variables with type safety
 */
import { z } from 'zod'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Tìm project root bằng cách đi lên từ __dirname cho đến khi tìm thấy pnpm-workspace.yaml.
// Cần thiết vì tsup bundle tất cả vào dist/main.js — __dirname lúc runtime là apps/api/dist/,
// không phải apps/api/src/config/ như lúc dev.
function findRoot(startDir: string): string {
    let dir = startDir
    for (let i = 0; i < 8; i++) {
        if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
        dir = resolve(dir, '..')
    }
    return startDir
}
const rootDir = findRoot(__dirname)
const envPath = resolve(rootDir, '.env')
const envLocalPath = resolve(rootDir, '.env.local')

// Load .env first
if (existsSync(envPath)) {
    config({ path: envPath })
}

// Load .env.local to override (for local development)
if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true })
}

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),

    // Database — either DATABASE_URL or POSTGRES_* components
    DATABASE_URL: z.string().optional(),
    POSTGRES_HOST: z.string().optional(),
    POSTGRES_PORT: z.coerce.number().optional(),
    POSTGRES_DB: z.string().optional(),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_PASSWORD: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().default(10),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    // Auth
    DISABLE_AUTH: z.enum(['true', 'false']).default('false'),
    REFRESH_COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),

    // CORS
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    CORS_ALLOW_CREDENTIALS: z.enum(['true', 'false']).default('true'),
    CORS_ALLOW_LOCALHOST_DEV: z.enum(['true', 'false']).default('true'),

    // Rate Limiting
    ENABLE_RATE_LIMIT: z.enum(['true', 'false']).default('false'),
    RATE_LIMIT_MAX: z.coerce.number().default(10000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

    // Redis Cache
    REDIS_URL: z.string().default('redis://localhost:6379'),
    REDIS_CACHE_ENABLED: z.enum(['true', 'false']).default('true'),
    REDIS_CACHE_TTL: z.coerce.number().default(900), // 15 phút
})

export type Env = z.infer<typeof envSchema> & { DATABASE_URL: string }
export type RefreshCookieRuntimeConfig = {
    name: string
    path: string
    maxAgeSeconds: number
    httpOnly: boolean
    sameSite: 'Lax' | 'None'
    secure: boolean
}

export const REFRESH_TOKEN_COOKIE_NAME = 'qltb_refresh_token'
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth'
export const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

function buildDatabaseUrl(raw: z.infer<typeof envSchema>): string {
    if (raw.DATABASE_URL) return raw.DATABASE_URL

    const host = raw.POSTGRES_HOST ?? 'localhost'
    const port = raw.POSTGRES_PORT ?? 5432
    const db = raw.POSTGRES_DB ?? 'qltb'
    const user = raw.POSTGRES_USER ?? 'postgres'
    const pass = raw.POSTGRES_PASSWORD ?? 'postgres'

    // encodeURIComponent handles @, #, $, % and other special chars in password
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`
}

function validateEnv(): Env {
    const parsed = envSchema.safeParse(process.env)

    if (!parsed.success) {
        console.error('❌ Invalid environment variables:')
        console.error(parsed.error.format())
        process.exit(1)
    }

    const data = parsed.data
    const databaseUrl = buildDatabaseUrl(data)

    if (!data.DATABASE_URL && !data.POSTGRES_HOST) {
        console.error('❌ Must set either DATABASE_URL or POSTGRES_HOST in .env')
        process.exit(1)
    }

    return { ...data, DATABASE_URL: databaseUrl }
}

export const env = validateEnv()

function normalizeOrigin(value: string): string | null {
    const raw = value.trim()
    if (!raw) return null
    try {
        return new URL(raw).origin.toLowerCase()
    } catch {
        return null
    }
}

export function resolveCorsOriginAllowlist(source: Env): string[] {
    const fromEnv = (source.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((item) => normalizeOrigin(item))
        .filter((item): item is string => item !== null)

    if (fromEnv.length > 0) {
        return [...new Set(fromEnv)]
    }

    if (source.NODE_ENV === 'production') {
        // Production-safe preset: no cross-origin access unless explicitly configured.
        return []
    }

    if (source.CORS_ALLOW_LOCALHOST_DEV !== 'true') {
        return []
    }

    return [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4011',
        'http://127.0.0.1:4011',
        'http://localhost:3001',
        'http://127.0.0.1:3001'
    ]
}

export function resolveRefreshCookieRuntimeConfig(source: Env): RefreshCookieRuntimeConfig {
    const sameSite = source.REFRESH_COOKIE_SAMESITE === 'none' ? 'None' : 'Lax'
    const secure = source.NODE_ENV === 'production' || sameSite === 'None'

    return {
        name: REFRESH_TOKEN_COOKIE_NAME,
        path: REFRESH_TOKEN_COOKIE_PATH,
        maxAgeSeconds: REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
        httpOnly: true,
        sameSite,
        secure
    }
}

export const isDev = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
export const isProd = env.NODE_ENV === 'production'
