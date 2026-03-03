import { describe, it, expect, vi } from 'vitest'
import { CiRepo } from './CiRepo.js'
import type { Queryable } from './types.js'

describe('CiRepo', () => {
    it('creates CIs', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'ci-1',
                type_id: 'type-1',
                name: 'App 1',
                ci_code: 'APP-1',
                status: 'active',
                environment: 'prod',
                asset_id: null,
                location_id: null,
                owner_team: null,
                notes: null,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CiRepo(pg)

        const created = await repo.create({ typeId: 'type-1', name: 'App 1', ciCode: 'APP-1' })
        expect(created.ciCode).toBe('APP-1')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cmdb_cis'), expect.any(Array))
    })
})
