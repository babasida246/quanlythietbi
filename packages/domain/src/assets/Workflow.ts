import { DomainError } from '../core/errors/index.js'
import type { WorkflowRequestStatus, WorkflowRequestType } from './types.js'

export interface WorkflowRequestProps {
    id: string
    requestType: WorkflowRequestType
    assetId?: string | null
    fromDept?: string | null
    toDept?: string | null
    requestedBy?: string | null
    approvedBy?: string | null
    status: WorkflowRequestStatus
    payload?: Record<string, unknown>
    createdAt?: Date
    updatedAt?: Date
    correlationId?: string | null
}

export class WorkflowRequest {
    public id: string
    public requestType: WorkflowRequestType
    public assetId?: string | null
    public fromDept?: string | null
    public toDept?: string | null
    public requestedBy?: string | null
    public approvedBy?: string | null
    public status: WorkflowRequestStatus
    public payload: Record<string, unknown>
    public createdAt: Date
    public updatedAt: Date
    public correlationId?: string | null

    constructor(props: WorkflowRequestProps) {
        if (!props.requestType) {
            throw DomainError.validation('Request type required', 'requestType')
        }
        if (!props.status) {
            throw DomainError.validation('Request status required', 'status')
        }

        this.id = props.id
        this.requestType = props.requestType
        this.assetId = props.assetId ?? null
        this.fromDept = props.fromDept ?? null
        this.toDept = props.toDept ?? null
        this.requestedBy = props.requestedBy ?? null
        this.approvedBy = props.approvedBy ?? null
        this.status = props.status
        this.payload = props.payload ?? {}
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
        this.correlationId = props.correlationId ?? null
    }
}
