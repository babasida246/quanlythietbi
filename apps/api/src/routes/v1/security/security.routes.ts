/**
 * Security & Compliance Routes
 * RBAC, audit logs, compliance frameworks
 */
import type { FastifyInstance } from 'fastify'
import type { SecurityService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

interface SecurityRoutesOptions {
    securityService: SecurityService
}

export async function securityRoutes(
    fastify: FastifyInstance,
    opts: SecurityRoutesOptions
): Promise<void> {
    const svc = opts.securityService

    // --- RBAC Permissions ---
    fastify.get('/security/permissions', async (request, reply) => {
        requirePermission(request, 'security:read')
        const permissions = await svc.listPermissions()
        return reply.send({ data: permissions })
    })

    fastify.post('/security/permissions', async (request, reply) => {
        requirePermission(request, 'security:manage')
        const body = z.object({
            code: z.string().min(1),
            name: z.string().min(1),
            description: z.string().optional(),
            module: z.string().min(1),
            action: z.enum(['read', 'create', 'update', 'delete', 'approve', 'export', 'admin'])
        }).parse(request.body)
        const perm = await svc.grantPermission(body.module, body.code, body.name)
        return reply.status(201).send({ data: perm })
    })

    fastify.get('/security/roles/:roleId/permissions', async (request, reply) => {
        requirePermission(request, 'security:read')
        const { roleId } = request.params as { roleId: string }
        const permissions = await svc.getRolePermissions(roleId)
        return reply.send({ data: permissions })
    })

    fastify.post('/security/roles/:roleId/permissions', async (request, reply) => {
        requirePermission(request, 'security:manage')
        const { roleId } = request.params as { roleId: string }
        const body = z.object({
            permissionIds: z.array(z.string().uuid())
        }).parse(request.body)
        for (const pid of body.permissionIds) {
            await svc.grantPermission(roleId, pid)
        }
        return reply.status(200).send({ data: { success: true } })
    })

    fastify.delete('/security/roles/:roleId/permissions/:permissionId', async (request, reply) => {
        requirePermission(request, 'security:manage')
        const { roleId, permissionId } = request.params as { roleId: string; permissionId: string }
        await svc.revokePermission(roleId, permissionId)
        return reply.status(204).send()
    })

    fastify.post('/security/check-permission', async (request, reply) => {
        const ctx = getUserContext(request)
        const body = z.object({
            permissionCode: z.string().min(1)
        }).parse(request.body)
        const result = await svc.checkPermission(ctx.role || ctx.userId, body.permissionCode)
        return reply.send({ data: result })
    })

    // --- Audit Logs ---
    fastify.get('/security/audit-logs', async (request, reply) => {
        requirePermission(request, 'security:read')
        const query = z.object({
            userId: z.string().uuid().optional(),
            action: z.string().optional(),
            entityType: z.string().optional(),
            riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
            from: z.string().optional(),
            to: z.string().optional(),
            limit: z.coerce.number().optional().default(50),
            offset: z.coerce.number().optional().default(0)
        }).parse(request.query)
        const logs = await svc.getAuditLogs(query)
        return reply.send({ data: logs })
    })

    fastify.post('/security/audit-logs', async (request, reply) => {
        const ctx = getUserContext(request)
        const body = z.object({
            action: z.string().min(1),
            entityType: z.string().min(1),
            entityId: z.string().optional(),
            details: z.record(z.unknown()).optional().default({}),
            ipAddress: z.string().optional(),
            userAgent: z.string().optional()
        }).parse(request.body)
        const log = await svc.logAction({
            userId: ctx.userId,
            action: body.action,
            entityType: body.entityType,
            entityId: body.entityId ?? null,
            details: body.details,
            ipAddress: body.ipAddress ?? (request.ip || null),
            userAgent: body.userAgent ?? (request.headers['user-agent'] || null)
        })
        return reply.status(201).send({ data: log })
    })

    // --- Compliance Frameworks ---
    fastify.get('/security/compliance/frameworks', async (request, reply) => {
        requirePermission(request, 'security:read')
        const frameworks = await svc.listFrameworks()
        return reply.send({ data: frameworks })
    })

    fastify.post('/security/compliance/frameworks', async (request, reply) => {
        requirePermission(request, 'security:manage')
        const body = z.object({
            code: z.string().min(1),
            name: z.string().min(1),
            version: z.string().optional().default('1.0'),
            description: z.string().optional()
        }).parse(request.body)
        const fw = await svc.createFramework(body)
        return reply.status(201).send({ data: fw })
    })

    // --- Compliance Controls ---
    fastify.get('/security/compliance/frameworks/:frameworkId/controls', async (request, reply) => {
        requirePermission(request, 'security:read')
        const { frameworkId } = request.params as { frameworkId: string }
        const controls = await svc.listControls(frameworkId)
        return reply.send({ data: controls })
    })

    fastify.post('/security/compliance/frameworks/:frameworkId/controls', async (request, reply) => {
        requirePermission(request, 'security:manage')
        const { frameworkId } = request.params as { frameworkId: string }
        const body = z.object({
            controlCode: z.string().min(1),
            name: z.string().min(1),
            description: z.string().optional(),
            category: z.string().optional(),
            severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
        }).parse(request.body)
        const control = await svc.createControl({ ...body, frameworkId })
        return reply.status(201).send({ data: control })
    })

    // --- Compliance Assessments ---
    fastify.get('/security/compliance/assessments', async (request, reply) => {
        requirePermission(request, 'security:read')
        const query = z.object({
            frameworkId: z.string().uuid().optional(),
            status: z.enum(['compliant', 'non_compliant', 'partial', 'not_assessed']).optional()
        }).parse(request.query)
        const assessments = await svc.listAssessments(query)
        return reply.send({ data: assessments })
    })

    fastify.post('/security/compliance/assessments', async (request, reply) => {
        const ctx = requirePermission(request, 'security:manage')
        const body = z.object({
            controlId: z.string().uuid(),
            assetId: z.string().uuid().optional(),
            status: z.enum(['compliant', 'non_compliant', 'partial', 'not_assessed']),
            evidence: z.string().optional(),
            notes: z.string().optional(),
            nextReviewDate: z.string().optional()
        }).parse(request.body)
        const assessment = await svc.createAssessment({
            ...body,
            assetId: body.assetId ?? null,
            evidence: body.evidence ?? null,
            notes: body.notes ?? null,
            nextReviewDate: body.nextReviewDate ?? null,
            assessedBy: ctx.userId
        })
        return reply.status(201).send({ data: assessment })
    })

    // --- Dashboard / Summary ---
    fastify.get('/security/compliance/summary', async (request, reply) => {
        requirePermission(request, 'security:read')
        const summary = await svc.getComplianceSummary()
        return reply.send({ data: summary })
    })
}
