import { describe, it, expect, vi } from 'vitest'
import { RepairOrderRepo } from './RepairOrderRepo.js'
import type { Queryable } from './types.js'

describe('RepairOrderRepo', () => {
    it('creates repair orders with generated code', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'repair-1',
                asset_id: 'asset-1',
                ci_id: null,
                code: 'RO-2025-000001',
                title: 'Fix',
                description: null,
                severity: 'low',
                status: 'open',
                opened_at: new Date(),
                closed_at: null,
                diagnosis: null,
                resolution: null,
                repair_type: 'internal',
                technician_name: null,
                vendor_id: null,
                labor_cost: '0',
                parts_cost: '0',
                downtime_minutes: null,
                created_by: 'user-1',
                correlation_id: null,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new RepairOrderRepo(pg)

        const created = await repo.create({ assetId: 'asset-1', title: 'Fix', severity: 'low', repairType: 'internal' })
        expect(created.code).toMatch(/^RO-/)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH next_code'), expect.any(Array))
    })

    it('lists repair orders with pagination', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as Queryable
        const repo = new RepairOrderRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'repair-2',
                    asset_id: 'asset-1',
                    ci_id: null,
                    code: 'RO-2025-000002',
                    title: 'Repair',
                    description: null,
                    severity: 'medium',
                    status: 'open',
                    opened_at: new Date(),
                    closed_at: null,
                    diagnosis: null,
                    resolution: null,
                    repair_type: 'internal',
                    technician_name: null,
                    vendor_id: null,
                    labor_cost: '0',
                    parts_cost: '0',
                    downtime_minutes: null,
                    created_by: null,
                    correlation_id: null,
                    created_at: new Date(),
                    updated_at: new Date()
                }]
            })

        const result = await repo.list({})
        expect(result.total).toBe(1)
        expect(result.items[0]?.status).toBe('open')
    })
})
