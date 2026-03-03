import { describe, it, expect } from 'vitest'
import { AssetSortValues } from './index.js'

describe('assets contracts', () => {
    it('exports sort values', () => {
        expect(AssetSortValues).toContain('newest')
        expect(AssetSortValues).toContain('asset_code_asc')
    })
})
