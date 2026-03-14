import { writable, derived } from 'svelte/store'

export type OrgInfo = {
    name: string
    shortName: string
    address?: string
    phone?: string
    taxCode?: string
    website?: string
}

const DEFAULT_ORG: OrgInfo = {
    name: 'QLTB',
    shortName: 'QB',
}

function createOrgStore() {
    const { subscribe, set, update } = writable<OrgInfo>(DEFAULT_ORG)

    function loadFromStorage(): void {
        if (typeof localStorage === 'undefined') return
        const name = localStorage.getItem('orgName')
        const shortName = localStorage.getItem('orgShortName')
        if (name || shortName) {
            update((current) => ({
                ...current,
                name: name || current.name,
                shortName: shortName || current.shortName,
            }))
        }
    }

    function setOrg(info: OrgInfo): void {
        set(info)
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('orgName', info.name)
            localStorage.setItem('orgShortName', info.shortName)
        }
    }

    async function fetchAndSync(): Promise<void> {
        // Load from localStorage first for instant display
        loadFromStorage()
        // Then try to fetch from API for freshest data
        try {
            const SETUP_BASE = (import.meta.env.VITE_API_BASE ?? '/api') + '/setup'
            const response = await fetch(`${SETUP_BASE}/org`)
            if (!response.ok) return
            const json = await response.json()
            const data: OrgInfo | null = json?.data ?? null
            if (data && data.name) {
                setOrg(data)
            }
        } catch {
            // silently ignore — localStorage fallback is fine
        }
    }

    return {
        subscribe,
        loadFromStorage,
        setOrg,
        fetchAndSync,
    }
}

export const orgStore = createOrgStore()

/** Derived: 1–3 uppercase letters abbreviation for the logo */
export const orgLogoLetters = derived(orgStore, ($org) => {
    const s = $org.shortName?.trim()
    if (s) return s.slice(0, 3).toUpperCase()
    // Fallback: first letters of each word in name
    return $org.name
        .split(/\s+/)
        .slice(0, 3)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
})
