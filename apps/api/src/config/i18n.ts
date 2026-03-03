/**
 * i18n Configuration
 * Internationalization setup for API responses
 */
import i18next from 'i18next'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load translation files
const enTranslation = JSON.parse(
    readFileSync(resolve(__dirname, '../locales/en/translation.json'), 'utf-8')
)
const viTranslation = JSON.parse(
    readFileSync(resolve(__dirname, '../locales/vi/translation.json'), 'utf-8')
)

// Initialize i18next
export async function initI18n() {
    await i18next.init({
        lng: 'en', // Default language
        fallbackLng: 'en',
        supportedLngs: ['en', 'vi'],
        preload: ['en', 'vi'],
        resources: {
            en: {
                translation: enTranslation
            },
            vi: {
                translation: viTranslation
            }
        },
        interpolation: {
            escapeValue: false
        }
    })

    return i18next
}

export { i18next }
