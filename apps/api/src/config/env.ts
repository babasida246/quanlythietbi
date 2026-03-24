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

// Load .env files from workspace root (local overrides docker)
const rootDir = resolve(__dirname, '../../../..')
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

function buildDatabaseUrl(raw: z.infer<typeof envSchema>): string {
    if (raw.DATABASE_URL) return raw.DATABASE_URL

    const host = raw.POSTGRES_HOST ?? 'localhost'
    const port = raw.POSTGRES_PORT ?? 5432
    const db   = raw.POSTGRES_DB   ?? 'qltb'
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

export const isDev = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
export const isProd = env.NODE_ENV === 'production'
