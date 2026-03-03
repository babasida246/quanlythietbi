export const isBrowser = typeof window !== 'undefined'

export function readLocal<T>(key: string, fallback: T): T {
    if (!isBrowser) return fallback
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    try {
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

export function writeLocal<T>(key: string, value: T): void {
    if (!isBrowser) return
    window.localStorage.setItem(key, JSON.stringify(value))
}

export function updateLocal<T>(key: string, fallback: T, updater: (current: T) => T): T {
    const current = readLocal(key, fallback)
    const next = updater(current)
    writeLocal(key, next)
    return next
}
