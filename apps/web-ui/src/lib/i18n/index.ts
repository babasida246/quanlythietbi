/**
 * i18n Configuration for SvelteKit
 */
import { register, init, getLocaleFromNavigator, locale, isLoading } from 'svelte-i18n'

// Register translations
register('en', () => import('./locales/en.json'))
register('vi', () => import('./locales/vi.json'))

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

// Export locale store and loading state for components to use
// Note: In components, use these as $_ and $isLoading (with $ prefix for auto-subscription)
export { locale, _, isLoading } from 'svelte-i18n'
