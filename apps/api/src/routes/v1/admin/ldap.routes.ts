/**
 * LDAP Directory Routes — /api/v1/admin/ldap
 * Quản lý cấu hình kết nối Domain Controller và sync cây OU.
 * Yêu cầu quyền: admin:manage
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'
import { BadRequestError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { createSuccessResponse } from '../../../shared/utils/response.utils.js'
import { requirePermission } from '../assets/assets.helpers.js'
import { LdapSyncService } from './ldap.service.js'

interface LdapRoutesOptions {
    pgClient?: PgClient
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const uuidParam = z.object({ id: z.string().uuid() })

const configCreateSchema = z.object({
    name: z.string().min(1).max(255),
    serverUrl: z.string().url().refine(
        v => /^ldaps?:\/\//i.test(v),
        { message: 'Phải bắt đầu bằng ldap:// hoặc ldaps://' }
    ),
    baseDn: z.string().min(3),
    bindDn: z.string().min(3),
    bindPassword: z.string().min(1),
    ouSearchBase: z.string().nullable().optional(),
    ouFilter: z.string().optional(),
    tlsEnabled: z.boolean().optional(),
    tlsRejectUnauthorized: z.boolean().optional(),
    syncIntervalHours: z.number().int().min(0).max(720).optional(),
})

const configPatchSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    serverUrl: z.string().url().refine(
        v => /^ldaps?:\/\//i.test(v),
        { message: 'Phải bắt đầu bằng ldap:// hoặc ldaps://' }
    ).optional(),
    baseDn: z.string().min(3).optional(),
    bindDn: z.string().min(3).optional(),
    bindPassword: z.string().min(1).optional(),
    ouSearchBase: z.string().nullable().optional(),
    ouFilter: z.string().optional(),
    tlsEnabled: z.boolean().optional(),
    tlsRejectUnauthorized: z.boolean().optional(),
    syncIntervalHours: z.number().int().min(0).max(720).optional(),
    isActive: z.boolean().optional(),
})

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const ldapRoutes: FastifyPluginAsync<LdapRoutesOptions> = async (fastify: FastifyInstance, opts) => {
    const pgClient = opts.pgClient
    const svc = new LdapSyncService(pgClient!)

    // GET /admin/ldap/configs
    fastify.get('/configs', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const configs = await svc.listConfigs()
        return reply.send(createSuccessResponse(configs, String(request.id)))
    })

    // GET /admin/ldap/configs/:id
    fastify.get('/configs/:id', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const { id } = uuidParam.parse(request.params)
        const config = await svc.getConfigById(id)
        if (!config) throw new NotFoundError('LDAP config')
        return reply.send(createSuccessResponse(config, String(request.id)))
    })

    // POST /admin/ldap/configs
    fastify.post('/configs', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const body = configCreateSchema.parse(request.body)
        const config = await svc.createConfig(body)
        return reply.status(201).send(createSuccessResponse(config, String(request.id)))
    })

    // PATCH /admin/ldap/configs/:id
    fastify.patch('/configs/:id', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const { id } = uuidParam.parse(request.params)
        const patch = configPatchSchema.parse(request.body)
        const config = await svc.updateConfig(id, patch)
        if (!config) throw new NotFoundError('LDAP config')
        return reply.send(createSuccessResponse(config, String(request.id)))
    })

    // DELETE /admin/ldap/configs/:id
    fastify.delete('/configs/:id', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const { id } = uuidParam.parse(request.params)
        const existing = await svc.getConfigById(id)
        if (!existing) throw new NotFoundError('LDAP config')
        await svc.deleteConfig(id)
        return reply.send(createSuccessResponse({ deleted: true }, String(request.id)))
    })

    // POST /admin/ldap/configs/:id/test — test kết nối DC
    fastify.post('/configs/:id/test', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const { id } = uuidParam.parse(request.params)
        const existing = await svc.getConfigById(id)
        if (!existing) throw new NotFoundError('LDAP config')
        const result = await svc.testConnection(id)
        return reply.send(createSuccessResponse(result, String(request.id)))
    })

    // POST /admin/ldap/configs/:id/sync — trigger đồng bộ OU từ DC
    fastify.post('/configs/:id/sync', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const { id } = uuidParam.parse(request.params)
        const existing = await svc.getConfigById(id)
        if (!existing) throw new NotFoundError('LDAP config')
        if (!existing.isActive) throw new BadRequestError('Config đang bị vô hiệu hóa')
        const result = await svc.syncOrgUnits(id)
        return reply.send(createSuccessResponse(result, String(request.id)))
    })

    // GET /admin/ldap/org-units — xem org_units đã sync từ LDAP
    fastify.get('/org-units', async (request, reply) => {
        requirePermission(request, 'admin:manage')
        const pg = pgClient!
        const res = await pg.query(
            `SELECT id, name, parent_id, path, depth, description,
                    ldap_dn, ldap_sync_at, source, created_at, updated_at
             FROM org_units
             ORDER BY path`
        )
        const data = res.rows.map((r: Record<string, unknown>) => ({
            id: r['id'],
            name: r['name'],
            parentId: r['parent_id'],
            path: r['path'],
            depth: r['depth'],
            description: r['description'],
            ldapDn: r['ldap_dn'],
            ldapSyncAt: r['ldap_sync_at'] ? new Date(r['ldap_sync_at'] as string).toISOString() : null,
            source: r['source'] ?? 'manual',
            createdAt: new Date(r['created_at'] as string).toISOString(),
            updatedAt: new Date(r['updated_at'] as string).toISOString(),
        }))
        return reply.send(createSuccessResponse(data, String(request.id)))
    })
}
