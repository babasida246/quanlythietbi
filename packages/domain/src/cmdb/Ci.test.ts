import { describe, it, expect } from 'vitest'
import { Ci, CiAttrValue } from './Ci.js'

describe('CI entities', () => {
    it('validates ciCode format', () => {
        const ci = new Ci({
            id: 'ci-1',
            typeId: 'type-1',
            name: 'Server 1',
            ciCode: 'SRV-01',
            status: 'active',
            environment: 'prod'
        })
        expect(ci.ciCode).toBe('SRV-01')
        expect(() => new Ci({
            id: 'ci-2',
            typeId: 'type-1',
            name: 'Server 2',
            ciCode: 'invalid code',
            status: 'active',
            environment: 'prod'
        })).toThrow()
    })

    it('creates attribute values', () => {
        const attr = new CiAttrValue({
            id: 'attr-1',
            ciId: 'ci-1',
            versionId: 'v1',
            key: 'ipAddress',
            value: '10.0.0.1'
        })
        expect(attr.key).toBe('ipAddress')
    })
})
