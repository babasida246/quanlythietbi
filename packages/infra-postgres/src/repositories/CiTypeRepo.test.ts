import { describe, it, expect, vi } from 'vitest'
import { CiTypeRepo } from './CiTypeRepo.js'
import type { Queryable } from './types.js'

describe('CiTypeRepo', () => {
    it('creates CI types', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'type-1',
                code: 'SERVER',
                name: 'Server',
                description: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CiTypeRepo(pg)

        const created = await repo.create({ code: 'SERVER', name: 'Server' })
        expect(created.code).toBe('SERVER')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cmdb_ci_types'), expect.any(Array))
    })
})
