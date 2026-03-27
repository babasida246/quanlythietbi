const API_BASE_FALLBACK = typeof window === 'undefined'
    ? 'http://localhost:3000/api'
    : '/api'

function isLocalHost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function shouldUseEnvApiBaseInBrowser(envApiBase: string): boolean {
    if (typeof window === 'undefined') return true

    const currentHost = window.location.hostname.toLowerCase()
    const envLower = envApiBase.toLowerCase()
    const envPointsToLocal = envLower.includes('localhost') || envLower.includes('127.0.0.1') || envLower.includes('[::1]')

    // On non-local domains, ignore env values that point back to localhost.
    if (!isLocalHost(currentHost) && envPointsToLocal) {
        return false
    }

    return true
}

// API base URL - includes /api prefix for versioned endpoints.
const ENV_API_BASE = import.meta.env?.VITE_API_BASE || import.meta.env?.BACKEND_BASE_URL
export const API_BASE = ENV_API_BASE && shouldUseEnvApiBaseInBrowser(ENV_API_BASE)
    ? ENV_API_BASE
    : API_BASE_FALLBACK

export type StoredUser = {
    email?: string | null
    role?: string | null
    name?: string | null
}

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
    if (typeof window === 'undefined') return { accessToken: null, refreshToken: null }
    return {
        accessToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
    }
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('authToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
}

export function setStoredUser(user: StoredUser): void {
    if (typeof window === 'undefined') return
    if (user.email) localStorage.setItem('userEmail', user.email)
    if (user.role) localStorage.setItem('userRole', user.role)
    if (user.name) localStorage.setItem('userName', user.name)
}

export function clearStoredSession(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userName')
    // Clear effective perms cache (sessionStorage)
    sessionStorage.removeItem('qltb_effective_perms_v1')
}

export function requireAccessToken(): string {
    const { accessToken } = getStoredTokens()
    if (!accessToken) {
        throw new Error('Authentication required')
    }
    return accessToken
}

let refreshingPromise: Promise<string | null> | null = null

function normalizePath(value: string): string {
    return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value
}

function isPublicAuthPath(pathname: string): boolean {
    const normalized = normalizePath(pathname)
    return normalized === '/login' || normalized === '/setup' || normalized === '/logout'
}

function buildSafeLoginRedirectTarget(pathname: string, search: string, hash: string): string | null {
    const normalizedPath = normalizePath(pathname)
    if (!normalizedPath.startsWith('/') || isPublicAuthPath(normalizedPath)) {
        return null
    }
    return `${normalizedPath}${search}${hash}`
}

function redirectToLoginOnUnauthorized(): void {
    if (typeof window === 'undefined') return

    const { pathname, search, hash } = window.location
    if (normalizePath(pathname) === '/login') return

    const target = buildSafeLoginRedirectTarget(pathname, search, hash)
    const destination = target
        ? `/login?redirect=${encodeURIComponent(target)}`
        : '/login'

    window.location.replace(destination)
}

