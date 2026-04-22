import type { FastifyPluginAsync } from 'fastify'
import type { AssetIncreaseRepo, ApprovalRepo, PgClient } from '@qltb/infra-postgres'
import { WorkflowService } from '../services/WorkflowService.js'
import { AssetIncreasePostingService } from '../services/AssetIncreasePostingService.js'
import {
    CreateAssetIncreaseSchema,
    UpdateAssetIncreaseSchema,
    ListAssetIncreasesQuerySchema,
    SubmitAssetIncreaseSchema
} from '../schemas/assetIncrease.js'
import { ApproveRejectSchema } from '../schemas/purchasePlan.js'
import { requireAuthenticatedUserId } from './auth-context.js'

export const assetIncreaseRoutes: FastifyPluginAsync = async (fastify) => {
    if (!fastify.diContainer) {
        throw new Error('DI Container not available')
    }
    const assetIncreaseRepo = fastify.diContainer.resolve<AssetIncreaseRepo>('assetIncreaseRepo')
    const approvalRepo = fastify.diContainer.resolve<ApprovalRepo>('approvalRepo')
    const pgClient = fastify.diContainer.resolve<PgClient>('pgClient')

    const workflowService = new WorkflowService(pgClient, approvalRepo)
    const postingService = new AssetIncreasePostingService(pgClient)

    // POST /api/v1/assets/asset-increases
    fastify.post('/', async (request, reply) => {
        const userId = requireAuthenticatedUserId(request)
        const validated = CreateAssetIncreaseSchema.parse(request.body)
        const doc = await assetIncreaseRepo.create(validated, userId)
        return { data: doc }
    })

    // GET /api/v1/assets/asset-increases
    fastify.get('/', async (request, reply) => {
        const query = ListAssetIncreasesQuerySchema.parse(request.query)
        const result = await assetIncreaseRepo.list(query)
        return {
            data: result.items,
            pagination: {
                page: query.page,
                limit: query.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / query.limit)
            }
        }
    })

    // GET /api/v1/assets/asset-increases/:id
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const doc = await assetIncreaseRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Asset increase document not found' })
        }
        return { data: doc }
    })

    // PUT /api/v1/assets/asset-increases/:id
    fastify.put('/:id', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string', format: 'uuid' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const existing = await assetIncreaseRepo.getById(id)
        if (!existing) {
            return reply.code(404).send({ error: 'Asset increase document not found' })
        }
        if (existing.status !== 'draft') {
            return reply.code(400).send({ error: 'Can only edit draft documents' })
        }
        const validated = UpdateAssetIncreaseSchema.parse(request.body)
        const doc = await assetIncreaseRepo.update(id, validated)
        return { data: doc }
    })

    // POST /api/v1/assets/asset-increases/:id/submit
    fastify.post('/:id/submit', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvers } = SubmitAssetIncreaseSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        const doc = await assetIncreaseRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Asset increase document not found' })
        }

        const transition = await workflowService.canTransition('asset_increase', id, doc.status, 'submitted', userId)
        if (!transition.allowed) {
            return reply.code(400).send({ error: transition.reason })
        }

        await assetIncreaseRepo.updateStatus(id, 'submitted', userId)
        const approvalRecords = await workflowService.submitForApproval('asset_increase', id, approvers)

        return { data: { status: 'submitted', approvals: approvalRecords } }
    })

    // POST /api/v1/assets/asset-increases/:id/approve
    fastify.post('/:id/approve', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvalId, note } = ApproveRejectSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        if (!approvalId) {
            return reply.code(400).send({ error: 'Approval ID is required' })
        }

        await workflowService.approve(approvalId, userId, note)

        const approvals = await workflowService.getApprovalHistory('asset_increase', id)
        const allApproved = approvals.every(a => a.decision === 'approved')

        if (allApproved) {
            await assetIncreaseRepo.updateStatus(id, 'approved', userId)
        }

        return { data: { approved: true, allApproved } }
    })

    // POST /api/v1/assets/asset-increases/:id/reject
    fastify.post('/:id/reject', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvalId, note } = ApproveRejectSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        if (!approvalId) {
            return reply.code(400).send({ error: 'Approval ID is required' })
        }

        if (!note) {
            return reply.code(400).send({ error: 'Rejection reason required' })
        }

        await workflowService.reject(approvalId, userId, note)
        await assetIncreaseRepo.updateStatus(id, 'rejected', userId)

        return { data: { rejected: true } }
    })

    // POST /api/v1/assets/asset-increases/:id/post
    fastify.post('/:id/post', async (request, reply) => {
        const { id } = request.params as { id: string }
        const userId = requireAuthenticatedUserId(request)

        const doc = await assetIncreaseRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Asset increase document not found' })
        }

        const transition = await workflowService.canTransition('asset_increase', id, doc.status, 'posted', userId)
        if (!transition.allowed) {
            return reply.code(400).send({ error: transition.reason })
        }

        const assetsCreated = await postingService.postDocument(doc, userId)
        return { data: { posted: true, assetsCreated } }
    })

    // DELETE /api/v1/assets/asset-increases/:id/cancel
    fastify.delete('/:id/cancel', async (request, reply) => {
        const { id } = request.params as { id: string }
        const userId = requireAuthenticatedUserId(request)

        const doc = await assetIncreaseRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Asset increase document not found' })
        }

        if (!['draft', 'submitted'].includes(doc.status)) {
            return reply.code(400).send({ error: 'Can only cancel draft or submitted documents' })
        }

        await assetIncreaseRepo.updateStatus(id, 'cancelled', userId)
        return { data: { cancelled: true } }
    })
}
