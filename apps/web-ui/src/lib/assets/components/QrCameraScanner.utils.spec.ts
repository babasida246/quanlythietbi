import { describe, it, expect } from 'vitest'
import { buildCameraConstraintCandidates, isLikelyMobile, resolveScannedCode, resolveScannedPayload } from './QrCameraScanner.utils'

describe('QrCameraScanner utils', () => {
    it('extracts last path segment from URL QR payload', () => {
        const code = resolveScannedCode('https://example.com/assets/ASSET-001')
        expect(code).toBe('ASSET-001')
    })

    it('parses assetCode and assetId from URL payload', () => {
        const payload = resolveScannedPayload('https://qltb.local/assets/ASSET-001?assetId=11111111-1111-4111-8111-111111111111')
        expect(payload.assetCode).toBe('ASSET-001')
        expect(payload.assetId).toBe('11111111-1111-4111-8111-111111111111')
        expect(payload.resolved).toBe('ASSET-001')
    })

    it('parses pipe payload containing assetCode and assetId', () => {
        const payload = resolveScannedPayload('ASSET-002|22222222-2222-4222-8222-222222222222')
        expect(payload.assetCode).toBe('ASSET-002')
        expect(payload.assetId).toBe('22222222-2222-4222-8222-222222222222')
        expect(payload.resolved).toBe('ASSET-002')
    })

    it('returns trimmed raw payload for non-URL codes', () => {
        const code = resolveScannedCode('  ASSET-XYZ  ')
        expect(code).toBe('ASSET-XYZ')
    })

    it('detects mobile user agents', () => {
        expect(isLikelyMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
        expect(isLikelyMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true)
        expect(isLikelyMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
    })

    it('builds environment-first camera constraints', () => {
        const constraints = buildCameraConstraintCandidates('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
        expect(constraints).toHaveLength(3)
        expect(constraints[0]?.facingMode).toEqual({ exact: 'environment' })
        expect(constraints[1]?.facingMode).toEqual({ ideal: 'environment' })
    })
})