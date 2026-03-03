import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowService } from './WorkflowService.js'
import { AssetService } from './AssetService.js'
import { MaintenanceService } from './MaintenanceService.js'
import type {
    AssetAssignmentInput,
    AssetAssignmentRecord,
    AssetBulkUpsertInput,
    AssetCreateInput,
    AssetEventInput,
    AssetEventPage,
    AssetEventRecord,
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetUpdatePatch,
    IAssetEventRepo,
    IAssetRepo,
    IAssignmentRepo,
    IMaintenanceRepo,
    IWorkflowRepo,
    MaintenanceTicketInput,
    MaintenanceTicketRecord,
    MaintenanceTicketStatusPatch,
    WorkflowRequestInput,
    WorkflowRequestPage,
    WorkflowRequestRecord,
    WorkflowStatusPatch
} from '@qltb/contracts'

class FakeAssetRepo implements IAssetRepo {
    private items: AssetRecord[] = [{ id: 'asset-1', assetCode: 'A1', modelId: 'm1', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() }]
    async create(_asset: AssetCreateInput): Promise<AssetRecord> { throw new Error('not used') }
    async update(id: string, patch: AssetUpdatePatch) {
        const existing = await this.getById(id)
        if (!existing) throw new Error('Asset not found')
        const updated = { ...existing, ...patch, updatedAt: new Date() }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }
    async getById(id: string) { return this.items.find(item => item.id === id) ?? null }
    async getByAssetCode(code: string) { return this.items.find(item => item.assetCode === code) ?? null }
    async delete() { return false }
    async search(_filters: AssetSearchFilters): Promise<AssetSearchResult> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: 50 }
    }
    async bulkUpsert(_items: AssetBulkUpsertInput[]) { return { created: 0, updated: 0, items: [] } }
}

class FakeAssignmentRepo implements IAssignmentRepo {
    async assign(assetId: string, assignment: AssetAssignmentInput): Promise<AssetAssignmentRecord> {
        return {
            id: 'assign-1',
            assetId,
            assigneeType: assignment.assigneeType,
            assigneeId: assignment.assigneeId,
            assigneeName: assignment.assigneeName,
            assignedAt: assignment.assignedAt ?? new Date(),
            returnedAt: null,
            note: assignment.note ?? null
        }
    }
    async return() { return null }
    async listByAsset() { return [] }
    async getActiveByAsset() { return null }
}

class FakeMaintenanceRepo implements IMaintenanceRepo {
    async open(ticket: MaintenanceTicketInput): Promise<MaintenanceTicketRecord> {
        return {
            id: 'ticket-1',
            assetId: ticket.assetId,
            title: ticket.title,
            severity: ticket.severity,
            status: ticket.status ?? 'open',
            openedAt: ticket.openedAt ?? new Date(),
            closedAt: null,
            diagnosis: ticket.diagnosis ?? null,
            resolution: ticket.resolution ?? null,
            createdBy: ticket.createdBy ?? null,
            correlationId: ticket.correlationId ?? null
        }
    }
    async updateStatus(): Promise<MaintenanceTicketRecord | null> { return null }
    async list() { return { items: [], total: 0, page: 1, limit: 50 } }
    async getById() { return null }
}

class FakeEventRepo implements IAssetEventRepo {
    private items: AssetEventRecord[] = []
    private seq = 1
    async append(event: AssetEventInput): Promise<AssetEventRecord> {
        const record: AssetEventRecord = { id: `event-${this.seq++}`, createdAt: new Date(), payload: event.payload ?? {}, ...event }
        this.items.push(record)
        return record
    }
    async listByAsset(assetId: string, page: number, limit: number): Promise<AssetEventPage> {
        return { items: this.items.filter(item => item.assetId === assetId), page, limit }
    }
    getAll() { return this.items }
}

