import { describe, it, expect, vi } from 'vitest'
import { AssetEventRepo } from './AssetEventRepo.js'
import type { PgClient } from '../PgClient.js'

describe('AssetEventRepo', () => {
    it('appends events', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssetEventRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'event-1',
                asset_id: 'asset-1',
                event_type: 'CREATED',
                payload: { status: 'in_stock' },
                actor_user_id: 'user-1',
                correlation_id: 'corr-1',
                created_at: new Date()
            }]
        })

        const event = await repo.append({
            assetId: 'asset-1',
            eventType: 'CREATED',
            payload: { status: 'in_stock' },
            actorUserId: 'user-1',
            correlationId: 'corr-1'
        })

        expect(event.eventType).toBe('CREATED')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO asset_events'), expect.any(Array))
    })

    it('lists events by asset', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssetEventRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'event-2',
                asset_id: 'asset-2',
                event_type: 'UPDATED',
                payload: {},
                actor_user_id: null,
                correlation_id: null,
                created_at: new Date()
            }]
        })

        const result = await repo.listByAsset('asset-2', 1, 10)
        expect(result.items).toHaveLength(1)
        expect(result.items[0]?.eventType).toBe('UPDATED')
    })
})
