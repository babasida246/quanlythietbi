/**
 * Auth Module
 * Authentication and authorization functionality
 */
import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { authRoutes } from './auth.routes.js'
import { adminRoutes } from '../admin/admin.routes.js'
import { rbacAdRoutes } from '../admin/rbac-ad.routes.js'
import { permissionCenterRoutes } from '../admin/permission-center.routes.js'
import { ldapRoutes } from '../admin/ldap.routes.js'

interface AuthModuleDeps {
    pgClient?: PgClient
}

/**
 * Register Auth Module
 * Provides authentication endpoints
 */
export async function registerAuthModule(
    fastify: FastifyInstance,
    deps: AuthModuleDeps = {}
): Promise<void> {
    // Register auth routes under /api/v1/auth to match existing pattern
    await fastify.register(authRoutes, {
        prefix: '/api/v1/auth',
        pgClient: deps.pgClient
    })

    await fastify.register(adminRoutes, {
        prefix: '/api/v1/admin',
        pgClient: deps.pgClient
    })

    await fastify.register(rbacAdRoutes, {
        prefix: '/api/v1/admin/ad-rbac',
        pgClient: deps.pgClient
    })

    await fastify.register(permissionCenterRoutes, {
        prefix: '/api/v1/admin/permissions',
        pgClient: deps.pgClient
    })

    await fastify.register(ldapRoutes, {
        prefix: '/api/v1/admin/ldap',
        pgClient: deps.pgClient
    })

    fastify.log.info('🔐 Auth module registered successfully')
}
