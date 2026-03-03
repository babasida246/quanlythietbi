import { describe, it, expect } from 'vitest'
import { CmdbService, ServiceMember } from './Service.js'

describe('cmdb services', () => {
    it('creates a service', () => {
        const service = new CmdbService({ id: 'svc-1', code: 'PAY', name: 'Payments' })
        expect(service.name).toBe('Payments')
    })

    it('creates a service member', () => {
        const member = new ServiceMember({ id: 'mem-1', serviceId: 'svc-1', ciId: 'ci-1' })
        expect(member.serviceId).toBe('svc-1')
    })
})
