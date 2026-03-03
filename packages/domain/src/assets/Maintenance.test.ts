import { describe, it, expect } from 'vitest'
import { MaintenanceTicket } from './Maintenance.js'
import { DomainError } from '../core/errors/index.js'

describe('MaintenanceTicket', () => {
    it('requires title', () => {
        expect(() => new MaintenanceTicket({
            id: 't1',
            assetId: 'asset-1',
            title: '',
            severity: 'low',
            status: 'open'
        })).toThrow(DomainError)
    })
})
