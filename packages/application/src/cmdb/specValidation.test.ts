import { describe, it, expect } from 'vitest'
import { validateAttrDefInput, validateCiAttributes } from './specValidation.js'
import type { CiAttrDefRecord } from '@qltb/contracts'

describe('cmdb spec validation', () => {
    it('validates attr def inputs', () => {
        expect(() => validateAttrDefInput({
            key: 'ipAddress',
            label: 'IP Address',
            fieldType: 'ip'
        })).not.toThrow()
        expect(() => validateAttrDefInput({
            key: 'roles',
            label: 'Roles',
            fieldType: 'enum'
        })).toThrow()
    })

    it('validates attribute values', () => {
        const defs: CiAttrDefRecord[] = [{
            id: 'd1',
            versionId: 'v1',
            key: 'ipAddress',
            label: 'IP Address',
            fieldType: 'ip',
            required: true,
            unit: null,
            enumValues: null,
            pattern: null,
            minValue: null,
            maxValue: null,
            stepValue: null,
            minLen: null,
            maxLen: null,
            defaultValue: null,
            isSearchable: false,
            isFilterable: false,
            sortOrder: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }]
        expect(() => validateCiAttributes(defs, { ipAddress: '10.0.0.1' })).not.toThrow()
        expect(() => validateCiAttributes(defs, { ipAddress: '999.1.1.1' })).toThrow()
    })
})
