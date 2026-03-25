/**
 * _pg-connect.mjs — Shared pg.Client factory
 *
 * Priority:
 *   1. POSTGRES_HOST → individual connection params (password passed as-is, no URL encoding)
 *   2. DATABASE_URL  → connection string fallback
 *
 * This avoids URL-parsing issues when the password contains special characters (@, #, $, etc.)
 */

/**
 * Returns a pg connection config object.
 * Import pg and call: new pg.Client(pgConfig())
 */
export function pgConfig() {
    const host = process.env.POSTGRES_HOST
    if (host) {
        return {
            host,
            port: Number(process.env.POSTGRES_PORT ?? 5432),
            database: process.env.POSTGRES_DB ?? 'qltb',
            user: process.env.POSTGRES_USER ?? 'postgres',
            password: process.env.POSTGRES_PASSWORD ?? 'postgres',
        }
    }

    const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/qltb'
    return { connectionString: url }
}