class FakeWorkflowRepo implements IWorkflowRepo {
    private items: WorkflowRequestRecord[] = []
    private seq = 1
    async submit(input: WorkflowRequestInput): Promise<WorkflowRequestRecord> {
        const record: WorkflowRequestRecord = {
            id: `req-${this.seq++}`,
            requestType: input.requestType,
            assetId: input.assetId ?? null,
            fromDept: input.fromDept ?? null,
            toDept: input.toDept ?? null,
            requestedBy: input.requestedBy ?? null,
            approvedBy: null,
            status: 'submitted',
            payload: input.payload ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
            correlationId: input.correlationId ?? null
        }
        this.items.push(record)
        return record
    }
    async approve(id: string, patch: WorkflowStatusPatch) {
        return this.updateStatus(id, 'approved', patch)
    }
    async reject(id: string, patch: WorkflowStatusPatch) {
        return this.updateStatus(id, 'rejected', patch)
    }
    async list(): Promise<WorkflowRequestPage> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: 50 }
    }
    async getById(id: string): Promise<WorkflowRequestRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }
    async updateStatus(id: string, status: WorkflowRequestRecord['status'], patch: WorkflowStatusPatch) {
        const existing = await this.getById(id)
        if (!existing) return null
        const updated: WorkflowRequestRecord = {
            ...existing,
            status,
            approvedBy: patch.approvedBy ?? existing.approvedBy,
            payload: patch.payload ?? existing.payload,
            correlationId: patch.correlationId ?? existing.correlationId,
            updatedAt: new Date()
        }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }
}

