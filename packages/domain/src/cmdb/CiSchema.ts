import { DomainError } from '../core/errors/index.js'
import { CmdbFieldTypeValues, SpecVersionStatusValues } from './types.js'

export interface CiTypeProps {
    id: string
    code: string
    name: string
    description?: string | null
    createdAt?: Date
}

export class CiType {
    id: string
    code: string
    name: string
    description?: string | null
    createdAt: Date

    constructor(props: CiTypeProps) {
        if (!props.code?.trim()) {
            throw DomainError.validation('CI type code required', 'code')
        }
        if (!props.name?.trim()) {
            throw DomainError.validation('CI type name required', 'name')
        }
        this.id = props.id
        this.code = props.code.trim()
        this.name = props.name.trim()
        this.description = props.description ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}

export interface CiTypeVersionProps {
    id: string
    typeId: string
    version: number
    status: (typeof SpecVersionStatusValues)[number]
    createdBy?: string | null
    createdAt?: Date
}

export class CiTypeVersion {
    id: string
    typeId: string
    version: number
    status: (typeof SpecVersionStatusValues)[number]
    createdBy?: string | null
    createdAt: Date

    constructor(props: CiTypeVersionProps) {
        if (!props.typeId) {
            throw DomainError.validation('Type id required', 'typeId')
        }
        if (!Number.isInteger(props.version) || props.version <= 0) {
            throw DomainError.validation('Version must be a positive integer', 'version')
        }
        if (!SpecVersionStatusValues.includes(props.status)) {
            throw DomainError.validation('Invalid status', 'status')
        }
        this.id = props.id
        this.typeId = props.typeId
        this.version = props.version
        this.status = props.status
        this.createdBy = props.createdBy ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}

export interface CiAttrDefProps {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: (typeof CmdbFieldTypeValues)[number]
    required?: boolean
    unit?: string | null
    enumValues?: string[] | null
    pattern?: string | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    minLen?: number | null
    maxLen?: number | null
    defaultValue?: unknown
    sortOrder?: number
    isActive?: boolean
}

export class CiAttrDef {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: (typeof CmdbFieldTypeValues)[number]
    required: boolean
    unit?: string | null
    enumValues?: string[] | null
    pattern?: string | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    minLen?: number | null
    maxLen?: number | null
    defaultValue?: unknown
    sortOrder: number
    isActive: boolean

    constructor(props: CiAttrDefProps) {
        if (!props.versionId) {
            throw DomainError.validation('Version id required', 'versionId')
        }
        if (!props.key?.trim()) {
            throw DomainError.validation('Key required', 'key')
        }
        if (!props.label?.trim()) {
            throw DomainError.validation('Label required', 'label')
        }
        if (!CmdbFieldTypeValues.includes(props.fieldType)) {
            throw DomainError.validation('Invalid field type', 'fieldType')
        }
        if ((props.fieldType === 'enum' || props.fieldType === 'multi_enum') && (!props.enumValues || props.enumValues.length === 0)) {
            throw DomainError.validation('Enum values required', 'enumValues')
        }
        if (props.fieldType === 'regex' && !props.pattern) {
            throw DomainError.validation('Pattern required for regex', 'pattern')
        }
        if (props.minValue !== undefined && props.maxValue !== undefined && props.minValue !== null && props.maxValue !== null) {
            if (props.minValue > props.maxValue) {
                throw DomainError.validation('minValue cannot exceed maxValue', 'minValue')
            }
        }
        if (props.minLen !== undefined && props.maxLen !== undefined && props.minLen !== null && props.maxLen !== null) {
            if (props.minLen > props.maxLen) {
                throw DomainError.validation('minLen cannot exceed maxLen', 'minLen')
            }
        }
        this.id = props.id
        this.versionId = props.versionId
        this.key = props.key.trim()
        this.label = props.label.trim()
        this.fieldType = props.fieldType
        this.required = props.required ?? false
        this.unit = props.unit ?? null
        this.enumValues = props.enumValues ?? null
        this.pattern = props.pattern ?? null
        this.minValue = props.minValue ?? null
        this.maxValue = props.maxValue ?? null
        this.stepValue = props.stepValue ?? null
        this.minLen = props.minLen ?? null
        this.maxLen = props.maxLen ?? null
        this.defaultValue = props.defaultValue
        this.sortOrder = props.sortOrder ?? 0
        this.isActive = props.isActive ?? true
    }
}
