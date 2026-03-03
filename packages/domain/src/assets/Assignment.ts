import { DomainError } from '../core/errors/index.js'
import type { AssigneeType } from './types.js'

export interface AssetAssignmentProps {
    id: string
    assetId: string
    assigneeType: AssigneeType
    assigneeId: string
    assigneeName: string
    assignedAt?: Date
    returnedAt?: Date | null
    note?: string | null
}

export class AssetAssignment {
    public id: string
    public assetId: string
    public assigneeType: AssigneeType
    public assigneeId: string
    public assigneeName: string
    public assignedAt: Date
    public returnedAt?: Date | null
    public note?: string | null

    constructor(props: AssetAssignmentProps) {
        if (!props.assigneeId || props.assigneeId.trim().length === 0) {
            throw DomainError.validation('Assignee id required', 'assigneeId')
        }
        if (!props.assigneeName || props.assigneeName.trim().length === 0) {
            throw DomainError.validation('Assignee name required', 'assigneeName')
        }

        this.id = props.id
        this.assetId = props.assetId
        this.assigneeType = props.assigneeType
        this.assigneeId = props.assigneeId.trim()
        this.assigneeName = props.assigneeName.trim()
        this.assignedAt = props.assignedAt ?? new Date()
        this.returnedAt = props.returnedAt ?? null
        this.note = props.note ?? null
    }
}

export function assertSingleActiveAssignment(items: Array<{ returnedAt?: Date | null }>): void {
    const activeCount = items.filter(item => item.returnedAt == null).length
    if (activeCount > 1) {
        throw DomainError.businessRule('Only one active assignment allowed', 'asset.assignment.active')
    }
}
