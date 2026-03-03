import {
    AppError,
    assertEnumValues,
    assertLengthBounds,
    assertNumericBounds,
    assertNumericStep,
    assertPattern,
    assertSpecKey,
    type CmdbFieldType
} from '@qltb/domain'
import type { CiAttrDefInput, CiAttrDefRecord, CiAttrDefUpdatePatch } from '@qltb/contracts'

const stringTypes: CmdbFieldType[] = ['string', 'hostname', 'mac', 'ip', 'cidr', 'regex']
const numberTypes: CmdbFieldType[] = ['number', 'port']

export function validateAttrDefInput(input: CiAttrDefInput): void {
    if (!input.key || !input.label || !input.fieldType) {
        throw AppError.badRequest('Spec key, label, and field type are required')
    }
    assertSpecKey(input.key)
    validateAttrDefConstraints(input)
}

export function validateAttrDefPatch(patch: CiAttrDefUpdatePatch): void {
    if (patch.key) {
        assertSpecKey(patch.key)
    }
    if (patch.fieldType) {
        validateAttrDefConstraints(patch)
        return
    }
    if (patch.enumValues) {
        assertEnumValues('enum', patch.enumValues)
    }
    if (patch.minValue !== undefined || patch.maxValue !== undefined) {
        assertNumericBounds(patch.minValue ?? null, patch.maxValue ?? null)
    }
    if (patch.stepValue !== undefined) {
        assertNumericStep(patch.stepValue ?? null)
    }
    if (patch.minLen !== undefined || patch.maxLen !== undefined) {
        assertLengthBounds(patch.minLen ?? null, patch.maxLen ?? null)
    }
    if (patch.pattern !== undefined) {
        assertPattern(patch.pattern ?? null)
    }
}

export function validateCiAttributes(
    defs: CiAttrDefRecord[],
    attributes: Record<string, unknown> | null | undefined
): void {
    if (defs.length === 0) return
    const payload = attributes ?? {}
    const errors: Array<{ key: string; message: string }> = []

    for (const def of defs) {
        const value = payload[def.key]
        if ((value === undefined || value === null || value === '') && def.required) {
            errors.push({ key: def.key, message: 'Required field' })
            continue
        }
        if (value === undefined || value === null || value === '') continue
        const typeError = validateValue(def, value)
        if (typeError) errors.push({ key: def.key, message: typeError })
    }

    if (errors.length > 0) {
        throw AppError.badRequest('Invalid CI attributes', { errors })
    }
}

function validateAttrDefConstraints(input: CiAttrDefInput | CiAttrDefUpdatePatch): void {
    const fieldType = input.fieldType ?? 'string'
    assertEnumValues(fieldType, input.enumValues)
    assertPattern(input.pattern ?? null)

    if (fieldType === 'regex' && !input.pattern) {
        throw AppError.badRequest('Pattern is required for regex fields')
    }
    if ((input.minLen !== undefined || input.maxLen !== undefined) && !stringTypes.includes(fieldType)) {
        throw AppError.badRequest('Length constraints only apply to string fields')
    }
    if ((input.pattern !== undefined) && !stringTypes.includes(fieldType)) {
        throw AppError.badRequest('Pattern only applies to string fields')
    }

    if (numberTypes.includes(fieldType)) {
        assertNumericBounds(input.minValue ?? null, input.maxValue ?? null)
        assertNumericStep(input.stepValue ?? null)
    }

    if (stringTypes.includes(fieldType)) {
        assertLengthBounds(input.minLen ?? null, input.maxLen ?? null)
    }
}

function validateValue(def: CiAttrDefRecord, value: unknown): string | null {
    switch (def.fieldType) {
        case 'string':
            return validateString(def, value)
        case 'number':
            return validateNumber(def, value)
        case 'boolean':
            return typeof value === 'boolean' ? null : 'Must be a boolean'
        case 'enum':
            if (typeof value !== 'string') return 'Must be a string'
            if (def.enumValues && !def.enumValues.includes(value)) return 'Invalid value'
            return null
        case 'multi_enum':
            if (!Array.isArray(value)) return 'Must be a list'
            if (!value.every((item) => typeof item === 'string')) return 'Must be a list of strings'
            if (def.enumValues && value.some((item) => !def.enumValues?.includes(item))) return 'Invalid value'
            return null
        case 'date':
            if (typeof value !== 'string') return 'Must be a date string'
            return Number.isNaN(Date.parse(value)) ? 'Invalid date' : null
        case 'ip':
            return validateIp(def, value)
        case 'mac':
            return validateMac(def, value)
        case 'hostname':
            return validateHostname(def, value)
        case 'cidr':
            return validateCidr(def, value)
        case 'port':
            return validatePort(def, value)
        case 'regex':
            return validateRegex(def, value)
        case 'json':
            return validateJson(value)
        default:
            return 'Unsupported field type'
    }
}

function validateString(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    return validateStringConstraints(def, value)
}

function validateNumber(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Must be a number'
    if (def.minValue !== null && def.minValue !== undefined && value < def.minValue) return 'Value below minimum'
    if (def.maxValue !== null && def.maxValue !== undefined && value > def.maxValue) return 'Value above maximum'
    return null
}

function validateIp(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    if (!isValidIpv4(value)) return 'Invalid IP'
    return validateStringConstraints(def, value)
}

function validateMac(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    if (!/^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(value)) return 'Invalid MAC'
    return validateStringConstraints(def, value)
}

function validateHostname(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    if (value.length > 253) return 'Invalid hostname'
    const labels = value.split('.')
    for (const label of labels) {
        if (!label.length || label.length > 63) return 'Invalid hostname'
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) return 'Invalid hostname'
    }
    return validateStringConstraints(def, value)
}

function validateCidr(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    const [ip, prefix] = value.split('/')
    if (!prefix || !isValidIpv4(ip)) return 'Invalid CIDR'
    const num = Number(prefix)
    if (!Number.isInteger(num) || num < 0 || num > 32) return 'Invalid CIDR'
    return validateStringConstraints(def, value)
}

function validatePort(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Must be a number'
    if (!Number.isInteger(value)) return 'Must be an integer'
    const min = def.minValue ?? 1
    const max = def.maxValue ?? 65535
    if (value < min || value > max) return 'Invalid port'
    return null
}

function validateRegex(def: CiAttrDefRecord, value: unknown): string | null {
    if (typeof value !== 'string') return 'Must be a string'
    if (!def.pattern) return 'Pattern is required'
    try {
        const regex = new RegExp(def.pattern)
        if (!regex.test(value)) return 'Value does not match pattern'
        return validateStringConstraints(def, value)
    } catch {
        return 'Invalid pattern'
    }
}

function validateJson(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) return 'Must be a JSON object'
    return null
}

function validateStringConstraints(def: CiAttrDefRecord, value: string): string | null {
    if (def.minLen !== null && def.minLen !== undefined && value.length < def.minLen) return 'Value too short'
    if (def.maxLen !== null && def.maxLen !== undefined && value.length > def.maxLen) return 'Value too long'
    if (def.pattern) {
        try {
            const regex = new RegExp(def.pattern)
            if (!regex.test(value)) return 'Value does not match pattern'
        } catch {
            return 'Invalid pattern'
        }
    }
    return null
}

function isValidIpv4(value: string): boolean {
    const parts = value.split('.')
    if (parts.length !== 4) return false
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return false
        const num = Number(part)
        if (num < 0 || num > 255) return false
    }
    return true
}
