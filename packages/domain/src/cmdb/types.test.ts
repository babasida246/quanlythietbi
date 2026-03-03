import { describe, it, expect } from 'vitest'
import {
    CiStatusValues,
    EnvironmentValues,
    CmdbFieldTypeValues,
    assertStatus,
    assertEnvironment
} from './types.js'

describe('cmdb types', () => {
    it('exposes expected status values', () => {
        expect(CiStatusValues).toContain('active')
        expect(EnvironmentValues).toContain('prod')
    })

    it('exposes field types', () => {
        expect(CmdbFieldTypeValues).toContain('ip')
        expect(CmdbFieldTypeValues).toContain('multi_enum')
    })

    it('validates status and environment', () => {
        expect(assertStatus('active')).toBe('active')
        expect(() => assertStatus('wrong')).toThrow()
        expect(assertEnvironment('uat')).toBe('uat')
    })
})
