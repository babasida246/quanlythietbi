import { describe, it, expect } from 'vitest'
import AppError from './AppError.js'

describe('AppError', () => {
    it('creates error with code and message', () => {
        const error = new AppError('TEST_ERROR', 'Test message')
        expect(error.code).toBe('TEST_ERROR')
        expect(error.message).toBe('Test message')
        expect(error.httpStatus).toBe(500)
    })

    it('creates badRequest error', () => {
        const error = AppError.badRequest('Invalid input')
        expect(error.code).toBe('BAD_REQUEST')
        expect(error.httpStatus).toBe(400)
    })

    it('includes correlationId', () => {
        const error = new AppError('TEST', 'Test', {}, 'corr-123')
        expect(error.correlationId).toBe('corr-123')
    })

    it('serializes to JSON', () => {
        const error = AppError.notFound('Resource not found')
        const json = error.toJSON()
        expect(json).toHaveProperty('code')
        expect(json).toHaveProperty('message')
    })
})
