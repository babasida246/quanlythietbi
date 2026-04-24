import { AppError } from '@qltb/domain'
import type {
    AssetAssignmentInput,
    IAssetEventRepo,
    IWorkflowRepo,
    MaintenanceTicketInput,
    StockDocumentLineInput,
    WorkflowRequestRecord
} from '@qltb/contracts'
import { AssetService } from './AssetService.js'
import { MaintenanceService } from './MaintenanceService.js'
import { StockDocumentService } from '../maintenanceWarehouse/StockDocumentService.js'

export interface WorkflowServiceContext {
    userId: string
    correlationId: string
}

type WorkflowActionOutcome = {
    nextStatus?: WorkflowRequestRecord['status']
    payloadPatch?: Record<string, unknown>
}

type IssueStockRequestLinePayload = {
    partId?: string
    qty?: number
    requestedQty?: number
    issueQty?: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
}

type IssueStockRequestPayload = {
    warehouseId?: string
    docDate?: string
    note?: string
    autoSubmit?: boolean
    lines?: IssueStockRequestLinePayload[]
}

type IssueStockRemainingLinePayload = {
    partId?: string
    issueQty?: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
}

type IssuedDocumentLineSnapshot = {
    partId: string
    issueQty: number
    requestedQty?: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
}

/**
 * Orchestrates workflow transitions and invokes domain services for side effects.
 *
 * This service behaves like an application-level state machine:
 * - validates allowed transitions
 * - executes request-type-specific actions
 * - stores progress snapshots back into workflow payload
 */
export class WorkflowService {
    constructor(
        private workflows: IWorkflowRepo,
        private assets: AssetService,
        private maintenance: MaintenanceService,
        private events: IAssetEventRepo,
        private stockDocuments?: StockDocumentService
    ) { }

    async submitRequest(
        input: Parameters<IWorkflowRepo['submit']>[0],
        ctx: WorkflowServiceContext
    ): Promise<WorkflowRequestRecord> {
        if (input.assetId) {
            await this.assets.getAssetById(input.assetId)
        }
        const request = await this.workflows.submit({
            ...input,
            requestedBy: ctx.userId,
            correlationId: ctx.correlationId
        })
        if (request.assetId) {
            await this.appendAssetEvent(request.assetId, 'REQUEST_SUBMITTED', {
                requestId: request.id,
                requestType: request.requestType
            }, ctx)
        }
        return request
    }

