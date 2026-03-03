import { describe, it, expect, vi } from 'vitest'
import { CategorySpecRepo } from './CategorySpecRepo.js'
import type { PgClient } from '../PgClient.js'

describe('CategorySpecRepo', () => {
    it('lists spec defs by category', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CategorySpecRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'spec-1',
                spec_version_id: 'ver-1',
                key: 'memorySizeGb',
                label: 'Memory Size',
                field_type: 'number',
                unit: 'GB',
                required: true,
                enum_values: null,
                pattern: null,
                min_len: null,
                max_len: null,
                min_value: 1,
                max_value: 256,
                step_value: 1,
                precision: null,
                scale: null,
                normalize: null,
                default_value: null,
                help_text: null,
                sort_order: 0,
                is_active: true,
                is_readonly: false,
                computed_expr: null,
                is_searchable: false,
                is_filterable: false,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })

        const defs = await repo.listByCategory('cat-1')
        expect(defs[0]?.key).toBe('memorySizeGb')
        expect(query).toHaveBeenCalled()
    })

    it('creates spec defs', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new CategorySpecRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'spec-2',
                spec_version_id: 'ver-1',
                key: 'memoryType',
                label: 'Memory Type',
                field_type: 'enum',
                unit: null,
                required: false,
                enum_values: ['DDR4'],
                pattern: null,
                min_len: null,
                max_len: null,
                min_value: null,
                max_value: null,
                step_value: null,
                precision: null,
                scale: null,
                normalize: null,
                default_value: null,
                help_text: null,
                sort_order: 1,
                is_active: true,
                is_readonly: false,
                computed_expr: null,
                is_searchable: false,
                is_filterable: false,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })

        const created = await repo.create({
            versionId: 'ver-1',
            key: 'memoryType',
            label: 'Memory Type',
            fieldType: 'enum',
            enumValues: ['DDR4']
        })
        expect(created.id).toBe('spec-2')
    })

    it('soft deletes spec defs', async () => {
        const query = vi.fn().mockResolvedValue({ rowCount: 1 })
        const pg = { query } as unknown as PgClient
        const repo = new CategorySpecRepo(pg)

        const result = await repo.softDelete('spec-1')
        expect(result).toBe(true)
    })
})
