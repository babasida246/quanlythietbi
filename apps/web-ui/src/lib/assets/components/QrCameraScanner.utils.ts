export type ResolvedScanPayload = {
    raw: string
    resolved: string
    assetCode?: string
    assetId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function decodeSafe(value: string): string {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function normalizeUuid(value: string | null | undefined): string | undefined {
    const trimmed = (value ?? '').trim()
    return UUID_RE.test(trimmed) ? trimmed : undefined
}

function parsePipePayload(raw: string): ResolvedScanPayload {
    const parts = raw.split('|').map(part => part.trim()).filter(Boolean)
    const maybeCode = parts[0] ?? ''
    const maybeId = normalizeUuid(parts[1])
    return {
        raw,
        resolved: maybeCode || maybeId || raw,
        assetCode: maybeCode || undefined,
        assetId: maybeId
    }
}

export function resolveScannedPayload(rawCode: string): ResolvedScanPayload {
    const raw = rawCode.trim()
    if (!raw) {
        return { raw: '', resolved: '' }
    }

    if (raw.includes('|')) {
        return parsePipePayload(raw)
    }

    try {
        const url = new URL(raw)
        const parts = url.pathname.split('/').filter(Boolean)
        const assetCode = parts.length > 0 ? decodeSafe(parts[parts.length - 1] ?? '') : ''
        const assetId = normalizeUuid(url.searchParams.get('assetId') ?? url.searchParams.get('id'))
        return {
            raw,
            resolved: assetCode || assetId || raw,
            assetCode: assetCode || undefined,
            assetId
        }
    } catch {
        const maybeId = normalizeUuid(raw)
        return {
            raw,
            resolved: raw,
            assetCode: maybeId ? undefined : raw,
            assetId: maybeId
        }
    }
}

export function resolveScannedCode(rawCode: string): string {
    return resolveScannedPayload(rawCode).resolved
}

export function isLikelyMobile(userAgent?: string): boolean {
    const ua = (userAgent ?? '').toLowerCase()
    return /(android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini)/.test(ua)
}

export function buildCameraConstraintCandidates(userAgent?: string): MediaTrackConstraints[] {
    const mobile = isLikelyMobile(userAgent)
    const idealWidth = mobile ? 1280 : 640
    const idealHeight = mobile ? 720 : 480

    return [
        {
            facingMode: { exact: 'environment' },
            width: { ideal: idealWidth },
            height: { ideal: idealHeight }
        },
        {
            facingMode: { ideal: 'environment' },
            width: { ideal: idealWidth },
            height: { ideal: idealHeight }
        },
        {
            width: { ideal: idealWidth },
            height: { ideal: idealHeight }
        }
    ]
}