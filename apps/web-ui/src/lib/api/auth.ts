import { API_BASE, apiJsonData, authorizedFetch, clearStoredSession, setStoredTokens, setStoredUser, unwrapApiData } from './httpClient'
import { effectivePermsStore } from '$lib/stores/effectivePermsStore'

export interface AuthResponse {
    accessToken: string
    refreshToken?: string
    expiresIn: number
    user: {
        id: string
        email: string
        name: string
        role: string
    }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const result = await apiJsonData<AuthResponse>(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ email, password })
    })

    setStoredTokens(result.accessToken)
    setStoredUser({
        email: result.user.email,
        role: result.user.role,
        name: result.user.name
    })
    // Store userId separately (required for asset management API calls)
    if (typeof window !== 'undefined') {
        localStorage.setItem('userId', result.user.id)
    }
    // Clear stale effective perms cache — new session may have different role/permissions
    effectivePermsStore.clear()
    return result
}

export async function refresh(): Promise<AuthResponse> {
    const response = await authorizedFetch(`${API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({})
    })

    if (!response.ok) {
        clearStoredSession()
        throw new Error('Unable to refresh token')
    }

    const payload = await response.json()
    const data = unwrapApiData<AuthResponse>(payload as AuthResponse | { data: AuthResponse })
    setStoredTokens(data.accessToken)
    return data
}

export async function logout(): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({})
    })
    clearStoredSession()
    effectivePermsStore.clear()
}

export async function getCurrentUser() {
    return apiJsonData<{ id: string; email: string; name: string; role: string }>(`${API_BASE}/v1/auth/me`, {
        method: 'GET'
    })
}
