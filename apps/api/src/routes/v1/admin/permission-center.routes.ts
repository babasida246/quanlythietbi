// ============================================================================
// Fastify Routes: Permission Center (Unified)
// Prefix: /api/v1/admin/permissions
// - classic/*   => legacy role-permission model
// - directory/* => OU/ACL inheritance model
// ============================================================================

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    PgOrgUnitRepo,
    PgRbacAclRepo,
    PgRbacAdPermissionRepo,
    PgRbacAdRoleRepo,
    PgRbacGroupRepo,
    PgRbacMembershipRepo,
    PgRbacUserRepo,
} from '@qltb/infra-postgres'
import { PermissionCenterService, RbacAdminService } from '@qltb/application'
import { z } from 'zod'
import { ForbiddenError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { createSuccessResponse } from '../../../shared/utils/response.utils.js'
import { requirePermission } from '../assets/assets.helpers.js'
import { invalidateAllowanceCache, invalidateDenialCache, invalidatePermissionCache } from '../../../shared/security/jwt-auth.js'
import { rbacAdRoutes } from './rbac-ad.routes.js'

interface PermissionCenterRoutesOptions {
    pgClient?: PgClient
}

const rolePermSchema = z.object({ permissionIds: z.array(z.string().uuid()) })

async function appendAuditLog(
    pgClient: PgClient,
    request: FastifyRequest,
    input: { actorUserId: string | null; action: string; resource: string; details?: Record<string, unknown> }
): Promise<void> {
    try {
        await pgClient.query(
            `INSERT INTO audit_logs (user_id, action, resource, details)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [input.actorUserId, input.action, input.resource, JSON.stringify(input.details ?? {})]
        )
    } catch (error) {
        request.log.warn({ err: error }, 'Failed to append permission center audit log')
    }
}

export const permissionCenterRoutes: FastifyPluginAsync<PermissionCenterRoutesOptions> = async (fastify, opts) => {
    const pgClient = opts.pgClient ?? (fastify as any).pgClient
    if (!pgClient) throw new Error('pgClient is required for permission center routes')

    type QueryResult<T> = { rows: T[]; rowCount: number }
    const query = <T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> => (
        pgClient.query(sql, params) as Promise<QueryResult<T>>
    )

    const ouRepo = new PgOrgUnitRepo(pgClient)
    const userRepo = new PgRbacUserRepo(pgClient)
    const groupRepo = new PgRbacGroupRepo(pgClient)
    const membershipRepo = new PgRbacMembershipRepo(pgClient)
    const roleRepo = new PgRbacAdRoleRepo(pgClient)
    const permissionRepo = new PgRbacAdPermissionRepo(pgClient)
    const aclRepo = new PgRbacAclRepo(pgClient)

    const adminService = new RbacAdminService(
        { ouRepo, userRepo, groupRepo, membershipRepo, aclRepo, roleRepo, permissionRepo },
        async (action, details) => {
            await pgClient.query(
                `INSERT INTO audit_logs (user_id, action, resource, details) VALUES ($1, $2, $3, $4::jsonb)`,
                [details.actorUserId ?? null, action, 'permission_center', JSON.stringify(details)]
            )
        }
    )

    const permissionCenterService = new PermissionCenterService({
        userRepo,
        getSystemRoleSlug: async (systemUserId: string): Promise<string | null> => {
            const row = await query<{ role: string | null }>(
                `SELECT role FROM users WHERE id = $1`,
                [systemUserId]
            )
            if (row.rowCount === 0) throw new NotFoundError('System user not found')
            return row.rows[0].role ?? null
        },
        getClassicRolePermissions: async (roleSlug: string) => {
            // Policy Library is authoritative (migration 060+): read from policy_permissions.
            // Falls back to role_permissions only if no policy with matching slug exists.
            const result = await query<{ key: string | null; policy_exists: boolean }>(
                `SELECT p.name AS key,
                        (SELECT EXISTS(SELECT 1 FROM policies WHERE slug = $1)) AS policy_exists
                 FROM policies pol
                 LEFT JOIN policy_permissions pp ON pp.policy_id = pol.id
                 LEFT JOIN permissions p ON p.id = pp.permission_id
                 WHERE pol.slug = $1`,
                [roleSlug]
            )
            if (result.rows.length > 0 && result.rows[0].policy_exists) {
                return result.rows
                    .filter((r): r is { key: string; policy_exists: boolean } => r.key !== null)
                    .map(r => ({ key: r.key }))
            }
            // Fallback: classic role_permissions
            const roleResult = await query<{ key: string }>(
                `SELECT p.name AS key
                 FROM roles r
                 JOIN role_permissions rp ON rp.role_id = r.id
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE r.slug = $1`,
                [roleSlug]
            )
            return roleResult.rows
        },
        // Resolve unified policy permissions for a system user:
        //   - Direct USER assignments
        //   - Via GROUP membership (rbac_group_members)
        //   - Via OU membership (rbac_users → org_units, with inherit subtree support)
        getPolicyPermissionsForUser: async (systemUserId: string) => {
            const rows = await query<{ key: string; effect: string }>(
                `-- 1. Direct USER assignments (any scope_type)
                 SELECT pm.name AS key, pa.effect
                 FROM policy_assignments pa
                 JOIN policy_permissions pp ON pp.policy_id = pa.policy_id
                 JOIN permissions pm ON pm.id = pp.permission_id
                 WHERE pa.principal_type = 'USER'
                   AND pa.principal_id = $1

                 UNION ALL

                 -- 2. Via GROUP membership (GLOBAL scope)
                 SELECT pm.name AS key, pa.effect
                 FROM policy_assignments pa
                 JOIN policy_permissions pp ON pp.policy_id = pa.policy_id
                 JOIN permissions pm ON pm.id = pp.permission_id
                 JOIN rbac_group_members gm ON gm.group_id = pa.principal_id
                    AND gm.member_type = 'USER'
                 JOIN rbac_users ru ON ru.id = gm.member_user_id
                    AND ru.linked_user_id = $1
                 WHERE pa.principal_type = 'GROUP'

                 UNION ALL

                 -- 3. Via OU — direct OU match or inherited parent OU
                 SELECT pm.name AS key, pa.effect
                 FROM policy_assignments pa
                 JOIN policy_permissions pp ON pp.policy_id = pa.policy_id
                 JOIN permissions pm ON pm.id = pp.permission_id
                 JOIN rbac_users ru ON ru.linked_user_id = $1
                 JOIN org_units user_ou ON user_ou.id = ru.ou_id
                 WHERE pa.principal_type = 'OU'
                   AND (
                     pa.principal_id = ru.ou_id
                     OR (pa.inherit = true AND EXISTS (
                       SELECT 1 FROM org_units scope_ou
                       WHERE scope_ou.id = pa.principal_id
                         AND user_ou.path LIKE scope_ou.path || '%'
                     ))
                   )`,
                [systemUserId]
            )
            const allowed: string[] = []
            const denied: string[] = []
            for (const row of rows.rows) {
                if (row.effect === 'DENY') denied.push(row.key)
                else allowed.push(row.key)
            }
            return { allowed, denied }
        },
    })

    // ---------------------------------------------------------------------
    // Unified overview endpoints
    // ---------------------------------------------------------------------

    fastify.get('/roles', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const [classicRoles, directoryRoles] = await Promise.all([
            query<{
                id: string
                slug: string
                name: string
                description: string | null
                is_system: boolean
                created_at: Date
                permission_count: string
            }>(
                `SELECT r.id, r.slug, r.name, r.description, r.is_system, r.created_at,
                        COUNT(rp.permission_id)::text AS permission_count
                 FROM roles r
                 LEFT JOIN role_permissions rp ON rp.role_id = r.id
                 GROUP BY r.id
                 ORDER BY r.created_at ASC`
            ),
            adminService.listRoles(),
        ])

        return reply.send({
            data: {
                classic: classicRoles.rows.map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: row.name,
                    description: row.description,
                    isSystem: row.is_system,
                    permissionCount: Number(row.permission_count),
                    createdAt: row.created_at.toISOString(),
                })),
                directory: directoryRoles,
            },
        })
    })

    fastify.get('/permissions', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const [classicPermissions, directoryPermissions] = await Promise.all([
            query<{ id: string; name: string; resource: string; action: string; description: string | null }>(
                `SELECT id, name, resource, action, description
                 FROM permissions
                 ORDER BY resource ASC, action ASC`
            ),
            adminService.listPermissions(),
        ])

        return reply.send({
            data: {
                classic: classicPermissions.rows,
                directory: directoryPermissions,
            },
        })
    })

    fastify.get('/effective/system-users/:id', async (request, reply) => {
        const id = (request.params as { id: string }).id
        // Allow self-lookup without admin:roles; viewing other users' perms requires admin:roles
        if (request.user?.id !== id) {
            await requirePermission(request, 'admin:roles')
        }
        const result = await permissionCenterService.getEffectiveForSystemUser(id)
        return reply.send({ data: result })
    })

    // ---------------------------------------------------------------------
    // Classic model endpoints under /classic/*
    // ---------------------------------------------------------------------

    fastify.get('/classic/roles', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const rows = await query<{
            id: string
            slug: string
            name: string
            description: string | null
            is_system: boolean
            created_at: Date
            permission_count: string
        }>(
            `SELECT r.id, r.slug, r.name, r.description, r.is_system, r.created_at,
                    COUNT(rp.permission_id)::text AS permission_count
             FROM roles r
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             GROUP BY r.id
             ORDER BY r.created_at ASC`
        )
        return reply.send({
            data: rows.rows.map((row) => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                description: row.description,
                isSystem: row.is_system,
                permissionCount: Number(row.permission_count),
                createdAt: row.created_at.toISOString(),
            })),
        })
    })

    fastify.get('/classic/permissions', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const rows = await query<{ id: string; name: string; resource: string; action: string; description: string | null }>(
            `SELECT id, name, resource, action, description
             FROM permissions
             ORDER BY resource ASC, action ASC`
        )
        return reply.send({ data: rows.rows })
    })

    fastify.get('/classic/roles/:slug/permissions', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const slug = (request.params as { slug: string }).slug
        const rows = await query<{ permission_id: string; name: string; resource: string; action: string }>(
            `SELECT p.id AS permission_id, p.name, p.resource, p.action
             FROM role_permissions rp
             JOIN roles r ON r.id = rp.role_id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE r.slug = $1`,
            [slug]
        )
        return reply.send({ data: rows.rows })
    })

    fastify.put('/classic/roles/:slug/permissions', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const slug = (request.params as { slug: string }).slug
        const body = rolePermSchema.parse(request.body)

        const roleRes = await query<{ id: string; is_system: boolean }>(
            `SELECT id, is_system FROM roles WHERE slug = $1`,
            [slug]
        )
        if (roleRes.rowCount === 0) throw new NotFoundError(`Role '${slug}' not found`)

        await pgClient.query('BEGIN')
        try {
            await pgClient.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleRes.rows[0].id])
            if (body.permissionIds.length > 0) {
                const vals = body.permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ')
                await pgClient.query(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
                    [roleRes.rows[0].id, ...body.permissionIds]
                )
            }
            await pgClient.query('COMMIT')
        } catch (error) {
            await pgClient.query('ROLLBACK')
            throw error
        }

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'permissions.classic.role_permissions.updated',
            resource: 'role_permissions',
            details: { roleSlug: slug, permissionCount: body.permissionIds.length },
        })
        invalidatePermissionCache(slug) // flush cached role perms so auth picks up new set

        return reply.send({ data: { success: true, roleSlug: slug, permissionCount: body.permissionIds.length } })
    })

    fastify.post('/classic/roles', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const body = z.object({
            slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
            name: z.string().min(1).max(255),
            description: z.string().optional(),
        }).parse(request.body)

        const result = await query<{
            id: string
            slug: string
            name: string
            description: string | null
            is_system: boolean
            created_at: Date
        }>(
            `INSERT INTO roles (slug, name, description, is_system)
             VALUES ($1, $2, $3, false)
             RETURNING id, slug, name, description, is_system, created_at`,
            [body.slug, body.name, body.description ?? null]
        )

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'permissions.classic.role.created',
            resource: 'roles',
            details: { roleSlug: body.slug },
        })

        const row = result.rows[0]
        return reply.status(201).send({
            data: {
                id: row.id,
                slug: row.slug,
                name: row.name,
                description: row.description,
                isSystem: row.is_system,
                permissionCount: 0,
                createdAt: row.created_at.toISOString(),
            },
        })
    })

    fastify.delete('/classic/roles/:slug', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const slug = (request.params as { slug: string }).slug

        const roleRes = await query<{ id: string; is_system: boolean }>(
            `SELECT id, is_system FROM roles WHERE slug = $1`,
            [slug]
        )
        if (roleRes.rowCount === 0) throw new NotFoundError(`Role '${slug}' not found`)
        if (roleRes.rows[0].is_system) throw new ForbiddenError('System roles cannot be deleted')

        await pgClient.query(`DELETE FROM roles WHERE id = $1`, [roleRes.rows[0].id])

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'permissions.classic.role.deleted',
            resource: 'roles',
            details: { roleSlug: slug },
        })

        return reply.send({ data: { success: true } })
    })

    fastify.put('/classic/roles/:slug', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const slug = (request.params as { slug: string }).slug
        const body = z.object({
            name: z.string().min(1).max(255).optional(),
            description: z.string().optional(),
        }).parse(request.body)

        const roleRes = await query<{ id: string }>(
            `SELECT id FROM roles WHERE slug = $1`,
            [slug]
        )
        if (roleRes.rowCount === 0) throw new NotFoundError(`Role '${slug}' not found`)

        const fields: string[] = []
        const vals: unknown[] = [roleRes.rows[0].id]
        if (body.name !== undefined) fields.push(`name = $${vals.push(body.name)}`)
        if (body.description !== undefined) fields.push(`description = $${vals.push(body.description)}`)

        if (fields.length > 0) {
            await pgClient.query(`UPDATE roles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`, vals)
        }

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'permissions.classic.role.updated',
            resource: 'roles',
            details: { roleSlug: slug },
        })

        return reply.send({ data: { success: true } })
    })

    fastify.post('/classic/ou-assign', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const body = z.object({
            ouId: z.string().uuid(),
            roleSlug: z.string().min(1),
            includeSubOUs: z.boolean().default(true),
        }).parse(request.body)

        const roleRes = await query<{ id: string }>(
            `SELECT id FROM roles WHERE slug = $1`,
            [body.roleSlug]
        )
        if (roleRes.rowCount === 0) throw new NotFoundError(`Role '${body.roleSlug}' not found`)

        const ouFilter = body.includeSubOUs
            ? `ou.path LIKE (SELECT path || '%' FROM org_units WHERE id = $1)`
            : `au.ou_id = $1`

        const result = await pgClient.query(
            `UPDATE users u
             SET role = $2, updated_at = NOW()
             FROM rbac_users au
             JOIN org_units ou ON ou.id = au.ou_id
             WHERE au.linked_user_id = u.id
               AND ${ouFilter}
             RETURNING u.id`,
            [body.ouId, body.roleSlug]
        )

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId,
            action: 'permissions.classic.ou_role_assigned',
            resource: 'users',
            details: { ouId: body.ouId, roleSlug: body.roleSlug, updatedCount: result.rowCount },
        })

        return reply.send({ data: { success: true, updatedCount: result.rowCount ?? 0 } })
    })

    // ---------------------------------------------------------------------
    // Directory model endpoint set under /directory/*
    // Reuse existing route implementation to keep behavior stable.
    // ---------------------------------------------------------------------
    await fastify.register(rbacAdRoutes, {
        prefix: '/directory',
        pgClient,
    })

    // =====================================================================
    // Unified Policy System endpoints under /policies/*
    // Tables: policies, policy_permissions, policy_assignments
    //
    // Route registration order matters for Fastify's radix tree:
    //   static routes (/policies/permissions, /policies/principals) FIRST
    //   then dynamic routes (/policies/:id/...)
    // =====================================================================

    const policySchema = z.object({
        slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
    })

    const assignmentSchema = z.object({
        principalType: z.enum(['USER', 'GROUP', 'OU']),
        principalId: z.string().uuid(),
        scopeType: z.enum(['GLOBAL', 'OU', 'RESOURCE']).default('GLOBAL'),
        scopeOuId: z.string().uuid().optional(),
        scopeResource: z.string().optional(),
        effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
        inherit: z.boolean().default(true),
    })

    // ── STATIC routes first (must come before /:id dynamic routes) ──────────

    // GET /policies/permission-catalog — full permission list for the matrix UI
    fastify.get('/policies/permission-catalog', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const rows = await query<{ id: string; name: string; resource: string; action: string; description: string | null }>(
            `SELECT id, name, resource, action, description FROM permissions ORDER BY resource ASC, action ASC`
        )
        return reply.send({ data: rows.rows })
    })

    // GET /policies/by-ou/:ouId — all policies linked to an OU
    // (direct OU assignments + inherited from ancestor OUs + via groups in this OU)
    fastify.get('/policies/by-ou/:ouId', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const { ouId } = request.params as { ouId: string }
        const rows = await query<{
            policy_id: string; slug: string; name: string; description: string | null
            is_system: boolean; permission_count: number
            assignment_id: string; principal_type: string; principal_id: string
            scope_type: string; scope_ou_id: string | null
            effect: string; inherit: boolean; assigned_at: Date
            link_reason: string; principal_name: string | null
        }>(
            `SELECT
                p.id            AS policy_id,
                p.slug, p.name, p.description, p.is_system,
                COUNT(DISTINCT pp.permission_id)::int AS permission_count,
                pa.id           AS assignment_id,
                pa.principal_type, pa.principal_id,
                pa.scope_type, pa.scope_ou_id,
                pa.effect, pa.inherit,
                pa.created_at   AS assigned_at,
                CASE
                    WHEN pa.principal_type = 'OU' AND pa.principal_id = $1 THEN 'direct'
                    WHEN pa.principal_type = 'OU' AND pa.inherit = true   THEN 'inherited'
                    ELSE 'via_group'
                END AS link_reason,
                COALESCE(grp.name, ou2.name) AS principal_name
             FROM policy_assignments pa
             JOIN policies p ON p.id = pa.policy_id
             LEFT JOIN policy_permissions pp ON pp.policy_id = p.id
             LEFT JOIN rbac_groups grp ON pa.principal_type = 'GROUP' AND grp.id = pa.principal_id
             LEFT JOIN org_units ou2  ON pa.principal_type = 'OU'    AND ou2.id = pa.principal_id
             WHERE
                (pa.principal_type = 'OU' AND pa.principal_id = $1)
                OR
                (pa.principal_type = 'OU' AND pa.inherit = true AND pa.principal_id <> $1
                 AND EXISTS (
                     SELECT 1 FROM org_units ancestor
                     JOIN org_units target ON target.id = $1
                     WHERE ancestor.id = pa.principal_id
                       AND (ancestor.path = '/' OR target.path LIKE ancestor.path || '/%')
                 ))
                OR
                (pa.principal_type = 'GROUP' AND EXISTS (
                    SELECT 1 FROM rbac_groups g WHERE g.id = pa.principal_id AND g.ou_id = $1
                ))
             GROUP BY p.id, p.slug, p.name, p.description, p.is_system,
                      pa.id, pa.principal_type, pa.principal_id,
                      pa.scope_type, pa.scope_ou_id, pa.effect, pa.inherit, pa.created_at,
                      grp.name, ou2.name
             ORDER BY p.name ASC, pa.effect ASC`,
            [ouId]
        )
        return reply.send({
            data: rows.rows.map(r => ({
                policyId: r.policy_id, slug: r.slug, name: r.name, description: r.description,
                isSystem: r.is_system, permissionCount: r.permission_count,
                assignmentId: r.assignment_id, principalType: r.principal_type,
                principalId: r.principal_id, scopeType: r.scope_type, scopeOuId: r.scope_ou_id,
                effect: r.effect, inherit: r.inherit, assignedAt: r.assigned_at.toISOString(),
                linkReason: r.link_reason, principalName: r.principal_name,
            })),
        })
    })

    // GET /policies/principals — users / groups / OUs for the assignment picker
    fastify.get('/policies/principals', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const [usersRes, groupsRes, ousRes] = await Promise.all([
            query<{ id: string; name: string; email: string; role: string | null }>(
                `SELECT id, name, email, role FROM users WHERE is_active = true ORDER BY name ASC`
            ),
            query<{ id: string; name: string; description: string | null }>(
                `SELECT id, name, description FROM rbac_groups ORDER BY name ASC`
            ),
            query<{ id: string; name: string; path: string }>(
                `SELECT id, name, path FROM org_units ORDER BY path ASC`
            ),
        ])
        return reply.send({ data: { users: usersRes.rows, groups: groupsRes.rows, ous: ousRes.rows } })
    })

    // ── Collection-level CRUD ─────────────────────────────────────────────────

    // GET /policies — list all policies
    fastify.get('/policies', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const rows = await query<{
            id: string; slug: string; name: string; description: string | null
            is_system: boolean; created_at: Date; permission_count: string
        }>(
            `SELECT p.id, p.slug, p.name, p.description, p.is_system, p.created_at,
                    COUNT(pp.permission_id)::text AS permission_count
             FROM policies p
             LEFT JOIN policy_permissions pp ON pp.policy_id = p.id
             GROUP BY p.id
             ORDER BY p.created_at ASC`
        )
        return reply.send({
            data: rows.rows.map(r => ({
                id: r.id, slug: r.slug, name: r.name, description: r.description,
                isSystem: r.is_system, permissionCount: Number(r.permission_count),
                createdAt: r.created_at.toISOString(),
            })),
        })
    })

    // POST /policies — create policy
    fastify.post('/policies', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const body = policySchema.parse(request.body)
        const result = await query<{ id: string; slug: string; name: string; description: string | null; is_system: boolean; created_at: Date }>(
            `INSERT INTO policies (slug, name, description, is_system)
             VALUES ($1, $2, $3, false)
             RETURNING id, slug, name, description, is_system, created_at`,
            [body.slug, body.name, body.description ?? null]
        )
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.created',
            resource: 'policies', details: { slug: body.slug },
        })
        const r = result.rows[0]
        return reply.status(201).send({
            data: { id: r.id, slug: r.slug, name: r.name, description: r.description, isSystem: r.is_system, permissionCount: 0, createdAt: r.created_at.toISOString() },
        })
    })

    // PUT /policies/:id — update policy name/description
    fastify.put('/policies/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const body = z.object({ name: z.string().min(1).max(255).optional(), description: z.string().optional() }).parse(request.body)

        const fields: string[] = []
        const vals: unknown[] = [id]
        if (body.name !== undefined) fields.push(`name = $${vals.push(body.name)}`)
        if (body.description !== undefined) fields.push(`description = $${vals.push(body.description)}`)

        if (fields.length > 0) {
            await pgClient.query(`UPDATE policies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`, vals)
        }
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.updated',
            resource: 'policies', details: { policyId: id },
        })
        return reply.send({ data: { success: true } })
    })

    // DELETE /policies/:id — delete non-system policy
    fastify.delete('/policies/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const check = await query<{ is_system: boolean; slug: string }>(`SELECT is_system, slug FROM policies WHERE id = $1`, [id])
        if (check.rowCount === 0) throw new NotFoundError('Policy not found')
        if (check.rows[0].is_system) throw new ForbiddenError('System policies cannot be deleted')
        await pgClient.query(`DELETE FROM policies WHERE id = $1`, [id])
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.deleted',
            resource: 'policies', details: { policyId: id, slug: check.rows[0].slug },
        })
        return reply.send({ data: { success: true } })
    })

    // GET /policies/:id/permissions — list permission IDs assigned to a policy
    fastify.get('/policies/:id/permissions', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const rows = await query<{ permission_id: string; name: string; resource: string; action: string }>(
            `SELECT p.id AS permission_id, p.name, p.resource, p.action
             FROM policy_permissions pp
             JOIN permissions p ON p.id = pp.permission_id
             WHERE pp.policy_id = $1`, [id]
        )
        return reply.send({ data: rows.rows })
    })

    // PUT /policies/:id/permissions — replace permission set
    fastify.put('/policies/:id/permissions', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const body = rolePermSchema.parse(request.body)

        const check = await query<{ id: string }>(`SELECT id FROM policies WHERE id = $1`, [id])
        if (check.rowCount === 0) throw new NotFoundError('Policy not found')

        await pgClient.query('BEGIN')
        try {
            await pgClient.query(`DELETE FROM policy_permissions WHERE policy_id = $1`, [id])
            if (body.permissionIds.length > 0) {
                const vals = body.permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ')
                await pgClient.query(
                    `INSERT INTO policy_permissions (policy_id, permission_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
                    [id, ...body.permissionIds]
                )
            }
            await pgClient.query('COMMIT')
        } catch (err) {
            await pgClient.query('ROLLBACK')
            throw err
        }
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.permissions_updated',
            resource: 'policy_permissions', details: { policyId: id, permissionCount: body.permissionIds.length },
        })
        // Changing policy permissions affects all users assigned to this policy — flush all caches
        invalidateDenialCache()
        invalidatePermissionCache() // flush role permission cache so auth middleware re-reads policy_permissions
        return reply.send({ data: { success: true, permissionCount: body.permissionIds.length } })
    })

    // GET /policies/:id/assignments — list all assignments for a policy
    fastify.get('/policies/:id/assignments', async (request, reply) => {
        await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const rows = await query<{
            id: string; principal_type: string; principal_id: string
            scope_type: string; scope_ou_id: string | null; scope_resource: string | null
            effect: string; inherit: boolean; created_at: Date
            principal_name: string | null
        }>(
            `SELECT pa.id, pa.principal_type, pa.principal_id,
                    pa.scope_type, pa.scope_ou_id, pa.scope_resource,
                    pa.effect, pa.inherit, pa.created_at,
                    COALESCE(
                        CASE pa.principal_type
                            WHEN 'USER'  THEN u.name
                            WHEN 'GROUP' THEN g.name
                            WHEN 'OU'    THEN ou.name
                        END
                    , pa.principal_id::text) AS principal_name
             FROM policy_assignments pa
             LEFT JOIN users u ON pa.principal_type = 'USER' AND u.id = pa.principal_id
             LEFT JOIN rbac_groups g ON pa.principal_type = 'GROUP' AND g.id = pa.principal_id
             LEFT JOIN org_units ou ON pa.principal_type = 'OU' AND ou.id = pa.principal_id
             WHERE pa.policy_id = $1
             ORDER BY pa.created_at ASC`, [id]
        )
        return reply.send({
            data: rows.rows.map(r => ({
                id: r.id,
                principalType: r.principal_type,
                principalId: r.principal_id,
                principalName: r.principal_name,
                scopeType: r.scope_type,
                scopeOuId: r.scope_ou_id,
                scopeResource: r.scope_resource,
                effect: r.effect,
                inherit: r.inherit,
                createdAt: r.created_at.toISOString(),
            })),
        })
    })

    // POST /policies/:id/assignments — add an assignment
    fastify.post('/policies/:id/assignments', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const body = assignmentSchema.parse(request.body)

        const check = await query<{ id: string }>(`SELECT id FROM policies WHERE id = $1`, [id])
        if (check.rowCount === 0) throw new NotFoundError('Policy not found')

        const result = await query<{ id: string; created_at: Date }>(
            `INSERT INTO policy_assignments
                (policy_id, principal_type, principal_id, scope_type, scope_ou_id, scope_resource, effect, inherit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, created_at`,
            [id, body.principalType, body.principalId, body.scopeType,
             body.scopeOuId ?? null, body.scopeResource ?? null, body.effect, body.inherit]
        )
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.assignment_added',
            resource: 'policy_assignments', details: { policyId: id, ...body },
        })
        // Invalidate caches so changes take effect on the next request
        if (body.principalType === 'USER') {
            invalidateDenialCache(body.principalId)
            invalidateAllowanceCache(body.principalId)
        } else {
            // GROUP/OU — flush all, affected users unknown
            invalidateDenialCache()
            invalidateAllowanceCache()
        }
        return reply.status(201).send({
            data: { id: result.rows[0].id, createdAt: result.rows[0].created_at.toISOString() },
        })
    })

    // DELETE /policies/:id/assignments/:assignmentId — remove an assignment
    fastify.delete('/policies/:id/assignments/:assignmentId', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const { id, assignmentId } = request.params as { id: string; assignmentId: string }
        const check = await query<{ id: string; principal_type: string; principal_id: string }>(
            `SELECT id, principal_type, principal_id FROM policy_assignments WHERE id = $1 AND policy_id = $2`,
            [assignmentId, id]
        )
        if (check.rowCount === 0) throw new NotFoundError('Assignment not found')
        await pgClient.query(`DELETE FROM policy_assignments WHERE id = $1`, [assignmentId])
        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.assignment_removed',
            resource: 'policy_assignments', details: { policyId: id, assignmentId },
        })
        // Invalidate caches for affected user (or all if GROUP/OU assignment)
        const deleted = check.rows[0]
        if (deleted.principal_type === 'USER') {
            invalidateDenialCache(deleted.principal_id)
            invalidateAllowanceCache(deleted.principal_id)
        } else {
            invalidateDenialCache()
            invalidateAllowanceCache()
        }
        return reply.send({ data: { success: true } })
    })

    // POST /policies/:id/assignments/bulk-ou — assign policy to all users in an OU (+ sub-OUs)
    fastify.post('/policies/:id/assignments/bulk-ou', async (request, reply) => {
        const ctx = await requirePermission(request, 'admin:roles')
        const id = (request.params as { id: string }).id
        const body = z.object({
            ouId: z.string().uuid(),
            includeSubOUs: z.boolean().default(true),
            effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
        }).parse(request.body)

        const check = await query<{ id: string }>(`SELECT id FROM policies WHERE id = $1`, [id])
        if (check.rowCount === 0) throw new NotFoundError('Policy not found')

        // Find all users whose RBAC user is in the target OU (or sub-OUs)
        const ouFilter = body.includeSubOUs
            ? `user_ou.path LIKE (SELECT path || '%' FROM org_units WHERE id = $2)`
            : `ru.ou_id = $2`

        const usersRes = await query<{ linked_user_id: string }>(
            `SELECT ru.linked_user_id
             FROM rbac_users ru
             JOIN org_units user_ou ON user_ou.id = ru.ou_id
             WHERE ru.linked_user_id IS NOT NULL
               AND ${ouFilter}`,
            [id, body.ouId]
        )

        let inserted = 0
        for (const { linked_user_id } of usersRes.rows) {
            await pgClient.query(
                `INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
                 VALUES ($1, 'USER', $2, 'GLOBAL', $3, true)
                 ON CONFLICT DO NOTHING`,
                [id, linked_user_id, body.effect]
            )
            inserted++
        }

        await appendAuditLog(pgClient, request, {
            actorUserId: ctx.userId, action: 'permissions.policy.bulk_ou_assigned',
            resource: 'policy_assignments', details: { policyId: id, ouId: body.ouId, effect: body.effect, inserted },
        })
        // Flush all per-user caches — affected users span an entire OU subtree
        invalidateDenialCache()
        invalidateAllowanceCache()
        return reply.send({ data: { success: true, inserted } })
    })
}

