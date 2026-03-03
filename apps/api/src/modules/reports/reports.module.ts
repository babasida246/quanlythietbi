/**
 * Reports Module
 */
import type { FastifyInstance } from 'fastify'
import type { AppDependencies } from '../../core/app.js'

export function reportsModule(deps: AppDependencies) {
    return async function (fastify: FastifyInstance): Promise<void> {
        // TODO: Migrate from routes/v1/reports.* to this module

        fastify.get('/reports', {
            schema: {
                tags: ['Reports'],
                description: 'Placeholder - to be migrated'
            }
        }, async (request, reply) => {
            reply.send({
                message: 'Reports module - under migration',
                timestamp: new Date().toISOString()
            })
        })

        fastify.log.info('Reports module placeholder registered')
    }
}