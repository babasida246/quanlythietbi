import { describe, it, expect, vi } from 'vitest'
import { MovementRepo } from './MovementRepo.js'
import type { Queryable } from './types.js'

describe('MovementRepo', () => {
    it('adds movement rows in bulk', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'mv-1',
                warehouse_id: 'wh-1',
                part_id: 'part-1',
                movement_type: 'in',
                qty: 2,
                unit_cost: '10.5',
                ref_type: null,
                ref_id: null,
                actor_user_id: null,
                correlation_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new MovementRepo(pg)

        const rows = await repo.addMany([{ warehouseId: 'wh-1', partId: 'part-1', movementType: 'in', qty: 2 }])
        expect(rows[0]?.unitCost).toBeCloseTo(10.5)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO spare_part_movements'), expect.any(Array))
    })

    it('lists movements with pagination', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as Queryable
        const repo = new MovementRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'mv-2',
                    warehouse_id: 'wh-1',
                    part_id: 'part-1',
                    movement_type: 'out',
                    qty: 1,
                    unit_cost: null,
                    ref_type: null,
                    ref_id: null,
                    actor_user_id: null,
                    correlation_id: null,
                    created_at: new Date()
                }]
            })

        const result = await repo.list({})
        expect(result.total).toBe(1)
        expect(result.items[0]?.movementType).toBe('out')
    })
})
