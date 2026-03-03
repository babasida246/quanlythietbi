import { describe, it, expect, vi } from 'vitest'
import { WarehouseUnitOfWork } from './WarehouseUnitOfWork.js'
import type { PgClient } from '../PgClient.js'

describe('WarehouseUnitOfWork', () => {
    it('wraps operations in a transaction', async () => {
        const transaction = vi.fn(async (handler: (client: { query: typeof vi.fn }) => Promise<string>) => {
            return await handler({ query: vi.fn() })
        })
        const pg = { transaction } as unknown as PgClient
        const uow = new WarehouseUnitOfWork(pg, false)

        const result = await uow.withTransaction(async (ctx) => {
            expect(ctx.documents).toBeTruthy()
            expect(ctx.stock).toBeTruthy()
            return 'ok'
        })

        expect(result).toBe('ok')
        expect(transaction).toHaveBeenCalledTimes(1)
    })
})
