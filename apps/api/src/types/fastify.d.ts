import 'fastify'
import type { PgClient } from '@qltb/infra-postgres'

declare module 'fastify' {
    interface FastifyRequest {
        language?: string
        user?: {
            id: string
            role: string
            email?: string
            status?: string
            permissions?: string[]
            deniedPermissions?: string[]
        }
        userContext?: {
            userId: string
            roles: string[]
            permissions: string[]
        }
    }

    interface FastifyInstance {
        diContainer?: {
            resolve<T>(key: string): T
        }
        pgClient?: PgClient
    }
}
