import { describe, it, expect } from 'vitest'
import { matchCategoryTemplate } from './categorySpecTemplates.js'

describe('category spec templates', () => {
    it('matches RAM template', () => {
        const defs = matchCategoryTemplate('RAM')
        expect(defs?.some(def => def.key === 'memorySizeGb')).toBe(true)
    })

    it('returns null for unknown category', () => {
        expect(matchCategoryTemplate('Unknown')).toBeNull()
    })
})
