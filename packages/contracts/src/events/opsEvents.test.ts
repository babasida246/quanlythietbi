import { describe, it, expect } from 'vitest'
import type { OpsEventInput } from './opsEvents.js'

describe('ops events contracts', () => {
    it('allows ops event input typing', () => {
        const input: OpsEventInput = {
            entityType: 'asset_category',
            entityId: 'cat-1',
            eventType: 'SPEC_VERSION_CREATED',
            payload: {}
        }
        expect(input.entityType).toBe('asset_category')
    })
})
