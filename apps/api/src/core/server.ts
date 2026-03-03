/**
 * QuanLyThietBi - Server Startup
 */
import { createApp } from './app.js'
import { env } from '../config/env.js'
import { PgClient } from '@qltb/infra-postgres'

export async function startServer(): Promise<void> {
    try {
        const pgClient = new PgClient({
            connectionString: env.DATABASE_URL,
            max: env.DATABASE_POOL_MAX,
            min: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        })

        const db = pgClient

        await db.query('SELECT NOW()')
        console.log('✅ Database connection established')

        const app = await createApp({ db, pgClient })

        const port = env.PORT
        const host = env.HOST

        const address = await app.listen({ port, host })

        console.log(`🚀 QuanLyThietBi API running at ${address}`)
        console.log(`📚 API Docs: ${address}/docs`)
        console.log(`🔍 Health: ${address}/health`)

        const shutdown = async (signal: string) => {
            console.log(`\n🛑 Received ${signal}, shutting down...`)
            try {
                await app.close()
                await db.close()
                console.log('✅ Server shut down')
                process.exit(0)
            } catch (error) {
                console.error('❌ Shutdown error:', error)
                process.exit(1)
            }
        }

        process.on('SIGTERM', () => shutdown('SIGTERM'))
        process.on('SIGINT', () => shutdown('SIGINT'))

    } catch (error) {
        console.error('❌ Failed to start:', error)
        process.exit(1)
    }
}
