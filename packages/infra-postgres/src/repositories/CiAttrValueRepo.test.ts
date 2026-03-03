import { describe, it, expect, vi } from 'vitest'
import { CiAttrValueRepo } from './CiAttrValueRepo.js'
import type { Queryable } from './types.js'

describe('CiAttrValueRepo', () => {
    it('upserts attribute values', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'attr-1',
                ci_id: 'ci-1',
                ci_type_version_id: 'v1',
                attribute_key: 'ipAddress',
                value: '10.0.0.1',
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CiAttrValueRepo(pg)

        const result = await repo.upsertMany('ci-1', 'v1', [{ key: 'ipAddress', value: '10.0.0.1' }])
        expect(result).toHaveLength(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cmdb_ci_attribute_values'), expect.any(Array))
    })
})
