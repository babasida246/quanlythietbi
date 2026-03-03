import { describe, it, expect, vi } from 'vitest'
import { SparePartRepo } from './SparePartRepo.js'
import type { PgClient } from '../PgClient.js'

describe('SparePartRepo', () => {
    it('lists spare parts with pagination', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new SparePartRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'part-1',
                    part_code: 'P-001',
                    name: 'SSD',
                    category: null,
                    uom: 'pcs',
                    manufacturer: null,
                    model: null,
                    spec: {},
                    min_level: 0,
                    created_at: new Date()
                }]
            })

        const result = await repo.list({ q: 'SSD' })
        expect(result.total).toBe(1)
        expect(result.items[0]?.partCode).toBe('P-001')
    })

    it('creates spare part', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'part-2',
                part_code: 'P-002',
                name: 'RAM',
                category: null,
                uom: 'pcs',
                manufacturer: null,
                model: null,
                spec: {},
                min_level: 1,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as PgClient
        const repo = new SparePartRepo(pg)

        const created = await repo.create({ partCode: 'P-002', name: 'RAM', minLevel: 1 })
        expect(created.minLevel).toBe(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO spare_parts'), expect.any(Array))
    })
})
