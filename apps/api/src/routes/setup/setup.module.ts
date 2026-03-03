import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'

import { setupRoutes } from './setup.routes.js'
import type { SetupRoutesOptions } from './setup.routes.js'

export interface SetupModuleDeps {
    pgClient: PgClient
    rootDir?: string
    appVersion?: string
    service?: SetupRoutesOptions['service']
}

export async function registerSetupModule(
    fastify: FastifyInstance,
    deps: SetupModuleDeps
): Promise<void> {
    await fastify.register(setupRoutes, {
        prefix: '/api/setup',
        pgClient: deps.pgClient,
        rootDir: deps.rootDir,
        appVersion: deps.appVersion,
        service: deps.service
    })

    fastify.log.info('🛠 Setup module registered successfully')
}

