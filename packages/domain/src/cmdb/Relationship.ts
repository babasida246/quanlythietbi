import { DomainError } from '../core/errors/index.js'
import type { RelationshipStatus } from './types.js'

export interface RelationshipTypeProps {
    id: string
    code: string
    name: string
    reverseName?: string | null
    allowedFromTypeId?: string | null
    allowedToTypeId?: string | null
}

export class RelationshipType {
    id: string
    code: string
    name: string
    reverseName?: string | null
    allowedFromTypeId?: string | null
    allowedToTypeId?: string | null

    constructor(props: RelationshipTypeProps) {
        if (!props.code?.trim()) {
            throw DomainError.validation('Relationship type code required', 'code')
        }
        if (!props.name?.trim()) {
            throw DomainError.validation('Relationship type name required', 'name')
        }
        this.id = props.id
        this.code = props.code.trim()
        this.name = props.name.trim()
        this.reverseName = props.reverseName ?? null
        this.allowedFromTypeId = props.allowedFromTypeId ?? null
        this.allowedToTypeId = props.allowedToTypeId ?? null
    }
}

export interface RelationshipProps {
    id: string
    relTypeId: string
    fromCiId: string
    toCiId: string
    status: RelationshipStatus
    sinceDate?: string | null
    note?: string | null
    allowSelfLoop?: boolean
    createdAt?: Date
}

export class Relationship {
    id: string
    relTypeId: string
    fromCiId: string
    toCiId: string
    status: RelationshipStatus
    sinceDate?: string | null
    note?: string | null
    createdAt: Date

    constructor(props: RelationshipProps) {
        if (!props.relTypeId) {
            throw DomainError.validation('Relationship type required', 'relTypeId')
        }
        if (!props.fromCiId || !props.toCiId) {
            throw DomainError.validation('Both endpoints required', 'fromCiId')
        }
        if (props.fromCiId === props.toCiId && !props.allowSelfLoop) {
            throw DomainError.businessRule('Self-loop relationships are not allowed', 'self_loop')
        }
        this.id = props.id
        this.relTypeId = props.relTypeId
        this.fromCiId = props.fromCiId
        this.toCiId = props.toCiId
        this.status = props.status
        this.sinceDate = props.sinceDate ?? null
        this.note = props.note ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}
