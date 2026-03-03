import { describe, it, expect, vi } from 'vitest'
import { CategorySpecVersionRepo } from './CategorySpecVersionRepo.js'
import type { PgClient } from '../PgClient.js'

describe('CategorySpecVersionRepo', () => {
    it('lists versions by category', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CategorySpecVersionRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'ver-1',
                category_id: 'cat-1',
                version: 1,
                status: 'active',
                created_by: null,
                created_at: new Date()
            }]
        })

        const versions = await repo.listByCategory('cat-1')
        expect(versions[0]?.status).toBe('active')
        expect(query).toHaveBeenCalled()
    })

    it('creates versions', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CategorySpecVersionRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'ver-2',
                category_id: 'cat-1',
                version: 2,
                status: 'draft',
                created_by: 'admin',
                created_at: new Date()
            }]
        })

        const created = await repo.create('cat-1', 2, 'draft', 'admin')
        expect(created.version).toBe(2)
    })
})
