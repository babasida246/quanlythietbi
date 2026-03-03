import { describe, it, expect, vi } from 'vitest'
import { CiTypeVersionRepo } from './CiTypeVersionRepo.js'
import type { Queryable } from './types.js'

describe('CiTypeVersionRepo', () => {
    it('lists versions by type', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'v1',
                type_id: 'type-1',
                version: 1,
                status: 'active',
                created_by: 'user-1',
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CiTypeVersionRepo(pg)

        const versions = await repo.listByType('type-1')
        expect(versions).toHaveLength(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM cmdb_ci_type_versions'), expect.any(Array))
    })
})
