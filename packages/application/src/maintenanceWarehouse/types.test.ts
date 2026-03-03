import { describe, it, expect } from 'vitest'
import type { MaintenanceWarehouseContext } from './types.js'

describe('maintenanceWarehouse context types', () => {
    it('accepts user and correlation identifiers', () => {
        const ctx: MaintenanceWarehouseContext = { userId: 'user-1', correlationId: 'corr-1' }
        expect(ctx.userId).toBe('user-1')
    })
})
