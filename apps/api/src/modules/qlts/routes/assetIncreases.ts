import type { FastifyPluginAsync } from 'fastify'
import type { AssetIncreaseRepo, ApprovalRepo, PgClient } from '@qltb/infra-postgres'
import { WorkflowService } from '../services/WorkflowService.js'
import {
    CreateAssetIncreaseSchema,
    UpdateAssetIncreaseSchema,
    ListAssetIncreasesQuerySchema,
    SubmitAssetIncreaseSchema
} from '../schemas/assetIncrease.js'
import { ApproveRejectSchema } from '../schemas/purchasePlan.js'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'

function requireAuthenticatedUserId(request: { user?: { id?: string } }): string {
    const userId = request.user?.id?.trim()
    if (!userId) {
        throw new UnauthorizedError('Missing authenticated user context')
    }
    return userId
}

export const assetIncreaseRoutes: FastifyPluginAsync = async (fastify) => {
    if (!fastify.diContainer) {
        throw new Error('DI Container not available')
    }
    const assetIncreaseRepo = fastify.diContainer.resolve<AssetIncreaseRepo>('assetIncreaseRepo')
    const approvalRepo = fastify.diContainer.resolve<ApprovalRepo>('approvalRepo')
    const pgClient = fastify.diContainer.resolve<PgClient>('pgClient')

    const workflowService = new WorkflowService(pgClient, approvalRepo)

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

        const lines = doc.lines ?? []

        await pgClient.transaction(async (client: any) => {
            for (const line of lines) {
                // Column names must match the actual assets table schema:
                //   asset_code (not code), model_id, serial_no (not serial_number),
                //   location_id, status, purchase_date (not acquisition_date),
                //   warranty_end (not warranty_end_date), vendor_id,
                //   source_doc_type/source_doc_id/source_doc_no (added by migration 026)
                const assetResult = await client.query(
                    `INSERT INTO assets (
                        asset_code, model_id, serial_no,
                        location_id, status,
                        purchase_date, warranty_end,
                        notes,
                        source_doc_type, source_doc_id, source_doc_no
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id`,
                    [
                        line.assetCode || `AST-${Date.now()}-${line.lineNo}`,
                        line.modelId,
                        line.serialNumber ?? null,
                        line.locationId ?? null,
                        'in_stock',
                        line.acquisitionDate || doc.docDate || null,
                        line.warrantyEndDate ?? null,
                        line.assetName ? `Tăng TS: ${line.assetName}` : null,
                        'asset_increase',
                        doc.id,
                        doc.docNo
                    ]
                )

                await client.query(
                    `UPDATE asset_increase_lines SET asset_id = $1 WHERE id = $2`,
                    [assetResult.rows[0].id, line.id]
                )

                if (line.modelId) {
                    await client.query(
                        `UPDATE asset_models 
                         SET current_stock_qty = COALESCE(current_stock_qty, 0) + $1
                         WHERE id = $2`,
                        [line.quantity, line.modelId]
                    )
                }
            }

            await client.query(
                `UPDATE asset_increase_docs 
                 SET status = $1, posted_by = $2, posted_at = NOW(), updated_at = NOW()
                 WHERE id = $3`,
                ['posted', userId, id]
            )
        })

        return { data: { posted: true, assetsCreated: lines.length } }
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