    async approveRequest(id: string, ctx: WorkflowServiceContext): Promise<WorkflowRequestRecord> {
        const request = await this.requireRequest(id)
        if (request.status !== 'submitted') {
            throw AppError.conflict('Request is not in submitted state')
        }
        const updated = await this.workflows.updateStatus(id, 'approved', {
            approvedBy: ctx.userId,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to approve request')
        }
        if (updated.assetId) {
            await this.appendAssetEvent(updated.assetId, 'REQUEST_APPROVED', {
                requestId: updated.id,
                requestType: updated.requestType
            }, ctx)
        }
        return updated
    }

    async rejectRequest(id: string, reason: string | undefined, ctx: WorkflowServiceContext): Promise<WorkflowRequestRecord> {
        const request = await this.requireRequest(id)
        if (request.status !== 'submitted') {
            throw AppError.conflict('Request is not in submitted state')
        }
        const updated = await this.workflows.updateStatus(id, 'rejected', {
            approvedBy: ctx.userId,
            payload: reason ? { reason } : undefined,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to reject request')
        }
        if (updated.assetId) {
            await this.appendAssetEvent(updated.assetId, 'REQUEST_REJECTED', {
                requestId: updated.id,
                requestType: updated.requestType,
                reason: reason ?? null
            }, ctx)
        }
        return updated
    }

    async executeRequest(id: string, ctx: WorkflowServiceContext): Promise<WorkflowRequestRecord> {
        const request = await this.requireRequest(id)
        if (request.status !== 'approved') {
            throw AppError.conflict('Request is not approved')
        }

        // Mark request as active before invoking side-effecting operations.
        await this.workflows.updateStatus(id, 'in_progress', {
            approvedBy: request.approvedBy ?? ctx.userId,
            correlationId: ctx.correlationId
        })

        const outcome = await this.executeAction(request, ctx)
        const mergedPayload = outcome.payloadPatch
            ? { ...request.payload, ...outcome.payloadPatch }
            : undefined
        const nextStatus = outcome.nextStatus ?? 'done'

        const updated = await this.workflows.updateStatus(id, nextStatus, {
            approvedBy: request.approvedBy ?? ctx.userId,
            payload: mergedPayload,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to update request execution status')
        }
        return updated
    }

    async confirmIssueStockHandover(
        id: string,
        input: {
            note?: string
            assigneeId?: string
            assigneeName?: string
            assigneeType?: AssetAssignmentInput['assigneeType']
        },
        ctx: WorkflowServiceContext
    ): Promise<WorkflowRequestRecord> {
        const request = await this.requireRequest(id)
        if (request.requestType !== 'issue_stock') {
            throw AppError.badRequest('Request is not stock issue workflow')
        }
        if (request.status !== 'in_progress') {
            throw AppError.conflict('Request is not awaiting handover confirmation')
        }

        const payload = (request.payload ?? {}) as Record<string, unknown>
        const stockIssue = (payload.stockIssue ?? null) as { issueMode?: string; stockDocumentId?: string } | null
        if (!stockIssue?.stockDocumentId) {
            throw AppError.conflict('Stock issue document has not been generated')
        }
        if (stockIssue.issueMode === 'partial') {
            throw AppError.conflict('Cannot confirm handover while stock issue is partial')
        }

        let assignedAsset = false
        if (request.assetId && input.assigneeId && input.assigneeName && input.assigneeType) {
            // Assignment remains an explicit step after warehouse issue flow.
            await this.assets.assignAsset(request.assetId, {
                assigneeId: input.assigneeId,
                assigneeName: input.assigneeName,
                assigneeType: input.assigneeType,
                note: input.note
            }, ctx)
            assignedAsset = true
        }

        const existingHandover = (payload.handover && typeof payload.handover === 'object'
            ? payload.handover
            : {}) as Record<string, unknown>

        const updatedPayload = {
            ...payload,
            handover: {
                ...existingHandover,
                status: 'confirmed',
                confirmedAt: new Date().toISOString(),
                confirmedBy: ctx.userId,
                note: input.note ?? (existingHandover.note as string | undefined) ?? null,
                assigneeId: input.assigneeId ?? (existingHandover.assigneeId as string | undefined) ?? null,
                assigneeName: input.assigneeName ?? (existingHandover.assigneeName as string | undefined) ?? null,
                assigneeType: input.assigneeType ?? (existingHandover.assigneeType as string | undefined) ?? null
            },
            assetAssignment: {
                synced: assignedAsset,
                syncedAt: assignedAsset ? new Date().toISOString() : null
            }
        }

        const updated = await this.workflows.updateStatus(id, 'done', {
            approvedBy: request.approvedBy ?? ctx.userId,
            payload: updatedPayload,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to confirm handover')
        }
        return updated
    }

    async issueRemainingStock(
        id: string,
        input: {
            docDate?: string
            note?: string
            autoSubmit?: boolean
            lines?: IssueStockRemainingLinePayload[]
        },
        ctx: WorkflowServiceContext
    ): Promise<WorkflowRequestRecord> {
        if (!this.stockDocuments) {
            throw AppError.internal('Stock document service is not configured for issue_stock workflow')
        }

        const request = await this.requireRequest(id)
        if (request.requestType !== 'issue_stock') {
            throw AppError.badRequest('Request is not stock issue workflow')
        }
        if (request.status !== 'in_progress') {
            throw AppError.conflict('Request is not awaiting remaining stock issue')
        }

        const payload = (request.payload ?? {}) as Record<string, unknown>
        const stockIssuePayload = (payload.stockIssue && typeof payload.stockIssue === 'object'
            ? payload.stockIssue
            : null) as Record<string, unknown> | null
        if (!stockIssuePayload) {
            throw AppError.conflict('Stock issue document has not been generated')
        }
        if (stockIssuePayload.issueMode !== 'partial') {
            throw AppError.conflict('Stock issue is already fully issued')
        }

        const warehouseId = (typeof stockIssuePayload.warehouseId === 'string' && stockIssuePayload.warehouseId.trim())
            ? stockIssuePayload.warehouseId.trim()
            : (typeof (payload as IssueStockRequestPayload).warehouseId === 'string' && (payload as IssueStockRequestPayload).warehouseId?.trim())
                ? (payload as IssueStockRequestPayload).warehouseId!.trim()
                : ''
        if (!warehouseId) {
            throw AppError.conflict('Workflow payload missing warehouseId for remaining issue')
        }

        const progressLinesRaw = Array.isArray(stockIssuePayload.lines) ? stockIssuePayload.lines : []
        if (progressLinesRaw.length === 0) {
            throw AppError.conflict('Workflow payload missing stock issue progress lines')
        }

        const progressLines = progressLinesRaw.map((line, index) => {
            const item = (line && typeof line === 'object') ? line as Record<string, unknown> : {}
            const partId = typeof item.partId === 'string' ? item.partId.trim() : ''
            if (!partId) {
                throw AppError.conflict(`Invalid stock issue progress line ${index + 1}`)
            }
            const requestedQty = this.parsePositiveInteger(item.requestedQty, `stockIssue.lines[${index}].requestedQty`)
            const issuedQty = this.parsePositiveInteger(item.issueQty, `stockIssue.lines[${index}].issueQty`)
            if (issuedQty > requestedQty) {
                throw AppError.conflict(`Issued qty exceeds requested qty for part ${partId}`)
            }
            return { partId, requestedQty, issueQty: issuedQty }
        })

        // Remaining quantity is calculated from persisted progress, not from client input.
        const remainingByPart = new Map(progressLines.map((line) => [line.partId, line.requestedQty - line.issueQty]))
        const hasRemaining = [...remainingByPart.values()].some((value) => value > 0)
        if (!hasRemaining) {
            throw AppError.conflict('No remaining quantity to issue')
        }

        const issueRoundByPart = new Map<string, number>()
        const issueRoundLines: StockDocumentLineInput[] = []
        const issueRoundLineSnapshots: IssuedDocumentLineSnapshot[] = []
        const providedLines = Array.isArray(input.lines) ? input.lines : undefined

        if (providedLines && providedLines.length === 0) {
            throw AppError.badRequest('issue_remaining lines cannot be empty')
        }

        if (providedLines) {
            for (const [index, line] of providedLines.entries()) {
                const partId = typeof line.partId === 'string' ? line.partId.trim() : ''
                if (!partId) {
                    throw AppError.badRequest(`issue_remaining line ${index + 1} missing partId`)
                }
                if (issueRoundByPart.has(partId)) {
                    throw AppError.badRequest(`Duplicate partId in issue_remaining lines: ${partId}`)
                }
                const remainingQty = remainingByPart.get(partId)
                if (remainingQty === undefined) {
                    throw AppError.badRequest(`Part ${partId} is not in workflow request`)
                }
                if (remainingQty <= 0) {
                    throw AppError.conflict(`No remaining quantity for part ${partId}`)
                }
                const issueQty = this.parsePositiveInteger(line.issueQty, `issue_remaining.lines[${index}].issueQty`)
                if (issueQty > remainingQty) {
                    throw AppError.badRequest(`Issue qty cannot exceed remaining qty for part ${partId}`)
                }
                issueRoundByPart.set(partId, issueQty)
                issueRoundLines.push({
                    partId,
                    qty: issueQty,
                    unitCost: line.unitCost ?? null,
                    serialNo: line.serialNo ?? null,
                    note: line.note ?? null
                })
                issueRoundLineSnapshots.push({
                    partId,
                    issueQty,
                    unitCost: line.unitCost ?? null,
                    serialNo: line.serialNo ?? null,
                    note: line.note ?? null
                })
            }
        } else {
            for (const line of progressLines) {
                const remainingQty = line.requestedQty - line.issueQty
                if (remainingQty <= 0) continue
                issueRoundByPart.set(line.partId, remainingQty)
                issueRoundLines.push({
                    partId: line.partId,
                    qty: remainingQty,
                    unitCost: null,
                    serialNo: null,
                    note: null
                })
                issueRoundLineSnapshots.push({
                    partId: line.partId,
                    issueQty: remainingQty,
                    unitCost: null,
                    serialNo: null,
                    note: null
                })
            }
        }

        if (issueRoundLines.length === 0) {
            throw AppError.conflict('No remaining quantity selected to issue')
        }

        const created = await this.stockDocuments.createDocument({
            docType: 'issue',
            code: this.generateStockDocumentCode(),
            warehouseId,
            docDate: input.docDate?.trim() || undefined,
            refType: 'workflow_request',
            refId: request.id,
            note: input.note ?? null
        }, issueRoundLines, ctx)

        let stockDocumentStatus = created.document.status
        if (input.autoSubmit === true) {
            const submitted = await this.stockDocuments.submitDocument(created.document.id, ctx)
            stockDocumentStatus = submitted.status
        }

        const updatedProgressLines = progressLines.map((line) => ({
            partId: line.partId,
            requestedQty: line.requestedQty,
            issueQty: line.issueQty + (issueRoundByPart.get(line.partId) ?? 0)
        }))
        const stillPartial = updatedProgressLines.some((line) => line.issueQty < line.requestedQty)

        const existingIssuedDocuments = Array.isArray(stockIssuePayload.issuedDocuments)
            ? stockIssuePayload.issuedDocuments
            : []
        const nowIso = new Date().toISOString()
        const updatedPayload = {
            ...payload,
            stockIssue: {
                ...stockIssuePayload,
                stockDocumentId: created.document.id,
                stockDocumentCode: created.document.code,
                stockDocumentStatus,
                issueMode: stillPartial ? 'partial' : 'full',
                lastIssuedAt: nowIso,
                lastIssuedBy: ctx.userId,
                lines: updatedProgressLines,
                issuedDocuments: [
                    ...existingIssuedDocuments,
                    {
                        stockDocumentId: created.document.id,
                        stockDocumentCode: created.document.code,
                        stockDocumentStatus,
                        issuedAt: nowIso,
                        issuedBy: ctx.userId,
                        note: input.note ?? null,
                        autoSubmit: input.autoSubmit === true,
                        lines: issueRoundLineSnapshots
                    }
                ]
            },
            handover: {
                ...((payload.handover && typeof payload.handover === 'object') ? payload.handover : {}),
                status: stillPartial ? 'awaiting_remaining_issue' : 'awaiting_confirmation'
            }
        }

        const updated = await this.workflows.updateStatus(id, 'in_progress', {
            approvedBy: request.approvedBy ?? ctx.userId,
            payload: updatedPayload,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to issue remaining stock')
        }
        return updated
    }

    async cancelRequest(id: string, reason: string | undefined, ctx: WorkflowServiceContext): Promise<WorkflowRequestRecord> {
        const request = await this.requireRequest(id)
        if (request.status === 'done' || request.status === 'canceled') {
            throw AppError.conflict('Request cannot be canceled')
        }

        const payload = reason
            ? { ...request.payload, cancelReason: reason }
            : request.payload

        const updated = await this.workflows.updateStatus(id, 'canceled', {
            approvedBy: ctx.userId,
            payload,
            correlationId: ctx.correlationId
        })
        if (!updated) {
            throw AppError.internal('Failed to cancel request')
        }
        return updated
    }

    async listRequests(filters: Parameters<IWorkflowRepo['list']>[0]): Promise<ReturnType<IWorkflowRepo['list']>> {
        return await this.workflows.list(filters)
    }

    async getRequest(id: string): Promise<WorkflowRequestRecord> {
        return await this.requireRequest(id)
    }

    private async requireRequest(id: string): Promise<WorkflowRequestRecord> {
        const request = await this.workflows.getById(id)
        if (!request) {
            throw AppError.notFound('Workflow request not found')
        }
        return request
    }

    private async executeAction(request: WorkflowRequestRecord, ctx: WorkflowServiceContext): Promise<WorkflowActionOutcome> {
        // Request type drives which domain service is invoked.
        switch (request.requestType) {
            case 'assign': {
                const assetId = this.requireAssetId(request)
                const payload = request.payload as Partial<AssetAssignmentInput>
                if (!payload.assigneeId || !payload.assigneeName || !payload.assigneeType) {
                    throw AppError.badRequest('Assign payload missing assignee fields')
                }
                await this.assets.assignAsset(assetId, {
                    assigneeId: payload.assigneeId,
                    assigneeName: payload.assigneeName,
                    assigneeType: payload.assigneeType,
                    note: payload.note
                }, ctx)
                return {}
            }
            case 'return': {
                const assetId = this.requireAssetId(request)
                const note = (request.payload as { note?: string } | undefined)?.note
                await this.assets.returnAsset(assetId, note, ctx)
                return {}
            }
            case 'move': {
                const assetId = this.requireAssetId(request)
                const locationId = (request.payload as { locationId?: string } | undefined)?.locationId
                if (!locationId) {
                    throw AppError.badRequest('Move payload missing locationId')
                }
                await this.assets.moveAsset(assetId, locationId, ctx)
                return {}
            }
            case 'repair': {
                const assetId = this.requireAssetId(request)
                const payload = request.payload as Partial<MaintenanceTicketInput>
                if (!payload.title || !payload.severity) {
                    throw AppError.badRequest('Repair payload missing title or severity')
                }
                await this.maintenance.openTicket(assetId, {
                    title: payload.title,
                    severity: payload.severity,
                    diagnosis: payload.diagnosis,
                    resolution: payload.resolution
                }, ctx)
                return {}
            }
            case 'dispose': {
                const assetId = this.requireAssetId(request)
                await this.assets.changeStatus(assetId, 'disposed', ctx)
                return {}
            }
            case 'issue_stock':
                // Returns payload patch with stock issue progress metadata.
                return await this.executeIssueStockRequest(request, ctx)
            default:
                throw AppError.badRequest('Unsupported request type')
        }
    }

    private requireAssetId(request: WorkflowRequestRecord): string {
        if (!request.assetId) {
            throw AppError.badRequest('Request missing assetId')
        }
        return request.assetId
    }

    private async executeIssueStockRequest(
        request: WorkflowRequestRecord,
        ctx: WorkflowServiceContext
    ): Promise<WorkflowActionOutcome> {
        if (!this.stockDocuments) {
            throw AppError.internal('Stock document service is not configured for issue_stock workflow')
        }

        const payload = (request.payload ?? {}) as IssueStockRequestPayload
        const warehouseId = payload.warehouseId?.trim()
        if (!warehouseId) {
            throw AppError.badRequest('issue_stock payload missing warehouseId')
        }

        const rawLines = Array.isArray(payload.lines) ? payload.lines : []
        if (rawLines.length === 0) {
            throw AppError.badRequest('issue_stock payload missing lines')
        }

        // Track full-vs-partial issue at line level so follow-up rounds can continue safely.
        let isPartial = false
        const requestedSummary: Array<{ partId: string; requestedQty: number; issueQty: number }> = []
        const issuedRoundLines: IssuedDocumentLineSnapshot[] = []
        const issueLines: StockDocumentLineInput[] = rawLines.map((line, index) => {
            const partId = typeof line.partId === 'string' ? line.partId.trim() : ''
            if (!partId) {
                throw AppError.badRequest(`issue_stock line ${index + 1} missing partId`)
            }
            const requestedQtyRaw = line.requestedQty ?? line.qty
            const issueQtyRaw = line.issueQty ?? line.qty ?? line.requestedQty
            const requestedQty = this.parsePositiveInteger(requestedQtyRaw, `issue_stock.lines[${index}].requestedQty`)
            const issueQty = this.parsePositiveInteger(issueQtyRaw, `issue_stock.lines[${index}].issueQty`)
            if (issueQty > requestedQty) {
                throw AppError.badRequest(`Issue qty cannot exceed requested qty for line ${index + 1}`)
            }
            if (issueQty < requestedQty) {
                isPartial = true
            }
            requestedSummary.push({ partId, requestedQty, issueQty })
            issuedRoundLines.push({
                partId,
                requestedQty,
                issueQty,
                unitCost: line.unitCost ?? null,
                serialNo: line.serialNo ?? null,
                note: line.note ?? null
            })
            return {
                partId,
                qty: issueQty,
                unitCost: line.unitCost ?? null,
                serialNo: line.serialNo ?? null,
                note: line.note ?? null
            }
        })

        const created = await this.stockDocuments.createDocument({
            docType: 'issue',
            code: this.generateStockDocumentCode(),
            warehouseId,
            docDate: payload.docDate?.trim() || undefined,
            refType: 'workflow_request',
            refId: request.id,
            note: payload.note ?? null
        }, issueLines, ctx)

        let stockDocumentStatus = created.document.status
        if (payload.autoSubmit === true) {
            const submitted = await this.stockDocuments.submitDocument(created.document.id, ctx)
            stockDocumentStatus = submitted.status
        }

        const generatedAt = new Date().toISOString()
        return {
            nextStatus: 'in_progress',
            payloadPatch: {
                // Persist generated stock document and progress snapshot for subsequent actions.
                stockIssue: {
                    stockDocumentId: created.document.id,
                    stockDocumentCode: created.document.code,
                    stockDocumentStatus,
                    warehouseId,
                    issueMode: isPartial ? 'partial' : 'full',
                    generatedAt,
                    generatedBy: ctx.userId,
                    lastIssuedAt: generatedAt,
                    lastIssuedBy: ctx.userId,
                    lines: requestedSummary,
                    issuedDocuments: [
                        {
                            stockDocumentId: created.document.id,
                            stockDocumentCode: created.document.code,
                            stockDocumentStatus,
                            issuedAt: generatedAt,
                            issuedBy: ctx.userId,
                            note: payload.note ?? null,
                            autoSubmit: payload.autoSubmit === true,
                            lines: issuedRoundLines
                        }
                    ]
                },
                handover: {
                    status: isPartial ? 'awaiting_remaining_issue' : 'awaiting_confirmation'
                }
            }
        }
    }

    private parsePositiveInteger(value: unknown, field: string): number {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (!Number.isInteger(numeric) || numeric <= 0) {
            throw AppError.badRequest(`Invalid positive integer for ${field}`)
        }
        return numeric
    }

    private generateStockDocumentCode(): string {
        const year = new Date().getFullYear()
        const random = Math.floor(100000 + Math.random() * 900000)
        return `SD-REQ-${year}-${random}`
    }

    private async appendAssetEvent(
        assetId: string,
        eventType: 'REQUEST_SUBMITTED' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED',
        payload: Record<string, unknown>,
        ctx: WorkflowServiceContext
    ): Promise<void> {
        await this.events.append({
            assetId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
