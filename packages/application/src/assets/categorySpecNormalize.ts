import type { CategorySpecDefRecord } from '@qltb/contracts'

export function normalizeSpecValues(
    defs: CategorySpecDefRecord[],
    spec: Record<string, unknown>
): Record<string, unknown> {
    if (defs.length === 0) return spec
    const next = { ...spec }
    for (const def of defs) {
        const mode = def.normalize
        if (!mode) continue
        const value = next[def.key]
        if (typeof value === 'string') {
            next[def.key] = normalizeString(value, mode)
            continue
        }
        if (Array.isArray(value)) {
            next[def.key] = value.map((item) =>
                typeof item === 'string' ? normalizeString(item, mode) : item
            )
        }
    }
    return next
}

function normalizeString(value: string, mode: string): string {
    const trimmed = value.trim()
    if (mode === 'upper') return trimmed.toUpperCase()
    if (mode === 'lower') return trimmed.toLowerCase()
    return trimmed
}
