/**
 * i18n Helper Functions
 */
import { i18next } from '../config/i18n.js'
import type { FastifyRequest } from 'fastify'

/**
 * Get translation function for current request language
 */
export function getTranslator(request: FastifyRequest) {
    const language = request.language || 'en'
    return (key: string, options?: Record<string, any>) => {
        // Use only key for now - i18next.t expects just the key
        return i18next.t(key)
    }
}

/**
 * Translate key with request context
 */
export function t(request: FastifyRequest, key: string, options?: Record<string, any>): string {
    const language = request.language || 'en'
    // Use only key for now - i18next.t expects just the key
    return i18next.t(key)
}

/**
 * Get current language from request
 */
export function getLanguage(request: FastifyRequest): string {
    return request.language || 'en'
}
