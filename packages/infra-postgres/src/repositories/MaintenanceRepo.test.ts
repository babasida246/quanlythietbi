import { describe, it, expect, vi } from 'vitest'
import { MaintenanceRepo } from './MaintenanceRepo.js'
import type { PgClient } from '../PgClient.js'

describe('MaintenanceRepo', () => {
    it('opens maintenance tickets', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new MaintenanceRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'ticket-1',
                asset_id: 'asset-1',
                title: 'Replace fan',
                severity: 'high',
                status: 'open',
                opened_at: new Date(),
                closed_at: null,
                diagnosis: null,
                resolution: null,
                created_by: 'user-1',
                correlation_id: 'corr-1'
            }]
        })

        const ticket = await repo.open({
            assetId: 'asset-1',
            title: 'Replace fan',
            severity: 'high',
            createdBy: 'user-1',
            correlationId: 'corr-1'
        })

        expect(ticket.status).toBe('open')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO maintenance_tickets'), expect.any(Array))
    })

    it('lists maintenance tickets', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new MaintenanceRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'ticket-2',
                    asset_id: 'asset-2',
                    title: 'Disk check',
                    severity: 'low',
                    status: 'open',
                    opened_at: new Date(),
                    closed_at: null,
                    diagnosis: null,
                    resolution: null,
                    created_by: null,
                    correlation_id: null
                }]
            })

        const result = await repo.list({ assetId: 'asset-2' })
        expect(result.total).toBe(1)
        expect(result.items[0]?.title).toBe('Disk check')
    })
})
