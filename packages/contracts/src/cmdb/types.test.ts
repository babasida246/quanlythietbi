import { describe, it, expect } from 'vitest'
import type { CiCreateInput } from './types.js'

describe('cmdb contract types', () => {
    it('accepts CI create input', () => {
        const input: CiCreateInput = {
            typeId: 'type-1',
            name: 'CI 1',
            ciCode: 'CI-001'
        }
        expect(input.ciCode).toBe('CI-001')
    })
})
