import { describe, it, expect } from 'vitest'
import { inventoryScanSchema } from './inventory.schemas.js'

describe('inventory schemas', () => {
    it('accepts scan payload with assetCode', () => {
        const result = inventoryScanSchema.parse({ assetCode: 'ASSET-1' })
        expect(result.assetCode).toBe('ASSET-1')
    })
})
