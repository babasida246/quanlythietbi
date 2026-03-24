// ============================================================================
// Fastify Routes: RBAC AD Admin — OU / User / Group / ACL / Permissions
// Prefix: /api/v1/admin/rbac
// ============================================================================

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    PgOrgUnitRepo, PgRbacUserRepo, PgRbacGroupRepo,
    PgRbacMembershipRepo, PgRbacAdRoleRepo,
    PgRbacAdPermissionRepo, PgRbacAclRepo,
} from '@qltb/infra-postgres'
import { AuthorizationService, RbacAdminService } from '@qltb/application'
import { z } from 'zod'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors/http-errors.js'
import { createSuccessResponse } from '../../../shared/utils/response.utils.js'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

// ─── Plugin Options ──────────────────────────────────────────────────────────

interface RbacAdRoutesOptions {
    pgClient?: PgClient
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const uuidParam = z.object({ id: z.string().uuid() })
const groupIdParam = z.object({ groupId: z.string().uuid() })

// OU
const ouCreateSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable(),
    description: z.string().optional(),
})
const ouUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
})

// User
const userCreateSchema = z.object({
    username: z.string().min(1).max(255),
    displayName: z.string().min(1).max(255),
    email: z.string().email().optional(),
    ouId: z.string().uuid(),
    linkedUserId: z.string().uuid().optional(),
    status: z.enum(['active', 'disabled', 'locked']).optional(),
})
const userUpdateSchema = z.object({
    displayName: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    status: z.enum(['active', 'disabled', 'locked']).optional(),
    linkedUserId: z.string().uuid().nullable().optional(),
})
const userListQuery = z.object({
    ouId: z.string().uuid().optional(),
    search: z.string().optional(),
})
const moveToOuSchema = z.object({
    ouId: z.string().uuid(),
})

// Group
const groupCreateSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    ouId: z.string().uuid(),
})
const groupUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
})
const groupListQuery = z.object({
    ouId: z.string().uuid().optional(),
    search: z.string().optional(),
})

// Membership
const memberAddSchema = z.object({
    memberType: z.enum(['USER', 'GROUP']),
    memberUserId: z.string().uuid().optional(),
    memberGroupId: z.string().uuid().optional(),
}).refine(data => {
    if (data.memberType === 'USER') return !!data.memberUserId
    return !!data.memberGroupId
}, { message: 'memberUserId required for USER, memberGroupId required for GROUP' })

const memberRemoveQuery = z.object({
    memberType: z.enum(['USER', 'GROUP']),
    memberId: z.string().uuid(),
})

// ACL
const aclAssignSchema = z.object({
    principalType: z.enum(['USER', 'GROUP']),
    principalUserId: z.string().uuid().optional(),
    principalGroupId: z.string().uuid().optional(),
    roleId: z.string().uuid(),
    scopeType: z.enum(['GLOBAL', 'OU', 'RESOURCE']),
    scopeOuId: z.string().uuid().optional(),
    scopeResource: z.string().optional(),
    effect: z.enum(['ALLOW', 'DENY']),
    inherit: z.boolean().optional(),
}).refine(data => {
    if (data.principalType === 'USER') return !!data.principalUserId
    return !!data.principalGroupId
}, { message: 'principalUserId required for USER, principalGroupId required for GROUP' })

const aclListQuery = z.object({
    principalUserId: z.string().uuid().optional(),
    principalGroupId: z.string().uuid().optional(),
})

// Role permissions
const setRolePermsSchema = z.object({
    permissionIds: z.array(z.string().uuid()),
})

// ─── Audit log helper ────────────────────────────────────────────────────────

