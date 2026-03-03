import type { WorkflowRequestStatus, WorkflowRequestType } from '@qltb/domain'

export interface WorkflowRequestRecord {
    id: string
    requestType: WorkflowRequestType
    assetId?: string | null
    fromDept?: string | null
    toDept?: string | null
    requestedBy?: string | null
    approvedBy?: string | null
    status: WorkflowRequestStatus
    payload: Record<string, unknown>
    createdAt: Date
    updatedAt: Date
    correlationId?: string | null
}

export interface WorkflowRequestInput {
    requestType: WorkflowRequestType
    assetId?: string | null
    fromDept?: string | null
    toDept?: string | null
    requestedBy?: string | null
    payload?: Record<string, unknown>
    correlationId?: string | null
}

export interface WorkflowRequestListFilters {
    status?: WorkflowRequestStatus
    requestType?: WorkflowRequestType
    requestedBy?: string
    page?: number
    limit?: number
}

export interface WorkflowRequestPage {
    items: WorkflowRequestRecord[]
    total: number
    page: number
    limit: number
}

export interface WorkflowStatusPatch {
    approvedBy?: string | null
    payload?: Record<string, unknown>
    correlationId?: string | null
}

export interface IWorkflowRepo {
    submit(input: WorkflowRequestInput): Promise<WorkflowRequestRecord>
    approve(id: string, patch: WorkflowStatusPatch): Promise<WorkflowRequestRecord | null>
    reject(id: string, patch: WorkflowStatusPatch): Promise<WorkflowRequestRecord | null>
    list(filters: WorkflowRequestListFilters): Promise<WorkflowRequestPage>
    getById(id: string): Promise<WorkflowRequestRecord | null>
    updateStatus(id: string, status: WorkflowRequestStatus, patch: WorkflowStatusPatch): Promise<WorkflowRequestRecord | null>
}
