import { describe, it, expect, vi } from 'vitest'
import { ReminderRepo } from './ReminderRepo.js'
import type { PgClient } from '../PgClient.js'

describe('ReminderRepo', () => {
    it('lists pending reminders', async () => {
        const query = vi.fn()
        const pg = {
            query,
            transaction: async (fn: (client: PgClient) => Promise<any>) => fn(pg as unknown as PgClient)
        } as unknown as PgClient
        const repo = new ReminderRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'r1',
                reminder_type: 'warranty_expiring',
                asset_id: 'asset-1',
                due_at: new Date(),
                status: 'pending',
                channel: 'ui',
                created_at: new Date(),
                sent_at: null,
                correlation_id: null
            }]
        })

        const reminders = await repo.listPending(10)
        expect(reminders.length).toBe(1)
    })
})