async function appendAuditLog(
    pgClient: PgClient,
    request: FastifyRequest,
    input: { actorUserId: string | null; action: string; resource: string; details?: Record<string, unknown> }
): Promise<void> {
    try {
        const correlationId = getUserContext(request).correlationId
        await pgClient.query(
            `INSERT INTO audit_logs (correlation_id, user_id, action, resource, details)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [correlationId, input.actorUserId, input.action, input.resource, JSON.stringify(input.details ?? {})]
        )
    } catch (error) {
        request.log.warn({ err: error }, 'Failed to append RBAC audit log')
    }
}

// ─── Route Plugin ────────────────────────────────────────────────────────────

export const rbacAdRoutes: FastifyPluginAsync<RbacAdRoutesOptions> = async (fastify, opts) => {
    const pgClient: PgClient = opts.pgClient ?? (fastify as any).pgClient
    if (!pgClient) throw new Error('pgClient is required for RBAC AD routes')

    // ── Bootstrap repos & services ───────────────────────────────────────
    const ouRepo = new PgOrgUnitRepo(pgClient)
    const userRepo = new PgRbacUserRepo(pgClient)
    const groupRepo = new PgRbacGroupRepo(pgClient)
    const membershipRepo = new PgRbacMembershipRepo(pgClient)
    const roleRepo = new PgRbacAdRoleRepo(pgClient)
    const permissionRepo = new PgRbacAdPermissionRepo(pgClient)
    const aclRepo = new PgRbacAclRepo(pgClient)

    const authzService = new AuthorizationService({
        ouRepo, userRepo, membershipRepo, aclRepo, roleRepo, permissionRepo,
    })

    const adminService = new RbacAdminService(
        { ouRepo, userRepo, groupRepo, membershipRepo, aclRepo, roleRepo, permissionRepo },
        async (action, details) => {
            // Audit log callback — we create a minimal request-like context
            try {
                await pgClient.query(
                    `INSERT INTO audit_logs (user_id, action, resource, details) VALUES ($1, $2, $3, $4::jsonb)`,
                    [details.actorUserId ?? null, action, 'rbac', JSON.stringify(details)]
                )
            } catch { /* swallow */ }
        }
    )

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  OU Routes
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /org-units/tree
    fastify.get('/org-units/tree', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const tree = await adminService.getOuTree()
        return reply.send(createSuccessResponse(tree, String(request.id)))
    })

    // POST /org-units
    fastify.post('/org-units', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:ou:manage')
        const body = ouCreateSchema.parse(request.body)
        try {
            const ou = await adminService.createOu(body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId, action: 'rbac.ou.create', resource: 'org_units',
                details: { ouId: ou.id, name: ou.name }
            })
            return reply.status(201).send(createSuccessResponse(ou, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            if (err?.code === 'CONFLICT') throw new ConflictError(err.message)
            throw err
        }
    })

    // PATCH /org-units/:id
    fastify.patch('/org-units/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:ou:manage')
        const { id } = uuidParam.parse(request.params)
        const body = ouUpdateSchema.parse(request.body)
        try {
            const ou = await adminService.updateOu(id, body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse(ou, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // DELETE /org-units/:id
    fastify.delete('/org-units/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:ou:manage')
        const { id } = uuidParam.parse(request.params)
        try {
            await adminService.deleteOu(id, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse({ deleted: true }, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            if (err?.code === 'CONFLICT') throw new ConflictError(err.message)
            throw err
        }
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  User Routes
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /users
    fastify.get('/users', async (request, reply) => {
        requirePermission(request, 'rbac:user:manage')
        const query = userListQuery.parse(request.query)
        const users = await adminService.listUsers(query)
        return reply.send(createSuccessResponse(users, String(request.id)))
    })

    // POST /users
    fastify.post('/users', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:user:manage')
        const body = userCreateSchema.parse(request.body)
        try {
            // Auto-link: nếu không truyền linkedUserId nhưng có email,
            // tự tìm system user có email trùng để liên kết
            let linkedUserId = body.linkedUserId
            if (!linkedUserId && body.email) {
                const found = await pgClient.query<{ id: string }>(
                    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1`,
                    [body.email]
                )
                if (found.rows[0]) linkedUserId = found.rows[0].id
            }

            const user = await adminService.createUser(
                { ...body, linkedUserId },
                { actorUserId: ctx.userId, correlationId: ctx.correlationId }
            )
            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId, action: 'rbac.user.create', resource: 'rbac_users',
                details: { userId: user.id, username: user.username, autoLinked: !!linkedUserId }
            })
            return reply.status(201).send(createSuccessResponse(user, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // PATCH /users/:id
    fastify.patch('/users/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:user:manage')
        const { id } = uuidParam.parse(request.params)
        const body = userUpdateSchema.parse(request.body)
        try {
            const user = await adminService.updateUser(id, body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse(user, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // DELETE /users/:id
    fastify.delete('/users/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:user:manage')
        const { id } = uuidParam.parse(request.params)
        try {
            await adminService.deleteUser(id, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse({ deleted: true }, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // POST /users/:id/move
    fastify.post('/users/:id/move', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:user:manage')
        const { id } = uuidParam.parse(request.params)
        const body = moveToOuSchema.parse(request.body)
        try {
            const user = await adminService.moveUserToOu(id, body.ouId, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse(user, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  Group Routes
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /groups
    fastify.get('/groups', async (request, reply) => {
        requirePermission(request, 'rbac:group:manage')
        const query = groupListQuery.parse(request.query)
        const groups = await adminService.listGroups(query)
        return reply.send(createSuccessResponse(groups, String(request.id)))
    })

    // POST /groups
    fastify.post('/groups', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:group:manage')
        const body = groupCreateSchema.parse(request.body)
        try {
            const group = await adminService.createGroup(body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId, action: 'rbac.group.create', resource: 'rbac_groups',
                details: { groupId: group.id, name: group.name }
            })
            return reply.status(201).send(createSuccessResponse(group, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // PATCH /groups/:id
    fastify.patch('/groups/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:group:manage')
        const { id } = uuidParam.parse(request.params)
        const body = groupUpdateSchema.parse(request.body)
        try {
            const group = await adminService.updateGroup(id, body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse(group, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // DELETE /groups/:id
    fastify.delete('/groups/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:group:manage')
        const { id } = uuidParam.parse(request.params)
        try {
            await adminService.deleteGroup(id, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse({ deleted: true }, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  Group Membership Routes
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /groups/:groupId/members
    fastify.get('/groups/:groupId/members', async (request, reply) => {
        requirePermission(request, 'rbac:group:manage')
        const { groupId } = groupIdParam.parse(request.params)
        const members = await adminService.listGroupMembers(groupId)
        return reply.send(createSuccessResponse(members, String(request.id)))
    })

    // POST /groups/:groupId/members
    fastify.post('/groups/:groupId/members', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:group:manage')
        const { groupId } = groupIdParam.parse(request.params)
        const body = memberAddSchema.parse(request.body)
        try {
            const member = await adminService.addMember(groupId, body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.status(201).send(createSuccessResponse(member, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            if (err?.code === 'CONFLICT') throw new ConflictError(err.message)
            throw err
        }
    })

    // DELETE /groups/:groupId/members
    fastify.delete('/groups/:groupId/members', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:group:manage')
        const { groupId } = groupIdParam.parse(request.params)
        const { memberType, memberId } = memberRemoveQuery.parse(request.query)
        const result = await adminService.removeMember(groupId, memberType, memberId, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
        return reply.send(createSuccessResponse({ removed: result }, String(request.id)))
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  ACL Routes
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /acl
    fastify.get('/acl', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const query = aclListQuery.parse(request.query)
        const entries = await adminService.listAcl(query)
        return reply.send(createSuccessResponse(entries, String(request.id)))
    })

    // POST /acl
    fastify.post('/acl', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:admin')
        const body = aclAssignSchema.parse(request.body)
        try {
            const entry = await adminService.assignAcl(body, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            await appendAuditLog(pgClient, request, {
                actorUserId: ctx.userId, action: 'rbac.acl.assign', resource: 'rbac_acl',
                details: { aclId: entry.id, principalType: body.principalType, effect: body.effect }
            })
            return reply.status(201).send(createSuccessResponse(entry, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // DELETE /acl/:id
    fastify.delete('/acl/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:admin')
        const { id } = uuidParam.parse(request.params)
        try {
            await adminService.revokeAcl(id, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
            return reply.send(createSuccessResponse({ deleted: true }, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  Roles & Permissions
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /roles
    fastify.get('/roles', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const roles = await adminService.listRoles()
        return reply.send(createSuccessResponse(roles, String(request.id)))
    })

    // GET /permissions
    fastify.get('/permissions', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const perms = await adminService.listPermissions()
        return reply.send(createSuccessResponse(perms, String(request.id)))
    })

    // GET /roles/:id/permissions
    fastify.get('/roles/:id/permissions', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const { id } = uuidParam.parse(request.params)
        const perms = await adminService.getRolePermissions(id)
        return reply.send(createSuccessResponse(perms, String(request.id)))
    })

    // PUT /roles/:id/permissions
    fastify.put('/roles/:id/permissions', async (request, reply) => {
        const ctx = requirePermission(request, 'rbac:admin')
        const { id } = uuidParam.parse(request.params)
        const body = setRolePermsSchema.parse(request.body)
        await adminService.setRolePermissions(id, body.permissionIds, { actorUserId: ctx.userId, correlationId: ctx.correlationId })
        return reply.send(createSuccessResponse({ updated: true }, String(request.id)))
    })

    // ╔═══════════════════════════════════════════════════════════════════════
    // ║  Effective Permissions (current user or specific user)
    // ╚═══════════════════════════════════════════════════════════════════════

    // GET /me/effective-permissions — for current user (linked via rbac_users.linked_user_id)
    fastify.get('/me/effective-permissions', async (request, reply) => {
        const ctx = getUserContext(request)
        // Lookup RBAC user by linked_user_id
        const rbacUser = await userRepo.getByLinkedUserId(ctx.userId)
        if (!rbacUser) {
            return reply.send(createSuccessResponse({
                userId: ctx.userId,
                permissions: {},
                denied: [],
                allowed: [],
                message: 'No RBAC user linked. Using legacy permission system.'
            }, String(request.id)))
        }

        const result = await authzService.listEffective(rbacUser.id)
        // Convert Map/Set to plain objects for JSON serialization
        return reply.send(createSuccessResponse({
            userId: rbacUser.id,
            username: rbacUser.username,
            permissions: Object.fromEntries(result.permissions),
            denied: Array.from(result.denied),
            allowed: Array.from(result.allowed),
        }, String(request.id)))
    })

    // GET /users/:id/effective-permissions — admin view
    fastify.get('/users/:id/effective-permissions', async (request, reply) => {
        requirePermission(request, 'rbac:admin')
        const { id } = uuidParam.parse(request.params)
        try {
            const result = await authzService.listEffective(id)
            return reply.send(createSuccessResponse({
                userId: id,
                permissions: Object.fromEntries(result.permissions),
                denied: Array.from(result.denied),
                allowed: Array.from(result.allowed),
            }, String(request.id)))
        } catch (err: any) {
            if (err?.code === 'NOT_FOUND') throw new NotFoundError(err.message)
            throw err
        }
    })
}
