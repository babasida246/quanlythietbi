import { describe, it, expect } from 'vitest'
import { normalizeSpecValues } from './categorySpecNormalize.js'
import type { CategorySpecDefRecord } from '@qltb/contracts'

describe('category spec normalization', () => {
    it('normalizes string values', () => {
        const defs: CategorySpecDefRecord[] = [
            {
                id: 'def-1',
                versionId: 'ver-1',
                key: 'hostname',
                label: 'Hostname',
                fieldType: 'hostname',
                required: false,
                normalize: 'lower',
                sortOrder: 1,
                isActive: true,
                isReadonly: false,
                isSearchable: false,
                isFilterable: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]

        const normalized = normalizeSpecValues(defs, { hostname: 'Server-01 ' })
        expect(normalized.hostname).toBe('server-01')
    })
})
