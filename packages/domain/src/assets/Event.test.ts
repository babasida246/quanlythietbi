import { describe, it, expect } from 'vitest'
import { AssetEvent } from './Event.js'

describe('AssetEvent', () => {
    it('defaults payload to empty object', () => {
        const event = new AssetEvent({
            id: 'e1',
            assetId: 'asset-1',
            eventType: 'CREATED'
        })
        expect(event.payload).toEqual({})
    })
})
