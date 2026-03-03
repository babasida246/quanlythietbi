import { describe, it, expect } from 'vitest'
import { AssetAssignment, assertSingleActiveAssignment } from './Assignment.js'
import { DomainError } from '../core/errors/index.js'

describe('AssetAssignment', () => {
    it('requires assignee id', () => {
        expect(() => new AssetAssignment({
            id: 'a1',
            assetId: 'asset-1',
            assigneeType: 'person',
            assigneeId: '',
            assigneeName: 'Alice'
        })).toThrow(DomainError)
    })

    it('enforces single active assignment', () => {
        expect(() => assertSingleActiveAssignment([
            { returnedAt: null },
            { returnedAt: null }
        ])).toThrow(DomainError)
        expect(() => assertSingleActiveAssignment([{ returnedAt: null }])).not.toThrow()
    })
})
