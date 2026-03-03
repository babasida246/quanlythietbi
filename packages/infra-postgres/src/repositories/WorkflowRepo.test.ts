import { describe, it, expect, vi } from 'vitest'
import { WorkflowRepo } from './WorkflowRepo.js'
import type { PgClient } from '../PgClient.js'

describe('WorkflowRepo', () => {
    it('submits workflow requests', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new WorkflowRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'req-1',
                request_type: 'move',
                asset_id: 'asset-1',
                from_dept: null,
                to_dept: null,
                requested_by: 'u1',
                approved_by: null,
                status: 'submitted',
                payload: {},
                created_at: new Date(),
                updated_at: new Date(),
                correlation_id: 'c1'
            }]
        })

        const request = await repo.submit({ requestType: 'move', assetId: 'asset-1', requestedBy: 'u1', correlationId: 'c1' })
        expect(request.status).toBe('submitted')
        expect(query).toHaveBeenCalled()
    })
})
