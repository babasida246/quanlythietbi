import { describe, it, expect } from 'vitest'
import { assetCreateSchema, assetSearchSchema, maintenanceOpenSchema } from './assets.schemas.js'

describe('assets schemas', () => {
    it('parses asset create payloads', () => {
        const result = assetCreateSchema.parse({
            assetCode: 'ASSET-1',
            modelId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'in_stock'
        })
        expect(result.assetCode).toBe('ASSET-1')
    })

    it('coerces pagination fields', () => {
        const result = assetSearchSchema.parse({ page: '2', limit: '10' })
        expect(result.page).toBe(2)
        expect(result.limit).toBe(10)
    })

    it('validates maintenance open payloads', () => {
        const result = maintenanceOpenSchema.parse({ assetId: '123e4567-e89b-12d3-a456-426614174000', title: 'Check', severity: 'low' })
        expect(result.severity).toBe('low')
    })
})
