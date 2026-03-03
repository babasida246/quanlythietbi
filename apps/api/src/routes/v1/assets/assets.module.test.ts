import { describe, it, expect } from 'vitest'
import { registerAssetModule } from './assets.module.js'

describe('assets module', () => {
    it('exports register function', () => {
        expect(typeof registerAssetModule).toBe('function')
    })
})
