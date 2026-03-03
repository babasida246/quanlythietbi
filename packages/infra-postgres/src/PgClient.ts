import pg from 'pg'
import { z } from 'zod'

const { Pool } = pg

const ConfigSchema = z.object({
    connectionString: z.string().url(),
    max: z.number().default(10),
    min: z.number().default(2),
    idleTimeoutMillis: z.number().default(30000),
    connectionTimeoutMillis: z.number().default(5000)
})

export type PgConfig = z.infer<typeof ConfigSchema>

export class PgClient {
    private pool: pg.Pool

    constructor(config: PgConfig) {
        const validated = ConfigSchema.parse(config)

        this.pool = new Pool({
            connectionString: validated.connectionString,
            max: validated.max,
            min: validated.min,
            idleTimeoutMillis: validated.idleTimeoutMillis,
            connectionTimeoutMillis: validated.connectionTimeoutMillis
        })

        this.pool.on('error', (err) => {
            console.error('Unexpected pool error', err)
        })
    }

    async query<T extends pg.QueryResultRow = any>(
        text: string,
        params?: any[]
    ): Promise<pg.QueryResult<T>> {
        const start = Date.now()
        try {
            const result = await this.pool.query<T>(text, params)
            const duration = Date.now() - start

            if (duration > 1000) {
                console.warn('Slow query detected', { text, duration })
            }

            return result
        } catch (error) {
            console.error('Query error', { text, error })
            throw error
        }
    }

    async getClient(): Promise<pg.PoolClient> {
        return await this.pool.connect()
    }

    getPool(): pg.Pool {
        return this.pool
    }

    async transaction<T>(
        callback: (client: pg.PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.getClient()

        try {
            await client.query('BEGIN')
            const result = await callback(client)
            await client.query('COMMIT')
            return result
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    async close(): Promise<void> {
        await this.pool.end()
    }

    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.query('SELECT 1 as health')
            return result.rows.length === 1
        } catch {
            return false
        }
    }
}
