import { describe, it, expect } from 'vitest'
import { assetImportPreviewSchema } from './assets.import.schemas.js'

describe('assets import schemas', () => {
    it('parses import preview payloads', () => {
        const result = assetImportPreviewSchema.parse({
            rows: [{
                assetCode: 'ASSET-1',
                modelId: '123e4567-e89b-12d3-a456-426614174000',
                status: 'in_stock'
            }]
        })

        expect(result.rows).toHaveLength(1)
    })
})
