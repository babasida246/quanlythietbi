import { API_BASE, getStoredTokens } from './httpClient'
import type { ThemePresetId } from '$lib/stores/themePresets'
import type { ThemeCustomizerConfig } from '$lib/stores/themeCustomizer'

export interface UserThemeSettings {
    preset?: ThemePresetId
    customizer?: ThemeCustomizerConfig
}

export async function getUserThemeSettings(): Promise<UserThemeSettings | null> {
    const { accessToken } = getStoredTokens()
    if (!accessToken) return null
    try {
        const res = await fetch(`${API_BASE}/v1/user/me/settings`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!res.ok) return null
        const json = await res.json()
        return (json.data as UserThemeSettings) ?? null
    } catch {
        return null
    }
}

export async function putUserThemeSettings(data: UserThemeSettings): Promise<void> {
    const { accessToken } = getStoredTokens()
    if (!accessToken) return
    try {
        await fetch(`${API_BASE}/v1/user/me/settings`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
    } catch { /* ignore — local state is source of truth */ }
}
