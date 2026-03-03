import { describe, it, expect, vi } from 'vitest'
import { WarehouseRepo } from './WarehouseRepo.js'
import type { PgClient } from '../PgClient.js'

describe('WarehouseRepo', () => {
    it('lists warehouses', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'wh-1',
                code: 'WH-01',
                name: 'Main',
                location_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as PgClient
        const repo = new WarehouseRepo(pg)

        const result = await repo.list()
        expect(result).toHaveLength(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM warehouses'))
    })

    it('creates a warehouse', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'wh-2',
                code: 'WH-02',
                name: 'Secondary',
                location_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as PgClient
        const repo = new WarehouseRepo(pg)

        const created = await repo.create({ code: 'WH-02', name: 'Secondary' })
        expect(created.code).toBe('WH-02')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO warehouses'), expect.any(Array))
    })
})
