import { browser } from '$app/environment'

export type HiddenSitesConfig = {
    hiddenHrefs?: string[]
}

let hiddenHrefsCache: string[] | null = null
let hiddenHrefsPromise: Promise<string[]> | null = null

export async function loadHiddenSiteHrefs(): Promise<string[]> {
    if (!browser) return []
    if (hiddenHrefsCache) return hiddenHrefsCache
    if (hiddenHrefsPromise) return hiddenHrefsPromise

    hiddenHrefsPromise = fetch('/local-ui-hidden-sites.json', { cache: 'no-store' })
        .then(async (response) => {
            if (!response.ok) return []
            const json = await response.json() as HiddenSitesConfig
            const hrefs = (json.hiddenHrefs ?? []).filter(Boolean)
            hiddenHrefsCache = hrefs
            return hrefs
        })
        .catch(() => [])
        .finally(() => {
            hiddenHrefsPromise = null
        })

    return hiddenHrefsPromise
}

export function isPathHidden(pathname: string, hiddenHrefs: string[]): boolean {
    return hiddenHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`))
}
