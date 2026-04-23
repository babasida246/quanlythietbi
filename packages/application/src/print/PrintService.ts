import type { DocType, AutoMapFieldsResponse, PrintFieldMapping } from '@qltb/contracts'

/**
 * Print Service - Handles field auto-mapping and template rendering
 * Works with data already fetched from API (no async operations needed)
 */
export class PrintService {
    /**
     * Auto-detect and map fields based on data and template
     * Uses smart field matching: exact match → partial match → normalized match
     */
    autoMapFields(
        docType: DocType,
        sourceData: Record<string, unknown>,
        templateFieldNames: string[]
    ): AutoMapFieldsResponse {
        const mappings: Record<string, unknown> = {}
        const detectedFields: PrintFieldMapping[] = []

        // Flatten the source data for easier matching
        const flatData = this.flattenObject(sourceData)

        // Smart field matching
        let matchedCount = 0
        for (const fieldName of templateFieldNames) {
            let value = this.deepGet(flatData, fieldName)
            let matchType = 'exact'

            // Try partial match (last segment)
            if (value === undefined) {
                const lastPart = fieldName.split('.').pop()
                if (lastPart) {
                    value = this.deepGet(flatData, lastPart)
                    matchType = 'partial'
                }
            }

            // Try normalized match (snake_case → camelCase)
            if (value === undefined && fieldName.includes('_')) {
                const normalized = fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                value = this.deepGet(flatData, normalized)
                matchType = 'normalized'
            }

            // Try alias: template may use 'items' but data uses 'lines' (and vice versa)
            if (value === undefined) {
                const aliases: Array<[string, string]> = [['items', 'lines'], ['lines', 'items']]
                for (const [from, to] of aliases) {
                    if (fieldName.includes(`.${from}.`)) {
                        const aliased = fieldName.replace(`.${from}.`, `.${to}.`)
                        value = this.deepGet(flatData, aliased)
                        if (value === undefined) {
                            // also try without leading docType prefix (e.g. "lines.0.code")
                            const parts = aliased.split('.')
                            if (parts.length >= 3) {
                                value = this.deepGet(flatData, parts.slice(-3).join('.'))
                            }
                        }
                        if (value !== undefined) {
                            matchType = 'partial'
                            break
                        }
                    }
                }
            }

            if (value !== undefined) {
                mappings[fieldName] = value
                detectedFields.push({
                    fieldName,
                    dataPath: fieldName,
                    value,
                    format: this.inferFormat(fieldName, value),
                    matchType: matchType as 'exact' | 'partial' | 'normalized'
                })
                matchedCount++
            } else {
                mappings[fieldName] = null
            }
        }

        const confidence = templateFieldNames.length > 0 ? matchedCount / templateFieldNames.length : 0

        return {
            mappings,
            detectedFields,
            confidence
        }
    }

    /**
     * Render template HTML with actual field values
     */
    renderTemplate(
        htmlContent: string,
        fieldMappings: Record<string, unknown>
    ): string {
        let rendered = htmlContent

        // Replace all {{fieldName}} placeholders with actual values
        for (const [fieldName, value] of Object.entries(fieldMappings)) {
            const placeholder = new RegExp(`\\{\\{${fieldName}\\}\\}`, 'g')
            const format = this.inferFormat(fieldName, value)
            const formatted = this.formatValue(value, format)
            rendered = rendered.replace(placeholder, String(formatted ?? ''))
        }

        return rendered
    }

    // ─── Helper methods ─────────────────────────────────────────

    private flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        if (obj === null || obj === undefined) return result

        if (Array.isArray(obj)) {
            const arr = obj as unknown[]
            for (let i = 0; i < arr.length; i++) {
                const fullKey = prefix ? `${prefix}.${i}` : String(i)
                const item = arr[i]
                if (item === null || item === undefined) {
                    result[fullKey] = null
                } else if (typeof item === 'object') {
                    Object.assign(result, this.flattenObject(item, fullKey))
                } else {
                    result[fullKey] = item
                }
            }
            return result
        }

        if (typeof obj !== 'object') return result

        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const fullKey = prefix ? `${prefix}.${key}` : key
            if (value === null || value === undefined) {
                result[fullKey] = null
            } else if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                result[fullKey] = value
            } else if (value instanceof Date) {
                result[fullKey] = value.toISOString()
            } else if (typeof value === 'object') {
                Object.assign(result, this.flattenObject(value, fullKey))
            }
        }

        return result
    }

    private deepGet(obj: Record<string, unknown>, path: string): unknown {
        const parts = path.split('.')
        let current: unknown = obj

        for (const part of parts) {
            if (current === null || current === undefined) return undefined
            if (typeof current === 'object') {
                current = (current as Record<string, unknown>)[part]
            } else {
                return undefined
            }
        }

        return current
    }

    private inferFormat(
        fieldName: string,
        value: unknown
    ): 'date' | 'currency' | 'phone' | 'percent' | undefined {
        const lower = fieldName.toLowerCase()

        if (lower.includes('date') || lower.includes('at')) {
            return 'date'
        }
        if (
            lower.includes('price') ||
            lower.includes('cost') ||
            lower.includes('amount') ||
            lower.includes('value')
        ) {
            return 'currency'
        }
        if (lower.includes('phone') || lower.includes('mobile')) {
            return 'phone'
        }
        if (lower.includes('percent') || lower.includes('rate')) {
            return 'percent'
        }

        return undefined
    }

    private formatValue(value: unknown, format?: string): string {
        if (value === null || value === undefined) return ''

        if (format === 'date' && typeof value === 'string') {
            try {
                const date = new Date(value)
                return date.toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
            } catch {
                return String(value)
            }
        }

        if (format === 'currency' && typeof value === 'number') {
            return value.toLocaleString('vi-VN', {
                style: 'currency',
                currency: 'VND',
                minimumFractionDigits: 0
            })
        }

        if (format === 'phone' && typeof value === 'string') {
            return value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
        }

        if (format === 'percent' && typeof value === 'number') {
            return `${(value * 100).toFixed(2)}%`
        }

        return String(value)
    }
}
