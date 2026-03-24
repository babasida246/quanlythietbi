/**
 * i18n Configuration for SvelteKit
 *
 * Locale files are split by domain for maintainability.
 * Each domain is registered separately so Vite can statically
 * analyze and code-split the imports at build time.
 *
 * File map (locales/vi/*.json  &  locales/en/*.json):
 *   common    — nav, common, auth, table, form, pagination, profile, me, notifications
 *   assets    — assets, maintenance, inventory, components, catalogs, specField
 *   cmdb      — cmdb
 *   warehouse — warehouse, wfRequest
 *   requests  — requests, inbox, workflow
 *   admin     — admin, adminRbac (includes PolicyLibrary i18n + resource names)
 *   help      — help
 *   analytics — analytics, reports
 *   modules   — tools, models, chat, stats, drivers, docs, qlts, themeCustomizer, themePresets, printCustomizer
 *   netops    — netops
 *   setup     — setup
 */
import { register, init, getLocaleFromNavigator, locale, isLoading } from 'svelte-i18n'

// ── Vietnamese ────────────────────────────────────────────────────────────────
register('vi', () => import('./locales/vi/common.json'))
register('vi', () => import('./locales/vi/assets.json'))
register('vi', () => import('./locales/vi/cmdb.json'))
register('vi', () => import('./locales/vi/warehouse.json'))
register('vi', () => import('./locales/vi/requests.json'))
register('vi', () => import('./locales/vi/admin.json'))
register('vi', () => import('./locales/vi/help.json'))
register('vi', () => import('./locales/vi/analytics.json'))
register('vi', () => import('./locales/vi/modules.json'))
register('vi', () => import('./locales/vi/netops.json'))
register('vi', () => import('./locales/vi/setup.json'))
register('vi', () => import('./locales/vi/depreciation.json'))

// ── English ───────────────────────────────────────────────────────────────────
register('en', () => import('./locales/en/common.json'))
register('en', () => import('./locales/en/assets.json'))
register('en', () => import('./locales/en/cmdb.json'))
register('en', () => import('./locales/en/warehouse.json'))
register('en', () => import('./locales/en/requests.json'))
register('en', () => import('./locales/en/admin.json'))
register('en', () => import('./locales/en/help.json'))
register('en', () => import('./locales/en/analytics.json'))
register('en', () => import('./locales/en/modules.json'))
register('en', () => import('./locales/en/netops.json'))
register('en', () => import('./locales/en/setup.json'))
register('en', () => import('./locales/en/depreciation.json'))

// ─────────────────────────────────────────────────────────────────────────────

const defaultLocale = 'en'
const initialLocale =
    typeof window !== 'undefined' ? getLocaleFromNavigator() || defaultLocale : defaultLocale

init({
    fallbackLocale: defaultLocale,
    initialLocale,
    handleMissingMessage: ({ id }) => {
        const key = String(id ?? '')
        const parts = key.split('.')
        const leaf = parts.length > 0 ? parts[parts.length - 1] ?? key : key
        const withSpaces = leaf
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .trim()
        return withSpaces.length > 0
            ? withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
            : 'N/A'
    }
})

locale.set(initialLocale)

export { locale, _, isLoading } from 'svelte-i18n'