describe('WorkflowService', () => {
    const ctx = { userId: 'u1', correlationId: 'c1' }
    let workflow: WorkflowService
    let events: FakeEventRepo
    let workflowRepo: FakeWorkflowRepo
    let stockDocuments: {
        createDocument: (...args: any[]) => Promise<any>
        submitDocument: (...args: any[]) => Promise<any>
    }

    beforeEach(() => {
        const assetsRepo = new FakeAssetRepo()
        events = new FakeEventRepo()
        const assetService = new AssetService(assetsRepo, new FakeAssignmentRepo(), events, new FakeMaintenanceRepo())
        const maintenanceService = new MaintenanceService(assetsRepo, new FakeAssignmentRepo(), new FakeMaintenanceRepo(), events)
        workflowRepo = new FakeWorkflowRepo()
        let stockDocSeq = 1
        stockDocuments = {
            async createDocument(input: any, lines: any[]) {
                const now = new Date()
                return {
                    document: {
                        id: `sd-${stockDocSeq++}`,
                        docType: input.docType,
                        code: input.code,
                        status: 'draft',
                        warehouseId: input.warehouseId ?? null,
                        targetWarehouseId: input.targetWarehouseId ?? null,
                        docDate: input.docDate ?? '2026-02-23',
                        refType: input.refType ?? null,
                        refId: input.refId ?? null,
                        note: input.note ?? null,
                        createdBy: ctx.userId,
                        approvedBy: null,
                        correlationId: ctx.correlationId,
                        createdAt: now,
                        updatedAt: now
                    },
                    lines
                }
            },
            async submitDocument(id: string) {
                const now = new Date()
                return {
                    id,
                    docType: 'issue',
                    code: 'SD-REQ',
                    status: 'submitted',
                    warehouseId: 'wh-1',
                    targetWarehouseId: null,
                    docDate: '2026-02-23',
                    refType: 'workflow_request',
                    refId: 'req-1',
                    note: null,
                    createdBy: ctx.userId,
                    approvedBy: null,
                    correlationId: ctx.correlationId,
                    createdAt: now,
                    updatedAt: now
                }
            }
        }
        workflow = new WorkflowService(workflowRepo, assetService, maintenanceService, events, stockDocuments as any)
    })

    it('submits and approves workflow request', async () => {
        const request = await workflow.submitRequest({
            requestType: 'move',
            assetId: 'asset-1',
            payload: { locationId: 'loc-2' }
        }, ctx)
        expect(request.status).toBe('submitted')

        const approved = await workflow.approveRequest(request.id, ctx)
        expect(approved.status).toBe('approved')
        expect(events.getAll().some(item => item.eventType === 'REQUEST_APPROVED')).toBe(true)
    })

    it('executes issue_stock request to create stock document and waits handover confirmation', async () => {
        const request = await workflow.submitRequest({
            requestType: 'issue_stock',
            assetId: 'asset-1',
            payload: {
                warehouseId: 'wh-1',
                autoSubmit: true,
                lines: [{ partId: 'part-1', requestedQty: 2, issueQty: 2 }]
            }
        }, ctx)
        await workflow.approveRequest(request.id, { userId: 'approver-1', correlationId: 'c2' })

        const executing = await workflow.executeRequest(request.id, { userId: 'issuer-1', correlationId: 'c3' })
        expect(executing.status).toBe('in_progress')
        expect((executing.payload as any).stockIssue.stockDocumentId).toBeTruthy()
        expect((executing.payload as any).stockIssue.stockDocumentStatus).toBe('submitted')
        expect((executing.payload as any).handover.status).toBe('awaiting_confirmation')
        expect((executing.payload as any).stockIssue.issuedDocuments[0]).toMatchObject({
            autoSubmit: true,
            lines: [{ partId: 'part-1', issueQty: 2 }]
        })

        const completed = await workflow.confirmIssueStockHandover(
            request.id,
            {
                note: 'Delivered to employee',
                assigneeId: 'user-99',
                assigneeName: 'Employee 99',
                assigneeType: 'person'
            },
            { userId: 'issuer-1', correlationId: 'c4' }
        )

        expect(completed.status).toBe('done')
        expect((completed.payload as any).handover.status).toBe('confirmed')
        expect((completed.payload as any).assetAssignment.synced).toBe(true)
        expect(events.getAll().some(item => item.eventType === 'ASSIGNED')).toBe(true)
    })

    it('keeps issue_stock request in progress for partial issue and blocks handover confirmation', async () => {
        const request = await workflow.submitRequest({
            requestType: 'issue_stock',
            assetId: 'asset-1',
            payload: {
                warehouseId: 'wh-1',
                lines: [{ partId: 'part-1', requestedQty: 5, issueQty: 2 }]
            }
        }, ctx)
        await workflow.approveRequest(request.id, { userId: 'approver-1', correlationId: 'c2' })

        const executing = await workflow.executeRequest(request.id, { userId: 'issuer-1', correlationId: 'c3' })
        expect(executing.status).toBe('in_progress')
        expect((executing.payload as any).stockIssue.issueMode).toBe('partial')
        expect((executing.payload as any).handover.status).toBe('awaiting_remaining_issue')

        await expect(workflow.confirmIssueStockHandover(request.id, {}, { userId: 'issuer-1', correlationId: 'c4' }))
            .rejects.toMatchObject({ httpStatus: 409 })
    })

    it('issues remaining stock and then allows handover confirmation', async () => {
        const request = await workflow.submitRequest({
            requestType: 'issue_stock',
            assetId: 'asset-1',
            payload: {
                warehouseId: 'wh-1',
                autoSubmit: true,
                lines: [{ partId: 'part-1', requestedQty: 5, issueQty: 2 }]
            }
        }, ctx)
        await workflow.approveRequest(request.id, { userId: 'approver-1', correlationId: 'c2' })
        await workflow.executeRequest(request.id, { userId: 'issuer-1', correlationId: 'c3' })

        const progressed = await workflow.issueRemainingStock(
            request.id,
            { autoSubmit: true },
            { userId: 'issuer-2', correlationId: 'c4' }
        )

        expect(progressed.status).toBe('in_progress')
        expect((progressed.payload as any).stockIssue.issueMode).toBe('full')
        expect((progressed.payload as any).handover.status).toBe('awaiting_confirmation')
        expect((progressed.payload as any).stockIssue.lines[0].issueQty).toBe(5)
        expect((progressed.payload as any).stockIssue.issuedDocuments).toHaveLength(2)
        expect((progressed.payload as any).stockIssue.issuedDocuments[1]).toMatchObject({
            autoSubmit: true,
            lines: [{ partId: 'part-1', issueQty: 3 }]
        })

        const done = await workflow.confirmIssueStockHandover(
            request.id,
            { note: 'Delivered after second issue' },
            { userId: 'issuer-2', correlationId: 'c5' }
        )
        expect(done.status).toBe('done')
        expect((done.payload as any).handover.status).toBe('confirmed')
    })

    it('rejects issue_remaining when qty exceeds remaining quantity', async () => {
        const request = await workflow.submitRequest({
            requestType: 'issue_stock',
            payload: {
                warehouseId: 'wh-1',
                lines: [{ partId: 'part-1', requestedQty: 5, issueQty: 2 }]
            }
        }, ctx)
        await workflow.approveRequest(request.id, { userId: 'approver-1', correlationId: 'c2' })
        await workflow.executeRequest(request.id, { userId: 'issuer-1', correlationId: 'c3' })

        await expect(workflow.issueRemainingStock(
            request.id,
            {
                lines: [{ partId: 'part-1', issueQty: 4, unitCost: 1, serialNo: 'SN-1', note: 'extra' }]
            },
            { userId: 'issuer-2', correlationId: 'c4' }
        )).rejects.toMatchObject({ httpStatus: 400 })
    })
})
