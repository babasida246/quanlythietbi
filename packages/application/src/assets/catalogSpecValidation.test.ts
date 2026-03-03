import { describe, it, expect } from 'vitest'
import { validateModelSpec, validateSpecDefInput } from './catalogSpecValidation.js'
import type { CategorySpecDefRecord } from '@qltb/contracts'

describe('catalog spec validation', () => {
    it('rejects invalid spec def input', () => {
        expect(() => validateSpecDefInput({
            key: '1invalid',
            label: 'Invalid',
            fieldType: 'string'
        })).toThrow('Spec key must be camelCase')
    })

    it('rejects missing required spec values', () => {
        const defs: CategorySpecDefRecord[] = [{
            id: 'spec-1',
            versionId: 'ver-1',
            key: 'capacityGb',
            label: 'Capacity',
            fieldType: 'number',
            unit: 'GB',
            required: true,
            enumValues: null,
            pattern: null,
            minLen: null,
            maxLen: null,
            minValue: 1,
            maxValue: 100,
            stepValue: 1,
            precision: null,
            scale: null,
            normalize: null,
            defaultValue: null,
            helpText: null,
            sortOrder: 0,
            isActive: true,
            isReadonly: false,
            computedExpr: null,
            isSearchable: false,
            isFilterable: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }]
        expect(() => validateModelSpec(defs, {})).toThrow('Invalid model spec')
    })

    it('validates advanced field types', () => {
        const defs: CategorySpecDefRecord[] = [
            {
                id: 'spec-ip',
                versionId: 'ver-1',
                key: 'ipAddr',
                label: 'IP',
                fieldType: 'ip',
                unit: null,
                required: false,
                enumValues: null,
                pattern: null,
                minLen: null,
                maxLen: null,
                minValue: null,
                maxValue: null,
                stepValue: null,
                precision: null,
                scale: null,
                normalize: null,
                defaultValue: null,
                helpText: null,
                sortOrder: 0,
                isActive: true,
                isReadonly: false,
                computedExpr: null,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'spec-mac',
                versionId: 'ver-1',
                key: 'macAddr',
                label: 'MAC',
                fieldType: 'mac',
                unit: null,
                required: false,
                enumValues: null,
                pattern: null,
                minLen: null,
                maxLen: null,
                minValue: null,
                maxValue: null,
                stepValue: null,
                precision: null,
                scale: null,
                normalize: null,
                defaultValue: null,
                helpText: null,
                sortOrder: 1,
                isActive: true,
                isReadonly: false,
                computedExpr: null,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'spec-multi',
                versionId: 'ver-1',
                key: 'modes',
                label: 'Modes',
                fieldType: 'multi_enum',
                unit: null,
                required: false,
                enumValues: ['A', 'B'],
                pattern: null,
                minLen: null,
                maxLen: null,
                minValue: null,
                maxValue: null,
                stepValue: null,
                precision: null,
                scale: null,
                normalize: null,
                defaultValue: null,
                helpText: null,
                sortOrder: 2,
                isActive: true,
                isReadonly: false,
                computedExpr: null,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'spec-json',
                versionId: 'ver-1',
                key: 'meta',
                label: 'Meta',
                fieldType: 'json',
                unit: null,
                required: false,
                enumValues: null,
                pattern: null,
                minLen: null,
                maxLen: null,
                minValue: null,
                maxValue: null,
                stepValue: null,
                precision: null,
                scale: null,
                normalize: null,
                defaultValue: null,
                helpText: null,
                sortOrder: 3,
                isActive: true,
                isReadonly: false,
                computedExpr: null,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]

        expect(() => validateModelSpec(defs, {
            ipAddr: '192.168.1.10',
            macAddr: 'AA:BB:CC:DD:EE:FF',
            modes: ['A'],
            meta: { key: 'value' }
        })).not.toThrow()

        expect(() => validateModelSpec(defs, {
            ipAddr: '999.999.1.1'
        })).toThrow('Invalid model spec')
    })
})
