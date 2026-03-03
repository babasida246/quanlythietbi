import { describe, it, expect } from 'vitest'
import {
    Asset,
    AssetAssignment,
    MaintenanceTicket,
    assertAssetCode,
    assertStatusTransition,
    assertVlanId
} from './Asset.js'
import { DomainError } from '../core/errors/index.js'

describe('Asset domain', () => {
    it('rejects empty asset codes', () => {
        expect(() => assertAssetCode('')).toThrow(DomainError)
        expect(() => new Asset({ id: 'a1', assetCode: '   ', modelId: 'm1' })).toThrow(DomainError)
    })

    it('allows valid status transitions', () => {
        const asset = new Asset({ id: 'a1', assetCode: 'ASSET-1', modelId: 'm1', status: 'in_stock' })
        asset.changeStatus('in_use')
        expect(asset.status).toBe('in_use')
    })

    it('rejects invalid status transitions', () => {
        expect(() => assertStatusTransition('disposed', 'in_stock')).toThrow(DomainError)
    })

    it('constructs assignment and maintenance entities', () => {
        const assignment = new AssetAssignment({
            id: 'assign-1',
            assetId: 'asset-1',
            assigneeType: 'person',
            assigneeId: 'u-1',
            assigneeName: 'Alice'
        })
        expect(assignment.assigneeName).toBe('Alice')

        const ticket = new MaintenanceTicket({
            id: 'maint-1',
            assetId: 'asset-1',
            title: 'Disk check',
            severity: 'low',
            status: 'open'
        })
        expect(ticket.title).toBe('Disk check')
    })

    it('validates vlan id range', () => {
        expect(() => assertVlanId(0)).toThrow(DomainError)
        expect(() => assertVlanId(4095)).toThrow(DomainError)
        expect(() => assertVlanId(100)).not.toThrow()
    })
})
