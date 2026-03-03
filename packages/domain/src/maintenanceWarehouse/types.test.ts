import { describe, it, expect } from 'vitest'
import {
    assertStockAvailable,
    assertStockDocLines,
    assertTransferTarget,
    assertRepairPartStockLink
} from './types.js'

describe('maintenanceWarehouse domain rules', () => {
    it('requires stock document lines', () => {
        expect(() => assertStockDocLines([])).toThrow('Stock document requires at least one line')
    })

    it('rejects insufficient stock', () => {
        expect(() => assertStockAvailable(2, 1, 2)).toThrow('Insufficient stock available')
    })

    it('requires transfer target', () => {
        expect(() => assertTransferTarget(null)).toThrow('Target warehouse required for transfer')
    })

    it('requires stock document link when warehouse provided', () => {
        expect(() => assertRepairPartStockLink('wh-1', null)).toThrow('Repair part linked to warehouse must have stock document')
    })
})
