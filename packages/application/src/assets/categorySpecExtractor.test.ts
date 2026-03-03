import { describe, it, expect } from 'vitest'
import { applyComputedSpec } from './categorySpecExtractor.js'
import type { CategorySpecDefRecord } from '@qltb/contracts'

describe('category spec extractor', () => {
    it('fills ram spec from model name', () => {
        const defs: CategorySpecDefRecord[] = [
            {
                id: 'def-1',
                versionId: 'ver-1',
                key: 'memoryType',
                label: 'Memory Type',
                fieldType: 'enum',
                required: false,
                enumValues: ['DDR4'],
                sortOrder: 1,
                isActive: true,
                isReadonly: true,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'def-2',
                versionId: 'ver-1',
                key: 'memorySizeGb',
                label: 'Memory Size',
                fieldType: 'number',
                required: false,
                sortOrder: 2,
                isActive: true,
                isReadonly: true,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]

        const spec = applyComputedSpec('DDR4 16GB 3200MHz', defs, {})
        expect(spec.memoryType).toBe('DDR4')
        expect(spec.memorySizeGb).toBe(16)
    })
})
