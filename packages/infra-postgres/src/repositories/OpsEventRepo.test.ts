import { describe, it, expect, vi } from 'vitest'
import { OpsEventRepo } from './OpsEventRepo.js'
import type { PgClient } from '../PgClient.js'

describe('OpsEventRepo', () => {
    it('appends ops events', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new OpsEventRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'evt-1',
                entity_type: 'asset_category',
                entity_id: 'cat-1',
                event_type: 'SPEC_VERSION_CREATED',
                payload: {},
                actor_user_id: 'user-1',
                correlation_id: 'corr-1',
                created_at: new Date()
            }]
        })

        const created = await repo.append({
            entityType: 'asset_category',
            entityId: 'cat-1',
            eventType: 'SPEC_VERSION_CREATED',
            payload: {},
            actorUserId: 'user-1',
            correlationId: 'corr-1'
        })
        expect(created.id).toBe('evt-1')
    })
})
