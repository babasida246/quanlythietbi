import { describe, it, expect } from 'vitest'
import { buildImportPreview, getValidImportRows } from './asset-import.js'

describe('asset import helpers', () => {
    it('flags duplicate asset codes', () => {
        const preview = buildImportPreview([
            { assetCode: 'A1', modelId: 'm1' },
            { assetCode: 'A1', modelId: 'm1' }
        ])
        expect(preview.invalidCount).toBe(1)
    })

    it('returns valid rows for commit', () => {
        const preview = buildImportPreview([
            { assetCode: 'A2', modelId: 'm1', status: 'in_stock' }
        ])
        const rows = getValidImportRows(preview)
        expect(rows[0]?.assetCode).toBe('A2')
    })
})