export async function refreshAccessToken(fetchImpl: typeof fetch = fetch): Promise<string | null> {
    if (typeof window === 'undefined') return null
    const { refreshToken } = getStoredTokens()
    if (!refreshToken) return null

    if (!refreshingPromise) {
        refreshingPromise = (async () => {
            const response = await fetchImpl(`${API_BASE}/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            })

            if (!response.ok) {
                clearStoredSession()
                return null
            }

            const data = await response.json()
            // API returns {success: true, data: {accessToken, refreshToken}, meta: {...}}
            const tokens = data.data || data
            setStoredTokens(tokens.accessToken, tokens.refreshToken)
            return tokens.accessToken as string
        })()

        refreshingPromise.finally(() => {
            refreshingPromise = null
        })
    }

    return refreshingPromise
}

export async function authorizedFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers || {})
    const { accessToken } = getStoredTokens()
    const isRefreshCall = typeof input === 'string' && input.includes('/auth/refresh')

    if (accessToken && !headers.has('Authorization') && !init.credentials) {
        headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const doFetch = () => fetch(input, { ...init, headers })
    let response = await doFetch()

    if (response.status !== 401 || isRefreshCall) {
        return response
    }

    const newToken = await refreshAccessToken()
    if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        response = await doFetch()
    }

    if (response.status === 401 && accessToken && !isRefreshCall) {
        clearStoredSession()
        redirectToLoginOnUnauthorized()
    }

    return response
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await authorizedFetch(input, init)
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    const bodyText = await response.text()
    const trimmedBody = bodyText.trim()
    const isHtmlBody = contentType.includes('text/html') || trimmedBody.startsWith('<!doctype') || trimmedBody.startsWith('<html') || trimmedBody.startsWith('<')

    if (!response.ok) {
        let apiMessage: string | null = null
        if (contentType.includes('application/json')) {
            try {
                const payload = JSON.parse(bodyText) as { error?: { message?: string }; message?: string }
                apiMessage = payload?.error?.message ?? (typeof payload?.message === 'string' ? payload.message : null)
            } catch {
                // Fall through to raw body message below.
            }
        }
        if (apiMessage) {
            throw new Error(apiMessage)
        }
        if (isHtmlBody) {
            if (response.status === 503) {
                throw new Error(`Service temporarily unavailable (HTTP 503). Please try again shortly.`)
            }
            throw new Error(`Unexpected HTML error from API (HTTP ${response.status}). Check API/proxy health.`)
        }
        throw new Error(trimmedBody || `HTTP ${response.status}`)
    }

    if (!trimmedBody) {
        return undefined as T
    }

    if (!contentType.includes('application/json')) {
        const preview = trimmedBody.slice(0, 120)
        if (preview.startsWith('<')) {
            throw new Error(`Expected JSON but received HTML from ${input}. Check API_BASE/proxy configuration.`)
        }
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'} from ${input}.`)
    }

    try {
        return JSON.parse(bodyText) as T
    } catch {
        throw new Error(`Invalid JSON response from ${input}.`)
    }
}

type ApiEnvelope<T> = {
    data: T
    meta?: unknown
    success?: boolean
}

export function unwrapApiData<T>(payload: ApiEnvelope<T> | T): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data
    }
    return payload as T
}

export async function apiJsonData<T>(input: string, init?: RequestInit): Promise<T> {
    const payload = await apiJson<ApiEnvelope<T> | T>(input, init)
    return unwrapApiData(payload)
}

type CacheEntry = {
    expiresAt: number
    value: unknown
    isError: boolean
}

const inflightRequests = new Map<string, Promise<unknown>>()
const responseCache = new Map<string, CacheEntry>()

/**
 * Clears the in-memory GET cache used by apiJsonCached/apiJsonDataCached.
 *
 * This is primarily used by unit tests to ensure deterministic assertions on fetch calls.
 */
export function clearApiCache(): void {
    inflightRequests.clear()
    responseCache.clear()
}

function buildCacheKey(input: string, init?: RequestInit): string {
    const method = init?.method?.toUpperCase() ?? 'GET'
    return `${method}:${input}`
}

function readCache<T>(key: string): T | null {
    const cached = responseCache.get(key)
    if (!cached) return null
    if (cached.expiresAt <= Date.now()) {
        responseCache.delete(key)
        return null
    }
    if (cached.isError) {
        throw cached.value
    }
    return cached.value as T
}

export async function apiJsonCached<T>(
    input: string,
    init?: RequestInit,
    options?: { ttlMs?: number; errorTtlMs?: number }
): Promise<T> {
    const method = init?.method?.toUpperCase() ?? 'GET'
    if (method !== 'GET') {
        return apiJson<T>(input, init)
    }

    const key = buildCacheKey(input, init)
    const cached = readCache<T>(key)
    if (cached !== null) return cached

    const existing = inflightRequests.get(key)
    if (existing) return existing as Promise<T>

    const ttlMs = options?.ttlMs ?? 5000
    const errorTtlMs = options?.errorTtlMs ?? 2000

    const promise = apiJson<T>(input, init)
        .then((data) => {
            responseCache.set(key, {
                expiresAt: Date.now() + ttlMs,
                value: data,
                isError: false
            })
            return data
        })
        .catch((error) => {
            responseCache.set(key, {
                expiresAt: Date.now() + errorTtlMs,
                value: error,
                isError: true
            })
            throw error
        })
        .finally(() => {
            inflightRequests.delete(key)
        })

    inflightRequests.set(key, promise)
    return promise
}

export async function apiJsonDataCached<T>(
    input: string,
    init?: RequestInit,
    options?: { ttlMs?: number; errorTtlMs?: number }
): Promise<T> {
    const payload = await apiJsonCached<ApiEnvelope<T> | T>(input, init, options)
    return unwrapApiData(payload)
}
