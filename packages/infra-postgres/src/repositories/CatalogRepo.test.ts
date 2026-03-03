import { describe, it, expect, vi } from 'vitest'
import { CatalogRepo } from './CatalogRepo.js'
import type { PgClient } from '../PgClient.js'

describe('CatalogRepo', () => {
    it('lists vendors', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CatalogRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'v1',
                name: 'Vendor',
                tax_code: null,
                phone: null,
                email: null,
                address: null,
                created_at: new Date()
            }]
        })

        const vendors = await repo.listVendors()
        expect(vendors[0]?.name).toBe('Vendor')
        expect(query).toHaveBeenCalled()
    })

    it('creates categories', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CatalogRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'c1',
                name: 'Servers',
                created_at: new Date()
            }]
        })

        const category = await repo.createCategory({ name: 'Servers' })
        expect(category.id).toBe('c1')
        expect(category.name).toBe('Servers')
        expect(query).toHaveBeenCalled()
    })
})
