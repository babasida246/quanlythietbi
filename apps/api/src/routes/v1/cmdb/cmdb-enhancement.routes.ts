/**
 * CMDB Enhancement Routes
 * Discovery, impact analysis, smart tagging
 */
import type { FastifyInstance } from 'fastify'
import type { CmdbEnhancementService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

interface CmdbEnhancementRoutesOptions {
    cmdbEnhancementService: CmdbEnhancementService
}

export async function cmdbEnhancementRoutes(
    fastify: FastifyInstance,
    opts: CmdbEnhancementRoutesOptions
): Promise<void> {
    const svc = opts.cmdbEnhancementService

    // --- Discovery Rules ---
    fastify.post('/cmdb/discovery/rules', async (request, reply) => {
        requirePermission(request, 'cmdb:create')
        const body = z.object({
            name: z.string().min(1),
            discoveryType: z.enum(['network_scan', 'agent_based', 'cloud_api', 'manual_import']),
            scope: z.array(z.unknown()).optional().default([]),
            scheduleCron: z.string().optional(),
            mappingRules: z.array(z.unknown()).optional().default([]),
            isActive: z.boolean().optional().default(true)
        }).parse(request.body)
        const rule = await svc.createDiscoveryRule({
            name: body.name,
            ruleType: body.discoveryType,
            config: { scope: body.scope, mappingRules: body.mappingRules },
            schedule: body.scheduleCron ?? null,
            isActive: body.isActive
        })
        return reply.status(201).send({ data: rule })
    })

    fastify.get('/cmdb/discovery/rules', async (request, reply) => {
        requirePermission(request, 'cmdb:read')
        const rules = await svc.listDiscoveryRules()
        return reply.send({ data: rules })
    })

    fastify.get('/cmdb/discovery/rules/:id', async (request, reply) => {
        requirePermission(request, 'cmdb:read')
        const { id } = request.params as { id: string }
        const rule = await svc.getDiscoveryRule(id)
        if (!rule) return reply.status(404).send({ error: 'Not found' })
        return reply.send({ data: rule })
    })

    fastify.delete('/cmdb/discovery/rules/:id', async (request, reply) => {
        requirePermission(request, 'cmdb:delete')
        const { id } = request.params as { id: string }
        await svc.deleteDiscoveryRule(id)
        return reply.status(204).send()
    })

    fastify.get('/cmdb/discovery/rules/:id/results', async (request, reply) => {
        requirePermission(request, 'cmdb:read')
        const { id } = request.params as { id: string }
        const query = request.query as Record<string, string>
        const results = await svc.getDiscoveryResults(id, query.status)
        return reply.send({ data: results })
    })

    fastify.post('/cmdb/discovery/results/:id/review', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = request.params as { id: string }
        const body = z.object({ status: z.enum(['confirmed', 'rejected']) }).parse(request.body)
        const result = await svc.reviewDiscoveryResult(id, body.status, ctx.userId)
        return reply.send({ data: result })
    })

    // --- Smart Tags ---
    fastify.post('/cmdb/tags', async (request, reply) => {
        requirePermission(request, 'cmdb:create')
        const body = z.object({
            tagName: z.string().min(1).max(100),
            tagCategory: z.string().optional().default('auto'),
            color: z.string().optional().default('#3b82f6'),
            description: z.string().optional(),
            autoAssignRules: z.array(z.unknown()).optional().default([])
        }).parse(request.body)
        const tag = await svc.createTag({
            tagName: body.tagName,
            tagCategory: body.tagCategory,
            color: body.color ?? null,
            autoAssignRules: body.autoAssignRules as any
        })
        return reply.status(201).send({ data: tag })
    })

    fastify.get('/cmdb/tags', async (request, reply) => {
        getUserContext(request)
        const tags = await svc.listTags()
        return reply.send({ data: tags })
    })

    fastify.delete('/cmdb/tags/:id', async (request, reply) => {
        requirePermission(request, 'cmdb:delete')
        const { id } = request.params as { id: string }
        await svc.deleteTag(id)
        return reply.status(204).send()
    })

    fastify.post('/cmdb/cis/:ciId/tags/:tagId', async (request, reply) => {
        requirePermission(request, 'cmdb:update')
        const { ciId, tagId } = request.params as { ciId: string; tagId: string }
        await svc.assignTag(ciId, tagId)
        return reply.status(201).send({ data: { success: true } })
    })

    fastify.delete('/cmdb/cis/:ciId/tags/:tagId', async (request, reply) => {
        requirePermission(request, 'cmdb:update')
        const { ciId, tagId } = request.params as { ciId: string; tagId: string }
        await svc.removeTag(ciId, tagId)
        return reply.status(204).send()
    })

    fastify.get('/cmdb/cis/:ciId/tags', async (request, reply) => {
        getUserContext(request)
        const { ciId } = request.params as { ciId: string }
        const tags = await svc.getCiTags(ciId)
        return reply.send({ data: tags })
    })

    // --- Change Impact Assessment ---
    fastify.post('/cmdb/change-assessments', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = z.object({
            title: z.string().min(1),
            description: z.string().optional(),
            targetCiIds: z.array(z.string().uuid()),
            status: z.enum(['draft', 'analyzing', 'reviewed', 'approved', 'rejected', 'executed']).optional().default('draft')
        }).parse(request.body)
        const impact = await svc.analyzeImpact(body.targetCiIds)
        const assessment = await svc.createAssessment({
            ...body,
            impactAnalysis: impact,
            riskScore: impact.riskScore as number,
            createdBy: ctx.userId,
            reviewedBy: null
        })
        return reply.status(201).send({ data: assessment })
    })

    fastify.get('/cmdb/change-assessments', async (request, reply) => {
        requirePermission(request, 'cmdb:read')
        const query = request.query as Record<string, string>
        const assessments = await svc.listAssessments(query.status)
        return reply.send({ data: assessments })
    })

    fastify.get('/cmdb/change-assessments/:id', async (request, reply) => {
        requirePermission(request, 'cmdb:read')
        const { id } = request.params as { id: string }
        const assessment = await svc.getAssessment(id)
        if (!assessment) return reply.status(404).send({ error: 'Not found' })
        return reply.send({ data: assessment })
    })

    fastify.post('/cmdb/change-assessments/:id/status', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = request.params as { id: string }
        const body = z.object({
            status: z.enum(['reviewed', 'approved', 'rejected', 'executed'])
        }).parse(request.body)
        const assessment = await svc.updateAssessmentStatus(id, body.status, ctx.userId)
        return reply.send({ data: assessment })
    })
}
