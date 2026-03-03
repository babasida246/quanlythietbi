import type { FastifyPluginAsync } from 'fastify'
import { purchasePlanRoutes } from './purchasePlans.js'
import { assetIncreaseRoutes } from './assetIncreases.js'

export const qltsRoutes: FastifyPluginAsync = async (fastify) => {
    await fastify.register(purchasePlanRoutes, { prefix: '/purchase-plans' })
    await fastify.register(assetIncreaseRoutes, { prefix: '/asset-increases' })
}
