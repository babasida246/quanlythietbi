import { describe, it, expect, vi } from 'vitest'
import { CiSchemaRepo } from './CiSchemaRepo.js'
import type { Queryable } from './types.js'

describe('CiSchemaRepo', () => {
    it('lists defs by version', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'def-1',
                ci_type_version_id: 'v1',
                key: 'ipAddress',
                label: 'IP Address',
                field_type: 'ip',
                required: true,
                unit: null,
                enum_values: null,
                pattern: null,
                min_value: null,
                max_value: null,
                step_value: null,
                min_len: null,
                max_len: null,
                default_value: null,
                is_searchable: false,
                is_filterable: false,
                sort_order: 0,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new CiSchemaRepo(pg)

        const defs = await repo.listByVersion('v1')
        expect(defs[0]?.key).toBe('ipAddress')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM cmdb_ci_type_attr_defs'), expect.any(Array))
    })
})
