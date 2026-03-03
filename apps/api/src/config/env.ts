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

    // Database
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().default(10),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    // Auth
    DISABLE_AUTH: z.enum(['true', 'false']).default('false'),

    // Rate Limiting
    ENABLE_RATE_LIMIT: z.enum(['true', 'false']).default('false'),
    RATE_LIMIT_MAX: z.coerce.number().default(10000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
    const parsed = envSchema.safeParse(process.env)

    if (!parsed.success) {
        console.error('❌ Invalid environment variables:')
        console.error(parsed.error.format())
        process.exit(1)
    }

    return parsed.data
}

export const env = validateEnv()

export const isDev = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
export const isProd = env.NODE_ENV === 'production'
