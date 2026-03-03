import { describe, it, expect } from 'vitest'
import { normalizePagination, resolveSort } from './asset-queries.js'

describe('asset query helpers', () => {
    it('normalizes pagination defaults', () => {
        const result = normalizePagination({})
        expect(result.page).toBe(1)
        expect(result.limit).toBe(20)
    })

    it('resolves sort order', () => {
        expect(resolveSort('asset_code_desc')).toContain('asset_code')
        expect(resolveSort(undefined)).toContain('created_at')
    })
})
