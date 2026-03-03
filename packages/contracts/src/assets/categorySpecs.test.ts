import { describe, it, expect } from 'vitest'
import type { CategorySpecDefInput } from './categorySpecs.js'

describe('category spec contracts', () => {
    it('allows spec def input typing', () => {
        const input: CategorySpecDefInput = {
            key: 'memorySizeGb',
            label: 'Memory Size',
            fieldType: 'number'
        }
        expect(input.key).toBe('memorySizeGb')
    })
})
