import { describe, it, expect } from 'vitest'
import type { ICiRepo } from './repos.js'

describe('cmdb repos contracts', () => {
    it('allows CI repo typing', async () => {
        const repo: ICiRepo = {
            create: async () => ({
                id: 'ci-1',
                typeId: 'type-1',
                name: 'CI',
                ciCode: 'CI-1',
                status: 'active',
                environment: 'prod',
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            update: async () => null,
            getById: async () => null,
            list: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
            getByAssetId: async () => null
        }
        const record = await repo.create({ typeId: 't1', name: 'CI', ciCode: 'CI-1' })
        expect(record.ciCode).toBe('CI-1')
    })
})
