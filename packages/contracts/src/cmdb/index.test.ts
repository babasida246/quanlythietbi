import { describe, it, expect } from 'vitest'
import type { CiTypeRecord } from './index.js'

describe('cmdb contracts index', () => {
    it('re-exports cmdb types', () => {
        const record: CiTypeRecord = {
            id: 'type-1',
            code: 'APP',
            name: 'Application',
            createdAt: new Date()
        }
        expect(record.code).toBe('APP')
    })
})
