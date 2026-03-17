import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { ReportCachingService } from '@qltb/application'
import { registerAssetsContext } from './assets.context.js'
import { registerWarehouseContext } from './warehouse.context.js'
import { registerCmdbContext } from './cmdb.context.js'
import { registerAdvancedContext } from './advanced.context.js'
import { registerContentContext } from './content.context.js'
import { registerInventoryContext } from './inventory.context.js'

export interface AssetModuleDeps {
    pgClient: PgClient
    cache?: ReportCachingService
}

export async function registerAssetModule(
    fastify: FastifyInstance,
    deps: AssetModuleDeps
): Promise<void> {
    const { assetService } = await registerAssetsContext(fastify, deps.pgClient)
    await registerWarehouseContext(fastify, deps.pgClient, { assetService })
    await registerCmdbContext(fastify, deps.pgClient, deps.cache)
    await registerAdvancedContext(fastify, deps.pgClient)
    await registerContentContext(fastify, deps.pgClient)
    await registerInventoryContext(fastify, deps.pgClient)
}
