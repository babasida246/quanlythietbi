import { describe, it, expect } from 'vitest'
import { categoryCreateSchema, modelCreateSchema } from './catalogs.schemas.js'

describe('catalogs schemas', () => {
    it('accepts valid category input', () => {
        const result = categoryCreateSchema.parse({ name: 'Laptop' })
        expect(result.name).toBe('Laptop')
    })

    it('rejects empty model name', () => {
        expect(() => modelCreateSchema.parse({ model: '' })).toThrow()
    })
})
