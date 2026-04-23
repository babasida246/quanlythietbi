import { API_BASE, requireAccessToken } from './httpClient'
import type {
    LdapDirectoryConfigDto,
    LdapDirectoryConfigCreateInput,
    LdapDirectoryConfigPatch,
    LdapSyncResult,
    LdapTestResult,
    LdapOrgUnitDto,
} from '@qltb/contracts'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = requireAccessToken()
    const res = await fetch(`${API_BASE}/v1/admin/ldap${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...init?.headers,
        },
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? res.statusText)
    }
    const json = await res.json()
    return json.data as T
}

export async function listLdapConfigs(): Promise<LdapDirectoryConfigDto[]> {
    return apiFetch('/configs')
}

export async function getLdapConfig(id: string): Promise<LdapDirectoryConfigDto> {
    return apiFetch(`/configs/${id}`)
}

export async function createLdapConfig(input: LdapDirectoryConfigCreateInput): Promise<LdapDirectoryConfigDto> {
    return apiFetch('/configs', {
        method: 'POST',
        body: JSON.stringify(input),
    })
}

export async function updateLdapConfig(id: string, patch: LdapDirectoryConfigPatch): Promise<LdapDirectoryConfigDto> {
    return apiFetch(`/configs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    })
}

export async function deleteLdapConfig(id: string): Promise<void> {
    await apiFetch(`/configs/${id}`, { method: 'DELETE' })
}

export async function testLdapConnection(id: string): Promise<LdapTestResult> {
    return apiFetch(`/configs/${id}/test`, { method: 'POST' })
}

export async function syncLdapOrgUnits(id: string): Promise<LdapSyncResult> {
    return apiFetch(`/configs/${id}/sync`, { method: 'POST' })
}

export async function listLdapOrgUnits(): Promise<LdapOrgUnitDto[]> {
    return apiFetch('/org-units')
}
