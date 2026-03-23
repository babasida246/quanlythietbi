import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import type { ICmdbConfigFileRepo } from '@qltb/contracts'
import type {
    CiService,
    ChangeManagementService,
    RelationshipService,
    SchemaService,
    ServiceMappingService,
    CiInventoryReportService,
    RelationshipAnalyticsService,
    AuditTrailService
} from '@qltb/application'
import {
    exportCiInventoryReportToCSV,
    exportRelationshipAnalyticsToCSV,
    exportAuditTrailToCSV,
    exportCiInventoryReportToPDF,
    exportRelationshipAnalyticsToPDF,
    exportAuditTrailToPDF
} from '@qltb/application'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import { AppError } from '@qltb/domain'
import {
    cmdbAttrDefCreateSchema,
    cmdbAttrDefIdParamsSchema,
    cmdbAttrDefUpdateSchema,
    cmdbCiCreateSchema,
    cmdbChangeCreateSchema,
    cmdbChangeIdParamsSchema,
    cmdbChangeListQuerySchema,
    cmdbChangeUpdateSchema,
    cmdbCiIdParamsSchema,
    cmdbCiListQuerySchema,
    cmdbCiUpdateSchema,
    cmdbGraphQuerySchema,
    cmdbRelationshipCreateSchema,
    cmdbRelationshipImportSchema,
    cmdbRelationshipIdParamsSchema,
    cmdbRelationshipTypeCreateSchema,
    cmdbRelationshipTypeIdParamsSchema,
    cmdbRelationshipTypeUpdateSchema,
    cmdbServiceCreateSchema,
    cmdbServiceIdParamsSchema,
    cmdbServiceListQuerySchema,
    cmdbServiceMemberCreateSchema,
    cmdbServiceMemberIdParamsSchema,
    cmdbServiceUpdateSchema,
    cmdbTypeCreateSchema,
    cmdbTypeIdParamsSchema,
    cmdbTypeUpdateSchema,
    cmdbVersionIdParamsSchema,
    cmdbConfigFileCreateSchema,
    cmdbConfigFileUpdateSchema
} from './cmdb.schemas.js'

interface CmdbRoutesOptions {
    schemaService: SchemaService
    ciService: CiService
    relationshipService: RelationshipService
    changeManagementService: ChangeManagementService
    serviceMappingService: ServiceMappingService
    ciInventoryReportService: CiInventoryReportService
    relationshipAnalyticsService: RelationshipAnalyticsService
    auditTrailService: AuditTrailService
    configFileRepo: ICmdbConfigFileRepo
    pgClient: PgClient
}

type CmdbTypeRow = {
    id: string
    code: string
    name: string
    description: string | null
    created_at: Date
}

