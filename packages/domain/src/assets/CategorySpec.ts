import { DomainError } from '../core/errors/index.js'

export const SpecFieldTypeValues = [
    'string',
    'number',
    'boolean',
    'enum',
    'date',
    'ip',
    'mac',
    'hostname',
    'cidr',
    'port',
    'regex',
    'json',
    'multi_enum'
] as const
export type SpecFieldType = typeof SpecFieldTypeValues[number]

export const NormalizeModeValues = ['trim', 'upper', 'lower'] as const
export type NormalizeMode = typeof NormalizeModeValues[number]

export interface CategorySpecDefProps {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required?: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder?: number
    isActive?: boolean
    isReadonly?: boolean
    computedExpr?: string | null
    isSearchable?: boolean
    isFilterable?: boolean
    createdAt?: Date
    updatedAt?: Date
}

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/

export function assertSpecKey(key: string): void {
    if (!KEY_PATTERN.test(key)) {
        throw DomainError.validation('Spec key must be camelCase', 'key')
    }
}

export function assertEnumValues(fieldType: SpecFieldType, values?: string[] | null): void {
    if (fieldType === 'enum' || fieldType === 'multi_enum') {
        if (!values || values.length === 0 || values.some((value) => value.trim().length === 0)) {
            throw DomainError.validation('Enum values required', 'enumValues')
        }
        return
    }
    if (values && values.some((value) => value.trim().length === 0)) {
        throw DomainError.validation('Enum values must be non-empty strings', 'enumValues')
    }
}

export function assertNumericBounds(min?: number | null, max?: number | null): void {
    if (min === null || min === undefined || max === null || max === undefined) return
    if (min > max) {
        throw DomainError.validation('Min value must be less than or equal to max value', 'minValue')
    }
}

export function assertLengthBounds(min?: number | null, max?: number | null): void {
    if (min === null || min === undefined || max === null || max === undefined) return
    if (min < 0 || max < 0) {
        throw DomainError.validation('Length bounds must be positive', 'minLen')
    }
    if (min > max) {
        throw DomainError.validation('Min length must be less than or equal to max length', 'minLen')
    }
}

export function assertNumericStep(step?: number | null): void {
    if (step === null || step === undefined) return
    if (step <= 0) {
        throw DomainError.validation('Step value must be positive', 'stepValue')
    }
}

export function assertPrecisionScale(precision?: number | null, scale?: number | null): void {
    if (precision === null || precision === undefined) return
    if (precision <= 0) {
        throw DomainError.validation('Precision must be positive', 'precision')
    }
    if (scale === null || scale === undefined) return
    if (scale < 0 || scale > precision) {
        throw DomainError.validation('Scale must be between 0 and precision', 'scale')
    }
}

export function assertPattern(pattern?: string | null): void {
    if (!pattern) return
    try {
        new RegExp(pattern)
    } catch {
        throw DomainError.validation('Pattern must be a valid regex', 'pattern')
    }
}

export function assertNormalize(mode?: string | null): void {
    if (!mode) return
    if (!NormalizeModeValues.includes(mode as NormalizeMode)) {
        throw DomainError.validation('Normalize must be trim, upper, or lower', 'normalize')
    }
}

export class CategorySpecDef {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder: number
    isActive: boolean
    isReadonly: boolean
    computedExpr?: string | null
    isSearchable: boolean
    isFilterable: boolean
    createdAt: Date
    updatedAt: Date

    constructor(props: CategorySpecDefProps) {
        if (!props.key || !props.label) {
            throw DomainError.validation('Spec key and label required', 'key')
        }
        assertSpecKey(props.key)
        assertEnumValues(props.fieldType, props.enumValues)
        assertPattern(props.pattern)
        assertNormalize(props.normalize ?? null)
        if (['string', 'hostname', 'mac', 'ip', 'cidr', 'regex'].includes(props.fieldType)) {
            assertLengthBounds(props.minLen, props.maxLen)
        }
        if (props.fieldType === 'regex' && !props.pattern) {
            throw DomainError.validation('Regex pattern is required', 'pattern')
        }
        if (props.fieldType === 'number' || props.fieldType === 'port') {
            assertNumericBounds(props.minValue, props.maxValue)
            assertNumericStep(props.stepValue)
            assertPrecisionScale(props.precision, props.scale)
        }
        this.id = props.id
        this.versionId = props.versionId
        this.key = props.key
        this.label = props.label
        this.fieldType = props.fieldType
        this.unit = props.unit ?? null
        this.required = props.required ?? false
        this.enumValues = props.enumValues ?? null
        this.pattern = props.pattern ?? null
        this.minLen = props.minLen ?? null
        this.maxLen = props.maxLen ?? null
        this.minValue = props.minValue ?? null
        this.maxValue = props.maxValue ?? null
        this.stepValue = props.stepValue ?? null
        this.precision = props.precision ?? null
        this.scale = props.scale ?? null
        this.normalize = props.normalize ?? null
        this.defaultValue = props.defaultValue
        this.helpText = props.helpText ?? null
        this.sortOrder = props.sortOrder ?? 0
        this.isActive = props.isActive ?? true
        this.isReadonly = props.isReadonly ?? false
        this.computedExpr = props.computedExpr ?? null
        this.isSearchable = props.isSearchable ?? false
        this.isFilterable = props.isFilterable ?? false
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
    }
}
