import { describe, expect, it } from 'vitest'
import { getUserContext, requireRole } from './assets.helpers.js'

describe('assets.helpers', () => {
    it('prefers request.user and normalizes manager role alias', () => {
        const request = {
            id: 'req-1',
            headers: {},
            user: {
                id: 'user-1',
                role: 'manager'
            }
        } as any

        expect(getUserContext(request)).toMatchObject({
            userId: 'user-1',
            role: 'it_asset_manager'
        })

        expect(() => requireRole(request, ['it_asset_manager'])).not.toThrow()
    })

    it('throws when authenticated user context is missing', () => {
        const request = {
            id: 'req-2',
            headers: {}
        } as any

        expect(() => getUserContext(request)).toThrow(/authenticated user context/i)
    })
})
