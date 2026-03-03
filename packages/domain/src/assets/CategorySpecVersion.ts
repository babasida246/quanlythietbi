import { DomainError } from '../core/errors/index.js'

export const SpecVersionStatusValues = ['draft', 'active', 'retired'] as const
export type SpecVersionStatus = typeof SpecVersionStatusValues[number]

export interface CategorySpecVersionProps {
    id: string
    categoryId: string
    version: number
    status: SpecVersionStatus
    createdBy?: string | null
    createdAt?: Date
}

export class CategorySpecVersion {
    id: string
    categoryId: string
    version: number
    status: SpecVersionStatus
    createdBy?: string | null
    createdAt: Date

    constructor(props: CategorySpecVersionProps) {
        if (!props.categoryId) {
            throw DomainError.validation('Category id required', 'categoryId')
        }
        if (!Number.isInteger(props.version) || props.version <= 0) {
            throw DomainError.validation('Version must be a positive integer', 'version')
        }
        if (!SpecVersionStatusValues.includes(props.status)) {
            throw DomainError.validation('Invalid status', 'status')
        }
        this.id = props.id
        this.categoryId = props.categoryId
        this.version = props.version
        this.status = props.status
        this.createdBy = props.createdBy ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}
