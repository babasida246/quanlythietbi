import type { FastifyPluginAsync } from 'fastify'
import type { PurchasePlanRepo, ApprovalRepo, PgClient } from '@qltb/infra-postgres'
import type {
    PurchasePlanCreateInput,
    PurchasePlanLineInput,
    PurchasePlanUpdateInput,
    PurchasePriority,
    SuggestionReason
} from '@qltb/contracts'
import { SuggestionReasonValues } from '@qltb/contracts'
import { WorkflowService } from '../services/WorkflowService.js'
import { PurchaseSuggestionService } from '../services/PurchaseSuggestionService.js'
import {
    CreatePurchasePlanSchema,
    UpdatePurchasePlanSchema,
    ListPurchasePlansQuerySchema,
    SubmitPurchasePlanSchema,
    ApproveRejectSchema
} from '../schemas/purchasePlan.js'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'

function requireAuthenticatedUserId(request: { user?: { id?: string } }): string {
    const userId = request.user?.id?.trim()
    if (!userId) {
        throw new UnauthorizedError('Missing authenticated user context')
    }
    return userId
}

export const purchasePlanRoutes: FastifyPluginAsync = async (fastify) => {
    if (!fastify.diContainer) {
        throw new Error('DI Container not available')
    }
    const purchasePlanRepo = fastify.diContainer.resolve<PurchasePlanRepo>('purchasePlanRepo')
    const approvalRepo = fastify.diContainer.resolve<ApprovalRepo>('approvalRepo')
    const pgClient = fastify.diContainer.resolve<PgClient>('pgClient')

    const workflowService = new WorkflowService(pgClient, approvalRepo)
    const suggestionService = new PurchaseSuggestionService(pgClient)

    const mapPriority = (value?: 'critical' | 'high' | 'medium' | 'low'): PurchasePriority => {
        if (value === 'critical') return 'high'
        return value ?? 'medium'
    }

    const mapSuggestionReason = (value?: string | null): SuggestionReason | null => {
        if (!value) return null
        if (SuggestionReasonValues.includes(value as SuggestionReason)) {
            return value as SuggestionReason
        }
        return null
    }

    const mapLines = (lines: Array<{
        lineNo: number
        modelId?: string | null
        modelName: string
        categoryId?: string | null
        quantity: number
        unit?: string
        estimatedCost: number
        suggestionReason?: string | null
        currentStock?: number
        minStock?: number
        daysUntilStockout?: number
        priority?: 'critical' | 'high' | 'medium' | 'low'
        note?: string
    }>): PurchasePlanLineInput[] => {
        return lines.map((line) => ({
            lineNo: line.lineNo,
            modelId: line.modelId ?? null,
            categoryId: line.categoryId ?? null,
            itemDescription: line.modelName,
            quantity: line.quantity,
            unit: line.unit ?? null,
            estimatedUnitCost: line.estimatedCost,
            suggestionReason: mapSuggestionReason(line.suggestionReason),
            currentStock: line.currentStock ?? null,
            minStock: line.minStock ?? null,
            daysUntilStockout: line.daysUntilStockout ?? null,
            priority: mapPriority(line.priority),
            note: line.note ?? null
        }))
    }

    // GET /api/v1/assets/purchase-plans/suggestions
    fastify.get('/suggestions', async (request, reply) => {
        const { categoryId, minPriority } = request.query as { categoryId?: string; minPriority?: 'low' | 'medium' | 'high' | 'critical' }
        const suggestions = await suggestionService.calculateSuggestions({ categoryId, minPriority })
        return { suggestions }
    })

    // POST /api/v1/assets/purchase-plans
    fastify.post('/', async (request, reply) => {
        const userId = requireAuthenticatedUserId(request)
        const validated = CreatePurchasePlanSchema.parse(request.body)
        const input: PurchasePlanCreateInput = {
            docDate: validated.docDate,
            fiscalYear: validated.fiscalYear,
            orgUnitId: validated.orgUnitId ?? null,
            orgUnitName: validated.orgUnitName ?? null,
            title: validated.purpose ?? 'Purchase Plan',
            description: validated.note ?? validated.purpose ?? null,
            currency: 'VND',
            lines: mapLines(validated.lines)
        }
        const doc = await purchasePlanRepo.create(input, userId)
        return { data: doc }
    })

    // GET /api/v1/assets/purchase-plans
    fastify.get('/', async (request, reply) => {
        const query = ListPurchasePlansQuerySchema.parse(request.query)
        const result = await purchasePlanRepo.list(query)
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

    // GET /api/v1/assets/purchase-plans/:id
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const doc = await purchasePlanRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Purchase plan not found' })
        }
        return { data: doc }
    })

    // PUT /api/v1/assets/purchase-plans/:id
    fastify.put('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const existing = await purchasePlanRepo.getById(id)
        if (!existing) {
            return reply.code(404).send({ error: 'Purchase plan not found' })
        }
        if (existing.status !== 'draft') {
            return reply.code(400).send({ error: 'Can only edit draft documents' })
        }
        const validated = UpdatePurchasePlanSchema.parse(request.body)
        const input: PurchasePlanUpdateInput = {
            docDate: validated.docDate,
            orgUnitId: validated.orgUnitId ?? null,
            orgUnitName: validated.orgUnitName ?? null,
            title: validated.purpose ?? undefined,
            description: validated.note ?? validated.purpose ?? undefined,
            lines: validated.lines ? mapLines(validated.lines) : undefined
        }
        const doc = await purchasePlanRepo.update(id, input)
        return { data: doc }
    })

    // POST /api/v1/assets/purchase-plans/:id/submit
    fastify.post('/:id/submit', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvers } = SubmitPurchasePlanSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        const doc = await purchasePlanRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Purchase plan not found' })
        }

        const transition = await workflowService.canTransition('purchase_plan', id, doc.status, 'submitted', userId)
        if (!transition.allowed) {
            return reply.code(400).send({ error: transition.reason })
        }

        await purchasePlanRepo.updateStatus(id, 'submitted', userId)
        const approvalRecords = await workflowService.submitForApproval('purchase_plan', id, approvers)

        return { data: { status: 'submitted', approvals: approvalRecords } }
    })

    // POST /api/v1/assets/purchase-plans/:id/approve
    fastify.post('/:id/approve', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvalId, note } = ApproveRejectSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        await workflowService.approve(approvalId, userId, note)

        const approvals = await workflowService.getApprovalHistory('purchase_plan', id)
        const allApproved = approvals.every(a => a.decision === 'approved')

        if (allApproved) {
            await purchasePlanRepo.updateStatus(id, 'approved', userId)
        }

        return { data: { approved: true, allApproved } }
    })

    // POST /api/v1/assets/purchase-plans/:id/reject
    fastify.post('/:id/reject', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { approvalId, note } = ApproveRejectSchema.parse(request.body)
        const userId = requireAuthenticatedUserId(request)

        if (!note) {
            return reply.code(400).send({ error: 'Rejection reason required' })
        }

        await workflowService.reject(approvalId, userId, note)
        await purchasePlanRepo.updateStatus(id, 'rejected', userId)

        return { data: { rejected: true } }
    })

    // POST /api/v1/assets/purchase-plans/:id/post
    fastify.post('/:id/post', async (request, reply) => {
        const { id } = request.params as { id: string }
        const userId = requireAuthenticatedUserId(request)

        const doc = await purchasePlanRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Purchase plan not found' })
        }

        const transition = await workflowService.canTransition('purchase_plan', id, doc.status, 'posted', userId)
        if (!transition.allowed) {
            return reply.code(400).send({ error: transition.reason })
        }

        await purchasePlanRepo.updateStatus(id, 'posted', userId)
        return { data: { posted: true } }
    })

    // DELETE /api/v1/assets/purchase-plans/:id/cancel
    fastify.delete('/:id/cancel', async (request, reply) => {
        const { id } = request.params as { id: string }
        const userId = requireAuthenticatedUserId(request)

        const doc = await purchasePlanRepo.getById(id)
        if (!doc) {
            return reply.code(404).send({ error: 'Purchase plan not found' })
        }

        if (!['draft', 'submitted'].includes(doc.status)) {
            return reply.code(400).send({ error: 'Can only cancel draft or submitted documents' })
        }

        await purchasePlanRepo.updateStatus(id, 'cancelled', userId)
        return { data: { cancelled: true } }
    })
}
