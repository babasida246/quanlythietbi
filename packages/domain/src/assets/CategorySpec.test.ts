import { describe, it, expect } from 'vitest'
import {
    CategorySpecDef,
    assertEnumValues,
    assertLengthBounds,
    assertNumericBounds,
    assertPattern,
    assertPrecisionScale,
    assertSpecKey
} from './CategorySpec.js'

describe('CategorySpecDef', () => {
    it('rejects invalid spec key', () => {
        expect(() => assertSpecKey('1invalid')).toThrow('Spec key must be camelCase')
    })

    it('requires enum values for enum type', () => {
        expect(() => assertEnumValues('enum', [])).toThrow('Enum values required')
    })

    it('rejects invalid numeric bounds', () => {
        expect(() => assertNumericBounds(10, 5)).toThrow('Min value must be less than or equal to max value')
    })

    it('rejects invalid length bounds', () => {
        expect(() => assertLengthBounds(10, 2)).toThrow('Min length must be less than or equal to max length')
    })

    it('rejects invalid pattern', () => {
        expect(() => assertPattern('[')).toThrow('Pattern must be a valid regex')
    })

    it('rejects invalid precision/scale', () => {
        expect(() => assertPrecisionScale(2, 3)).toThrow('Scale must be between 0 and precision')
    })

    it('creates a valid spec def', () => {
        const def = new CategorySpecDef({
            id: 'spec-1',
            versionId: 'ver-1',
            key: 'memorySizeGb',
            label: 'Memory Size',
            fieldType: 'number',
            minValue: 1,
            maxValue: 512
        })
        expect(def.key).toBe('memorySizeGb')
        expect(def.required).toBe(false)
    })
})
