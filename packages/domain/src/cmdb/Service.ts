import { DomainError } from '../core/errors/index.js'

export interface CmdbServiceProps {
    id: string
    code: string
    name: string
    criticality?: string | null
    owner?: string | null
    sla?: string | null
    status?: string | null
    createdAt?: Date
}

export class CmdbService {
    id: string
    code: string
    name: string
    criticality?: string | null
    owner?: string | null
    sla?: string | null
    status?: string | null
    createdAt: Date

    constructor(props: CmdbServiceProps) {
        if (!props.code?.trim()) {
            throw DomainError.validation('Service code required', 'code')
        }
        if (!props.name?.trim()) {
            throw DomainError.validation('Service name required', 'name')
        }
        this.id = props.id
        this.code = props.code.trim()
        this.name = props.name.trim()
        this.criticality = props.criticality ?? null
        this.owner = props.owner ?? null
        this.sla = props.sla ?? null
        this.status = props.status ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}

export interface ServiceMemberProps {
    id: string
    serviceId: string
    ciId: string
    role?: string | null
    createdAt?: Date
}

export class ServiceMember {
    id: string
    serviceId: string
    ciId: string
    role?: string | null
    createdAt: Date

    constructor(props: ServiceMemberProps) {
        if (!props.serviceId) {
            throw DomainError.validation('Service id required', 'serviceId')
        }
        if (!props.ciId) {
            throw DomainError.validation('CI id required', 'ciId')
        }
        this.id = props.id
        this.serviceId = props.serviceId
        this.ciId = props.ciId
        this.role = props.role ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}
