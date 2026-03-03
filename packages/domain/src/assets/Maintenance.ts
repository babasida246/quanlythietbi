import { DomainError } from '../core/errors/index.js'
import type { MaintenanceSeverity, MaintenanceStatus } from './types.js'

export interface MaintenanceTicketProps {
    id: string
    assetId: string
    title: string
    severity: MaintenanceSeverity
    status: MaintenanceStatus
    openedAt?: Date
    closedAt?: Date | null
    diagnosis?: string | null
    resolution?: string | null
    createdBy?: string | null
    correlationId?: string | null
}

export class MaintenanceTicket {
    public id: string
    public assetId: string
    public title: string
    public severity: MaintenanceSeverity
    public status: MaintenanceStatus
    public openedAt: Date
    public closedAt?: Date | null
    public diagnosis?: string | null
    public resolution?: string | null
    public createdBy?: string | null
    public correlationId?: string | null

    constructor(props: MaintenanceTicketProps) {
        if (!props.title || props.title.trim().length === 0) {
            throw DomainError.validation('Maintenance title required', 'title')
        }

        this.id = props.id
        this.assetId = props.assetId
        this.title = props.title.trim()
        this.severity = props.severity
        this.status = props.status
        this.openedAt = props.openedAt ?? new Date()
        this.closedAt = props.closedAt ?? null
        this.diagnosis = props.diagnosis ?? null
        this.resolution = props.resolution ?? null
        this.createdBy = props.createdBy ?? null
        this.correlationId = props.correlationId ?? null
    }
}
