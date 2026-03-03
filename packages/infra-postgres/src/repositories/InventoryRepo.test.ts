import { describe, it, expect, vi } from 'vitest'
import { InventoryRepo } from './InventoryRepo.js'
import type { PgClient } from '../PgClient.js'

describe('InventoryRepo', () => {
    it('creates inventory sessions', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new InventoryRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'session-1',
                name: 'Cycle 1',
                location_id: null,
                status: 'draft',
                started_at: null,
                closed_at: null,
                created_by: 'u1',
                correlation_id: 'c1',
                created_at: new Date()
            }]
        })

        const session = await repo.createSession({ name: 'Cycle 1', createdBy: 'u1', correlationId: 'c1' })
        expect(session.name).toBe('Cycle 1')
        expect(query).toHaveBeenCalled()
    })
})
