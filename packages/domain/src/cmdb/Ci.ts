import { DomainError } from '../core/errors/index.js'
import type { CiStatus, Environment } from './types.js'

export interface CiProps {
    id: string
    typeId: string
    name: string
    ciCode: string
    status: CiStatus
    environment: Environment
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
    createdAt?: Date
    updatedAt?: Date
}

const CI_CODE_REGEX = /^[A-Z0-9\-_.]+$/i

export class Ci {
    id: string
    typeId: string
    name: string
    ciCode: string
    status: CiStatus
    environment: Environment
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
    createdAt: Date
    updatedAt: Date

    constructor(props: CiProps) {
        if (!props.typeId) {
            throw DomainError.validation('Type id required', 'typeId')
        }
        if (!props.name?.trim()) {
            throw DomainError.validation('CI name required', 'name')
        }
        if (!props.ciCode?.trim() || !CI_CODE_REGEX.test(props.ciCode)) {
            throw DomainError.validation('Invalid CI code', 'ciCode')
        }
        this.id = props.id
        this.typeId = props.typeId
        this.name = props.name.trim()
        this.ciCode = props.ciCode.trim()
        this.status = props.status
        this.environment = props.environment
        this.assetId = props.assetId ?? null
        this.locationId = props.locationId ?? null
        this.ownerTeam = props.ownerTeam ?? null
        this.notes = props.notes ?? null
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
    }
}

export interface CiAttrValueProps {
    id: string
    ciId: string
    versionId: string
    key: string
    value?: unknown
    updatedAt?: Date
}

export class CiAttrValue {
    id: string
    ciId: string
    versionId: string
    key: string
    value?: unknown
    updatedAt: Date

    constructor(props: CiAttrValueProps) {
        if (!props.ciId) {
            throw DomainError.validation('CI id required', 'ciId')
        }
        if (!props.versionId) {
            throw DomainError.validation('Version id required', 'versionId')
        }
        if (!props.key?.trim()) {
            throw DomainError.validation('Key required', 'key')
        }
        this.id = props.id
        this.ciId = props.ciId
        this.versionId = props.versionId
        this.key = props.key.trim()
        this.value = props.value
        this.updatedAt = props.updatedAt ?? new Date()
    }
}
