import { describe, it, expect } from 'vitest'
import { specDefCreateSchema } from './category-specs.schemas.js'

describe('category spec schemas', () => {
    it('accepts valid spec def', () => {
        const result = specDefCreateSchema.parse({
            key: 'memorySizeGb',
            label: 'Memory Size',
            fieldType: 'number',
            minValue: 1,
            maxValue: 512
        })
        expect(result.key).toBe('memorySizeGb')
    })

    it('rejects invalid key', () => {
        expect(() => specDefCreateSchema.parse({
            key: '1invalid',
            label: 'Invalid',
            fieldType: 'string'
        })).toThrow()
    })
})
