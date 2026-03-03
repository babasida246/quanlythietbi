import { describe, it, expect, vi } from 'vitest'
import { AssignmentRepo } from './AssignmentRepo.js'
import type { PgClient } from '../PgClient.js'

describe('AssignmentRepo', () => {
    it('assigns assets', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssignmentRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'assign-1',
                asset_id: 'asset-1',
                assignee_type: 'person',
                assignee_id: 'user-1',
                assignee_name: 'User 1',
                assigned_at: new Date(),
                returned_at: null,
                note: null
            }]
        })

        const assignment = await repo.assign('asset-1', {
            assigneeType: 'person',
            assigneeId: 'user-1',
            assigneeName: 'User 1'
        })

        expect(assignment.assetId).toBe('asset-1')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO asset_assignments'), expect.any(Array))
    })

    it('returns active assignment', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssignmentRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'assign-2',
                asset_id: 'asset-2',
                assignee_type: 'department',
                assignee_id: 'dept-1',
                assignee_name: 'IT',
                assigned_at: new Date(),
                returned_at: null,
                note: null
            }]
        })

        const active = await repo.getActiveByAsset('asset-2')
        expect(active?.assigneeName).toBe('IT')
    })
})
