import { describe, it, expect, vi } from 'vitest'
import { CmdbServiceRepo } from './CmdbServiceRepo.js'
import type { Queryable } from './types.js'

describe('CmdbServiceRepo', () => {
    it('creates services', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'svc-1',
                code: 'PAY',
                name: 'Payments',
                criticality: null,
                owner: null,
                sla: null,
                status: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CmdbServiceRepo(pg)

        const created = await repo.create({ code: 'PAY', name: 'Payments' })
        expect(created.code).toBe('PAY')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cmdb_services'), expect.any(Array))
    })
})