export async function cmdbRoutes(
    fastify: FastifyInstance,
    opts: CmdbRoutesOptions
): Promise<void> {
    const { schemaService, ciService, relationshipService, changeManagementService, serviceMappingService, ciInventoryReportService, relationshipAnalyticsService, auditTrailService, configFileRepo, pgClient } = opts

    fastify.get('/cmdb/types', async (request, reply) => {
        getUserContext(request)
        const types = await schemaService.listTypes()
        return reply.send({ data: types })
    })

    fastify.post('/cmdb/types', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const body = cmdbTypeCreateSchema.parse(request.body)
        const created = await schemaService.createType(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/cmdb/types/:id', async (request, reply) => {
        requirePermission(request, 'categories:manage')
        const { id } = cmdbTypeIdParamsSchema.parse(request.params)
        const body = cmdbTypeUpdateSchema.parse(request.body)

        const fields: string[] = []
        const params: Array<string | null> = []

        if (body.code !== undefined) {
            params.push(body.code)
            fields.push(`code = $${params.length}`)
        }
        if (body.name !== undefined) {
            params.push(body.name)
            fields.push(`name = $${params.length}`)
        }
        if (body.description !== undefined) {
            params.push(body.description ?? null)
            fields.push(`description = $${params.length}`)
        }

        if (fields.length === 0) {
            const current = await pgClient.query<CmdbTypeRow>(
                `SELECT id, code, name, description, created_at
                 FROM cmdb_ci_types
                 WHERE id = $1`,
                [id]
            )
            if (current.rowCount === 0) throw AppError.notFound('CMDB type not found')
            const row = current.rows[0]
            return reply.send({
                data: {
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    description: row.description,
                    createdAt: row.created_at
                }
            })
        }

        params.push(id)
        const result = await pgClient.query<CmdbTypeRow>(
            `UPDATE cmdb_ci_types
             SET ${fields.join(', ')}
             WHERE id = $${params.length}
             RETURNING id, code, name, description, created_at`,
            params
        )

        if (result.rowCount === 0) {
            throw AppError.notFound('CMDB type not found')
        }

        const row = result.rows[0]
        return reply.send({
            data: {
                id: row.id,
                code: row.code,
                name: row.name,
                description: row.description,
                createdAt: row.created_at
            }
        })
    })

    fastify.delete('/cmdb/types/:id', async (request, reply) => {
        requirePermission(request, 'categories:manage')
        const { id } = cmdbTypeIdParamsSchema.parse(request.params)
        const result = await pgClient.query(
            `DELETE FROM cmdb_ci_types
             WHERE id = $1`,
            [id]
        )
        if ((result.rowCount ?? 0) === 0) {
            throw AppError.notFound('CMDB type not found')
        }
        return reply.send({ data: { id } })
    })

    fastify.get('/cmdb/types/:id/versions', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbTypeIdParamsSchema.parse(request.params)
        const versions = await schemaService.listTypeVersions(id)
        return reply.send({ data: versions })
    })

    fastify.post('/cmdb/types/:id/versions', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const { id } = cmdbTypeIdParamsSchema.parse(request.params)
        const result = await schemaService.createDraftVersion(id, ctx)
        return reply.status(201).send({ data: result })
    })

    fastify.post('/cmdb/versions/:versionId/publish', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const { versionId } = cmdbVersionIdParamsSchema.parse(request.params)
        const result = await schemaService.publishVersion(versionId, ctx)
        return reply.send({ data: result })
    })

    fastify.get('/cmdb/versions/:versionId/attr-defs', async (request, reply) => {
        getUserContext(request)
        const { versionId } = cmdbVersionIdParamsSchema.parse(request.params)
        const defs = await schemaService.listDefsByVersion(versionId)
        return reply.send({ data: defs })
    })

    fastify.post('/cmdb/versions/:versionId/attr-defs', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const { versionId } = cmdbVersionIdParamsSchema.parse(request.params)
        const body = cmdbAttrDefCreateSchema.parse(request.body)
        const created = await schemaService.addAttrDef(versionId, body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/cmdb/attr-defs/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const { id } = cmdbAttrDefIdParamsSchema.parse(request.params)
        const body = cmdbAttrDefUpdateSchema.parse(request.body)
        const updated = await schemaService.updateAttrDef(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/cmdb/attr-defs/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'categories:manage')
        const { id } = cmdbAttrDefIdParamsSchema.parse(request.params)
        await schemaService.deleteAttrDef(id, ctx)
        return reply.send({ data: { id } })
    })

    fastify.get('/cmdb/cis', async (request, reply) => {
        getUserContext(request)
        const query = cmdbCiListQuerySchema.parse(request.query)
        const result = await ciService.listCis(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    fastify.post('/cmdb/cis', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbCiCreateSchema.parse(request.body)
        const { attributes, ...payload } = body
        const created = await ciService.createCi(payload, attributes, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.get('/cmdb/cis/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const detail = await ciService.getCiDetail(id)
        return reply.send({ data: detail })
    })

    fastify.put('/cmdb/cis/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const body = cmdbCiUpdateSchema.parse(request.body)
        const { attributes, ...patch } = body
        const updated = await ciService.updateCi(id, patch, attributes, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/cmdb/cis/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:delete')
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const retired = await ciService.retireCi(id, ctx)
        return reply.send({ data: retired })
    })

    fastify.get('/cmdb/cis/:id/graph', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const query = cmdbGraphQuerySchema.parse(request.query)
        const graph = await relationshipService.getGraph(id, query.depth ?? 1, query.direction ?? 'both')
        return reply.send({ data: graph })
    })

    // Get full CMDB topology graph
    fastify.get('/cmdb/graph', async (request, reply) => {
        getUserContext(request)
        const query = cmdbGraphQuerySchema.parse(request.query)
        const graph = await relationshipService.getFullGraph(query.depth ?? 2, query.direction ?? 'both')
        return reply.send({ data: graph })
    })

    // Get dependency path for a CI (upstream or downstream)
    fastify.get('/cmdb/cis/:id/dependency-path', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const direction = (request.query as any).direction ?? 'downstream'
        const path = await relationshipService.getDependencyPath(id, direction)
        return reply.send({ data: path })
    })

    // Get impact analysis - what breaks if this CI fails
    fastify.get('/cmdb/cis/:id/impact', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const impact = await relationshipService.getImpactAnalysis(id)
        return reply.send({ data: impact })
    })

    fastify.get('/cmdb/relationship-types', async (request, reply) => {
        getUserContext(request)
        const types = await relationshipService.listRelationshipTypes()
        return reply.send({ data: types })
    })

    fastify.post('/cmdb/relationship-types', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbRelationshipTypeCreateSchema.parse(request.body)
        const created = await relationshipService.createRelationshipType(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/cmdb/relationship-types/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbRelationshipTypeIdParamsSchema.parse(request.params)
        const body = cmdbRelationshipTypeUpdateSchema.parse(request.body)
        const updated = await relationshipService.updateRelationshipType(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/cmdb/relationship-types/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:delete')
        const { id } = cmdbRelationshipTypeIdParamsSchema.parse(request.params)
        await relationshipService.deleteRelationshipType(id, ctx)
        return reply.status(204).send()
    })

    fastify.get('/cmdb/cis/:id/relationships', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const relationships = await relationshipService.listRelationshipsByCi(id)
        return reply.send({ data: relationships })
    })

    fastify.post('/cmdb/cis/:id/relationships', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const { id } = cmdbCiIdParamsSchema.parse(request.params)
        const body = cmdbRelationshipCreateSchema.parse(request.body)
        const created = await relationshipService.createRelationship({ ...body, fromCiId: id }, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.post('/cmdb/relationships', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbRelationshipCreateSchema.parse(request.body)
        const created = await relationshipService.createRelationship(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.post('/cmdb/relationships/import', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbRelationshipImportSchema.parse(request.body)
        const result = await relationshipService.importRelationships(body, ctx)
        return reply.status(result.errors.length > 0 ? 400 : (result.dryRun ? 200 : 201)).send({ data: result })
    })

    fastify.delete('/cmdb/relationships/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:delete')
        const { id } = cmdbRelationshipIdParamsSchema.parse(request.params)
        const updated = await relationshipService.retireRelationship(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.get('/cmdb/changes', async (request, reply) => {
        getUserContext(request)
        const query = cmdbChangeListQuerySchema.parse(request.query)
        const result = await changeManagementService.listChanges(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    fastify.post('/cmdb/changes', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbChangeCreateSchema.parse(request.body)
        const created = await changeManagementService.createChange({
            title: body.title,
            description: body.description ?? null,
            risk: body.risk,
            primaryCiId: body.primaryCiId ?? null,
            implementationPlan: body.implementationPlan ?? null,
            rollbackPlan: body.rollbackPlan ?? null,
            plannedStartAt: body.plannedStartAt ? new Date(body.plannedStartAt).toISOString() : null,
            plannedEndAt: body.plannedEndAt ? new Date(body.plannedEndAt).toISOString() : null,
            metadata: body.metadata ?? null
        }, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.get('/cmdb/changes/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const change = await changeManagementService.getChange(id)
        return reply.send({ data: change })
    })

    fastify.put('/cmdb/changes/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const body = cmdbChangeUpdateSchema.parse(request.body)
        const updated = await changeManagementService.updateChange(id, {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.description !== undefined ? { description: body.description ?? null } : {}),
            ...(body.risk !== undefined ? { risk: body.risk } : {}),
            ...(body.primaryCiId !== undefined ? { primaryCiId: body.primaryCiId ?? null } : {}),
            ...(body.implementationPlan !== undefined ? { implementationPlan: body.implementationPlan ?? null } : {}),
            ...(body.rollbackPlan !== undefined ? { rollbackPlan: body.rollbackPlan ?? null } : {}),
            ...(body.plannedStartAt !== undefined ? { plannedStartAt: body.plannedStartAt ? new Date(body.plannedStartAt).toISOString() : null } : {}),
            ...(body.plannedEndAt !== undefined ? { plannedEndAt: body.plannedEndAt ? new Date(body.plannedEndAt).toISOString() : null } : {}),
            ...(body.metadata !== undefined ? { metadata: body.metadata ?? null } : {})
        }, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/cmdb/changes/:id/submit', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const updated = await changeManagementService.submitChange(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/cmdb/changes/:id/approve', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const updated = await changeManagementService.approveChange(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/cmdb/changes/:id/implement', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const updated = await changeManagementService.implementChange(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/cmdb/changes/:id/close', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const updated = await changeManagementService.closeChange(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/cmdb/changes/:id/cancel', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbChangeIdParamsSchema.parse(request.params)
        const updated = await changeManagementService.cancelChange(id, ctx)
        return reply.send({ data: updated })
    })

    fastify.get('/cmdb/services', async (request, reply) => {
        getUserContext(request)
        const query = cmdbServiceListQuerySchema.parse(request.query)
        const result = await serviceMappingService.listServices(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    fastify.post('/cmdb/services', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const body = cmdbServiceCreateSchema.parse(request.body)
        const created = await serviceMappingService.createService(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.get('/cmdb/services/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbServiceIdParamsSchema.parse(request.params)
        const detail = await serviceMappingService.getServiceDetail(id)
        return reply.send({ data: detail })
    })

    fastify.put('/cmdb/services/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:update')
        const { id } = cmdbServiceIdParamsSchema.parse(request.params)
        const body = cmdbServiceUpdateSchema.parse(request.body)
        const updated = await serviceMappingService.updateService(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/cmdb/services/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:delete')
        const { id } = cmdbServiceIdParamsSchema.parse(request.params)
        const retired = await serviceMappingService.retireService(id, ctx)
        return reply.send({ data: retired })
    })

    fastify.post('/cmdb/services/:id/members', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:create')
        const { id } = cmdbServiceIdParamsSchema.parse(request.params)
        const body = cmdbServiceMemberCreateSchema.parse(request.body)
        const created = await serviceMappingService.addMember(id, body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.delete('/cmdb/services/:id/members/:memberId', async (request, reply) => {
        const ctx = requirePermission(request, 'cmdb:delete')
        const { id, memberId } = cmdbServiceMemberIdParamsSchema.parse(request.params)
        await serviceMappingService.removeMember(id, memberId, ctx)
        return reply.send({ data: { memberId } })
    })

    fastify.get('/cmdb/services/:id/impact', async (request, reply) => {
        getUserContext(request)
        const { id } = cmdbServiceIdParamsSchema.parse(request.params)
        const query = cmdbGraphQuerySchema.parse(request.query)
        const graph = await serviceMappingService.serviceImpact(id, query.depth ?? 1, query.direction ?? 'downstream')
        return reply.send({ data: graph })
    })

    // Reports endpoints
    fastify.get('/cmdb/reports/ci-inventory', async (request, reply) => {
        getUserContext(request)
        try {
            const report = await ciInventoryReportService.generateCiInventoryReport()
            return reply.send({ data: report })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return reply.status(500).send({ error: message })
        }
    })

    fastify.get('/cmdb/reports/relationship-analytics', async (request, reply) => {
        getUserContext(request)
        try {
            const report = await relationshipAnalyticsService.generateAnalyticsReport()
            return reply.send({ data: report })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return reply.status(500).send({ error: message })
        }
    })

    fastify.get('/cmdb/reports/audit-trail', async (request, reply) => {
        getUserContext(request)
        try {
            const query = (request.query as any) || {}
            const ciId = query.ciId as string | undefined
            const startDate = query.startDate ? new Date(query.startDate) : undefined
            const endDate = query.endDate ? new Date(query.endDate) : undefined

            const report = await auditTrailService.generateAuditTrailReport(ciId, startDate, endDate)
            return reply.send({ data: report })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return reply.status(500).send({ error: message })
        }
    })

    fastify.get('/cmdb/reports/export/:reportType', async (request, reply) => {
        getUserContext(request)
        try {
            const { reportType } = request.params as { reportType: string }
            const format = (request.query as any)?.format ?? 'json' // json, csv, pdf

            // Supported report types
            const supportedReports = ['ci-inventory', 'relationship-analytics', 'audit-trail']
            if (!supportedReports.includes(reportType)) {
                return reply.status(400).send({ error: 'Unsupported report type' })
            }

            // Generate report based on type
            let reportData: any
            switch (reportType) {
                case 'ci-inventory':
                    reportData = await ciInventoryReportService.generateCiInventoryReport()
                    break
                case 'relationship-analytics':
                    reportData = await relationshipAnalyticsService.generateAnalyticsReport()
                    break
                case 'audit-trail':
                    reportData = await auditTrailService.generateAuditTrailReport()
                    break
            }

            // Export based on format
            switch (format) {
                case 'json':
                    return reply.type('application/json').send(reportData)
                case 'csv': {
                    let csvContent: string
                    switch (reportType) {
                        case 'ci-inventory':
                            csvContent = exportCiInventoryReportToCSV(reportData)
                            break
                        case 'relationship-analytics':
                            csvContent = exportRelationshipAnalyticsToCSV(reportData)
                            break
                        case 'audit-trail':
                            csvContent = exportAuditTrailToCSV(reportData)
                            break
                        default:
                            csvContent = ''
                    }
                    return reply
                        .type('text/csv')
                        .header('Content-Disposition', `attachment; filename="report-${reportType}-${Date.now()}.csv"`)
                        .send(csvContent)
                }
                case 'pdf': {
                    let pdfContent: Buffer
                    switch (reportType) {
                        case 'ci-inventory':
                            pdfContent = await exportCiInventoryReportToPDF(reportData)
                            break
                        case 'relationship-analytics':
                            pdfContent = await exportRelationshipAnalyticsToPDF(reportData)
                            break
                        case 'audit-trail':
                            pdfContent = await exportAuditTrailToPDF(reportData)
                            break
                        default:
                            pdfContent = Buffer.from('')
                    }
                    return reply
                        .type('application/pdf')
                        .header('Content-Disposition', `attachment; filename="report-${reportType}-${Date.now()}.pdf"`)
                        .send(pdfContent)
                }
                default:
                    return reply.status(400).send({ error: 'Invalid export format' })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return reply.status(500).send({ error: message })
        }
    })

    // ── Config Files ──────────────────────────────────────────────────────────

    // GET /cmdb/config-files — Danh sách file cấu hình (có thể lọc theo ciId)
    fastify.get('/cmdb/config-files', async (request, reply) => {
        const q = request.query as any
        const result = await configFileRepo.list({
            ciId:     q.ciId,
            fileType: q.fileType,
            q:        q.q,
            page:     q.page     ? parseInt(q.page)  : undefined,
            limit:    q.limit    ? parseInt(q.limit)  : undefined
        })
        return reply.send({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    // POST /cmdb/config-files — Tạo file cấu hình mới
    fastify.post('/cmdb/config-files', async (request, reply) => {
        const parsed = cmdbConfigFileCreateSchema.parse(request.body)
        const ctx = getUserContext(request)
        const file = await configFileRepo.create({ ...parsed, createdBy: ctx.userId })
        return reply.status(201).send({ success: true, data: file })
    })

    // GET /cmdb/config-files/:id — Chi tiết file cấu hình
    fastify.get('/cmdb/config-files/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const file = await configFileRepo.getById(id)
        if (!file) throw new AppError('NOT_FOUND', 'Config file not found', 404)
        return reply.send({ success: true, data: file })
    })

    // PUT /cmdb/config-files/:id — Cập nhật file cấu hình (tự động tạo phiên bản mới nếu content thay đổi)
    fastify.put('/cmdb/config-files/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const parsed = cmdbConfigFileUpdateSchema.parse(request.body)
        const ctx = getUserContext(request)
        const file = await configFileRepo.update(id, { ...parsed, updatedBy: ctx.userId })
        if (!file) throw new AppError('NOT_FOUND', 'Config file not found', 404)
        return reply.send({ success: true, data: file })
    })

    // DELETE /cmdb/config-files/:id — Xoá mềm file cấu hình
    fastify.delete('/cmdb/config-files/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const ok = await configFileRepo.softDelete(id)
        if (!ok) throw new AppError('NOT_FOUND', 'Config file not found', 404)
        return reply.send({ success: true })
    })

    // GET /cmdb/config-files/:id/versions — Lịch sử phiên bản
    fastify.get('/cmdb/config-files/:id/versions', async (request, reply) => {
        const { id } = request.params as { id: string }
        const versions = await configFileRepo.listVersions(id)
        return reply.send({ success: true, data: versions })
    })

    // GET /cmdb/config-files/:id/versions/:version — Nội dung tại phiên bản cụ thể
    fastify.get('/cmdb/config-files/:id/versions/:version', async (request, reply) => {
        const { id, version } = request.params as { id: string; version: string }
        const v = await configFileRepo.getVersion(id, parseInt(version))
        if (!v) throw new AppError('NOT_FOUND', 'Version not found', 404)
        return reply.send({ success: true, data: v })
    })
}
