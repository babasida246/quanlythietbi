/**
 * Utility Functions
 */

/**
 * Calculate pagination metadata
 */
export function calculatePagination(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit)
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    }
}

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit
}

/**
 * Sleep utility for testing/delays
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T
    } catch {
        return fallback
    }
}

/**
 * Omit keys from object
 */
export function omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj }
    keys.forEach(key => delete result[key])
    return result
}

/**
 * Pick keys from object
 */
export function pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key]
        }
    })
    return result
}

/**
 * Generate a slug from string
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
